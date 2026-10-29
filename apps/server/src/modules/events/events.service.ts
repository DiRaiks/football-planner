import { randomInt } from 'node:crypto';
import type {
  CreateEventBody,
  UpdateEventBody,
} from '@football-planner/shared';

import { and, asc, desc, eq, gte, lte, not, sql } from 'drizzle-orm';

import {
  events,
  users,
  type Db,
  type EventRecord,
  type Executor,
} from '../../db/index.js';
import { AppError, forbiddenError, notFoundError } from '../../lib/errors.js';
import { withEventLock } from '../../lib/event-lock.js';
import { zonedToInstant } from '../../lib/time.js';
import { computeRoster, squadChanges } from '../players/count.js';
import { playersInOrder } from '../players/players.service.js';
import type { TelegramNotifier } from '../../plugins/telegram/index.js';
import { isAdmin, type UserRecord } from '../users/user.model.js';
import { findEventById } from './event.model.js';

const WEEK_MS = 7 * 86_400_000;
/** Weeks a series may skip at once; beyond that it stops */
const MAX_CATCH_UP_WEEKS = 520;

/** How far back places count for suggestions, and how many are suggested */
const PLACES_PERIOD_MS = 365 * 86_400_000;
const PLACES_LIMIT = 10;
const PLACES_MAX_EVENTS = 2000;

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
    private readonly db: Db,
    private readonly notifier: TelegramNotifier,
    private readonly timeZone: string,
  ) {}

  list() {
    // Events without a start time (none after the move from MongoDB) come first, as before
    return this.db
      .select()
      .from(events)
      .orderBy(
        sql`${events.startsAt} ASC NULLS FIRST`,
        asc(events.date),
        asc(events.time),
      );
  }

  /** Where to pay for a match: its organiser's payment details */
  async payment(id: string) {
    const [row] = await this.db
      .select({ details: users.paymentDetails })
      .from(events)
      .innerJoin(users, eq(users._id, events.creatorId))
      .where(eq(events._id, id));
    if (!row) throw notFoundError('event');
    return { details: row.details };
  }

  /**
   * Places of the past year's matches for the match form, the most played first. The
   * same place typed in another case is one place; the latest spelling and city win.
   */
  async places() {
    const rows = await this.db
      .select({ place: events.place, location: events.location })
      .from(events)
      .where(gte(events.startsAt, new Date(Date.now() - PLACES_PERIOD_MS)))
      .orderBy(desc(events.startsAt))
      .limit(PLACES_MAX_EVENTS);

    const found = new Map<
      string,
      { place: string; location: EventRecord['location']; count: number }
    >();
    for (const { place, location } of rows) {
      const key = place.trim().toLowerCase();
      const seen = found.get(key);
      if (seen) {
        seen.count += 1;
        seen.location ??= location;
      } else {
        found.set(key, { place: place.trim(), location, count: 1 });
      }
    }
    // Map order is the latest match first: a stable sort keeps it among equal counts
    return [...found.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, PLACES_LIMIT)
      .map(({ place, location }) => ({ place, location }));
  }

  private startsAt(date: string, time: string) {
    const instant = zonedToInstant(date, time, this.timeZone);
    if (!instant) {
      throw new AppError(400, 'VALIDATION_ERROR', 'invalid date or time');
    }
    return instant;
  }

  async get(id: string, q: Executor = this.db) {
    const event = await findEventById(q, id);
    if (!event) throw notFoundError('event');
    return event;
  }

  async create(input: CreateEventBody, user: UserRecord) {
    assertPlaces(input.minimum, input.maximum ?? 0);
    const [event] = (await this.db
      .insert(events)
      .values({
        eventName: input.eventName,
        place: input.place,
        date: input.date,
        time: input.time,
        startsAt: this.startsAt(input.date, input.time),
        minimum: input.minimum,
        maximum: input.maximum ?? 0,
        repeat: input.repeat ?? 'none',
        price: input.price ?? 0,
        priceMode: input.priceMode ?? 'person',
        location: input.location ?? null,
        playersAmount: 0,
        creatorId: user._id,
      })
      .returning()) as [EventRecord];
    this.notifier.eventCreated(event._id);

    return event;
  }

  async update(id: string, input: UpdateEventBody, user: UserRecord) {
    await this.getManageable(id, user);
    // A new limit of places moves people between the squad and the waitlist
    return withEventLock(this.db, id, async (tx, after) => {
      const event = await this.getManageable(id, user, tx);
      const players = await playersInOrder(tx, id);
      const before = computeRoster(players, event.maximum).people;
      const { location, ...fields } = input;
      const scheduleChanged = SCHEDULE_FIELDS.some(
        (field) =>
          fields[field] !== undefined && fields[field] !== event[field],
      );

      assertPlaces(
        fields.minimum ?? event.minimum,
        fields.maximum ?? event.maximum,
      );
      const date = fields.date ?? event.date;
      const time = fields.time ?? event.time;
      const [saved] = (await tx
        .update(events)
        .set({
          ...fields,
          ...((fields.date !== undefined || fields.time !== undefined) && {
            startsAt: this.startsAt(date, time),
          }),
          ...(location !== undefined && { location }),
        })
        .where(eq(events._id, id))
        .returning()) as [EventRecord];

      const { promoted, demoted } = squadChanges(
        before,
        computeRoster(players, saved.maximum).people,
      );
      after(() => {
        if (promoted.length || demoted.length) {
          this.notifier.squadChanged(id, { promoted, demoted });
        }
        this.notifier.eventUpdated(id, scheduleChanged);
      });
      return saved;
    });
  }

  /**
   * Weekly series: once a match has started, the next one appears a week later at the
   * same time and place, with the same settings, and is announced like any new match.
   * Each match makes its successor once, also across restarts and instances.
   */
  async createDueRepeats(now = new Date()) {
    const due = await this.db
      .select()
      .from(events)
      .where(
        and(
          eq(events.repeat, 'weekly'),
          not(events.nextCreated),
          lte(events.startsAt, now),
        ),
      );
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
   * unique `repeat_of` makes creation the claim, and marking the series done happens in
   * the same transaction: another instance creates nothing, and nothing is announced twice.
   */
  private async createNext(event: EventRecord, now: Date) {
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

    const next = await this.db.transaction(async (tx) => {
      const [created] =
        startsAt > now
          ? await tx
              .insert(events)
              .values({
                eventName: event.eventName,
                place: event.place,
                date,
                time: event.time,
                startsAt,
                minimum: event.minimum,
                maximum: event.maximum,
                price: event.price,
                priceMode: event.priceMode,
                repeat: 'weekly',
                repeatOf: event._id,
                location: event.location,
                creatorId: event.creatorId,
                playersAmount: 0,
              })
              .onConflictDoNothing({ target: events.repeatOf })
              .returning()
          : [];
      await tx
        .update(events)
        .set({ nextCreated: true })
        .where(eq(events._id, event._id));
      return created ?? null;
    });
    if (next) this.notifier.eventCreated(next._id);
    return next;
  }

  /**
   * Splits the squad into teams at random, evenly, and announces them. Friends play too;
   * people on the waitlist or "maybe" do not.
   */
  async splitTeams(id: string, user: UserRecord, count = 2) {
    await this.getManageable(id, user);
    // The same lock as sign-ups: the squad must not change while it is split
    return withEventLock(this.db, id, async (tx, after) => {
      const event = await this.getManageable(id, user, tx);
      const players = await playersInOrder(tx, id);
      const squad = computeRoster(players, event.maximum).people.filter(
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
      const [saved] = (await tx
        .update(events)
        .set({ teams })
        .where(eq(events._id, id))
        .returning()) as [EventRecord];
      after(() => this.notifier.teamsSplit(id));
      return saved;
    });
  }

  async remove(id: string, user: UserRecord) {
    const event = await this.getManageable(id, user);
    // Players go with the match (ON DELETE CASCADE). The deleted row, not the one
    // loaded above: Telegram message ids may have been saved in between, and the
    // cancellation needs them
    const [deleted] = await this.db
      .delete(events)
      .where(eq(events._id, id))
      .returning();

    if (deleted) this.notifier.eventCancelled(deleted);
    return deleted ?? event;
  }

  private async getManageable(
    id: string,
    user: UserRecord,
    q: Executor = this.db,
  ) {
    const event = await this.get(id, q);
    if (event.creatorId !== user._id && !isAdmin(user)) {
      throw forbiddenError();
    }
    return event;
  }
}
