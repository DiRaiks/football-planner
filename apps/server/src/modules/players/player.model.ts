import type { Player } from '@football-planner/shared';

import type { PlayerRecord } from '../../db/index.js';

export type { FriendEntity, PlayerRecord } from '../../db/index.js';

export const toPlayerDto = (
  player: PlayerRecord,
  waitlisted = false,
): Player => ({
  _id: player._id,
  name: player.name,
  status: player.status,
  friends: player.friends.map(({ name, status }) => ({ name, status })),
  eventId: player.eventId,
  userId: player.userId,
  date: player.date,
  waitlisted,
  paid: player.paid,
});
