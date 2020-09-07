export interface IWeatherModel {
  lat: string;
  lon: string;
  timezone: string;
  timezone_offset: number;
  current: ICurrentWeather;
  daily: IDaily[];
}

export interface ICurrentWeather {
  dt: number;
  sunrise: number;
  sunset: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  visibility: number;
  wind_speed: number;
  wind_deg: number;
  weather: IWeatherInfo;
}

export interface IWeatherInfo {
  id: number;
  main: string;
  description: string;
  icon: string;
}

export interface IDaily {
  dt: number;
  sunrise: number;
  sunset: number;
  temp: IDailyTemp;
  feels_like: IFeels;
  pressure: number;
  humidity: number;
  dew_point: number;
  wind_speed: number;
  wind_deg: number;
  weather: IWeatherInfo[];
  clouds: number;
  pop: number;
  uvi: number;
}

interface IDailyTemp {
  day: number;
  min: number;
  max: number;
  night: number;
  eve: number;
  morn: number;
}

interface IFeels {
  day: number;
  night: number;
  eve: number;
  morn: number;
}
