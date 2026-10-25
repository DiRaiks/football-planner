import { EntityStore, IEventModel, Action, TEventData } from 'store';
import { action, computed, observable } from 'mobx';

class EventStore extends EntityStore<IEventModel> {
  @observable eventId: string | null = null;

  @computed get currentEventUrl(): string {
    return `/events/get/${this.eventId}`;
  }

  @computed get isCanModify(): boolean {
    if (!this.entity) return false;

    const nowMonth = new Date().getMonth();
    const nowDay = new Date().getDate();
    const nowYear = new Date().getFullYear();

    return new Date(this.entity.date) > new Date(nowYear, nowMonth, nowDay);
  }

  @action setEventId(id: string | null): void {
    this.eventId = id;
  }

  changeEventAction = new Action();

  async updateEvent(eventId: string): Promise<void | boolean> {
    this.setEventId(eventId);

    return await this.updateEntity(this.currentEventUrl);
  }

  async changeEvent(changedEvent: TEventData): Promise<boolean> {
    const result = await this.changeEventAction.callAction(`/events/change/${this.eventId}`, 'put', changedEvent);
    if (result) this.updateEvent(this.eventId || '');

    return !!result;
  }
}

export default new EventStore();
