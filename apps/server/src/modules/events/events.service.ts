import { randomInt } from 'node:crypto';
import type {
  CreateEventBody,
  UpdateEventBody,
} from '@football-planner/shared';

import { AppError, forbiddenError, notFoundError } from '../../lib/errors.js';
import { withEventLock } from '../../lib/event-lock.js';
import { zonedToInstant } from '../../lib/time.js';
import { computeRoster, squadChanges } from '../players/count.js';
import type { TelegramNotifier } from '../../plugins/telegram/index.js';
import { PlayerModel } from '../players/player.model.js';
import { isAdmin, type UserDocument } from '../users/user.model.js';
import { EventModel, type EventDocument } from './event.model.js';

const WEEK_MS = 7 * 86_400_000;
/** Weeks a series may skip at once; beyond that it stops */
const MAX_CATCH_UP_WEEKS = 520;
const DUPLICATE_KEY = 11000;

const SCHEDULE_FIELDS = ['date', 'time', 'place'] as const;

/** The calendar day `days` after a YYYY-MM-DD day */
const addDays = (date: string, days: number) => {
  const [year, month, day] = date.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
};

/** Fisher-Yates with a cryptographic source: nobody can predict or tilt the teams */
const shuffle = <T>(items: T[]) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
};

/** A limit of places below the minimum could never be met */
const assertPlaces = (minimum: number, maximum: number) => {
  if (maximum > 0 && maximum < minimum) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'maximum must not be below minimum',
    );
  }
};

export class EventsService {
  constructor(
    private readonly notifier: TelegramNotifier,
    private readonly timeZone: string,
  ) {}

  list() {
    return EventModel.find().sort({ startsAt: 1, date: 1, time: 1 });
  }

  private startsAt(date: string, time: string) {
    const instant = zonedToInstant(date, time, this.timeZone);
    if (!instant) {
      throw new AppError(400, 'VALIDATION_ERROR', 'invalid date or time');
    }
    return instant;
  }

  async get(id: string) {
    const event = await EventModel.findById(id);
    if (!event) throw notFoundError('event');
    return event;
  }

  async create(input: CreateEventBody, user: UserDocument) {
    assertPlaces(input.minimum, input.maximum ?? 0);
    const event = await EventModel.create({
      ...input,
      startsAt: this.startsAt(input.date, input.time),
      playersAmount: 0,
      creatorId: user._id.toString(),
    });
    this.notifier.eventCreated(event._id.toString());

    return event;
  }

  async update(id: string, input: UpdateEventBody, user: UserDocument) {
    await this.getManageable(id, user);
    // A new limit of places moves people between the squad and the waitlist
    return withEventLock(id, () => this.applyUpdate(id, input, user));
  }

  private async applyUpdate(
    id: string,
    input: UpdateEventBody,
    user: UserDocument,
  ) {
    const event = await this.getManageable(id, user);
    const players = await PlayerModel.find({ eventId: id }).sort({
      createdAt: 1,
      _id: 1,
    });
    const before = computeRoster(players, event.maximum ?? 0).people;
    const { location, ...fields } = input;
    const scheduleChanged = SCHEDULE_FIELDS.some(
      (field) => fields[field] !== undefined && fields[field] !== event[field],
    );

    assertPlaces(
      fields.minimum ?? event.minimum,
      fields.maximum ?? event.maximum ?? 0,
    );
    event.set(fields);
    if (fields.date !== undefined || fields.time !== undefined) {
      event.set('startsAt', this.startsAt(event.date, event.time));
    }
    if (location === null) event.set('location', undefined);
    else if (location) event.set('location', location);
    await event.save();

    const { promoted, demoted } = squadChanges(
      before,
      computeRoster(players, event.maximum ?? 0).people,
    );
    if (promoted.length || demoted.length) {
      this.notifier.squadChanged(id, { promoted, demoted });
    }
    this.notifier.eventUpdated(id, scheduleChanged);
    return event;
  }

