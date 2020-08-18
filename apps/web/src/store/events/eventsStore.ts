import { computed } from 'mobx';

import { EntitiesStore } from 'store';

import { DEFAULT_STATE } from './constants';
import { IEventModel, EventFilterStatus } from './types';

class EventsStore extends EntitiesStore<IEventModel, typeof EventFilterStatus> {
  constructor() {
    super(DEFAULT_STATE);
  }

  getQueryParams(offset: number): Record<string, string> {
    return super.getQueryParams(offset);
  }

  @computed get activeEvents(): IEventModel[] {
    const nowMonth = new Date().getMonth();
    const nowDay = new Date().getDate();
    const nowYear = new Date().getFullYear();

    return this.entities.filter(event => {
      return new Date(event.date) >= new Date(nowYear, nowMonth, nowDay);
    });
  }

  @computed get oldEvents(): IEventModel[] {
    const nowMonth = new Date().getMonth();
    const nowDay = new Date().getDate();
    const nowYear = new Date().getFullYear();

    return this.entities.filter(event => {
      return new Date(event.date) < new Date(nowYear, nowMonth, nowDay);
    });
  }
}

export default new EventsStore();
