import type {
  CreateEventBody,
  UpdateEventBody,
} from '@football-planner/shared';

import { forbiddenError, notFoundError } from '../../lib/errors.js';
import type { TelegramNotifier } from '../../plugins/telegram_bot/index.js';
import { PlayerModel } from '../players/player.model.js';
import { isAdmin, type UserDocument } from '../users/user.model.js';
import { EventModel, toNotifyEvent } from './event.model.js';

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
    this.notifier.eventCreated(toNotifyEvent(event));

    return event;
  }

  async update(id: string, input: UpdateEventBody, user: UserDocument) {
    const event = await this.getManageable(id, user);
    const { location, ...fields } = input;
    event.set(fields);
    if (location === null) event.set('location', undefined);
    else if (location) event.set('location', location);
    return event.save();
  }

  async remove(id: string, user: UserDocument) {
    const event = await this.getManageable(id, user);
    await PlayerModel.deleteMany({ eventId: id });
    await event.deleteOne();
    return event;
  }

  private async getManageable(id: string, user: UserDocument) {
    const event = await this.get(id);
    if (event.creatorId !== user._id.toString() && !isAdmin(user)) {
      throw forbiddenError();
    }
    return event;
  }
}
