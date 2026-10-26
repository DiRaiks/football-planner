import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { normalizeDate, normalizeTime } from '../src/lib/legacy-dates.js';
import { isTimeZone, zonedToInstant } from '../src/lib/time.js';
import { createEvent, JWT_SECRET, register, setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000, TIME_ZONE: 'Europe/Moscow' });

describe('zonedToInstant', () => {
  it('turns venue wall-clock time into an instant', () => {
    expect(
      zonedToInstant('2026-11-03', '20:00', 'Europe/Moscow')?.toISOString(),
    ).toBe('2026-11-03T17:00:00.000Z');
    expect(zonedToInstant('2026-11-03', '20:00', 'UTC')?.toISOString()).toBe(
      '2026-11-03T20:00:00.000Z',
    );
  });

  it('follows daylight saving time', () => {
    // Berlin is UTC+2 in summer and UTC+1 in winter; DST ends on 2026-10-25
    expect(
      zonedToInstant('2026-10-24', '12:00', 'Europe/Berlin')?.toISOString(),
    ).toBe('2026-10-24T10:00:00.000Z');
    expect(
      zonedToInstant('2026-10-26', '12:00', 'Europe/Berlin')?.toISOString(),
    ).toBe('2026-10-26T11:00:00.000Z');
    expect(
      zonedToInstant('2026-07-01', '00:30', 'America/New_York')?.toISOString(),
    ).toBe('2026-07-01T04:30:00.000Z');
  });

  it('rejects impossible dates and times', () => {
    expect(zonedToInstant('2026-02-30', '20:00', 'UTC')).toBeNull();
    expect(zonedToInstant('2026-11-03', '24:00', 'UTC')).toBeNull();
    expect(zonedToInstant('03.11.2026', '20:00', 'UTC')).toBeNull();
  });

  it('knows time zones', () => {
    expect(isTimeZone('Europe/Moscow')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('legacy dates', () => {
  it.each([
    ['2026-11-03', '2026-11-03'],
    ['2026-1-5', '2026-01-05'],
    ['2026-11-03T00:00:00.000Z', '2026-11-03'],
    ['03.11.2026', '2026-11-03'],
    ['3/11/2026', '2026-11-03'],
    ['31.02.2026', null],
    ['tuesday', null],
  ])('reads the date %j', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it.each([
    ['20:00', '20:00'],
    ['9:30', '09:30'],
    ['20.30', '20:30'],
    ['20-00', '20:00'],
    ['20', '20:00'],
    [' 7h15 ', '07:15'],
    ['25:00', null],
    ['вечером', null],
  ])('reads the time %j', (input, expected) => {
    expect(normalizeTime(input)).toBe(expected);
  });
});

describe('events with a start instant', () => {
  it('stores the start in the configured time zone and keeps it in sync', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(ctx.app, auth, {
      date: '2026-11-03',
      time: '20:00',
    });
    const read = async () =>
      (
        await ctx.app.inject({ url: `/v1/events/${event._id}`, headers: auth })
      ).json();

    expect(await read()).toMatchObject({
      date: '2026-11-03',
      time: '20:00',
      startsAt: '2026-11-03T17:00:00.000Z',
    });

    await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}`,
      headers: auth,
      payload: { time: '21:30' },
    });
    expect((await read()).startsAt).toBe('2026-11-03T18:30:00.000Z');

    await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}`,
      headers: auth,
      payload: { place: 'Other pitch' },
    });
    expect((await read()).startsAt).toBe('2026-11-03T18:30:00.000Z');
  });

  it('rejects free-text times and impossible dates', async () => {
    const { auth } = await register(ctx.app);
    const create = (payload: Record<string, unknown>) =>
      ctx.app.inject({
        method: 'POST',
        url: '/v1/events',
        headers: auth,
        payload: {
          place: 'P',
          eventName: 'E',
          minimum: 10,
          date: '2026-11-03',
          time: '20:00',
          ...payload,
        },
      });
    expect((await create({ time: 'вечером' })).statusCode).toBe(400);
    expect((await create({ date: '2026-02-30' })).json()).toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('lists matches by start', async () => {
    const { auth } = await register(ctx.app);
    await createEvent(ctx.app, auth, {
      eventName: 'Late',
      date: '2026-11-05',
      time: '09:00',
    });
    await createEvent(ctx.app, auth, {
      eventName: 'Early',
      date: '2026-11-04',
      time: '22:00',
    });
    const list = (
      await ctx.app.inject({ url: '/v1/events', headers: auth })
    ).json() as {
      eventName: string;
    }[];
    expect(list.map((event) => event.eventName)).toEqual(['Early', 'Late']);
  });

  it('refuses to start with an unknown TIME_ZONE', async () => {
    await expect(
      buildApp({
        fastify: { logger: false },
        env: {
          PORT: 0,
          DATABASE_URL: 'postgres://127.0.0.1:1/never',
          JWT_SECRET,
          TIME_ZONE: 'Mars/Olympus',
        },
      }),
    ).rejects.toThrow('TIME_ZONE "Mars/Olympus" is not a known time zone');
  });
});

describe('database settings', () => {
  const start = (env: Record<string, unknown>) =>
    buildApp({
      fastify: { logger: false },
      env: { PORT: 0, JWT_SECRET, ...env },
    });

  it('explains that MONGO_URI was replaced by DATABASE_URL', async () => {
    await expect(
      start({ MONGO_URI: 'mongodb://127.0.0.1:1/football' }),
    ).rejects.toThrow(/MONGO_URI is no longer used.*DATABASE_URL/);
  });

  it('refuses to start without DATABASE_URL or with another database', async () => {
    await expect(start({})).rejects.toThrow('DATABASE_URL is not set');
    await expect(
      start({ DATABASE_URL: 'mongodb://127.0.0.1:1/football' }),
    ).rejects.toThrow('DATABASE_URL must start with postgres://');
  });
});
