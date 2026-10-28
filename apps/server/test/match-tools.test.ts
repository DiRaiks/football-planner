import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { events as eventsTable } from '../src/db/index.js';
import {
  addChat,
  countRows,
  createEvent,
  getEvent,
  register,
  setupApp,
} from './helpers.js';

const calls: { method: string; payload: Record<string, unknown> }[] = [];
let messageId = 0;

const ctx = setupApp(
  {
    AUTH_RATE_LIMIT_MAX: 1000,
    BOT_TOKEN: '123:test',
    TIME_ZONE: 'Europe/Moscow',
  },
  {
    botInfo: {
      id: 1,
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
    configureApi: (api) => {
      api.config.use(async (_prev, method, payload) => {
        calls.push({ method, payload: payload as Record<string, unknown> });
        const result =
          method === 'sendMessage'
            ? {
                message_id: ++messageId,
                date: 0,
                chat: { id: 1, type: 'group' },
              }
            : true;
        return { ok: true, result } as never;
      });
    },
  },
);

const CHAT = -100;
const texts = () =>
  calls
    .filter((c) => c.method === 'sendMessage' && c.payload.chat_id === CHAT)
    .map((c) => String(c.payload.text));

let people = 0;
const person = (name: string) =>
  register(ctx.app, { email: `p${++people}@example.com`, name });

const join = (
  auth: Record<string, string>,
  eventId: string,
  payload: Record<string, unknown>,
) =>
  ctx.app.inject({
    method: 'POST',
    url: `/v1/events/${eventId}/players`,
    headers: auth,
    payload: { friends: [], ...payload },
  });

beforeEach(async () => {
  calls.length = 0;
  await addChat(ctx.app, CHAT);
});

describe('weekly matches', () => {
  it('creates the next match a week later once this one starts, once', async () => {
    const owner = await person('Owner');
    const event = await createEvent(ctx.app, owner.auth, {
      eventName: 'Вторник',
      date: '2026-11-03',
      time: '20:00',
      minimum: 8,
      maximum: 12,
      price: 300,
      repeat: 'weekly',
    });
    const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!;
    const { events } = ctx.app.services;

    expect(
      await events.createDueRepeats(new Date(startsAt.getTime() - 1000)),
    ).toHaveLength(0);
    const [next] = await events.createDueRepeats(
      new Date(startsAt.getTime() + 1000),
    );
    expect(next).toMatchObject({
      eventName: 'Вторник',
      date: '2026-11-10',
      time: '20:00',
      minimum: 8,
      maximum: 12,
      price: 300,
      repeat: 'weekly',
      creatorId: owner._id,
      playersAmount: 0,
    });
    expect(next!.startsAt?.toISOString()).toBe('2026-11-10T17:00:00.000Z');
    expect(
      await events.createDueRepeats(new Date(startsAt.getTime() + 2000)),
    ).toHaveLength(0);
    // The new match is announced like any other
    await vi.waitFor(() =>
      expect(
        texts().filter((t) => t.includes('⚽ <b>Вторник</b>')),
      ).toHaveLength(2),
    );
  });

  it('catches up past weeks in one step, once, even when run twice at a time', async () => {
    const owner = await person('Owner');
    const event = await createEvent(ctx.app, owner.auth, {
      date: '2026-09-01',
      repeat: 'weekly',
    });
    const { events } = ctx.app.services;
    const now = new Date('2026-10-01T00:00:00Z');

    const runs = await Promise.all([
      events.createDueRepeats(now),
      events.createDueRepeats(now),
    ]);
    expect(runs.flat().map((next) => next.date)).toEqual(['2026-10-06']);
    expect(
      await countRows(
        ctx.app,
        eventsTable,
        eq(eventsTable.repeatOf, event._id),
      ),
    ).toBe(1);
    expect(await events.createDueRepeats(now)).toHaveLength(0);
  });

  it('finishes a series whose next match was made before a crash', async () => {
    const owner = await person('Owner');
    const event = await createEvent(ctx.app, owner.auth, {
      date: '2026-11-03',
      repeat: 'weekly',
    });
    const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!;
    // The next match exists, but the series was not marked done
    await ctx.app.db.insert(eventsTable).values({
      eventName: 'x',
      place: 'x',
      date: '2026-11-10',
      time: '20:00',
      minimum: 0,
      playersAmount: 0,
      creatorId: owner._id,
      repeatOf: event._id,
    });

    const after = new Date(startsAt.getTime() + 1000);
    expect(await ctx.app.services.events.createDueRepeats(after)).toHaveLength(
      0,
    );
    expect(
      await countRows(
        ctx.app,
        eventsTable,
        eq(eventsTable.repeatOf, event._id),
      ),
    ).toBe(1);
    expect((await getEvent(ctx.app, event._id))!.nextCreated).toBe(true);
  });

  it('leaves one-off matches alone', async () => {
    const owner = await person('Owner');
    const event = await createEvent(ctx.app, owner.auth, {
      date: '2026-11-03',
    });
    const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!;
    expect(
      await ctx.app.services.events.createDueRepeats(
        new Date(startsAt.getTime() + 1000),
      ),
    ).toHaveLength(0);
  });
});

describe('teams', () => {
  it('splits the squad evenly, guests included, and posts it to the chat', async () => {
    const owner = await person('Owner');
    const event = await createEvent(ctx.app, owner.auth, {
      minimum: 1,
      maximum: 5,
    });
    await join(owner.auth, event._id, {
      name: 'Owner',
      status: true,
      friends: [{ name: 'Guest', status: true }],
    });
    for (const name of ['A', 'B', 'C', 'D']) {
      const p = await person(name);
      await join(p.auth, event._id, { name, status: true });
    }
    const maybe = await person('Maybe');
    await join(maybe.auth, event._id, { name: 'Maybe', status: false });

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/v1/events/${event._id}/teams`,
      headers: owner.auth,
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    const teams = response.json().teams as string[][];
    expect(teams.map((team) => team.length).sort()).toEqual([2, 3]);
    // The five places: the owner, their guest, A, B and C; D waits, Maybe is not sure
    expect(teams.flat().sort()).toEqual([
      'A',
      'B',
      'C',
      'Guest (от Owner)',
      'Owner',
    ]);

    await vi.waitFor(() =>
      expect(texts().some((t) => t.startsWith('⚽ Составы на'))).toBe(true),
    );
    const message = texts().find((t) => t.startsWith('⚽ Составы на'))!;
    expect(message).toContain('🟢 <b>Команда 1</b>');
    expect(message).toContain('🔵 <b>Команда 2</b>');
    expect(message).toContain('Guest (от Owner)');
  });

  it('drops the teams once the squad changes', async () => {
    const owner = await person('Owner');
    const event = await createEvent(ctx.app, owner.auth);
    await join(owner.auth, event._id, { name: 'Owner', status: true });
    const other = await person('Other');
    await join(other.auth, event._id, { name: 'Other', status: true });
    const split = await ctx.app.inject({
      method: 'POST',
      url: `/v1/events/${event._id}/teams`,
      headers: owner.auth,
      payload: {},
    });
    expect(split.json().teams).toHaveLength(2);

    // A "maybe" does not touch the squad
    const maybe = await person('Maybe');
    const signUp = await join(maybe.auth, event._id, {
      name: 'Maybe',
      status: false,
    });
    expect(signUp.json().event.teams).toHaveLength(2);

    const sure = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}/players/${signUp.json().player._id}`,
      headers: maybe.auth,
      payload: { status: true },
    });
    expect(sure.json().event.teams).toBeUndefined();
  });

  it('is for the organiser, and needs enough players', async () => {
    const owner = await person('Owner');
    const event = await createEvent(ctx.app, owner.auth);
    const other = await person('Other');
    const split = (auth: Record<string, string>, count?: number) =>
      ctx.app.inject({
        method: 'POST',
        url: `/v1/events/${event._id}/teams`,
        headers: auth,
        payload: count ? { count } : {},
      });

    expect((await split(other.auth)).statusCode).toBe(403);
    await join(owner.auth, event._id, { name: 'Owner', status: true });
    expect((await split(owner.auth)).json().code).toBe('NOT_ENOUGH_PLAYERS');
    expect((await split(owner.auth, 5)).statusCode).toBe(400);
  });
});

