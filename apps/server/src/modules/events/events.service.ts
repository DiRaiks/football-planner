import type {
  CreateEventBody,
  UpdateEventBody,
} from '@football-planner/shared';

import { forbiddenError, notFoundError } from '../../lib/errors.js';
import type { TelegramNotifier } from '../../plugins/telegram/index.js';
import { PlayerModel } from '../players/player.model.js';
import { isAdmin, type UserDocument } from '../users/user.model.js';
import { EventModel } from './event.model.js';

const SCHEDULE_FIELDS = ['date', 'time', 'place'] as const;

export class EventsService {
  constructor(private readonly notifier: TelegramNotifier) {}

  list() {
    return EventModel.find();
  }

  async get(id: string) {
    const event = await EventModel.findById(id);
    if (!event) throw notFoundError('event');
    return event;
  }

  async create(input: CreateEventBody, user: UserDocument) {
    const event = await EventModel.create({
      ...input,
      playersAmount: 0,
      creatorId: user._id.toString(),
    });
    this.notifier.eventCreated(event._id.toString());

    return event;
  }

  async update(id: string, input: UpdateEventBody, user: UserDocument) {
    const event = await this.getManageable(id, user);
    const { location, ...fields } = input;
    const scheduleChanged = SCHEDULE_FIELDS.some(
      (field) => fields[field] !== undefined && fields[field] !== event[field],
    );

    event.set(fields);
    if (location === null) event.set('location', undefined);
    else if (location) event.set('location', location);
    await event.save();

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
