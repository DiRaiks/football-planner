import { IEventsStore } from './types';

export const EVENTS_ROUTE_MATCH = '/events';
export const EVENTS_URL = '/events/all';

export const DEFAULT_STATE: IEventsStore = {
  urlMatch: EVENTS_ROUTE_MATCH,
  entitiesUrl: EVENTS_URL,
  entitiesField: 'events',
  sortColumn: 'eventName',
  columnsOrder: ['eventName', 'playersAmount', 'place', 'date'],
  columnsConfig: {},
  counters: {
    total: null,
    found: null,
  },
};
