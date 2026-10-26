import { pgStore } from '@dirai/tg-kit';
import { eq } from 'drizzle-orm';
import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import { events, players, users } from '../src/db/index.js';
import {
  NotEmptyError,
  formatReport,
  migrateFromMongo,
  type MongoCollection,
  type MongoDoc,
} from '../src/db/migrate-from-mongo.js';
import { countRows, findUser, getEvent, setupApp } from './helpers.js';

const ctx = setupApp({ TIME_ZONE: 'Europe/Moscow' });

const id = () => new ObjectId();
const ids = {
  admin: id(),
  anya: id(),
  boris: id(),
  legacy: id(),
  duplicate: id(),
  gone: id(),
  weekly: id(),
  next: id(),
  twin: id(),
  byTwin: id(),
  old: id(),
  broken: id(),
};
const created = new Date('2026-09-20T10:00:00Z');

/** Documents as MongoDB holds them after years of the old versions */
const fixture = (): Record<MongoCollection, MongoDoc[]> => ({
  users: [
    {
      _id: ids.admin,
      email: 'admin@example.com',
      name: 'Админ',
      hash: 'scrypt$abc',
      role: 'admin',
      tokenVersion: 3,
      createdAt: created,
      updatedAt: created,
      __v: 0,
    },
    {
      _id: ids.anya,
      name: 'Аня Котова',
      telegramId: 501,
      telegramUsername: 'anya',
      role: 'user',
      tokenVersion: 0,
      createdAt: created,
    },
    {
      _id: ids.boris,
      email: 'boris@example.com',
      name: 'Борис',
      hash: 'scrypt$def',
      telegramLink: {
        token: 'a'.repeat(64),
        expiresAt: new Date('2026-10-01T00:00:00Z'),
      },
    },
    // Stored before emails were lowercased, with the old PBKDF2 hash
    {
      _id: ids.legacy,
      email: 'Old@Example.com',
      name: 'Old Timer',
      hash: 'deadbeef',
      salt: 'salt',
    },
    // The old case-sensitive index let the same address in twice
    { _id: ids.duplicate, email: 'old@example.com', name: 'Old Twin' },
  ],
  events: [
    {
      _id: ids.weekly,
      eventName: 'Вторник',
      place: 'Манеж',
      date: '2026-09-29',
      time: '20:00',
      startsAt: new Date('2026-09-29T17:00:00Z'),
      minimum: 10,
      maximum: 2,
      repeat: 'weekly',
      price: 300,
      nextCreated: true,
      playersAmount: 4,
      creatorId: ids.admin.toString(),
      location: { lat: 55.75, lon: 37.62 },
      teams: [['Аня'], ['Борис']],
      telegram: {
        announcements: [{ chatId: -100, messageId: 7 }],
        minimumReached: false,
        reminders: { day: true },
        scheduledAt: new Date('2026-09-20T10:00:00Z'),
      },
      createdAt: created,
      updatedAt: created,
    },
    {
      _id: ids.next,
      eventName: 'Вторник',
      place: 'Манеж',
      date: '2026-10-06',
      time: '20:00',
      startsAt: new Date('2026-10-06T17:00:00Z'),
      minimum: 10,
      repeat: 'weekly',
      repeatOf: ids.weekly.toString(),
      playersAmount: 0,
      creatorId: ids.admin.toString(),
    },
    // A second next match of the same series, from a race of old versions
    {
      _id: ids.twin,
      eventName: 'Вторник',
      place: 'Манеж',
      date: '2026-10-06',
      time: '20:00',
      startsAt: new Date('2026-10-06T17:00:00Z'),
      minimum: 10,
      repeat: 'weekly',
      repeatOf: ids.weekly.toString(),
      playersAmount: 0,
      creatorId: ids.admin.toString(),
    },
    // Organised by the twin account
    {
      _id: ids.byTwin,
      eventName: 'Матч близнеца',
      place: 'Двор',
      date: '2026-11-10',
      time: '19:00',
      startsAt: new Date('2026-11-10T16:00:00Z'),
      minimum: 4,
      playersAmount: 0,
      creatorId: ids.duplicate.toString(),
    },
    // Saved before startsAt existed, with free-text date and time
    {
      _id: ids.old,
      eventName: 'Старый матч',
      place: 'Двор',
      date: '03.11.2026',
      time: '20.00',
      minimum: 6,
      playersAmount: 1,
      creatorId: ids.anya.toString(),
    },
    {
      _id: ids.broken,
      eventName: 'Когда-нибудь',
      place: 'Двор',
      date: 'someday',
      time: 'вечером',
      minimum: 6,
      playersAmount: 0,
      creatorId: ids.anya.toString(),
    },
  ],
  players: [
    {
      _id: id(),
      eventId: ids.weekly.toString(),
      userId: ids.anya.toString(),
      name: 'Аня',
      date: '2026-09-29',
      status: true,
      sureSince: new Date('2026-09-21T10:00:00Z'),
      friends: [
        {
          _id: id(),
          name: 'Гость 1',
          status: true,
          sureSince: new Date('2026-09-21T10:05:00Z'),
        },
      ],
      paid: true,
      createdAt: new Date('2026-09-21T10:00:00Z'),
    },
    {
      _id: id(),
      eventId: ids.weekly.toString(),
      userId: ids.boris.toString(),
      name: 'Борис',
      date: '2026-09-29',
      status: true,
      friends: [{ _id: id(), name: 'Петя', status: false }],
      createdAt: new Date('2026-09-22T10:00:00Z'),
    },
    {
      _id: id(),
      eventId: ids.old.toString(),
      userId: ids.legacy.toString(),
      name: 'Old Timer',
      date: '03.11.2026',
      status: false,
      friends: [],
    },
    // By the twin account: moves to the account that keeps the address
    {
      _id: id(),
      eventId: ids.weekly.toString(),
      userId: ids.duplicate.toString(),
      name: 'Old Twin',
      date: '2026-09-29',
      status: false,
      friends: [],
      createdAt: new Date('2026-09-23T10:00:00Z'),
    },
    // Signed up for a match deleted long ago, and by a user deleted since
    {
      _id: id(),
      eventId: ids.gone.toString(),
      userId: ids.anya.toString(),
      name: 'Аня',
      date: '2026-01-01',
      status: true,
      friends: [],
    },
    {
      _id: id(),
      eventId: ids.old.toString(),
      userId: ids.gone.toString(),
      name: 'Призрак',
      date: '03.11.2026',
      status: true,
      friends: [],
    },
  ],
  chats: [
    // Saved by the telegraf-based bot: no topics
    { _id: id(), chatId: -100, createdAt: created },
    { _id: id(), chatId: 300, topics: [], settings: {} },
    { _id: id(), chatId: 301, topics: ['events'] },
  ],
});

