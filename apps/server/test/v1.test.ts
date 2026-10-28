import { describe, expect, it } from 'vitest';

import { events } from '../src/db/index.js';
import { countRows, register, registerAdmin, setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

const eventPayload = {
  eventName: 'Tuesday game',
  place: 'Stadium',
  date: '2026-11-03',
  time: '20:00',
  minimum: 10,
};

const createEvent = async (auth: Record<string, string>, payload = {}) => {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/events',
    headers: auth,
    payload: { ...eventPayload, ...payload },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as {
    _id: string;
    creatorId: string;
    playersAmount: number;
  };
};

describe('v1 auth', () => {
  it('registers, logs in and returns only public user fields', async () => {
    const register = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'v1@example.com', name: 'V1', password: 'password123' },
    });
    expect(register.statusCode).toBe(200);

    const login = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'v1@example.com', password: 'password123' },
    });
    const { token } = login.json() as { token: string };

    const me = await ctx.app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(Object.keys(me.json()).sort()).toEqual([
      '_id',
      'email',
      'name',
      'role',
      'telegramLinked',
    ]);
  });
});

describe('v1 events', () => {
  it('runs the event lifecycle for the creator', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const event = await createEvent(alice.auth, {
      creatorId: 'ignored',
      playersAmount: 5,
    });

    expect(event).toMatchObject({
      ...eventPayload,
      creatorId: alice._id,
      playersAmount: 0,
    });

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/v1/events',
      headers: alice.auth,
    });
    expect(list.json()).toHaveLength(1);

    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}`,
      headers: alice.auth,
      payload: { eventName: 'Renamed', location: { lat: 55.7, lon: 37.6 } },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toMatchObject({
      eventName: 'Renamed',
      location: { lat: 55.7, lon: 37.6 },
    });

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/events/${event._id}`,
      headers: alice.auth,
    });
    expect(del.statusCode).toBe(204);
    expect(await countRows(ctx.app, events)).toBe(0);
  });

  it('forbids changes by other users but allows admins', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const admin = await registerAdmin(ctx.app);
    const event = await createEvent(alice.auth);

    const patch = (auth: Record<string, string>) =>
      ctx.app.inject({
        method: 'PATCH',
        url: `/v1/events/${event._id}`,
        headers: auth,
        payload: { eventName: 'Changed' },
      });

    expect((await patch(bob.auth)).statusCode).toBe(403);
    expect((await patch(admin.auth)).statusCode).toBe(200);
  });

  it('validates the event date and removes the location with null', async () => {
    const { auth } = await register(ctx.app);

    const badDate = await ctx.app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: auth,
      payload: { ...eventPayload, date: '03.11.2026' },
    });
    expect(badDate.statusCode).toBe(400);

    const event = await createEvent(auth, { location: { lat: 1, lon: 2 } });
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}`,
      headers: auth,
      payload: { location: null },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('location');
  });

  it('returns 404 for players of an unknown event', async () => {
    const { auth } = await register(ctx.app);
    const base = '/v1/events/0123456789abcdef01234567/players';

    for (const url of [base, `${base}/me`]) {
      const res = await ctx.app.inject({ method: 'GET', url, headers: auth });
      expect(res.json()).toEqual({
        code: 'NOT_FOUND',
        message: 'event not found',
      });
    }
  });

  it('returns 404 in the unified format for unknown events', async () => {
    const { auth } = await register(ctx.app);
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/events/0123456789abcdef01234567',
      headers: auth,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code: 'NOT_FOUND',
      message: 'event not found',
    });
  });
});

describe('v1 players', () => {
  it('signs up, updates and leaves an event', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const event = await createEvent(alice.auth);
    const base = `/v1/events/${event._id}/players`;

    const signUp = await ctx.app.inject({
      method: 'POST',
      url: base,
      headers: alice.auth,
      payload: {
        name: 'Alice',
        status: true,
        friends: [{ name: 'F', status: false }],
      },
    });
    expect(signUp.statusCode).toBe(201);
    expect(signUp.json()).toMatchObject({
      event: { playersAmount: 2 },
      count: { all: 2, exactly: 1, maybe: 1 },
    });
    const playerId = signUp.json().player._id as string;

    const me = await ctx.app.inject({
      method: 'GET',
      url: `${base}/me`,
      headers: alice.auth,
    });
    expect(me.json()).toMatchObject({ _id: playerId, userId: alice._id });

    const update = await ctx.app.inject({
      method: 'PATCH',
      url: `${base}/${playerId}`,
      headers: alice.auth,
      payload: { friends: [] },
    });
    expect(update.json().count).toEqual({
      all: 1,
      exactly: 1,
      maybe: 0,
      waiting: 0,
    });

    const leave = await ctx.app.inject({
      method: 'DELETE',
      url: `${base}/${playerId}`,
      headers: alice.auth,
    });
    expect(leave.json().event.playersAmount).toBe(0);

    const missing = await ctx.app.inject({
      method: 'GET',
      url: `${base}/me`,
      headers: alice.auth,
    });
    expect(missing.statusCode).toBe(404);
  });

  it('does not touch a player through another event path', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const first = await createEvent(alice.auth);
    const second = await createEvent(alice.auth);

    const signUp = await ctx.app.inject({
      method: 'POST',
      url: `/v1/events/${first._id}/players`,
      headers: alice.auth,
      payload: { name: 'Alice', status: true, friends: [] },
    });
    const playerId = signUp.json().player._id as string;

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/events/${second._id}/players/${playerId}`,
      headers: alice.auth,
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns user stats', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const event = await createEvent(alice.auth);
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/events/${event._id}/players`,
      headers: alice.auth,
      payload: { name: 'Alice', status: true, friends: [] },
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/users/${alice._id}/stats`,
      headers: alice.auth,
    });

    expect(res.json()).toEqual({ eventsCount: 1 });
  });
});
