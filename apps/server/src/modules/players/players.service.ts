import { and, asc, count, eq, sql } from 'drizzle-orm';
import type {
  Friend,
  SignUpBody,
  UpdatePlayerBody,
} from '@football-planner/shared';

import {
  events,
  players,
  type Db,
  type EventRecord,
  type Executor,
  type Tx,
} from '../../db/index.js';
import {
  AppError,
  forbiddenError,
  isDuplicateKeyError,
  notFoundError,
} from '../../lib/errors.js';
import { withEventLock, type AfterCommit } from '../../lib/event-lock.js';
import type { TelegramNotifier } from '../../plugins/telegram/index.js';
import { findEventById, toEventDto } from '../events/event.model.js';
import { isAdmin, type UserRecord } from '../users/user.model.js';
import { computeRoster, squadChanges, type RosterPerson } from './count.js';
import {
  toPlayerDto,
  type FriendEntity,
  type PlayerRecord,
} from './player.model.js';

export const MAX_FRIENDS = 20;

/** Players of an event in sign-up order */
export const playersInOrder = (q: Executor, eventId: string) =>
  q
    .select()
    .from(players)
    .where(eq(players.eventId, eventId))
    .orderBy(asc(players.createdAt), asc(players._id));

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
      ...(friend.status && {
        sureSince: keep ? old.sureSince : now.toISOString(),
      }),
    };
  });

export class PlayersService {
  constructor(
    private readonly db: Db,
    private readonly notifier: TelegramNotifier,
  ) {}

  /** The event's players with places and the waitlist */
  async roster(eventId: string, q: Executor = this.db) {
    const event = await findEventById(q, eventId);
    if (!event) throw notFoundError('event');
    const list = await playersInOrder(q, eventId);
    return { event, players: list, ...computeRoster(list, event.maximum) };
  }

  async findMine(eventId: string, user: UserRecord) {
    const { players: list, waitlisted } = await this.roster(eventId);
    const player = list.find((p) => p.userId === user._id);
    if (!player) throw notFoundError('player');
    return { player, waitlisted: waitlisted.has(player._id) };
  }

  async findByEventAndUser(eventId: string, userId: string) {
    const [player] = await this.db
      .select()
      .from(players)
      .where(and(eq(players.eventId, eventId), eq(players.userId, userId)));
    return player ?? null;
  }

  signUp(eventId: string, input: SignUpBody, user: UserRecord) {
    return withEventLock(this.db, eventId, async (tx, after) => {
      const before = await this.roster(eventId, tx);
      const now = new Date();

      let player: PlayerRecord;
      try {
        [player] = (await tx
          .insert(players)
          .values({
            name: input.name,
            status: input.status,
            friends: mergeFriends([], input.friends, now),
            sureSince: input.status ? now : null,
            eventId,
            userId: user._id,
            date: before.event.date,
          })
          .returning()) as [PlayerRecord];
      } catch (error) {
        // The unique (event_id, user_id) also covers concurrent sign-ups
        if (isDuplicateKeyError(error)) {
          throw new AppError(
            409,
            'PLAYER_EXISTS',
            'already signed up for this event',
          );
        }
        throw error;
      }

      const result = await this.syncEvent(tx, after, player, before.people);
      after(() =>
        this.notifier.playersChanged('added', player, player.eventId),
      );
      return result;
    });
  }

  async update(
    playerId: string,
    input: UpdatePlayerBody,
    user: UserRecord,
    eventId?: string,
  ) {
    const found = await this.getManageable(this.db, playerId, user, eventId);
    return withEventLock(this.db, found.eventId, async (tx, after) => {
      const before = await this.roster(found.eventId, tx);
      const current = await this.getManageable(tx, playerId, user, eventId);
      const now = new Date();
      const { friends, ...fields } = input;

      const changes: Partial<typeof players.$inferInsert> = { ...fields };
      if (input.status === false) changes.sureSince = null;
      // Becoming sure starts the turn for a place; staying sure keeps it
      else if (
        input.status === true &&
        !before.players.find((p) => p._id === current._id)?.status
      ) {
        changes.sureSince = now;
      }
      if (friends) {
        changes.friends = mergeFriends(current.friends, friends, now);
      }
      const [player] = (await tx
        .update(players)
        .set(changes)
        .where(eq(players._id, current._id))
        .returning()) as [PlayerRecord];

      const result = await this.syncEvent(tx, after, player, before.people);
      after(() =>
        this.notifier.playersChanged('updated', player, player.eventId),
      );
      return result;
    });
  }

  /**
   * Adds a guest atomically, for quick repeated presses of the bot's button. The guest
   * is as sure as the player who brings them.
   */
  addGuest(playerId: string, user: UserRecord, eventId: string) {
    return withEventLock(this.db, eventId, async (tx, after) => {
      const before = await this.roster(eventId, tx);
      const player = await this.getManageable(tx, playerId, user, eventId);
      const now = new Date();
      const guest: FriendEntity = {
        name: `Гость ${player.friends.length + 1}`,
        status: player.status,
        ...(player.status && { sureSince: now.toISOString() }),
      };
      const [pushed] = await tx
        .update(players)
        .set({
          friends: sql`${players.friends} || ${JSON.stringify([guest])}::jsonb`,
        })
        .where(
          and(
            eq(players._id, player._id),
            sql`jsonb_array_length(${players.friends}) < ${MAX_FRIENDS}`,
          ),
        )
        .returning();
      if (!pushed) {
        throw new AppError(409, 'TOO_MANY_FRIENDS', 'no more guests');
      }

      const result = await this.syncEvent(tx, after, pushed, before.people);
      after(() => this.notifier.playersChanged('updated', pushed, eventId));
      return { ...result, guest: guest.name };
    });
  }

