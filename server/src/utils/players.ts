import { PlayerEntity } from '../modules/players/player.model.js';

export const calcAllPlayers = (
  players: PlayerEntity[],
): { all: number; maybe: number; exactly: number } => {
  let count = 0;
  let maybe = 0;
  let exactly = 0;
  players.forEach((item) => {
    if (item.status) exactly++;
    else maybe++;

    item.friends.forEach((friend) => {
      if (friend.status) exactly++;
      else maybe++;
    });
    count += item.friends.length;
  });

  return { all: count + players.length, maybe, exactly };
};
