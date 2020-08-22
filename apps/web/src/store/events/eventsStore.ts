import { computed } from 'mobx';

import { EntitiesStore, Action } from 'store';

import { DEFAULT_STATE } from './constants';
import { IEventModel, EventFilterStatus, TEventData } from './types';

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

  createEventAction = new Action();
  deleteEventAction = new Action();

  async createEvent(data: TEventData): Promise<boolean> {
    // TODO: fix create event on server
    const result = await this.createEventAction.callAction('/events/save', 'post', { ...data, playersAmount: 0 });

    if (result) this.updateEntities();

    return !!result;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await this.deleteEventAction.callAction('/events/delete', 'delete', undefined, { eventID: id });

    if (result) this.updateEntities();

    return !!result;
  }
}

export default new EventsStore();
