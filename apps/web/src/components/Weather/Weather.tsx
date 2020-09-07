import React, { FC } from 'react';

import { useWeather } from './useWeather';
import { IWeatherProps } from './types';
import styles from './weather.module.scss';

const Weather: FC<IWeatherProps> = props => {
  const { eventWeather } = useWeather(props);

  if (!eventWeather) return null;

  return (
    <div className={styles.wrapper}>
      <img className="icon" src={`https://openweathermap.org/img/wn/${eventWeather.weather[0].icon}.png`} alt="" />
      <div className={styles.temp}>
        <div>
          <div className={styles.maxTemp}>{Math.floor(eventWeather.temp.max)}</div>
          <div>{Math.floor(eventWeather.temp.min)}</div>
        </div>
        <div className={styles.symbol}>℃</div>
      </div>
    </div>
  );
};

export default Weather;
