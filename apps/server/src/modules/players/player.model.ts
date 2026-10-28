import type { Player } from '@football-planner/shared';

import type { PlayerRecord } from '../../db/index.js';

export type { FriendEntity, PlayerRecord } from '../../db/index.js';

/** A player row, with the photo of their account where the query joined it */
export type PlayerWithPhoto = PlayerRecord & { photoUrl?: string | null };

export const toPlayerDto = (
  player: PlayerWithPhoto,
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
  ...(player.photoUrl && { photoUrl: player.photoUrl }),
});
