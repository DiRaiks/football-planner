import { IPlayerModel } from 'store';
import sortBy from 'lodash/sortBy';

export const countAllPLayers = (players: IPlayerModel[]): Record<string, boolean>[] => {
  let allPlayersArray: Record<string, boolean>[] = [];

  for (const value of players) {
    allPlayersArray.push({ status: value.status });
    if (value.friends.length) {
      const friendsArray = value.friends.map(({ status }) => {
        return { status };
      });
      allPlayersArray = allPlayersArray.concat(friendsArray);
    }
  }

  return sortBy(allPlayersArray, (item: Record<string, boolean>) => {
    return !item.status;
  });
};
