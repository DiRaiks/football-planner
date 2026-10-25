import { describe, expect, it } from 'vitest';

import { UserModel } from '../src/modules/users/user.model.js';
import { register, setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

describe('users', () => {
  it('lists users without emails or password data', async () => {
    const { auth } = await register(ctx.app, {
      email: 'a@example.com',
      name: 'Alice',
    });
    await register(ctx.app, { email: 'b@example.com', name: 'Bob' });

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: auth,
    });

    expect(res.statusCode).toBe(200);
    const users = res.json() as Record<string, unknown>[];
    expect(users.map((u) => u.name).sort()).toEqual(['Alice', 'Bob']);
    for (const user of users) {
      expect(Object.keys(user).sort()).toEqual(['_id', 'name']);
    }
  });

  it('updates only the name of the current user', async () => {
    const alice = await register(ctx.app, {
      email: 'a@example.com',
      name: 'Alice',
    });
    const bob = await register(ctx.app, {
      email: 'b@example.com',
      name: 'Bob',
    });

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: alice.auth,
      payload: {
        name: 'Alice 2',
        email: 'evil@example.com',
        hash: 'x',
        role: 'admin',
        id: bob._id,
      },
    });

    expect(res.statusCode).toBe(200);
    const stored = await UserModel.findById(alice._id).select('+hash');
    expect(stored).toMatchObject({
      name: 'Alice 2',
      email: 'a@example.com',
      role: 'user',
    });
    expect(stored?.hash).toMatch(/^scrypt\$/);
    expect(await UserModel.findById(bob._id)).toMatchObject({ name: 'Bob' });
  });

  it('no longer exposes the account takeover endpoint', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });

    const res = await ctx.app.inject({
      method: 'PUT',
      url: '/users/change',
      headers: alice.auth,
      payload: { id: bob._id, email: 'evil@example.com' },
    });

    expect(res.statusCode).toBe(404);
    expect(await UserModel.findById(bob._id)).toMatchObject({
      email: 'b@example.com',
    });
  });

  it('changes the password and revokes older tokens', async () => {
    const user = await register(ctx.app, {
      email: 'p@example.com',
      password: 'password123',
    });
    // No delay: tokens issued in the same second must still be revoked

    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/v1/users/me/password',
      headers: user.auth,
      payload: { currentPassword: 'nope-nope', newPassword: 'new-password-1' },
    });
    expect(wrong.statusCode).toBe(400);

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/users/me/password',
      headers: user.auth,
      payload: {
        currentPassword: 'password123',
        newPassword: 'new-password-1',
      },
    });
    expect(res.statusCode).toBe(200);
    const { token } = res.json() as { token: string };

    const oldToken = await ctx.app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: user.auth,
    });
    const newToken = await ctx.app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    const login = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'p@example.com', password: 'new-password-1' },
    });

    expect(oldToken.statusCode).toBe(401);
    expect(newToken.statusCode).toBe(200);
    expect(login.statusCode).toBe(200);
  });

  it('validates ids in params', async () => {
    const { auth } = await register(ctx.app);
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/users/userEventsCount/not-an-id',
      headers: auth,
    });

    expect(res.statusCode).toBe(400);
  });
});
