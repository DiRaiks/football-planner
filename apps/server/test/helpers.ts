import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { buildApp, type BuildAppOptions } from '../src/app.js';
import type { TelegramTestOptions } from '../src/plugins/telegram/index.js';
import { UserModel } from '../src/modules/users/user.model.js';

export const JWT_SECRET = 'test-secret-that-is-long-enough-1234567890';

type App = Awaited<ReturnType<typeof buildApp>>;

/** Starts an in-memory MongoDB and the app once per test file, clears collections before each test */
export const setupApp = (
  env: Record<string, unknown> = {},
  telegram?: TelegramTestOptions,
  options: Pick<BuildAppOptions, 'telegramLogin'> = {},
) => {
  const ctx = {} as { app: App; mongo: MongoMemoryServer };

  beforeAll(async () => {
    ctx.mongo = await MongoMemoryServer.create();
    ctx.app = await buildApp({
      fastify: { logger: false },
      telegram,
      ...options,
      env: {
        PORT: 0,
        MONGO_URI: ctx.mongo.getUri(),
        JWT_SECRET,
        LOG_FORMAT: 'json',
        LOG_LEVEL: 'silent',
        CORS_ORIGINS: 'https://football-planner.ru',
        ...env,
      },
    });
    await ctx.app.ready();
  });

  beforeEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await ctx.app?.close();
    await ctx.mongo?.stop();
  });

  return ctx;
};

export const register = async (
  app: App,
  { email = 'user@example.com', name = 'User', password = 'password123' } = {},
) => {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, name, password },
  });
  if (res.statusCode !== 200)
    throw new Error(`registration failed: ${res.body}`);

  const body = res.json() as { _id: string; token: string; email: string };
  return { ...body, auth: { authorization: `Bearer ${body.token}` } };
};

export const createEvent = async (
  app: App,
  auth: Record<string, string>,
  payload: Record<string, unknown> = {},
) => {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/events',
    headers: auth,
    payload: {
      place: 'Stadium',
      time: '20:00',
      date: '2026-11-01',
      minimum: 10,
      eventName: 'Tuesday game',
      ...payload,
    },
  });
  if (res.statusCode !== 201)
    throw new Error(`event creation failed: ${res.body}`);

  return res.json() as {
    _id: string;
    creatorId: string;
    playersAmount: number;
  };
};

/** Registers a user and grants admin rights directly in the database, as `npm run set-role` does */
export const registerAdmin = async (app: App) => {
  const admin = await register(app, { email: 'admin@example.com' });
  await UserModel.updateOne({ _id: admin._id }, { role: 'admin' });
  return admin;
};
