import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { parseTrustProxy } from '../src/env.js';
import { PlayerModel } from '../src/modules/players/player.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { createEvent, register, setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

const signToken = (payload: Record<string, unknown>, secret: string) => {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  const signature = createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
};

describe('security', () => {
  it('rejects tokens signed with another secret', async () => {
    const { _id } = await register(ctx.app);
    const now = Math.floor(Date.now() / 1000);
    const token = signToken(
      { id: _id, v: 0, iat: now, exp: now + 3600 },
      'another-secret-that-is-long-enough-1234567890',
    );

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('requires authentication on every data route', async () => {
    const id = '0123456789abcdef01234567';
    const routes = [
      ['GET', '/v1/auth/me'],
      ['GET', '/v1/users'],
      ['PATCH', '/v1/users/me'],
      ['POST', '/v1/users/me/password'],
      ['GET', `/v1/users/${id}/stats`],
      ['GET', '/v1/events'],
      ['POST', '/v1/events'],
      ['GET', `/v1/events/${id}`],
      ['PATCH', `/v1/events/${id}`],
      ['DELETE', `/v1/events/${id}`],
      ['GET', `/v1/events/${id}/weather`],
      ['GET', `/v1/events/${id}/players`],
      ['POST', `/v1/events/${id}/players`],
      ['GET', `/v1/events/${id}/players/me`],
      ['PATCH', `/v1/events/${id}/players/${id}`],
      ['DELETE', `/v1/events/${id}/players/${id}`],
    ] as const;

    for (const [method, url] of routes) {
      const res = await ctx.app.inject({ method, url });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it('does not grant admin rights by email', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const event = await createEvent(ctx.app, alice.auth);
    const intruder = await register(ctx.app, { email: 'admin@example.com' });

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/events/${event._id}`,
      headers: intruder.auth,
    });

    expect(res.statusCode).toBe(403);
  });

  it('revokes tokens when the role changes via the CLI', async () => {
    const user = await register(ctx.app);
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { role: 'admin' }, $inc: { tokenVersion: 1 } },
    );

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: user.auth,
    });

    expect(res.statusCode).toBe(401);
  });

  it('allows only one concurrent registration per email', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        ctx.app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: {
            email: 'race@example.com',
            name: 'Race',
            password: 'password123',
          },
        }),
      ),
    );

    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 409, 409, 409]);
    for (const res of results.filter((r) => r.statusCode === 409)) {
      expect(res.json().code).toBe('USER_EXISTS');
    }
  });

  it('allows only one concurrent sign-up per user and event', async () => {
    const alice = await register(ctx.app);
    const event = await createEvent(ctx.app, alice.auth);

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        ctx.app.inject({
          method: 'POST',
          url: `/v1/events/${event._id}/players`,
          headers: alice.auth,
          payload: { name: 'Alice', status: true, friends: [] },
        }),
      ),
    );

    expect(results.map((r) => r.statusCode).sort()).toEqual([
      201, 409, 409, 409,
    ]);
    expect(await PlayerModel.countDocuments({ eventId: event._id })).toBe(1);
  });

  it('answers unknown routes in the unified error format', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/nope' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code: 'NOT_FOUND',
      message: 'route GET /nope not found',
    });
  });
});

describe('parseTrustProxy', () => {
  it('disables proxy trust by default', () => {
    expect(parseTrustProxy()).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('accepts hop counts and proxy addresses', () => {
    const oneHop = parseTrustProxy('1') as (a: string, hop: number) => boolean;
    expect(oneHop('10.0.0.1', 0)).toBe(true);
    expect(oneHop('203.0.113.7', 1)).toBe(false);
    expect(parseTrustProxy('10.0.0.0/8, 127.0.0.1')).toEqual([
      '10.0.0.0/8',
      '127.0.0.1',
    ]);
  });

  it('refuses to trust every proxy', () => {
    expect(() => parseTrustProxy('true')).toThrow(/unsafe/);
  });
});
