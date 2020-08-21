import { EntityStore, IPlayerModel, UserStore, Action, EventStore } from 'store';
import { action, computed, observable } from 'mobx';

import { TPlayerData } from './types';

class PlayerStore extends EntityStore<IPlayerModel> {
  @observable eventId: string | null = null;

  @computed get currentPlayerUrl(): string {
    return `/players/${this.eventId}/${UserStore.user?._id}`;
  }

  @action setEventId(id: string | null): void {
    this.eventId = id;
  }

  changePlayerAction = new Action();
  deletePlayerAction = new Action();

  async updatePlayer(eventId: string): Promise<void | boolean> {
    this.setEventId(eventId);

    return await this.updateEntity(this.currentPlayerUrl);
  }

  async deleteFriend(friendName: string): Promise<boolean> {
    const filteredFriend = this.entity?.friends.filter(friend => friend.name !== friendName);
    const changedPlayer = { ...this.entity, friends: filteredFriend };

    const result = await this.changePlayerAction.callAction(
      `/players/change/${this.entity?._id}`,
      'put',
      changedPlayer,
    );
    if (result) this.updatePlayer(this.eventId || '');

    return !!result;
  }

  async addFriend(name: string, status: boolean): Promise<boolean> {
    const friends = [...this.entity?.friends, { name, status }];
    const changedPlayer = { ...this.entity, friends: friends };

    const result = await this.changePlayerAction.callAction(
      `/players/change/${this.entity?._id}`,
      'put',
      changedPlayer,
    );
    if (result) this.updatePlayer(this.eventId || '');

    return !!result;
  }

  async changePlayer(playerData: TPlayerData): Promise<boolean> {
    const changedPlayer = { ...this.entity, ...playerData };
    const result = await this.changePlayerAction.callAction(
      `/players/change/${this.entity?._id}`,
      'put',
      changedPlayer,
    );
    if (result) this.updatePlayer(this.eventId || '');

    return !!result;
  }

  async addPlayer(playerData: TPlayerData): Promise<boolean> {
    if (!EventStore.entity || !UserStore.user) return false;

    const newPlayer = {
      ...playerData,
      eventId: EventStore.entity._id,
      date: EventStore.entity.date,
      userId: UserStore.user._id,
    };
    const result = await this.changePlayerAction.callAction('/players/save', 'post', newPlayer);
    if (result) await this.updatePlayer(this.eventId || '');

    return !!result;
  }

  async deletePlayer(playerId: string): Promise<boolean> {
    const result = await this.deletePlayerAction.callAction(`/players/delete/${playerId}`, 'delete');

    return !!result;
  }
}

export default new PlayerStore();
