import { IPlayersStore } from './types';

export const PLAYERS_ROUTE_MATCH = '/players';
export const PLAYERS_URL = '/players/byEventId';

export const DEFAULT_STATE: IPlayersStore = {
  urlMatch: PLAYERS_ROUTE_MATCH,
  entitiesUrl: PLAYERS_URL,
  entitiesField: 'events',
  sortColumn: 'name',
  columnsOrder: ['name', 'status', 'friends'],
  columnsConfig: {},
  counters: {
    total: null,
    found: null,
  },
};
