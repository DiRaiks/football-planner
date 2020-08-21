import { IFriendModel } from 'store';

export type TPlayerData = {
  name: string;
  friends: IFriendModel[];
  status: boolean;
};
