import { IEntitiesColumnsState } from 'store/entities';

export interface IPlayersStore extends IEntitiesColumnsState<TPlayersColumn> {}
export type TPlayersColumn = keyof IPlayerModel;
export type TPlayersColumnList = TPlayersColumn[];

export interface IPlayerModel {
  _id: string;
  id: string;
  friends: FriendItem[];
  name: string;
  date: string;
  status: boolean;
  eventId: string;
  userId: string;
}

export interface IFriendModel {
  name: string;
  status: boolean;
}

export enum PlayerFilterStatus {
  all = 'all',
}
