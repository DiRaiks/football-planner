import { createHmac } from 'node:crypto';
import { SignJWT, generateKeyPair } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { verifyInitData } from '../src/modules/users/telegram-login.js';
import { matchLink } from '../src/plugins/telegram/messages.js';
import { eq } from 'drizzle-orm';

import { users } from '../src/db/index.js';
import { countRows, createEvent, register, setupApp } from './helpers.js';

const BOT_TOKEN = '123:test';
const CLIENT_ID = '123456789';
const VERIFIER = 'v'.repeat(43);

/** initData signed the way Telegram signs it */
const signInitData = (fields: Record<string, string>, token = BOT_TOKEN) => {
  const checkString = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
};

const now = () => String(Math.floor(Date.now() / 1000));
const PHOTO = 'https://t.me/i/userpic/320/ildar.jpg';
const tgUser = JSON.stringify({
  id: 4242,
  first_name: 'Ильдар',
  last_name: 'Сафин',
  username: 'ildar',
  photo_url: PHOTO,
});

describe('matchLink', () => {
  it('opens the match in the Mini App when there is one, else on the site', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(
      matchLink(id, {
        publicUrl: 'https://football-planner.ru',
        appUrl: 'https://t.me/football_bot/app',
      }),
    ).toBe(`https://t.me/football_bot/app?startapp=${id}`);
    expect(matchLink(id, { publicUrl: 'https://football-planner.ru' })).toBe(
      `https://football-planner.ru/events/${id}`,
    );
    expect(matchLink(id, {})).toBeUndefined();
  });
});

describe('verifyInitData', () => {
  it('accepts data signed with the bot token', () => {
    const initData = signInitData({
      auth_date: now(),
      query_id: 'AAH',
      user: tgUser,
      start_param: '507f1f77bcf86cd799439011',
      signature: 'ed25519-signature-is-part-of-the-check',
    });
    expect(verifyInitData(initData, BOT_TOKEN)).toEqual({
      user: {
        id: 4242,
        first_name: 'Ильдар',
        last_name: 'Сафин',
        username: 'ildar',
        photo_url: PHOTO,
      },
      startParam: '507f1f77bcf86cd799439011',
    });
  });

  it('refuses forged, changed and stale data', () => {
    const fields = { auth_date: now(), user: tgUser };
    const forged = signInitData(fields, '999:other-bot');
    expect(() => verifyInitData(forged, BOT_TOKEN)).toThrow(/mismatch/);

    const changed = signInitData(fields).replace('4242', '4243');
    expect(() => verifyInitData(changed, BOT_TOKEN)).toThrow(/mismatch/);

    const stale = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000) - 2 * 86_400),
      user: tgUser,
    });
    expect(() => verifyInitData(stale, BOT_TOKEN)).toThrow(/expired/);

    expect(() => verifyInitData('user=x', BOT_TOKEN)).toThrow(/no hash/);

    const future = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000) + 3600),
      user: tgUser,
    });
    expect(() => verifyInitData(future, BOT_TOKEN)).toThrow(/expired/);
  });
});

// Telegram's login, faked: its signing key and token endpoint
const keys = await generateKeyPair('RS256');
const tokenCalls: { auth: string | null; body: URLSearchParams }[] = [];
let tokenAnswer: () => Promise<Response> = async () =>
  Response.json({ id_token: await idToken() });

