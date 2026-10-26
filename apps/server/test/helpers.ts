import { count, eq, sql, type SQL } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { buildApp, type BuildAppOptions } from '../src/app.js';
import {
  connectPostgres,
  events,
  newId,
  players,
  users,
  type Database,
} from '../src/db/index.js';
import { createPgliteDatabase } from '../src/db/pglite.js';
import type { TelegramTestOptions } from '../src/plugins/telegram/index.js';

export const JWT_SECRET = 'test-secret-that-is-long-enough-1234567890';

type App = Awaited<ReturnType<typeof buildApp>>;

/**
 * Postgres in memory (PGlite), or with TEST_DATABASE_URL a fresh database on that server
 * (e.g. postgres://postgres:pw@localhost:5432/postgres), dropped after the test file
 */
const createTestDatabase = async (): Promise<Database> => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return createPgliteDatabase();

  const name = `football_test_${newId()}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const target = new URL(url);
  target.pathname = `/${name}`;
  const database = connectPostgres(target.toString());
  return {
    ...database,
    close: async () => {
      await database.close();
      const cleanup = new pg.Client({ connectionString: url });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await cleanup.end();
    },
  };
};

/** Starts the database and the app once per test file, empties tables before each test */
export const setupApp = (
  env: Record<string, unknown> = {},
  telegram?: TelegramTestOptions,
  options: Pick<BuildAppOptions, 'telegramLogin'> = {},
) => {
  const ctx = {} as { app: App; database: Database };

  beforeAll(async () => {
    ctx.database = await createTestDatabase();
    ctx.app = await buildApp({
      database: ctx.database,
      fastify: { logger: false },
      telegram,
      jobs: false,
      ...options,
      env: {
        PORT: 0,
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
    // The chats table appears with the bot's first query
    await ctx.app.db.execute(sql`
      DO $$ BEGIN
        TRUNCATE players, events, users;
        IF to_regclass('chats') IS NOT NULL THEN TRUNCATE chats; END IF;
      END $$`);
  });

  afterAll(async () => {
    await ctx.app?.close();
    await ctx.database?.close();
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
  await app.db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users._id, admin._id));
  return admin;
};

/** Subscribes a chat to the bot's messages, as /subscribe does */
export const addChat = (app: App, chatId: number, topics = ['events']) =>
  app.subscriptions.store.save(chatId, { topics });

/** A match as stored, or null */
export const getEvent = async (app: App, id: string) => {
  const [event] = await app.db.select().from(events).where(eq(events._id, id));
  return event ?? null;
};

/** Rows of a table, optionally matching a condition */
export const countRows = async (
  app: App,
  table: typeof events | typeof players | typeof users,
  where?: SQL,
) => {
  const [row] = await app.db.select({ n: count() }).from(table).where(where);
  return row!.n;
};

export const getPlayer = async (app: App, id: string) => {
  const [player] = await app.db
    .select()
    .from(players)
    .where(eq(players._id, id));
  return player ?? null;
};

/** The first sign-up for a match */
export const firstPlayerOf = async (app: App, eventId: string) => {
  const [player] = await app.db
    .select()
    .from(players)
    .where(eq(players.eventId, eventId))
    .orderBy(players.createdAt, players._id)
    .limit(1);
  return player ?? null;
};

export const findUser = async (app: App, where: SQL) => {
  const [user] = await app.db.select().from(users).where(where).limit(1);
  return user ?? null;
};
