import type { PlayerEntity } from './player.model.js';

/** Counts players including their friends; `exactly` and `maybe` split them by status */
export const countPlayers = (
  players: Pick<PlayerEntity, 'status' | 'friends'>[],
) => {
  let exactly = 0;
  let maybe = 0;

  for (const person of players.flatMap((player) => [
    player,
    ...player.friends,
  ])) {
    if (person.status) exactly++;
    else maybe++;
  }

  return { all: exactly + maybe, exactly, maybe };
};
