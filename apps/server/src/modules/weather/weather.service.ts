import type { City, Forecast, Location } from '@football-planner/shared';

import { AppError } from '../../lib/errors.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const CACHE_TTL_MS = 30 * 60 * 1000;
// City names and coordinates do not change
const CITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

type OpenMeteoHourly = {
  hourly: {
    time: string[];
    weather_code: number[];
    temperature_2m: number[];
    precipitation_probability: (number | null)[];
    wind_speed_10m: number[];
  };
};

type OpenMeteoPlaces = {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }[];
};

/** A small LRU of promises by key: concurrent lookups share one call, failures are not kept */
class PromiseCache<T> {
  // LRU by insertion order: entries are re-inserted on every hit
  private readonly entries = new Map<
    string,
    { expires: number; data: Promise<T> }
  >();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && cached.expires > Date.now()) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached.data;
    }

    const data = load();
    this.entries.delete(key);
    this.entries.set(key, { expires: Date.now() + this.ttlMs, data });
    data.catch(() => this.entries.delete(key));

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return data;
  }
}

const unavailable = () =>
  new AppError(502, 'WEATHER_UNAVAILABLE', 'weather provider is unavailable');

export class WeatherService {
  private readonly forecasts: PromiseCache<Forecast[]>;
  private readonly cities = new PromiseCache<City[]>(CITY_CACHE_TTL_MS, 500);

  constructor(
    private readonly defaultLocation?: Location,
    maxCacheEntries = 200,
  ) {
    this.forecasts = new PromiseCache(CACHE_TTL_MS, maxCacheEntries);
  }

  /** Location of the event, or the configured default; null when neither is known */
  resolveLocation(location?: Location | null): Location | null {
    return location ?? this.defaultLocation ?? null;
  }

  get default(): Location | null {
    return this.defaultLocation ?? null;
  }

  /**
   * 16-day hourly forecast. Coordinates are rounded to ~1 km so nearby venues share a
   * cache entry, and concurrent requests for the same location share one upstream call.
   */
  getHourlyForecast(location: Location): Promise<Forecast[]> {
    const lat = round(location.lat);
    const lon = round(location.lon);
    return this.forecasts.get(`${lat},${lon}`, () =>
      this.fetchForecast(lat, lon),
    );
  }

  private async fetchForecast(lat: number, lon: number): Promise<Forecast[]> {
    const url = new URL(FORECAST_URL);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set(
      'hourly',
      'weather_code,temperature_2m,precipitation_probability,wind_speed_10m',
    );
    // Hours in UTC, matched against the start of the match as an instant
    url.searchParams.set('timezone', 'GMT');
    url.searchParams.set('forecast_days', '16');

    let hourly: OpenMeteoHourly['hourly'] | undefined;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok)
        hourly = ((await response.json()) as Partial<OpenMeteoHourly>).hourly;
    } catch {
      // Network errors and timeouts are reported as an unavailable provider below
    }
    if (!hourly || !Array.isArray(hourly.time)) throw unavailable();

    return hourly.time.map((time, i) => {
      const weatherCode = hourly.weather_code[i] ?? 0;
      return {
        // Open-Meteo gives "2026-11-03T17:00" in the requested zone, here UTC
        time: `${time}:00.000Z`,
        weatherCode,
        description: describeWeather(weatherCode),
        temperature: hourly.temperature_2m[i] ?? 0,
        precipitationProbability: hourly.precipitation_probability[i] ?? null,
        windSpeed: hourly.wind_speed_10m[i] ?? 0,
      };
    });
  }

  /**
   * The weather in the hour the match starts (a 20:30 start reads 20:00), or null when
   * the start is unknown or outside the forecast window
   */
  async getForecastAt(location: Location, startsAt: Date | null) {
    if (!startsAt) return null;
    const hour = new Date(startsAt);
    hour.setUTCMinutes(0, 0, 0);
    const time = hour.toISOString();

    const forecast = await this.getHourlyForecast(location);
    return forecast.find((item) => item.time === time) ?? null;
  }

  /** Cities by the start of their name, in Russian, for the match form */
  searchCities(query: string): Promise<City[]> {
    const name = query.trim().toLowerCase();
    return this.cities.get(name, () => this.fetchCities(name));
  }

  private async fetchCities(name: string): Promise<City[]> {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set('name', name);
    url.searchParams.set('count', '6');
    url.searchParams.set('language', 'ru');
    url.searchParams.set('format', 'json');

    let body: OpenMeteoPlaces | undefined;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) body = (await response.json()) as OpenMeteoPlaces;
    } catch {
      // Reported as an unavailable provider below
    }
    if (!body) throw unavailable();

    return (body.results ?? []).map((place) => ({
      name: place.name,
      region: [place.admin1, place.country]
        .filter((part) => part && part !== place.name)
        .join(', '),
      lat: place.latitude,
      lon: place.longitude,
    }));
  }
}

const round = (value: number) => Math.round(value * 100) / 100;
