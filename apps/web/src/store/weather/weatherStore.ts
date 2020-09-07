import { EntityStore } from 'store';
import { action, computed, observable } from 'mobx';

import { WEATHER_URL } from './constants';
import { IWeatherModel, ICurrentWeather, IDaily } from './types';

class WeatherStore extends EntityStore<IWeatherModel> {
  @observable eventDate: null | string = null;

  @action setEventDate(date: string | null): void {
    this.eventDate = date;
  }

  @computed get currentWeatherUrl(): string {
    return `${WEATHER_URL}/get`;
  }

  @computed get currentWeather(): ICurrentWeather | null {
    return this.entity?.current || null;
  }

  @computed get eventWeather(): IDaily | undefined {
    const eventDate = new Date(this.eventDate || '');
    const month = eventDate.getMonth();
    const day = eventDate.getDate();
    const year = eventDate.getFullYear();

    return this.entity?.daily.find(item => {
      const itemDate = new Date(item.dt * 1000);
      const itemMonth = itemDate.getMonth();
      const itemDay = itemDate.getDate();
      const itemYear = itemDate.getFullYear();

      console.log('--->>>>', year, itemYear, day, itemDay, month, itemMonth);

      return year === itemYear && day === itemDay && month === itemMonth;
    });
  }

  async updateWeather(date: string): Promise<void | boolean> {
    this.setEventDate(date);

    return await this.updateEntity(this.currentWeatherUrl);
  }
}

export default new WeatherStore();