  async remove(playerId: string, user: UserRecord, eventId?: string) {
    const found = await this.getManageable(this.db, playerId, user, eventId);
    return withEventLock(this.db, found.eventId, async (tx, after) => {
      const before = await this.roster(found.eventId, tx);
      const player = await this.getManageable(tx, playerId, user, eventId);
      await tx.delete(players).where(eq(players._id, player._id));

      const result = await this.syncEvent(tx, after, player, before.people);
      after(() =>
        this.notifier.playersChanged('removed', player, player.eventId),
      );
      return result;
    });
  }

  /**
   * Recounts a match after its players changed outside these methods (a merge of
   * accounts, a new limit of places) and announces who moved. `change` runs in the
   * same transaction, with the match locked.
   */
  resync(
    eventId: string,
    change: (tx: Tx) => Promise<void> = async () => undefined,
  ) {
    return withEventLock(this.db, eventId, async (tx, after) => {
      const before = await this.roster(eventId, tx).catch(() => null);
      await change(tx);
      if (!before) return;
      const now = await this.roster(eventId, tx);
      await this.saveCount(
        tx,
        now.event,
        now.count.all,
        before.people,
        now.people,
      );
      after(() => {
        this.announceMoves(eventId, before.people, now.people);
        this.notifier.eventUpdated(eventId, false);
      });
    });
  }

  /** Marks a player as paid for the pitch; the match's organiser and admins only */
  async setPaid(
    eventId: string,
    playerId: string,
    paid: boolean,
    user: UserRecord,
  ) {
    const event = await findEventById(this.db, eventId);
    if (!event) throw notFoundError('event');
    if (event.creatorId !== user._id && !isAdmin(user)) {
      throw forbiddenError();
    }
    const [player] = await this.db
      .update(players)
      .set({ paid })
      .where(and(eq(players._id, playerId), eq(players.eventId, eventId)))
      .returning();
    if (!player) throw notFoundError('player');
    const { waitlisted } = await this.roster(eventId);
    return { player, waitlisted: waitlisted.has(player._id) };
  }

  async countEventsOfUser(userId: string) {
    const [row] = await this.db
      .select({ n: count() })
      .from(players)
      .where(eq(players.userId, userId));
    return row?.n ?? 0;
  }

  private async getManageable(
    q: Executor,
    playerId: string,
    user: UserRecord,
    eventId?: string,
  ) {
    const [player] = await q
      .select()
      .from(players)
      .where(eq(players._id, playerId));
    if (!player || (eventId && player.eventId !== eventId))
      throw notFoundError('player');
    if (player.userId !== user._id && !isAdmin(user)) throw forbiddenError();
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

  /**
   * Saves the number of people, and drops teams split from the old squad: once someone
   * leaves or gets a place, they go. Writes only when something changed.
   */
  private async saveCount(
    tx: Tx,
    event: EventRecord,
    all: number,
    before: RosterPerson[],
    after: RosterPerson[],
  ) {
    const staleTeams =
      event.teams !== null && squadKeys(before) !== squadKeys(after);
    if (event.playersAmount === all && !staleTeams) return event;
    const [saved] = await tx
      .update(events)
      .set({ playersAmount: all, ...(staleTeams && { teams: null }) })
      .where(eq(events._id, event._id))
      .returning();
    return saved ?? event;
  }

  /** Recalculates the event after its players list changed and announces who moved */
  private async syncEvent(
    tx: Tx,
    after: AfterCommit,
    player: PlayerRecord,
    before: RosterPerson[],
  ) {
    const list = await playersInOrder(tx, player.eventId);
    const current = await findEventById(tx, player.eventId);
    if (!current) throw notFoundError('event');
    const { count, waitlisted, people } = computeRoster(list, current.maximum);
    const event = await this.saveCount(tx, current, count.all, before, people);
    after(() => this.announceMoves(player.eventId, before, people));

    return { player, players: list, event, count, waitlisted };
  }
}

const squadKeys = (people: RosterPerson[]) =>
  people
    .filter((person) => person.place === 'squad')
    .map((person) => person.key)
    .sort()
    .join();

type PlayersChangeResult = Awaited<ReturnType<PlayersService['signUp']>>;

export const toPlayersChangeDto = ({
  player,
  players: list,
  event,
  count,
  waitlisted,
}: PlayersChangeResult) => ({
  player: toPlayerDto(player, waitlisted.has(player._id)),
  players: list.map((p) => toPlayerDto(p, waitlisted.has(p._id))),
  event: toEventDto(event),
  count,
});
