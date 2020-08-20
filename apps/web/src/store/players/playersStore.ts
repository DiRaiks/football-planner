import { observable, action } from 'mobx';

import { EntitiesStore } from 'store';

import { DEFAULT_STATE, PLAYERS_URL } from './constants';
import { IPlayerModel, PlayerFilterStatus } from './types';

class PlayersStore extends EntitiesStore<IPlayerModel, typeof PlayerFilterStatus> {
  constructor() {
    super(DEFAULT_STATE);
  }

  @observable eventId: string | null = '5f3c38d94798fb4015fd24a1';

  @action setEventId(eventId: string): void {
    this.eventId = eventId;
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
