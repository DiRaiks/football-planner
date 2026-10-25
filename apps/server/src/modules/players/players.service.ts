import type { SignUpBody, UpdatePlayerBody } from '@football-planner/shared';

import {
  AppError,
  forbiddenError,
  isDuplicateKeyError,
  notFoundError,
} from '../../lib/errors.js';
import type { TelegramNotifier } from '../../plugins/telegram/index.js';
import { EventModel, toEventDto } from '../events/event.model.js';
import { isAdmin, type UserDocument } from '../users/user.model.js';
import { countPlayers } from './count.js';
import {
  PlayerModel,
  toPlayerDto,
  type PlayerDocument,
} from './player.model.js';

export class PlayersService {
  constructor(private readonly notifier: TelegramNotifier) {}

  listByEvent(eventId: string) {
    return PlayerModel.find({ eventId });
  }

  /** Same as listByEvent, but 404 when the event does not exist */
  async listByExistingEvent(eventId: string) {
    await this.assertEventExists(eventId);
    return this.listByEvent(eventId);
  }

  async findMine(eventId: string, user: UserDocument) {
    await this.assertEventExists(eventId);
    const player = await this.findByEventAndUser(eventId, user._id.toString());
    if (!player) throw notFoundError('player');
    return player;
  }

  private async assertEventExists(eventId: string) {
    if (!(await EventModel.exists({ _id: eventId })))
      throw notFoundError('event');
  }

  findByEventAndUser(eventId: string, userId: string) {
    return PlayerModel.findOne({ eventId, userId });
  }

  async signUp(eventId: string, input: SignUpBody, user: UserDocument) {
    const event = await EventModel.findById(eventId);
    if (!event) throw notFoundError('event');

    let player: PlayerDocument;
    try {
      player = await PlayerModel.create({
        ...input,
        eventId,
        userId: user._id.toString(),
        date: event.date,
      });
    } catch (error) {
      // The unique (eventId, userId) index also covers concurrent sign-ups
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          409,
          'PLAYER_EXISTS',
          'already signed up for this event',
        );
      }
      throw error;
    }

    const result = await this.syncEvent(player).catch(
      async (error: unknown) => {
        // The event was deleted while signing up: do not leave an orphaned player
        await player.deleteOne();
        throw error;
      },
    );
    this.notifier.playersChanged('added', player.toObject(), player.eventId);
    return result;
  }

  async update(
    playerId: string,
    input: UpdatePlayerBody,
    user: UserDocument,
    eventId?: string,
  ) {
    const player = await this.getManageable(playerId, user, eventId);
    player.set(input);
    await player.save();

    const result = await this.syncEvent(player);
    this.notifier.playersChanged('updated', player.toObject(), player.eventId);
    return result;
  }

  async remove(playerId: string, user: UserDocument, eventId?: string) {
    const player = await this.getManageable(playerId, user, eventId);
    await player.deleteOne();

    const result = await this.syncEvent(player);
    this.notifier.playersChanged('removed', player.toObject(), player.eventId);
    return result;
  }

  async countEventsOfUser(userId: string) {
    return PlayerModel.countDocuments({ userId });
  }

  private async getManageable(
    playerId: string,
    user: UserDocument,
    eventId?: string,
  ) {
    const player = await PlayerModel.findById(playerId);
    if (!player || (eventId && player.eventId !== eventId))
      throw notFoundError('player');
    if (player.userId !== user._id.toString() && !isAdmin(user))
      throw forbiddenError();
    return player;
  }

  /** Recalculates the event's players amount after its players list changed */
  private async syncEvent(player: PlayerDocument) {
    const players = await PlayerModel.find({ eventId: player.eventId });
    const count = countPlayers(players);
    const event = await EventModel.findByIdAndUpdate(
      player.eventId,
      { playersAmount: count.all },
      { returnDocument: 'after' },
    );
    if (!event) throw notFoundError('event');

    return { player, players, event, count };
  }
}

type PlayersChangeResult = Awaited<ReturnType<PlayersService['signUp']>>;

export const toPlayersChangeDto = ({
  player,
  players,
  event,
  count,
}: PlayersChangeResult) => ({
  player: toPlayerDto(player),
  players: players.map(toPlayerDto),
  event: toEventDto(event),
  count,
});
