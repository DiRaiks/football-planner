import type { DailyForecast, Location } from '@football-planner/shared';

import { AppError } from '../../lib/errors.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 30 * 60 * 1000;

// WMO weather interpretation codes: https://open-meteo.com/en/docs#weather_variable_documentation
const WMO: Record<number, string> = {
  0: 'Ясно',
  1: 'Преимущественно ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Изморозь',
  51: 'Лёгкая морось',
  53: 'Морось',
  55: 'Сильная морось',
  56: 'Ледяная морось',
  57: 'Сильная ледяная морось',
  61: 'Небольшой дождь',
  63: 'Дождь',
  65: 'Сильный дождь',
  66: 'Ледяной дождь',
  67: 'Сильный ледяной дождь',
  71: 'Небольшой снег',
  73: 'Снег',
  75: 'Сильный снег',
  77: 'Снежная крупа',
  80: 'Ливень',
  81: 'Сильный ливень',
  82: 'Очень сильный ливень',
  85: 'Снегопад',
  86: 'Сильный снегопад',
  95: 'Гроза',
  96: 'Гроза с градом',
  99: 'Гроза с сильным градом',
};

export const describeWeather = (code: number) => WMO[code] ?? 'Неизвестно';

type OpenMeteoDaily = {
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: number[];
  };
};

export class WeatherService {
  // LRU by insertion order: entries are re-inserted on every hit
  private readonly cache = new Map<
    string,
    { expires: number; data: Promise<DailyForecast[]> }
  >();

  constructor(
    private readonly defaultLocation?: Location,
    private readonly maxCacheEntries = 200,
  ) {}

  /** Location of the event, or the configured default; null when neither is known */
  resolveLocation(location?: Location | null): Location | null {
    return location ?? this.defaultLocation ?? null;
  }

  /**
   * 16-day daily forecast. Coordinates are rounded to ~1 km so nearby venues share a cache
   * entry, and concurrent requests for the same location share one upstream call.
   */
  getDailyForecast(location: Location): Promise<DailyForecast[]> {
    const lat = round(location.lat);
    const lon = round(location.lon);
    const key = `${lat},${lon}`;

    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.data;
    }

    const data = this.fetchForecast(lat, lon);
    this.cache.delete(key);
    this.cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
    // Failed lookups are not cached
    data.catch(() => this.cache.delete(key));

    while (this.cache.size > this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }

    return data;
  }

  private async fetchForecast(
    lat: number,
    lon: number,
  ): Promise<DailyForecast[]> {
    const url = new URL(FORECAST_URL);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max',
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '16');

    let daily: OpenMeteoDaily['daily'] | undefined;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok)
        daily = ((await response.json()) as Partial<OpenMeteoDaily>).daily;
    } catch {
      // Network errors and timeouts are reported as an unavailable provider below
    }
    if (!daily || !Array.isArray(daily.time)) {
      throw new AppError(
        502,
        'WEATHER_UNAVAILABLE',
        'weather provider is unavailable',
      );
    }

    return daily.time.map((date, i) => {
      const weatherCode = daily.weather_code[i] ?? 0;
      return {
        date,
        weatherCode,
        description: describeWeather(weatherCode),
        tempMin: daily.temperature_2m_min[i] ?? 0,
        tempMax: daily.temperature_2m_max[i] ?? 0,
        precipitationProbability:
          daily.precipitation_probability_max[i] ?? null,
        windSpeedMax: daily.wind_speed_10m_max[i] ?? 0,
      };
    });
  }

  /** Forecast for a given day, or null when it is outside the forecast window */
  async getForecastForDate(location: Location, date: string) {
    const day = toIsoDay(date);
    if (!day) return null;

    const forecast = await this.getDailyForecast(location);
    return forecast.find((item) => item.date === day) ?? null;
  }
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Returns the event day as YYYY-MM-DD, or null when it is not a valid calendar date */
export const toIsoDay = (date: string): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const [, year, month, day] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return valid ? date : null;
};