describe('payments', () => {
  it('lets the organiser mark who paid', async () => {
    const owner = await person('Owner');
    const event = await createEvent(ctx.app, owner.auth, { price: 400 });
    const player = await person('Player');
    const signUp = await join(player.auth, event._id, {
      name: 'Player',
      status: true,
    });
    const url = `/v1/events/${event._id}/players/${signUp.json().player._id}/paid`;

    const forbidden = await ctx.app.inject({
      method: 'PATCH',
      url,
      headers: player.auth,
      payload: { paid: true },
    });
    expect(forbidden.statusCode).toBe(403);

    const paid = await ctx.app.inject({
      method: 'PATCH',
      url,
      headers: owner.auth,
      payload: { paid: true },
    });
    expect(paid.json()).toMatchObject({ name: 'Player', paid: true });
    const list = await ctx.app.inject({
      url: `/v1/events/${event._id}/players`,
      headers: owner.auth,
    });
    expect(list.json()[0]).toMatchObject({ paid: true });
    expect(
      (
        await ctx.app.inject({
          url: `/v1/events/${event._id}`,
          headers: owner.auth,
        })
      ).json(),
    ).toMatchObject({
      price: 400,
    });
  });
});

describe('attendance', () => {
  it('counts matches played with a place, maybe sign-ups, and the last match', async () => {
    const owner = await person('Owner');
    const a = await person('Аня');
    const b = await person('Боря');
    const past = async (date: string, maximum = 0) =>
      createEvent(ctx.app, owner.auth, { date, minimum: 1, maximum });

    const first = await past('2026-09-01');
    const second = await past('2026-09-08', 1);
    const future = await past('2026-12-01');
    await join(a.auth, first._id, { name: 'Аня', status: true });
    await join(b.auth, first._id, { name: 'Боря', status: false });
    await join(a.auth, second._id, { name: 'Аня', status: true });
    // Боря is sure but waits for the one place: not played
    await join(b.auth, second._id, { name: 'Боря', status: true });
    await join(a.auth, future._id, { name: 'Аня', status: true });

    const rows = await ctx.app.services.stats.attendance(
      90,
      new Date('2026-10-01T00:00:00Z'),
    );
    expect(rows).toEqual([
      {
        userId: a._id,
        name: 'Аня',
        played: 2,
        maybe: 0,
        lastPlayed: '2026-09-08',
      },
      { userId: b._id, name: 'Боря', played: 0, maybe: 1, lastPlayed: null },
    ]);

    const response = await ctx.app.inject({
      url: '/v1/stats/attendance?days=7',
      headers: owner.auth,
    });
    expect(response.statusCode).toBe(200);
    const status = async (days: string) =>
      (
        await ctx.app.inject({
          url: `/v1/stats/attendance?days=${days}`,
          headers: owner.auth,
        })
      ).statusCode;
    // A week to a year, or 0 for all time
    expect(await status('0')).toBe(200);
    expect(await status('1')).toBe(400);
    expect(await status('366')).toBe(400);
  });
});
