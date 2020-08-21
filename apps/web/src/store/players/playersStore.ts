import { observable, action, computed } from 'mobx';

import { EntitiesStore } from 'store';
import { countAllPLayers } from 'utils';

import { DEFAULT_STATE, PLAYERS_URL } from './constants';
import { IPlayerModel, PlayerFilterStatus } from './types';

class PlayersStore extends EntitiesStore<IPlayerModel, typeof PlayerFilterStatus> {
  constructor() {
    super(DEFAULT_STATE);
  }

  @observable eventId: string | null = null;

  @action setEventId(eventId: string): void {
    this.eventId = eventId;
  }

  @computed get allPlayers(): Record<string, boolean>[] {
    if (!this.entities) return [];

    return countAllPLayers(this.entities);
  }

  get entitiesUrl(): string {
    return `${PLAYERS_URL}/${this.eventId}`;
  }

  set entitiesUrl(value: string) {
    return;
  }

  getQueryParams(offset: number): Record<string, string> {
    return super.getQueryParams(offset);
  }
}

export default new PlayersStore();
