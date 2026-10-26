import { describe, expect, it } from 'vitest';

import { eq } from 'drizzle-orm';

import { players } from '../src/db/index.js';
import {
  countRows,
  createEvent,
  getEvent,
  getPlayer,
  register,
  registerAdmin,
  setupApp,
} from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

const signUp = (
  auth: Record<string, string>,
  eventId: string,
  payload: Record<string, unknown> = {},
) =>
  ctx.app.inject({
    method: 'POST',
    url: `/v1/events/${eventId}/players`,
    headers: auth,
    payload: { name: 'Player', status: true, friends: [], ...payload },
  });

describe('events', () => {
  it('validates event input', async () => {
    const { auth } = await register(ctx.app);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: auth,
      payload: {
        place: '',
        time: '20:00',
        date: '2026-11-01',
        minimum: 'ten',
        eventName: 'x',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('keeps server-managed fields when the client sends them back', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const event = await createEvent(ctx.app, alice.auth);

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}`,
      headers: alice.auth,
      payload: {
        ...event,
        eventName: 'Renamed',
        creatorId: bob._id,
        playersAmount: 99,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(await getEvent(ctx.app, event._id)).toMatchObject({
      eventName: 'Renamed',
      creatorId: alice._id,
      playersAmount: 0,
    });
  });

  it('deletes the players of a deleted event, even with an empty JSON body', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const event = await createEvent(ctx.app, alice.auth);
    await signUp(alice.auth, event._id);

    const del = (auth: Record<string, string>) =>
      ctx.app.inject({
        method: 'DELETE',
        url: `/v1/events/${event._id}`,
        headers: { ...auth, 'content-type': 'application/json; charset=utf-8' },
      });

    expect((await del(bob.auth)).statusCode).toBe(403);
    expect((await del(alice.auth)).statusCode).toBe(204);
    expect(
      await countRows(ctx.app, players, eq(players.eventId, event._id)),
    ).toBe(0);
  });

  it('returns 400 for malformed ids', async () => {
    const { auth } = await register(ctx.app);
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/events/123',
      headers: auth,
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('players', () => {
  it('signs up the current user once and counts friends', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const event = await createEvent(ctx.app, alice.auth);

    const res = await signUp(alice.auth, event._id, {
      userId: bob._id,
      friends: [{ name: 'Friend', status: false }],
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().event.playersAmount).toBe(2);
    expect(res.json().player.userId).toBe(alice._id);
    expect((await signUp(alice.auth, event._id)).statusCode).toBe(409);
    expect(
      (await signUp(alice.auth, '0123456789abcdef01234567')).statusCode,
    ).toBe(404);
  });

  it('lets only the owner or an admin change and delete a player', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const admin = await registerAdmin(ctx.app);
    const event = await createEvent(ctx.app, alice.auth);
    const player = (await signUp(alice.auth, event._id)).json().player as {
      _id: string;
    };
    const url = `/v1/events/${event._id}/players/${player._id}`;

    const change = (
      auth: Record<string, string>,
      payload: Record<string, unknown>,
    ) => ctx.app.inject({ method: 'PATCH', url, headers: auth, payload });

    expect((await change(bob.auth, { status: false })).statusCode).toBe(403);

    // Protected fields sent back by the client are ignored
    const own = await change(alice.auth, {
      ...player,
      userId: bob._id,
      eventId: '0123456789abcdef01234567',
      friends: [{ name: 'F1', status: true }],
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().event.playersAmount).toBe(2);
    expect(await getPlayer(ctx.app, player._id)).toMatchObject({
      userId: alice._id,
      eventId: event._id,
    });

    expect((await change(admin.auth, { status: false })).statusCode).toBe(200);

    const del = (auth: Record<string, string>) =>
      ctx.app.inject({ method: 'DELETE', url, headers: auth });

    expect((await del(bob.auth)).statusCode).toBe(403);
    const removed = await del(alice.auth);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().event.playersAmount).toBe(0);
  });

  it('shows the players of an event to every user', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const event = await createEvent(ctx.app, alice.auth);
    await signUp(alice.auth, event._id);

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/events/${event._id}/players`,
      headers: bob.auth,
    });

    expect(res.json()).toHaveLength(1);
    expect(res.json()[0]).toMatchObject({ userId: alice._id });
  });
});

describe('http', () => {
  it('allows CORS only for configured origins', async () => {
    const preflight = (origin: string) =>
      ctx.app.inject({
        method: 'OPTIONS',
        url: '/v1/events',
        headers: { origin, 'access-control-request-method': 'GET' },
      });

    expect(
      (await preflight('https://football-planner.ru')).headers[
        'access-control-allow-origin'
      ],
    ).toBe('https://football-planner.ru');
    expect(
      (await preflight('https://evil.example')).headers[
        'access-control-allow-origin'
      ],
    ).toBeUndefined();
  });

  it('sets security headers and reports health', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      dbState: 'connected',
      // No BOT_TOKEN in these tests
      telegram: null,
    });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