  /**
   * Weekly series: once a match has started, the next one appears a week later at the
   * same time and place, with the same settings, and is announced like any new match.
   * Each match makes its successor once, also across restarts and instances.
   */
  async createDueRepeats(now = new Date()) {
    const due = await EventModel.find({
      repeat: 'weekly',
      // Only ever set to true; $exists matches the partial index
      nextCreated: { $exists: false },
      startsAt: { $lte: now },
    });
    const created = [];
    const errors: unknown[] = [];
    for (const event of due) {
      try {
        const next = await this.createNext(event, now);
        if (next) created.push(next);
      } catch (error) {
        // One broken match must not hold up the others
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'weekly matches failed');
    return created;
  }

  /**
   * The next match of a weekly series: the first week still ahead, so a series that
   * missed weeks (downtime, a match moved into the past) catches up in one step. The
   * unique `repeatOf` makes creation the claim: a crash before `nextCreated` is set
   * only means the next run finds the match made and marks the series done.
   */
  private async createNext(event: EventDocument, now: Date) {
    let date = event.date;
    let startsAt = event.startsAt!;
    for (let week = 0; week < MAX_CATCH_UP_WEEKS && startsAt <= now; week++) {
      const previous = startsAt;
      date = addDays(date, 7);
      // A time that does not exist that day (a DST gap): a week to the hour instead
      startsAt =
        zonedToInstant(date, event.time, this.timeZone) ??
        new Date(previous.getTime() + WEEK_MS);
    }

    let next: EventDocument | null = null;
    if (startsAt > now) {
      try {
        next = await EventModel.create({
          eventName: event.eventName,
          place: event.place,
          date,
          time: event.time,
          startsAt,
          minimum: event.minimum,
          maximum: event.maximum ?? 0,
          price: event.price ?? 0,
          repeat: 'weekly',
          repeatOf: event._id.toString(),
          ...(event.location && { location: event.location }),
          creatorId: event.creatorId,
          playersAmount: 0,
        });
      } catch (error) {
        if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
      }
    }
    await EventModel.updateOne(
      { _id: event._id },
      { $set: { nextCreated: true } },
    );
    if (next) this.notifier.eventCreated(next._id.toString());
    return next;
  }

  /**
   * Splits the squad into teams at random, evenly, and announces them. Friends play too;
   * people on the waitlist or "maybe" do not.
   */
  async splitTeams(id: string, user: UserDocument, count = 2) {
    await this.getManageable(id, user);
    // The same lock as sign-ups: the squad must not change while it is split
    return withEventLock(id, () => this.splitLocked(id, user, count));
  }

  private async splitLocked(id: string, user: UserDocument, count: number) {
    const event = await this.getManageable(id, user);
    const players = await PlayerModel.find({ eventId: id }).sort({
      createdAt: 1,
      _id: 1,
    });
    const squad = computeRoster(players, event.maximum ?? 0).people.filter(
      (person) => person.place === 'squad',
    );
    if (squad.length < count) {
      throw new AppError(
        409,
        'NOT_ENOUGH_PLAYERS',
        'not enough sure players for teams',
      );
    }

    const names = shuffle(
      squad.map((p) => (p.from ? `${p.name} (от ${p.from})` : p.name)),
    );
    const teams = Array.from({ length: count }, (_, team) =>
      names.filter((_, index) => index % count === team),
    );
    event.teams = teams;
    await event.save();
    this.notifier.teamsSplit(id);
    return event;
  }

  async remove(id: string, user: UserDocument) {
    const event = await this.getManageable(id, user);
    await PlayerModel.deleteMany({ eventId: id });
    // The deleted document, not the one loaded above: Telegram message ids may
    // have been saved in between, and the cancellation needs them
    const deleted = await EventModel.findOneAndDelete({ _id: id });

    if (deleted) {
      this.notifier.eventCancelled({ ...deleted.toObject(), _id: id });
    }
    return deleted ?? event;
  }

  private async getManageable(id: string, user: UserDocument) {
    const event = await this.get(id);
    if (event.creatorId !== user._id.toString() && !isAdmin(user)) {
      throw forbiddenError();
    }
    return event;
  }
}