const run = (dryRun: boolean, docs = fixture(), force = false) =>
  migrateFromMongo(
    // Like a MongoDB cursor: an async iterable of documents
    async function* (name) {
      yield* docs[name];
    },
    dryRun ? null : ctx.database,
    { timeZone: 'Europe/Moscow', dryRun, force },
  );

/** The chats as the bot reads them */
const chats = async () =>
  (await pgStore(ctx.database.client, { table: 'chats' }).list()).map((c) => [
    c.chatId,
    c.topics,
  ]);

describe('migrate-from-mongo', () => {
  it('reports counts and every problem on a dry run, writing nothing', async () => {
    const report = await run(true);

    expect(report.collections).toEqual({
      users: { read: 5, inserted: 4, existing: 0, skipped: 1 },
      events: { read: 6, inserted: 6, existing: 0, skipped: 0 },
      players: { read: 6, inserted: 4, existing: 0, skipped: 2 },
      chats: { read: 3, inserted: 3, existing: 0, skipped: 0 },
    });
    expect(report.startsAtFilled).toBe(1);
    expect(report.problems).toEqual([
      `users ${ids.duplicate}: skipped, same old@example.com as ${ids.legacy}; its sign-ups move to that account`,
      `events ${ids.byTwin}: organiser is now ${ids.legacy}`,
      `events ${ids.old}: date and time "03.11.2026 20.00" saved as "2026-11-03 20:00"`,
      `events ${ids.broken}: no start time, date "someday" and time "вечером" are not readable`,
      `events ${ids.twin}: another match follows ${ids.weekly} already, kept without the link`,
      expect.stringMatching(
        new RegExp(`skipped, match ${ids.gone} not found \\(Аня\\)`),
      ),
      expect.stringMatching(
        new RegExp(`skipped, user ${ids.gone} not found \\(Призрак\\)`),
      ),
    ]);
    expect(formatReport(report).join('\n')).toContain(
      'players  read 6, would insert 4, skipped 2',
    );
    expect(await countRows(ctx.app, users)).toBe(0);
    expect(await countRows(ctx.app, events)).toBe(0);
  });

  it('copies everything with the original ids, once', async () => {
    const report = await run(false);
    expect(report.collections.players).toEqual({
      read: 6,
      inserted: 4,
      existing: 0,
      skipped: 2,
    });

    expect(
      await findUser(ctx.app, eq(users._id, ids.admin.toString())),
    ).toMatchObject({
      email: 'admin@example.com',
      role: 'admin',
      tokenVersion: 3,
      createdAt: created,
    });
    expect(
      await findUser(ctx.app, eq(users._id, ids.anya.toString())),
    ).toMatchObject({ email: null, telegramId: 501, telegramUsername: 'anya' });
    expect(
      await findUser(ctx.app, eq(users._id, ids.boris.toString())),
    ).toMatchObject({
      telegramLinkToken: 'a'.repeat(64),
      telegramLinkExpiresAt: new Date('2026-10-01T00:00:00Z'),
    });
    expect(
      await findUser(ctx.app, eq(users._id, ids.legacy.toString())),
    ).toMatchObject({ email: 'old@example.com', salt: 'salt' });

    expect(await getEvent(ctx.app, ids.weekly.toString())).toMatchObject({
      maximum: 2,
      repeat: 'weekly',
      price: 300,
      nextCreated: true,
      teams: [['Аня'], ['Борис']],
      location: { lat: 55.75, lon: 37.62 },
      telegram: {
        announcements: [{ chatId: -100, messageId: 7 }],
        minimumReached: false,
        reminders: { day: true },
        scheduledAt: '2026-09-20T10:00:00.000Z',
      },
    });
    expect(await getEvent(ctx.app, ids.next.toString())).toMatchObject({
      repeatOf: ids.weekly.toString(),
      nextCreated: false,
    });
    expect((await getEvent(ctx.app, ids.twin.toString()))?.repeatOf).toBeNull();
    expect(await getEvent(ctx.app, ids.old.toString())).toMatchObject({
      date: '2026-11-03',
      time: '20:00',
      startsAt: new Date('2026-11-03T17:00:00Z'),
    });
    expect(
      (await getEvent(ctx.app, ids.broken.toString()))?.startsAt,
    ).toBeNull();

    const [old] = await ctx.app.db
      .select()
      .from(players)
      .where(eq(players.eventId, ids.old.toString()));
    expect(old).toMatchObject({ date: '2026-11-03', paid: false });
    // Chats of the old bot get the topic they used to receive
    expect(await chats()).toEqual([
      [-100, ['events']],
      [300, []],
      [301, ['events']],
    ]);

    await expect(run(false)).rejects.toThrow(NotEmptyError);
    const again = await run(false, fixture(), true);
    expect(again.collections.users).toEqual({
      read: 5,
      inserted: 0,
      existing: 4,
      skipped: 1,
    });
    expect(again.collections.players.existing).toBe(4);
    expect(again.collections.chats.existing).toBe(3);
    expect(await countRows(ctx.app, players)).toBe(4);
  });

  it('keeps old sessions and links working on the copied data', async () => {
    await run(false);
    const admin = await findUser(ctx.app, eq(users._id, ids.admin.toString()));
    // A token issued before the move: the same user id and version
    const token = ctx.app.jwt.sign({ id: ids.admin.toString(), v: 3 });
    const auth = { authorization: `Bearer ${token}` };

    const players = await ctx.app.inject({
      // Upper case as MongoDB accepted it
      url: `/v1/events/${ids.weekly.toString().toUpperCase()}/players`,
      headers: auth,
    });
    expect(players.statusCode).toBe(200);
    expect(
      (
        players.json() as { name: string; waitlisted: boolean; paid: boolean }[]
      ).map((p) => [p.name, p.waitlisted, p.paid]),
    ).toEqual([
      ['Аня', false, true],
      // Аня and her guest took the two places
      ['Борис', true, false],
      ['Old Twin', false, false],
    ]);

    const me = await ctx.app.inject({ url: '/v1/auth/me', headers: auth });
    expect(me.json()).toMatchObject({ _id: admin!._id, role: 'admin' });

    // Sign-ups keep pointing at their users
    const stats = await ctx.app.inject({
      url: `/v1/users/${ids.legacy}/stats`,
      headers: auth,
    });
    expect(stats.json()).toEqual({ eventsCount: 2 });
  });

  it('keeps the account with a password, else the oldest, whatever the order', async () => {
    const docs = fixture();
    const twin = docs.users.find((u) => u._id === ids.duplicate)!;
    // The twin comes first and is older, but has no password
    twin.createdAt = new Date('2020-01-01T00:00:00Z');
    docs.users = [twin, ...docs.users.filter((u) => u !== twin)];
    const report = await run(false, docs);
    expect(report.problems).toContain(
      `users ${ids.duplicate}: skipped, same old@example.com as ${ids.legacy}; its sign-ups move to that account`,
    );
    expect(await getEvent(ctx.app, ids.byTwin.toString())).toMatchObject({
      creatorId: ids.legacy.toString(),
    });

    // Neither has a password: the older one stays
    const a = { _id: id(), email: 'same@example.com', name: 'A' };
    const b = { _id: id(), email: 'SAME@example.com', name: 'B' };
    const older = await run(true, {
      ...fixture(),
      users: [
        { ...a, createdAt: new Date('2026-02-01T00:00:00Z') },
        { ...b, createdAt: new Date('2026-01-01T00:00:00Z') },
      ],
    });
    expect(older.problems).toContain(
      `users ${a._id}: skipped, same same@example.com as ${b._id}; its sign-ups move to that account`,
    );
  });

  it('adds only what is new on a second run', async () => {
    const docs = fixture();
    await run(false, { ...docs, players: [], chats: [] });
    const report = await run(false, docs, true);
    expect(report.collections.users.inserted).toBe(0);
    expect(report.collections.players.inserted).toBe(4);
    expect(report.collections.chats.inserted).toBe(3);
  });
});
