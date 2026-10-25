import { useEffect } from 'react';
import { useObserver } from 'mobx-react';

import { WeatherStore } from 'store';

import { TUseWeather } from './types';

export const useWeather: TUseWeather = props => {
  const { date } = props;

  const eventWeather = useObserver(() => WeatherStore.eventWeather);

  useEffect(() => {
    WeatherStore.updateWeather(date);
  }, [date]);

  return {
    eventWeather,
  };
};
