import { IEntitiesColumnsState } from 'store/entities';

export interface IEventsStore extends IEntitiesColumnsState<TEventsColumn> {}
export type TEventsColumn = keyof IEventModel;

export interface IEventModel {
  _id: string;
  id: string;
  place: string;
  time: string;
  date: string;
  minimum: number;
  playersAmount: number;
  eventName: string;
  creatorId?: string;
}

export enum EventFilterStatus {
  all = 'all',
}

export type TEventData = {
  time: string;
  place: string;
  date: string;
  minimum: string;
  eventName: string;
  playersAmount?: string;
};
