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
import { EventModel } from './event.model.js';

const SCHEDULE_FIELDS = ['date', 'time', 'place'] as const;

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
