import { describe, expect, it } from 'vitest';

import { EventModel } from '../src/modules/events/event.model.js';
import { PlayerModel } from '../src/modules/players/player.model.js';
import { createEvent, register, registerAdmin, setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

const signUp = (auth: Record<string, string>, eventId: string, payload = {}) =>
  ctx.app.inject({
    method: 'POST',
    url: '/players/save',
    headers: auth,
    payload: { name: 'Player', status: true, friends: [], eventId, ...payload },
  });

describe('events', () => {
  it('requires authentication', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/events/all' });
    expect(res.statusCode).toBe(401);
  });

  it('takes the creator from the token and ignores server-managed fields', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });

    const event = await createEvent(ctx.app, alice.auth, {
      creatorId: bob._id,
      playersAmount: 99,
    });

    expect(event.creatorId).toBe(alice._id);
    expect(event.playersAmount).toBe(0);
  });

  it('validates event input', async () => {
    const { auth } = await register(ctx.app);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/events/save',
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
  });

  it('lets only the creator or an admin change and delete an event', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const admin = await registerAdmin(ctx.app);
    const event = await createEvent(ctx.app, alice.auth);

    const change = (auth: Record<string, string>, eventName: string) =>
      ctx.app.inject({
        method: 'PUT',
        url: `/events/change/${event._id}`,
        headers: auth,
        payload: { eventName, creatorId: bob._id },
      });

    expect((await change(bob.auth, 'Hijacked')).statusCode).toBe(403);
    expect((await change(alice.auth, 'Renamed')).statusCode).toBe(200);
    expect((await change(admin.auth, 'By admin')).statusCode).toBe(200);
    expect(await EventModel.findById(event._id)).toMatchObject({
      eventName: 'By admin',
      creatorId: alice._id,
    });

    const del = (auth: Record<string, string>) =>
      ctx.app.inject({
        method: 'DELETE',
        url: `/events/delete?eventID=${event._id}`,
        headers: { ...auth, 'content-type': 'application/json; charset=utf-8' },
      });

    expect((await del(bob.auth)).statusCode).toBe(403);
    await signUp(alice.auth, event._id);
    // DELETE with a JSON content type and no body, as the current frontend sends it
    expect((await del(alice.auth)).statusCode).toBe(200);
    expect(await EventModel.findById(event._id)).toBeNull();
    expect(await PlayerModel.countDocuments({ eventId: event._id })).toBe(0);
  });

  it('returns 404 for unknown events and 400 for malformed ids', async () => {
    const { auth } = await register(ctx.app);

    const unknown = await ctx.app.inject({
      method: 'GET',
      url: '/events/get/0123456789abcdef01234567',
      headers: auth,
    });
    const malformed = await ctx.app.inject({
      method: 'GET',
      url: '/events/get/123',
      headers: auth,
    });

    expect(unknown.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(400);
  });
});

describe('players', () => {
  it('signs up the current user once and recalculates the players amount', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const event = await createEvent(ctx.app, alice.auth);

    const res = await signUp(alice.auth, event._id, {
      userId: bob._id,
      friends: [{ name: 'Friend', status: false }],
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().event.playersAmount).toBe(2);
    const player = await PlayerModel.findOne({ eventId: event._id });
    expect(player?.userId).toBe(alice._id);

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
    await signUp(alice.auth, event._id);
    const player = await PlayerModel.findOne({ eventId: event._id });

    const change = (
      auth: Record<string, string>,
      payload: Record<string, unknown>,
    ) =>
      ctx.app.inject({
        method: 'PUT',
        url: `/players/change/${player!._id}`,
        headers: auth,
        payload,
      });

    expect((await change(bob.auth, { status: false })).statusCode).toBe(403);

    // The frontend sends the whole document back; protected fields must not change
    const own = await change(alice.auth, {
      ...player!.toObject(),
      _id: player!._id.toString(),
      userId: bob._id,
      eventId: '0123456789abcdef01234567',
      friends: [{ name: 'F1', status: true }],
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().event.playersAmount).toBe(2);
    expect(await PlayerModel.findById(player!._id)).toMatchObject({
      userId: alice._id,
      eventId: event._id,
    });

    expect((await change(admin.auth, { status: false })).statusCode).toBe(200);

    const del = (auth: Record<string, string>) =>
      ctx.app.inject({
        method: 'DELETE',
        url: `/players/delete/${player!._id}`,
        headers: auth,
      });

    expect((await del(bob.auth)).statusCode).toBe(403);
    const removed = await del(alice.auth);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().event.playersAmount).toBe(0);
  });

  it('reads players by event and by user', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const event = await createEvent(ctx.app, alice.auth);
    await signUp(alice.auth, event._id);

    const byEvent = await ctx.app.inject({
      method: 'GET',
      url: `/players/byEventId/${event._id}`,
      headers: alice.auth,
    });
    const byUser = await ctx.app.inject({
      method: 'GET',
      url: `/players/${event._id}/${alice._id}`,
      headers: alice.auth,
    });

    expect(byEvent.json()).toHaveLength(1);
    expect(byUser.json()).toMatchObject({ userId: alice._id });
  });
});

describe('http', () => {
  it('allows CORS only for configured origins', async () => {
    const allowed = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/events/all',
      headers: {
        origin: 'https://football-planner.ru',
        'access-control-request-method': 'GET',
      },
    });
    const denied = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/events/all',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'GET',
      },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://football-planner.ru',
    );
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets security headers and reports health', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', dbState: 'connected' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
