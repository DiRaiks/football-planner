import type {
  Friend,
  SignUpBody,
  UpdatePlayerBody,
} from '@football-planner/shared';

import {
  AppError,
  forbiddenError,
  isDuplicateKeyError,
  notFoundError,
} from '../../lib/errors.js';
import { withEventLock } from '../../lib/event-lock.js';
import type { TelegramNotifier } from '../../plugins/telegram/index.js';
import { EventModel, toEventDto } from '../events/event.model.js';
import { isAdmin, type UserDocument } from '../users/user.model.js';
import { computeRoster, squadChanges, type RosterPerson } from './count.js';
import {
  PlayerModel,
  toPlayerDto,
  type FriendEntity,
  type PlayerDocument,
} from './player.model.js';

export const MAX_FRIENDS = 20;

/** Players of an event in sign-up order */
const playersInOrder = (eventId: string) =>
  PlayerModel.find({ eventId }).sort({ createdAt: 1, _id: 1 });

const sureSince = (sure: boolean, now: Date) => (sure ? now : undefined);

/**
 * New friends list from the client, keeping the time each friend became sure: the same
 * friend (same position and name) who stays sure keeps their turn for a place
 */
const mergeFriends = (
  current: FriendEntity[],
  next: Friend[],
  now: Date,
): FriendEntity[] =>
  next.map((friend, index) => {
    const old = current[index];
    const keep =
      friend.status && old?.status && old.name === friend.name && old.sureSince;
    return {
      name: friend.name,
      status: friend.status,
      ...(friend.status && { sureSince: keep ? old.sureSince : now }),
    };
  });

export class PlayersService {
  constructor(private readonly notifier: TelegramNotifier) {}

  /** The event's players with places and the waitlist */
  async roster(eventId: string) {
    const event = await EventModel.findById(eventId);
    if (!event) throw notFoundError('event');
    const players = await playersInOrder(eventId);
    return { event, players, ...computeRoster(players, event.maximum ?? 0) };
  }

  async findMine(eventId: string, user: UserDocument) {
    const { players, waitlisted } = await this.roster(eventId);
    const player = players.find((p) => p.userId === user._id.toString());
    if (!player) throw notFoundError('player');
    return { player, waitlisted: waitlisted.has(player._id.toString()) };
  }

  findByEventAndUser(eventId: string, userId: string) {
    return PlayerModel.findOne({ eventId, userId });
  }

  signUp(eventId: string, input: SignUpBody, user: UserDocument) {
    return withEventLock(eventId, async () => {
      const before = await this.roster(eventId);
      const now = new Date();

      let player: PlayerDocument;
      try {
        player = await PlayerModel.create({
          ...input,
          friends: mergeFriends([], input.friends, now),
          sureSince: sureSince(input.status, now),
          eventId,
          userId: user._id.toString(),
          date: before.event.date,
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

      const result = await this.syncEvent(player, before.people).catch(
        async (error: unknown) => {
          // The event was deleted while signing up: do not leave an orphaned player
          await player.deleteOne();
          throw error;
        },
      );
      this.notifier.playersChanged('added', player.toObject(), player.eventId);
      return result;
    });
  }

  async update(
    playerId: string,
    input: UpdatePlayerBody,
    user: UserDocument,
    eventId?: string,
  ) {
    const found = await this.getManageable(playerId, user, eventId);
    return withEventLock(found.eventId, async () => {
      const before = await this.roster(found.eventId);
      const player = await this.getManageable(playerId, user, eventId);
      const now = new Date();
      const { friends, ...fields } = input;

      player.set(fields);
      if (input.status === false) player.sureSince = undefined;
      // Becoming sure starts the turn for a place; staying sure keeps it
      else if (
        input.status === true &&
        !before.players.find((p) => p._id.equals(player._id))?.status
      ) {
        player.sureSince = now;
      }
      if (friends)
        player.friends = mergeFriends(player.friends, friends, now) as never;
      await player.save();

      const result = await this.syncEvent(player, before.people);
      this.notifier.playersChanged(
        'updated',
        player.toObject(),
        player.eventId,
      );
      return result;
    });
  }

  /**
   * Adds a guest atomically, for quick repeated presses of the bot's button. The guest
   * is as sure as the player who brings them.
   */
  addGuest(playerId: string, user: UserDocument, eventId: string) {
    return withEventLock(eventId, async () => {
      const before = await this.roster(eventId);
      const player = await this.getManageable(playerId, user, eventId);
      const now = new Date();
      const guest = {
        name: `Гость ${player.friends.length + 1}`,
        status: player.status,
        ...(player.status && { sureSince: now }),
      };
      const pushed = await PlayerModel.findOneAndUpdate(
        { _id: player._id, [`friends.${MAX_FRIENDS - 1}`]: { $exists: false } },
        { $push: { friends: guest } },
        { returnDocument: 'after' },
      );
      if (!pushed) {
        throw new AppError(409, 'TOO_MANY_FRIENDS', 'no more guests');
      }

      const result = await this.syncEvent(pushed, before.people);
      this.notifier.playersChanged('updated', pushed.toObject(), eventId);
      return { ...result, guest: guest.name };
    });
  }

  async remove(playerId: string, user: UserDocument, eventId?: string) {
    const found = await this.getManageable(playerId, user, eventId);
    return withEventLock(found.eventId, async () => {
      const before = await this.roster(found.eventId);
      const player = await this.getManageable(playerId, user, eventId);
      await player.deleteOne();

      const result = await this.syncEvent(player, before.people);
      this.notifier.playersChanged(
        'removed',
        player.toObject(),
        player.eventId,
      );
      return result;
    });
  }

  /**
   * Recounts a match after its players changed outside these methods (a merge of
   * accounts, a new limit of places) and announces who moved
   */
  resync(eventId: string, change: () => Promise<void> = async () => undefined) {
    return withEventLock(eventId, async () => {
      const before = await this.roster(eventId).catch(() => null);
      await change();
      if (!before) return;
      const after = await this.roster(eventId);
      after.event.playersAmount = after.count.all;
      await after.event.save();
      this.announceMoves(eventId, before.people, after.people);
      this.notifier.eventUpdated(eventId, false);
    });
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

  private announceMoves(
    eventId: string,
    before: RosterPerson[],
    after: RosterPerson[],
  ) {
    const { promoted, demoted } = squadChanges(before, after);
    if (promoted.length || demoted.length) {
      this.notifier.squadChanged(eventId, { promoted, demoted });
    }
  }

  /** Recalculates the event after its players list changed and announces who moved */
  private async syncEvent(player: PlayerDocument, before: RosterPerson[]) {
    const players = await playersInOrder(player.eventId);
    const event = await EventModel.findById(player.eventId);
    if (!event) throw notFoundError('event');
    const { count, waitlisted, people } = computeRoster(
      players,
      event.maximum ?? 0,
    );
    event.playersAmount = count.all;
    await event.save();
    this.announceMoves(player.eventId, before, people);

    return { player, players, event, count, waitlisted };
  }
}

type PlayersChangeResult = Awaited<ReturnType<PlayersService['signUp']>>;

export const toPlayersChangeDto = ({
  player,
  players,
  event,
  count,
  waitlisted,
}: PlayersChangeResult) => ({
  player: toPlayerDto(player, waitlisted.has(player._id.toString())),
  players: players.map((p) => toPlayerDto(p, waitlisted.has(p._id.toString()))),
  event: toEventDto(event),
  count,
});
