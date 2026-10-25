import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WeatherService,
  toIsoDay,
} from '../src/modules/weather/weather.service.js';
import { register, setupApp } from './helpers.js';

const ctx = setupApp({
  AUTH_RATE_LIMIT_MAX: 1000,
  WEATHER_DEFAULT_LAT: 47.22,
  WEATHER_DEFAULT_LON: 39.71,
});

const openMeteoResponse = {
  daily: {
    time: ['2026-11-03', '2026-11-04'],
    weather_code: [61, 0],
    temperature_2m_min: [3.1, 1.5],
    temperature_2m_max: [9.4, 7.2],
    precipitation_probability_max: [80, null],
    wind_speed_10m_max: [14.2, 6.3],
  },
};

const realFetch = globalThis.fetch;
let weatherCalls: URL[] = [];

beforeEach(() => {
  weatherCalls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== 'api.open-meteo.com') return realFetch(input, init);

    weatherCalls.push(url);
    return Response.json(openMeteoResponse);
  });
});

afterEach(() => vi.restoreAllMocks());

const createEvent = async (auth: Record<string, string>, payload = {}) => {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/events',
    headers: auth,
    payload: {
      eventName: 'Game',
      place: 'Stadium',
      date: '2026-11-03',
      time: '20:00',
      minimum: 10,
      ...payload,
    },
  });
  return res.json() as { _id: string };
};

describe('weather', () => {
  it('returns the forecast for the event day at the event location', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(auth, {
      location: { lat: 55.75, lon: 37.62 },
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/events/${event._id}/weather`,
      headers: auth,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      location: { lat: 55.75, lon: 37.62 },
      forecast: {
        date: '2026-11-03',
        weatherCode: 61,
        description: 'Небольшой дождь',
        tempMin: 3.1,
        tempMax: 9.4,
        precipitationProbability: 80,
        windSpeedMax: 14.2,
      },
    });
    expect(weatherCalls[0]?.searchParams.get('latitude')).toBe('55.75');
  });

  it('falls back to the default location and caches the forecast', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(auth, { date: '2026-12-31' });

    const get = () =>
      ctx.app.inject({
        method: 'GET',
        url: `/v1/events/${event._id}/weather`,
        headers: auth,
      });
    const first = await get();
    await get();

    expect(first.json()).toEqual({
      location: { lat: 47.22, lon: 39.71 },
      forecast: null,
    });
    // Two requests, one upstream call
    expect(weatherCalls).toHaveLength(1);
    expect(weatherCalls[0]?.searchParams.get('latitude')).toBe('47.22');
  });
});

describe('weather provider failures', () => {
  const failWith = (impl: () => Promise<Response>) =>
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      return url.hostname === 'api.open-meteo.com'
        ? impl()
        : realFetch(input, init);
    });

  it.each([
    ['network error', () => Promise.reject(new TypeError('fetch failed'))],
    ['5xx response', async () => new Response('oops', { status: 503 })],
    ['malformed body', async () => Response.json({ unexpected: true })],
  ])('maps a %s to 502 and does not cache it', async (_name, impl) => {
    const { auth } = await register(ctx.app);
    // A location no other test uses, so nothing is cached yet
    const event = await createEvent(auth, {
      location: { lat: -33.87, lon: 151.21 },
    });
    failWith(impl);

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/events/${event._id}/weather`,
      headers: auth,
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      code: 'WEATHER_UNAVAILABLE',
      message: 'weather provider is unavailable',
    });
  });
});

describe('WeatherService cache', () => {
  it('shares one upstream call between concurrent requests', async () => {
    const service = new WeatherService();
    await Promise.all([
      service.getDailyForecast({ lat: 10.001, lon: 20.001 }),
      service.getDailyForecast({ lat: 10.002, lon: 20.002 }),
    ]);

    expect(weatherCalls).toHaveLength(1);
    expect(weatherCalls[0]?.searchParams.get('latitude')).toBe('10');
  });

  it('evicts the least recently used locations', async () => {
    const service = new WeatherService(undefined, 2);
    const get = (lat: number) => service.getDailyForecast({ lat, lon: 0 });

    await get(1);
    await get(2);
    await get(1); // refreshes 1
    await get(3); // evicts 2
    await get(1);
    await get(2);

    expect(weatherCalls.map((u) => u.searchParams.get('latitude'))).toEqual([
      '1',
      '2',
      '3',
      '2',
    ]);
  });
});

describe('toIsoDay', () => {
  it('accepts valid calendar days only', () => {
    expect(toIsoDay('2026-11-03')).toBe('2026-11-03');
    expect(toIsoDay('2028-02-29')).toBe('2028-02-29');
    expect(toIsoDay('2026-02-29')).toBeNull();
    expect(toIsoDay('2026-99-99')).toBeNull();
    expect(toIsoDay('2026-11-03T18:00:00.000Z')).toBeNull();
    expect(toIsoDay('03.11.2026')).toBeNull();
  });
});
