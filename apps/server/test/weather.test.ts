import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherService } from '../src/modules/weather/weather.service.js';
import { register, setupApp } from './helpers.js';

const ctx = setupApp({
  AUTH_RATE_LIMIT_MAX: 1000,
  WEATHER_DEFAULT_LAT: 59.94,
  WEATHER_DEFAULT_LON: 30.31,
  WEATHER_DEFAULT_CITY: 'Санкт-Петербург',
});

const openMeteoResponse = {
  hourly: {
    time: ['2026-11-03T19:00', '2026-11-03T20:00', '2026-11-03T21:00'],
    weather_code: [3, 61, 0],
    temperature_2m: [9.4, 7.6, 6.1],
    precipitation_probability: [20, 80, null],
    wind_speed_10m: [10.1, 14.2, 6.3],
  },
};

const geocodingResponse = {
  results: [
    {
      name: 'Кировск',
      latitude: 67.61,
      longitude: 33.67,
      country: 'Россия',
      admin1: 'Мурманская область',
    },
    {
      name: 'Кировский',
      latitude: 45.09,
      longitude: 133.51,
      country: 'Россия',
    },
  ],
};

const realFetch = globalThis.fetch;
let weatherCalls: URL[] = [];

beforeEach(() => {
  weatherCalls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'geocoding-api.open-meteo.com') {
      weatherCalls.push(url);
      return Response.json(geocodingResponse);
    }
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
  it('returns the weather at the start of the match, at its location', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(auth, {
      // 20:30 reads the 20:00 hour
      time: '20:30',
      location: { lat: 55.75, lon: 37.62, name: 'Москва' },
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/events/${event._id}/weather`,
      headers: auth,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      location: { lat: 55.75, lon: 37.62, name: 'Москва' },
      forecast: {
        time: '2026-11-03T20:00:00.000Z',
        weatherCode: 61,
        description: 'Небольшой дождь',
        temperature: 7.6,
        precipitationProbability: 80,
        windSpeed: 14.2,
      },
    });
    expect(weatherCalls[0]?.searchParams.get('latitude')).toBe('55.75');
    expect(weatherCalls[0]?.searchParams.get('hourly')).toContain(
      'temperature_2m',
    );
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
      location: { lat: 59.94, lon: 30.31, name: 'Санкт-Петербург' },
      forecast: null,
    });
    // Two requests, one upstream call
    expect(weatherCalls).toHaveLength(1);
    expect(weatherCalls[0]?.searchParams.get('latitude')).toBe('59.94');
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
      service.getHourlyForecast({ lat: 10.001, lon: 20.001 }),
      service.getHourlyForecast({ lat: 10.002, lon: 20.002 }),
    ]);

    expect(weatherCalls).toHaveLength(1);
    expect(weatherCalls[0]?.searchParams.get('latitude')).toBe('10');
  });

  it('evicts the least recently used locations', async () => {
    const service = new WeatherService(undefined, 2);
    const get = (lat: number) => service.getHourlyForecast({ lat, lon: 0 });

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

describe('cities', () => {
  it('finds cities by name with their region, and names the default', async () => {
    const { auth } = await register(ctx.app);
    const search = (q: string) =>
      ctx.app.inject({
        url: `/v1/weather/cities?q=${encodeURIComponent(q)}`,
        headers: auth,
      });

    const res = await search('Киров');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        name: 'Кировск',
        region: 'Мурманская область, Россия',
        lat: 67.61,
        lon: 33.67,
      },
      { name: 'Кировский', region: 'Россия', lat: 45.09, lon: 133.51 },
    ]);
    const call = weatherCalls.at(-1);
    expect(call?.searchParams.get('name')).toBe('киров');
    expect(call?.searchParams.get('language')).toBe('ru');

    // The same query again comes from the cache
    await search('киров ');
    expect(weatherCalls).toHaveLength(1);
    expect((await search('Р')).statusCode).toBe(400);

    const defaults = await ctx.app.inject({
      url: '/v1/weather/default',
      headers: auth,
    });
    expect(defaults.json()).toEqual({
      location: { lat: 59.94, lon: 30.31, name: 'Санкт-Петербург' },
    });
  });

  it('needs a signed-in user', async () => {
    const res = await ctx.app.inject({ url: '/v1/weather/cities?q=Киров' });
    expect(res.statusCode).toBe(401);
  });
});
