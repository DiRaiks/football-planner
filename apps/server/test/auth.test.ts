import { createHmac, pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { UserModel } from '../src/modules/users/user.model.js';
import { JWT_SECRET, register, setupApp } from './helpers.js';

const ctx = setupApp({ AUTH_RATE_LIMIT_MAX: 1000 });

// Token as issued before expiration was introduced: HS256 with `iat` but no `exp`
const signLegacyToken = (payload: Record<string, unknown>) => {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  const signature = createHmac('sha256', JWT_SECRET)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
};

describe('auth', () => {
  it('registers a user without exposing password data', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/registration',
      payload: {
        email: 'New@Example.com',
        name: 'New',
        password: 'password123',
        role: 'admin',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      email: 'new@example.com',
      name: 'New',
      role: 'user',
    });
    expect(body.token).toBeTypeOf('string');
    expect(body).not.toHaveProperty('hash');
    expect(body).not.toHaveProperty('salt');
  });

  it('validates registration input', async () => {
    const badEmail = await ctx.app.inject({
      method: 'POST',
      url: '/auth/registration',
      payload: { email: 'not-an-email', name: 'A', password: 'password123' },
    });
    const shortPassword = await ctx.app.inject({
      method: 'POST',
      url: '/auth/registration',
      payload: { email: 'a@example.com', name: 'A', password: 'short' },
    });

    expect(badEmail.statusCode).toBe(400);
    expect(shortPassword.statusCode).toBe(400);
    expect(shortPassword.json().code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await register(ctx.app, { email: 'dup@example.com' });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/registration',
      payload: {
        email: 'DUP@example.com',
        name: 'Dup',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it('logs in with valid credentials only', async () => {
    await register(ctx.app, {
      email: 'login@example.com',
      password: 'password123',
    });

    const ok = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'LOGIN@example.com', password: 'password123' },
    });
    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login@example.com', password: 'wrong-password' },
    });
    const unknown = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'password123' },
    });

    expect(ok.statusCode).toBe(200);
    expect(ok.json().token).toBeTypeOf('string');
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
  });

  it('upgrades legacy PBKDF2 hashes on login', async () => {
    const salt = 'legacysalt';
    const hash = pbkdf2Sync(
      'old-password',
      salt,
      10000,
      512,
      'sha512',
    ).toString('hex');
    await UserModel.create({
      email: 'Legacy@Example.com',
      name: 'Legacy',
      hash,
      salt,
    });
    // Simulate an old record stored before emails were lowercased
    await UserModel.collection.updateOne(
      { name: 'Legacy' },
      { $set: { email: 'Legacy@Example.com' } },
    );

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'legacy@example.com', password: 'old-password' },
    });

    expect(res.statusCode).toBe(200);
    const user = await UserModel.findOne({ name: 'Legacy' }).select(
      '+hash +salt',
    );
    expect(user?.hash).toMatch(/^scrypt\$/);
    expect(user?.salt).toBeUndefined();
  });

  it('returns the profile for a valid token', async () => {
    const { auth } = await register(ctx.app, { email: 'me@example.com' });

    for (const url of ['/v1/auth/me', '/auth/check']) {
      const res = await ctx.app.inject({ method: 'GET', url, headers: auth });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ email: 'me@example.com' });
    }
  });

  it('rejects missing, invalid and non-expiring tokens', async () => {
    const { _id } = await register(ctx.app);
    const legacyToken = signLegacyToken({
      id: _id,
      iat: Math.floor(Date.now() / 1000),
    });

    const missing = await ctx.app.inject({
      method: 'GET',
      url: '/v1/auth/me',
    });
    const invalid = await ctx.app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: 'Bearer nope' },
    });
    const noExp = await ctx.app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${legacyToken}` },
    });

    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
    expect(noExp.statusCode).toBe(401);
    expect(noExp.json().code).toBe('UNAUTHORIZED');
  });
});
