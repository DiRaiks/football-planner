import { IDaily } from 'store';

export interface IWeatherProps {
  date: string;
}

export type TUseWeather = (
  props: IWeatherProps,
) => {
  eventWeather?: IDaily;
};