const idToken = (claims: Record<string, unknown> = {}, audience = CLIENT_ID) =>
  new SignJWT({
    id: 4242,
    name: 'Ильдар Сафин',
    given_name: 'Ильдар',
    family_name: 'Сафин',
    preferred_username: 'ildar',
    picture: PHOTO,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://oauth.telegram.org')
    .setAudience(audience)
    .setSubject('1234123412341234123')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(keys.privateKey);

const ctx = setupApp(
  {
    AUTH_RATE_LIMIT_MAX: 1000,
    BOT_TOKEN,
    PUBLIC_URL: 'https://football-planner.ru/',
    TELEGRAM_LOGIN_CLIENT_ID: CLIENT_ID,
    TELEGRAM_LOGIN_CLIENT_SECRET: 'client-secret',
  },
  {
    botInfo: {
      id: 123,
      is_bot: true,
      first_name: 'Bot',
      username: 'football_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  },
  {
    telegramLogin: {
      keys: async () => keys.publicKey,
      fetch: vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        tokenCalls.push({
          auth: new Headers(init?.headers).get('authorization'),
          body: new URLSearchParams(String(init?.body)),
        });
        return tokenAnswer();
      }),
    },
  },
);

const login = (code = 'code-1') =>
  ctx.app.inject({
    method: 'POST',
    url: '/v1/auth/telegram',
    payload: { code, codeVerifier: VERIFIER },
  });

describe('Telegram login', () => {
  beforeAll(() => {
    tokenCalls.length = 0;
  });

  it('tells the site how to start the login', async () => {
    const response = await ctx.app.inject({ url: '/v1/auth/providers' });
    expect(response.json()).toEqual({
      telegram: {
        clientId: CLIENT_ID,
        redirectUri: 'https://football-planner.ru/auth/telegram',
      },
      miniApp: true,
    });
  });

  it('trades the code for a session, once per Telegram user', async () => {
    const first = await login();
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      name: 'Ильдар Сафин',
      telegramLinked: true,
      photoUrl: PHOTO,
      token: expect.any(String),
    });
    expect(tokenCalls.at(-1)).toEqual({
      auth: `Basic ${Buffer.from(`${CLIENT_ID}:client-secret`).toString('base64')}`,
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'code-1',
        redirect_uri: 'https://football-planner.ru/auth/telegram',
        client_id: CLIENT_ID,
        code_verifier: VERIFIER,
      }),
    });

    const second = await login('code-2');
    expect(second.json()._id).toBe(first.json()._id);
    expect(await countRows(ctx.app, users, eq(users.telegramId, 4242))).toBe(1);

    const me = await ctx.app.inject({
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${second.json().token}` },
    });
    expect(me.json()).toMatchObject({ name: 'Ильдар Сафин' });
  });

  it('signs in to the site account that Telegram is linked to', async () => {
    const site = await register(ctx.app, { name: 'Андрей' });
    await ctx.app.db
      .update(users)
      .set({ telegramId: 4242 })
      .where(eq(users._id, site._id));
    expect((await login()).json()._id).toBe(site._id);
  });

  it('refuses tokens of another bot, unsigned ones and bad codes', async () => {
    tokenAnswer = async () =>
      Response.json({ id_token: await idToken({}, '1') });
    expect((await login()).json().code).toBe('TELEGRAM_AUTH_FAILED');

    const other = await generateKeyPair('RS256');
    tokenAnswer = async () =>
      Response.json({
        id_token: await new SignJWT({ id: 4242 })
          .setProtectedHeader({ alg: 'RS256' })
          .setIssuer('https://oauth.telegram.org')
          .setAudience(CLIENT_ID)
          .setExpirationTime('1h')
          .sign(other.privateKey),
      });
    expect((await login()).statusCode).toBe(401);

    tokenAnswer = async () =>
      Response.json({ error: 'invalid_grant' }, { status: 400 });
    expect((await login()).statusCode).toBe(401);
    // Telegram's own way: the error with a 200, named in the answer
    tokenAnswer = async () => Response.json({ error: 'invalid_client' });
    expect((await login()).json()).toEqual({
      code: 'TELEGRAM_AUTH_FAILED',
      message: 'token endpoint said invalid_client',
    });

    tokenAnswer = async () => Promise.reject(new Error('network'));
    expect((await login()).json().code).toBe('TELEGRAM_UNAVAILABLE');

    // Telegram's own trouble is a 502, not a failed login
    tokenAnswer = async () => new Response('oops', { status: 503 });
    expect((await login()).json().code).toBe('TELEGRAM_UNAVAILABLE');
    tokenAnswer = async () => new Response('<html>', { status: 200 });
    expect((await login()).json().code).toBe('TELEGRAM_AUTH_FAILED');

    // A token that never expires is not accepted
    tokenAnswer = async () =>
      Response.json({
        id_token: await new SignJWT({ id: 4242 })
          .setProtectedHeader({ alg: 'RS256' })
          .setIssuer('https://oauth.telegram.org')
          .setAudience(CLIENT_ID)
          .setIssuedAt()
          .sign(keys.privateKey),
      });
    expect((await login()).statusCode).toBe(401);

    // Ids only as numbers: "1e3" is not a Telegram id
    tokenAnswer = async () =>
      Response.json({ id_token: await idToken({ id: '1e3' }) });
    expect((await login()).statusCode).toBe(401);

    expect(await countRows(ctx.app, users)).toBe(0);
    tokenAnswer = async () => Response.json({ id_token: await idToken() });
  });

  it('keeps the latest https photo for avatars, also in rosters', async () => {
    const newer = 'https://t.me/i/userpic/320/ildar-2.jpg';
    tokenAnswer = async () =>
      Response.json({ id_token: await idToken({ picture: newer }) });
    const session = (await login()).json();
    expect(session.photoUrl).toBe(newer);

    // Not a link to show: the stored photo stays
    tokenAnswer = async () =>
      Response.json({ id_token: await idToken({ picture: 'javascript:x' }) });
    expect((await login()).json().photoUrl).toBe(newer);
    tokenAnswer = async () => Response.json({ id_token: await idToken() });

    const auth = { authorization: `Bearer ${session.token}` };
    const event = await createEvent(ctx.app, auth);
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/events/${event._id}/players`,
      headers: auth,
      payload: { name: 'Ильдар', status: true, friends: [] },
    });
    const roster = await ctx.app.inject({
      url: `/v1/events/${event._id}/players`,
      headers: auth,
    });
    expect(roster.json()).toMatchObject([{ name: 'Ильдар', photoUrl: newer }]);
  });

  it('rejects a malformed PKCE verifier', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/telegram',
      payload: { code: 'x', codeVerifier: 'short' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('Mini App sign-in', () => {
  const webapp = (initData: string) =>
    ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/telegram/webapp',
      payload: { initData },
    });

  it('signs in whoever Telegram vouches for', async () => {
    const response = await webapp(
      signInitData({ auth_date: now(), user: tgUser }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Ильдар Сафин',
      telegramLinked: true,
      photoUrl: PHOTO,
    });
    // The Mini App signs in on every launch: its session is short
    const { exp, iat } = ctx.app.jwt.decode<{ exp: number; iat: number }>(
      response.json().token,
    )!;
    expect(exp - iat).toBe(86_400);
    // The same account as the bot's buttons and the site's login
    expect((await login()).json()._id).toBe(response.json()._id);
  });

  it('refuses forged data', async () => {
    const response = await webapp(
      signInitData({ auth_date: now(), user: tgUser }, '999:other'),
    );
    expect(response.statusCode).toBe(401);
    expect(await countRows(ctx.app, users)).toBe(0);
  });
});
