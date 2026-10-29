import { eq, isNull, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { events, players, users } from '../src/db/index.js';
import { playersInOrder } from '../src/modules/players/players.service.js';
import {
  addChat,
  countRows,
  createEvent,
  findUser,
  firstPlayerOf,
  getEvent,
  register,
  setupApp,
} from './helpers.js';

type Call = { method: string; payload: Record<string, unknown> };
const calls: Call[] = [];
let messageId = 0;

const ctx = setupApp(
  {
    AUTH_RATE_LIMIT_MAX: 1000,
    BOT_TOKEN: '123:test',
    PUBLIC_URL: 'https://football-planner.ru',
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
const ANYA = {
  id: 501,
  first_name: 'Аня',
  last_name: 'Котова',
  username: 'anya',
};
const BORIS = { id: 502, first_name: 'Борис' };
let updateId = 0;

const press = (data: string, from: { id: number; first_name: string } = ANYA) =>
  ctx.app.tg.bot.handleUpdate({
    update_id: ++updateId,
    callback_query: {
      id: String(updateId),
      from: { is_bot: false, ...from },
      chat_instance: '1',
      data,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: CHAT, type: 'group', title: 'Football' },
        text: 'announcement',
      },
    },
  } as never);

const say = (
  text: string,
  from = ANYA,
  chatType: 'private' | 'group' = 'private',
) =>
  ctx.app.tg.bot.handleUpdate({
    update_id: ++updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat:
        chatType === 'private'
          ? { id: from.id, type: 'private', first_name: from.first_name }
          : { id: CHAT, type: 'group', title: 'Football' },
      from: { is_bot: false, ...from },
      text,
      entities: [
        { type: 'bot_command', offset: 0, length: text.split(' ')[0]!.length },
      ],
    },
  } as never);

const answers = () =>
  calls
    .filter((c) => c.method === 'answerCallbackQuery')
    .map((c) => c.payload.text);
const replies = (chatId: number) =>
  calls
    .filter((c) => c.method === 'sendMessage' && c.payload.chat_id === chatId)
    .map((c) => String(c.payload.text));

/** A match a week ahead, so it has not started whenever the tests run */
let owners = 0;
const futureMatch = async (payload: Record<string, unknown> = {}) => {
  const { auth } = await register(ctx.app, {
    email: `owner-${++owners}@example.com`,
  });
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  // No sign-up deadline check: its warnings are tested in deadline-rain.test.ts
  const event = await createEvent(ctx.app, auth, {
    date: day,
    deadlineHours: 0,
    ...payload,
  });
  return { event, auth };
};

beforeEach(async () => {
  calls.length = 0;
  await addChat(ctx.app, CHAT);
});

describe('sign-up buttons', () => {
  it('signs up a Telegram user without a site account', async () => {
    const { event } = await futureMatch();
    await press(`rsvp:${event._id}:yes`);

    expect(answers()).toEqual(['✅ Вы в составе']);
    const user = await findUser(ctx.app, eq(users.telegramId, ANYA.id));
    expect(user).toMatchObject({
      name: 'Аня Котова',
      telegramUsername: 'anya',
    });
    expect(user?.email).toBeNull();
    expect(await firstPlayerOf(ctx.app, event._id)).toMatchObject({
      name: 'Аня Котова',
      status: true,
      userId: user!._id.toString(),
    });
    // The pinned announcement follows
    await vi.waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === 'editMessageText' &&
            String(c.payload.text).includes('Аня Котова'),
        ),
      ).toBe(true),
    );

    await press(`rsvp:${event._id}:yes`);
    expect(answers().at(-1)).toBe('Вы уже в списке');
  });

  it('switches to maybe, adds guests and leaves', async () => {
    const { event } = await futureMatch();
    await press(`rsvp:${event._id}:maybe`);
    expect(answers().at(-1)).toBe('🤔 Отметил: возможно');
    await press(`rsvp:${event._id}:maybe`);
    expect(answers().at(-1)).toBe('Вы уже отметили «возможно»');

    await press(`rsvp:${event._id}:friend`);
    expect(answers().at(-1)).toBe('Добавил: Гость 1');
    expect((await firstPlayerOf(ctx.app, event._id))?.friends).toMatchObject([
      { name: 'Гость 1', status: false },
    ]);

    await press(`rsvp:${event._id}:no`);
    expect(answers().at(-1)).toBe('Отметил: вы и ваши гости не пойдёте');
    expect(
      await countRows(ctx.app, players, eq(players.eventId, event._id)),
    ).toBe(0);
    await press(`rsvp:${event._id}:no`);
    expect(answers().at(-1)).toBe('Вас и так нет в списке');
  });

  it('signs up with a guest in one press', async () => {
    const { event } = await futureMatch();
    await press(`rsvp:${event._id}:friend`, BORIS);
    expect(await firstPlayerOf(ctx.app, event._id)).toMatchObject({
      name: 'Борис',
      friends: [{ name: 'Гость 1', status: true }],
    });
  });

  it('refuses cancelled and started matches', async () => {
    const { event } = await futureMatch();
    await ctx.app.db
      .update(events)
      .set({ startsAt: new Date(Date.now() - 1000) })
      .where(eq(events._id, event._id));
    await press(`rsvp:${event._id}:yes`);
    expect(answers().at(-1)).toBe('Матч уже начался');

    await press(`rsvp:${'0'.repeat(24)}:yes`);
    expect(answers().at(-1)).toBe('Матч отменён');
  });
});

describe('places and the waitlist', () => {
  it('puts late sign-ups in line and moves them up when a place frees', async () => {
    const { event } = await futureMatch({ minimum: 1, maximum: 1 });
    const web = await register(ctx.app, {
      email: 'web@example.com',
      name: 'Веб',
    });
    const first = await ctx.app.inject({
      method: 'POST',
      url: `/v1/events/${event._id}/players`,
      headers: web.auth,
      payload: { name: 'Веб', status: true, friends: [] },
    });
    expect(first.json().count).toMatchObject({ exactly: 1, waiting: 0 });

    await press(`rsvp:${event._id}:yes`);
    expect(answers().at(-1)).toBe('⏳ Мест нет: вы в листе ожидания');
    const list = await ctx.app.inject({
      url: `/v1/events/${event._id}/players`,
      headers: web.auth,
    });
    expect(
      list
        .json()
        .map((p: { name: string; waitlisted: boolean }) => [
          p.name,
          p.waitlisted,
        ]),
    ).toEqual([
      ['Веб', false],
      ['Аня Котова', true],
    ]);
    await vi.waitFor(() =>
      expect(
        replies(CHAT).some((t) =>
          t.includes('⏳ <b>Аня Котова</b> в листе ожидания'),
        ),
      ).toBe(true),
    );

    // The first player leaves: Anya gets the place, the chat and Anya hear about it
    await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/events/${event._id}/players/${first.json().player._id}`,
      headers: web.auth,
    });
    await vi.waitFor(() =>
      expect(
        replies(CHAT).some((t) =>
          t.includes('Из листа ожидания в состав: <b>Аня Котова</b>'),
        ),
      ).toBe(true),
    );
    await vi.waitFor(() =>
      expect(
        replies(ANYA.id).some((t) => t.includes('Освободилось место')),
      ).toBe(true),
    );
  });

  it('rejects fewer places than the minimum', async () => {
    const { auth } = await register(ctx.app, { email: 'max@example.com' });
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: auth,
      payload: {
        place: 'P',
        eventName: 'E',
        date: '2026-11-03',
        time: '20:00',
        minimum: 10,
        maximum: 8,
      },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('linking a site account', () => {
  it('links with a code and moves sign-ups made with the buttons', async () => {
    const { event } = await futureMatch();
    await press(`rsvp:${event._id}:yes`);
    const web = await register(ctx.app, {
      email: 'anya@example.com',
      name: 'Анна',
    });

    const link = await ctx.app.inject({
      method: 'POST',
      url: '/v1/users/me/telegram',
      headers: web.auth,
    });
    expect(link.json()).toEqual({
      code: expect.stringMatching(/^[A-Z2-9]{6}$/),
      botUrl: 'https://t.me/football_bot',
    });

    await say(`/link ${link.json().code.toLowerCase()}`);
    expect(replies(ANYA.id).at(-1)).toContain(
      'Telegram привязан к аккаунту <b>Анна</b>',
    );
    expect(await countRows(ctx.app, users, eq(users.telegramId, ANYA.id))).toBe(
      1,
    );
    expect(await firstPlayerOf(ctx.app, event._id)).toMatchObject({
      userId: web._id,
    });
    const me = await ctx.app.inject({ url: '/v1/auth/me', headers: web.auth });
    expect(me.json().telegramLinked).toBe(true);

    // The code works once
    await say(`/link ${link.json().code}`, BORIS);
    expect(replies(BORIS.id).at(-1)).toContain('Код не подошёл');

    const unlinked = await ctx.app.inject({
      method: 'DELETE',
      url: '/v1/users/me/telegram',
      headers: web.auth,
    });
    expect(unlinked.json().telegramLinked).toBe(false);
  });

  it('keeps the account sign-up when both signed up for the same match', async () => {
    const { event } = await futureMatch();
    await press(`rsvp:${event._id}:maybe`);
    const web = await register(ctx.app, {
      email: 'both@example.com',
      name: 'Анна',
    });
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/events/${event._id}/players`,
      headers: web.auth,
      payload: { name: 'Анна', status: true, friends: [] },
    });
    const { code } = (
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/users/me/telegram',
        headers: web.auth,
      })
    ).json();
    await say(`/link ${code}`);
    const signUps = await playersInOrder(ctx.app.db, event._id);
    expect(signUps.map((p) => [p.name, p.status])).toEqual([['Анна', true]]);
  });

  it('refuses a Telegram user linked to another account, and group chats', async () => {
    const first = await register(ctx.app, { email: 'first@example.com' });
    const second = await register(ctx.app, { email: 'second@example.com' });
    const code = async (auth: Record<string, string>) =>
      (
        await ctx.app.inject({
          method: 'POST',
          url: '/v1/users/me/telegram',
          headers: auth,
        })
      ).json().code as string;

    await say(`/link ${await code(first.auth)}`);
    await say(`/link ${await code(second.auth)}`);
    expect(replies(ANYA.id).at(-1)).toContain(
      'уже привязан к другому аккаунту',
    );

    await say('/link ABCDEF', ANYA, 'group');
    expect(replies(CHAT).at(-1)).toContain('в личные сообщения');
    await say('/link');
    expect(replies(ANYA.id).at(-1)).toContain('Получите код в профиле');
  });

  it('cannot unlink an account made from Telegram', async () => {
    const { event } = await futureMatch();
    await press(`rsvp:${event._id}:yes`);
    const user = await findUser(ctx.app, eq(users.telegramId, ANYA.id));
    const token = ctx.app.issueToken(user!);
    const response = await ctx.app.inject({
      method: 'DELETE',
      url: '/v1/users/me/telegram',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().code).toBe('TELEGRAM_ONLY');
  });
});

describe('reminders', () => {
  it('reminds the day before and two hours before, once each', async () => {
    const { event } = await futureMatch({ eventName: 'Вторник', minimum: 4 });
    const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!.getTime();
    const at = (hoursBefore: number) =>
      new Date(startsAt - hoursBefore * 3_600_000);
    await vi.waitFor(() => expect(replies(CHAT).length).toBeGreaterThan(0));
    calls.length = 0;

    // The match starts at 20:00 UTC: 23 hours before is the evening before
    expect(await ctx.app.telegramBot.sendDueReminders(at(30))).toBe(0);
    expect(await ctx.app.telegramBot.sendDueReminders(at(23))).toBe(1);
    expect(await ctx.app.telegramBot.sendDueReminders(at(19))).toBe(0);
    const day = calls.filter((c) => c.method === 'sendMessage').at(-1)!;
    expect(String(day.payload.text)).toContain('⏰ Завтра матч <b>Вторник</b>');
    expect(String(day.payload.text)).toContain('Нужно ещё 4');
    expect(JSON.stringify(day.payload.reply_markup)).toContain(
      `rsvp:${event._id}:yes`,
    );

    expect(await ctx.app.telegramBot.sendDueReminders(at(1.5))).toBe(1);
    expect(replies(CHAT).at(-1)).toContain('⏰ Скоро начало');
    expect(await ctx.app.telegramBot.sendDueReminders(at(1))).toBe(0);
  });

  it('sends only the second reminder for a match created shortly before', async () => {
    const { event } = await futureMatch();
    const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!.getTime();
    expect(
      await ctx.app.telegramBot.sendDueReminders(
        new Date(startsAt - 3_600_000),
      ),
    ).toBe(1);
    expect(
      await ctx.app.telegramBot.sendDueReminders(
        new Date(startsAt - 1_800_000),
      ),
    ).toBe(0);
  });

  it('starts over when the start time changes', async () => {
    const { event, auth } = await futureMatch();
    const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!.getTime();
    await ctx.app.telegramBot.sendDueReminders(new Date(startsAt - 3_600_000));
    await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}`,
      headers: auth,
      payload: { time: '21:30' },
    });
    await vi.waitFor(async () =>
      expect(
        (await getEvent(ctx.app, event._id))?.telegram?.reminders,
      ).toBeUndefined(),
    );
    expect(await ctx.app.telegramBot.sendDueReminders(new Date(startsAt))).toBe(
      1,
    );
  });
});

describe('payment reminder', () => {
  it('names who has not paid a few hours after the match, once', async () => {
    const { event, auth } = await futureMatch({
      eventName: 'Аренда',
      price: 5000,
      priceMode: 'pitch',
    });
    await press(`rsvp:${event._id}:yes`);
    await press(`rsvp:${event._id}:yes`, BORIS);
    const players = (
      await ctx.app.inject({
        url: `/v1/events/${event._id}/players`,
        headers: auth,
      })
    ).json() as { _id: string; name: string }[];
    const boris = players.find((player) => player.name === 'Борис')!;
    await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}/players/${boris._id}/paid`,
      headers: auth,
      payload: { paid: true },
    });
    const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!.getTime();
    const after = (hours: number) => new Date(startsAt + hours * 3_600_000);
    calls.length = 0;

    expect(await ctx.app.telegramBot.sendDueReminders(after(2))).toBe(0);
    expect(await ctx.app.telegramBot.sendDueReminders(after(3.5))).toBe(1);
    const message = calls.filter((c) => c.method === 'sendMessage').at(-1)!;
    const text = String(message.payload.text);
    expect(text).toContain('💰 Оплата за <b>Аренда</b>');
    expect(text).toContain('Не отметили оплату: Аня Котова\n');
    expect(text).toMatch(/~2\s500 ₽ с человека \(поле 5\s000 ₽ на 2\)/);
    expect(message.payload.disable_notification).toBe(true);
    expect(await ctx.app.telegramBot.sendDueReminders(after(4))).toBe(0);
  });

  it('stays quiet when everyone paid, for free matches and long after', async () => {
    const free = await futureMatch();
    await press(`rsvp:${free.event._id}:yes`);
    const startsAt = (await getEvent(ctx.app, free.event._id))!.startsAt!;
    const after = (hours: number) =>
      new Date(startsAt.getTime() + hours * 3_600_000);
    const paid = await futureMatch({ price: 300 });
    await press(`rsvp:${paid.event._id}:yes`);
    calls.length = 0;

    expect(await ctx.app.telegramBot.sendDueReminders(after(24 * 4))).toBe(0);
    expect(await ctx.app.telegramBot.sendDueReminders(after(4))).toBe(1);
    expect(replies(CHAT).at(-1)).toContain('300 ₽ с человека');
  });
});

describe('users without email', () => {
  it('keeps any number of accounts without email, but one per Telegram user', async () => {
    await ctx.app.db.insert(users).values({ name: 'A', telegramId: 1 });
    await ctx.app.db.insert(users).values({ name: 'B', telegramId: 2 });
    expect(await countRows(ctx.app, users, isNull(users.email))).toBe(2);
    await expect(
      ctx.app.db.insert(users).values({ name: 'C', telegramId: 2 }),
    ).rejects.toThrow();
  });
});

describe('review: queue order, merges and races', () => {
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
  const places = async (eventId: string, auth: Record<string, string>) =>
    (
      await ctx.app.inject({
        url: `/v1/events/${eventId}/players`,
        headers: auth,
      })
    )
      .json()
      .map(
        (p: { name: string; waitlisted: boolean }) =>
          `${p.name}:${p.waitlisted ? 'wait' : 'ok'}`,
      );

  it('never lets a later friend or a late yes push out someone who committed earlier', async () => {
    const { event } = await futureMatch({ minimum: 1, maximum: 2 });
    const a = await register(ctx.app, { email: 'qa@example.com', name: 'A' });
    const b = await register(ctx.app, { email: 'qb@example.com', name: 'B' });
    const c = await register(ctx.app, { email: 'qc@example.com', name: 'C' });

    const first = await join(a.auth, event._id, { name: 'A', status: false });
    await join(b.auth, event._id, { name: 'B', status: true });
    await join(c.auth, event._id, { name: 'C', status: true });
    // A signed up first, but only as "maybe": becoming sure now queues behind B and C
    await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}/players/${first.json().player._id}`,
      headers: a.auth,
      payload: { status: true, friends: [{ name: 'Guest', status: true }] },
    });
    expect(await places(event._id, a.auth)).toEqual(['A:wait', 'B:ok', 'C:ok']);
  });

  it('announces who moves when the places change, both ways', async () => {
    const { event, auth } = await futureMatch({ minimum: 1, maximum: 1 });
    await join(auth, event._id, { name: 'Owner', status: true });
    await press(`rsvp:${event._id}:yes`);
    calls.length = 0;

    await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}`,
      headers: auth,
      payload: { maximum: 2 },
    });
    await vi.waitFor(() =>
      expect(
        replies(CHAT).some((t) =>
          t.includes('Из листа ожидания в состав: <b>Аня Котова</b>'),
        ),
      ).toBe(true),
    );
    await vi.waitFor(() =>
      expect(
        replies(ANYA.id).some((t) => t.includes('Освободилось место')),
      ).toBe(true),
    );

    await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}`,
      headers: auth,
      payload: { maximum: 1 },
    });
    await vi.waitFor(() =>
      expect(
        replies(CHAT).some((t) =>
          t.includes('Мест стало меньше, в лист ожидания: <b>Аня Котова</b>'),
        ),
      ).toBe(true),
    );
  });

  it('announces a promotion once when two players leave at the same time', async () => {
    const { event, auth } = await futureMatch({ minimum: 1, maximum: 2 });
    const a = await register(ctx.app, { email: 'ra@example.com', name: 'A' });
    const first = await join(auth, event._id, { name: 'Owner', status: true });
    const second = await join(a.auth, event._id, { name: 'A', status: true });
    await press(`rsvp:${event._id}:yes`);
    calls.length = 0;

    await Promise.all([
      ctx.app.inject({
        method: 'DELETE',
        url: `/v1/events/${event._id}/players/${first.json().player._id}`,
        headers: auth,
      }),
      ctx.app.inject({
        method: 'DELETE',
        url: `/v1/events/${event._id}/players/${second.json().player._id}`,
        headers: a.auth,
      }),
    ]);
    await vi.waitFor(() => expect(replies(ANYA.id).length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      replies(CHAT).filter((t) => t.includes('Из листа ожидания')),
    ).toHaveLength(1);
    expect(replies(ANYA.id)).toHaveLength(1);
  });

  it('keeps both guests of two quick presses', async () => {
    const { event } = await futureMatch();
    await press(`rsvp:${event._id}:yes`);
    await Promise.all([
      press(`rsvp:${event._id}:friend`),
      press(`rsvp:${event._id}:friend`),
    ]);
    const player = await firstPlayerOf(ctx.app, event._id);
    expect(player?.friends.map((f) => f.name).sort()).toEqual([
      'Гость 1',
      'Гость 2',
    ]);
  });

  it('recounts the match after a merge removes a duplicate sign-up', async () => {
    const { event } = await futureMatch();
    await press(`rsvp:${event._id}:yes`);
    const web = await register(ctx.app, {
      email: 'merge@example.com',
      name: 'Анна',
    });
    await join(web.auth, event._id, { name: 'Анна', status: true });
    expect((await getEvent(ctx.app, event._id))?.playersAmount).toBe(2);

    const { code } = (
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/users/me/telegram',
        headers: web.auth,
      })
    ).json();
    calls.length = 0;
    await say(`/link ${code}`);
    await vi.waitFor(async () =>
      expect((await getEvent(ctx.app, event._id))?.playersAmount).toBe(1),
    );
    await vi.waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === 'editMessageText' &&
            !String(c.payload.text).includes('Аня Котова'),
        ),
      ).toBe(true),
    );
  });

  it('runs a merge again when a sign-up for the old account lands before its delete', async () => {
    const { event } = await futureMatch();
    const second = await futureMatch();
    await press(`rsvp:${event._id}:yes`);
    const old = await findUser(ctx.app, eq(users.telegramId, ANYA.id));
    const web = await register(ctx.app, {
      email: 'race@example.com',
      name: 'Анна',
    });
    const { code } = (
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/users/me/telegram',
        headers: web.auth,
      })
    ).json();

    // A button press signs the old account up for another match in between
    let attempts = 0;
    ctx.app.services.telegramAccounts.testHooks.beforeMergeDelete = async (
      tx,
    ) => {
      if (++attempts > 1) return;
      await tx.insert(players).values({
        eventId: second.event._id,
        userId: old!._id,
        name: 'Аня',
        date: '2026-11-01',
        status: true,
      });
    };
    try {
      await say(`/link ${code}`);
    } finally {
      ctx.app.services.telegramAccounts.testHooks = {};
    }

    expect(attempts).toBe(2);
    expect(replies(ANYA.id).at(-1)).toContain('Telegram привязан');
    expect(await findUser(ctx.app, eq(users._id, old!._id))).toBeNull();
    expect(await firstPlayerOf(ctx.app, event._id)).toMatchObject({
      userId: web._id,
      name: 'Анна',
    });
    expect((await getEvent(ctx.app, event._id))?.playersAmount).toBe(1);
  });

  it('presses as the merged account when the old one is gone meanwhile', async () => {
    const { event } = await futureMatch();
    const accounts = ctx.app.services.telegramAccounts;
    const real = await accounts.findOrCreate(ANYA);
    // The account the press looked up was merged and deleted before the sign-up
    vi.spyOn(accounts, 'findOrCreate').mockResolvedValueOnce({
      ...real,
      _id: 'f'.repeat(24),
    });
    await press(`rsvp:${event._id}:yes`);
    vi.restoreAllMocks();

    expect(answers().at(-1)).toBe('✅ Вы в составе');
    expect(await firstPlayerOf(ctx.app, event._id)).toMatchObject({
      userId: real._id,
    });
  });

  it('stops working once the code is posted in a group, and after too many wrong codes', async () => {
    const web = await register(ctx.app, { email: 'group@example.com' });
    const { code } = (
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/users/me/telegram',
        headers: web.auth,
      })
    ).json();
    await say(`/link ${code}`, ANYA, 'group');
    expect(replies(CHAT).at(-1)).toContain('Этот код больше не действует');
    await say(`/link ${code}`);
    expect(replies(ANYA.id).at(-1)).toContain('Код не подошёл');

    for (let i = 0; i < 5; i++) await say('/link ZZZZZZ', BORIS);
    await say('/link ZZZZZZ', BORIS);
    expect(replies(BORIS.id).at(-1)).toContain('Слишком много неверных кодов');
  });

  it('says today for a match later today, and skips the day reminder for short notice', async () => {
    const { event } = await futureMatch();
    const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!.getTime();
    // Announced long before: 10 hours ahead (10:00 UTC on match day) it is today
    expect(
      await ctx.app.telegramBot.sendDueReminders(
        new Date(startsAt - 10 * 3_600_000),
      ),
    ).toBe(1);
    expect(replies(CHAT).at(-1)).toContain('⏰ Сегодня матч');

    const late = await futureMatch({ time: '18:00' });
    const lateStart = (await getEvent(
      ctx.app,
      late.event._id,
    ))!.startsAt!.getTime();
    // The announcement sets scheduledAt when it goes out; let it finish first
    await vi.waitFor(async () =>
      expect(
        (await getEvent(ctx.app, late.event._id))?.telegram?.scheduledAt,
      ).toBeDefined(),
    );
    await ctx.app.db
      .update(events)
      .set({
        telegram: sql`${events.telegram} || ${JSON.stringify({
          scheduledAt: new Date(lateStart - 10 * 3_600_000).toISOString(),
        })}::jsonb`,
      })
      .where(eq(events._id, late.event._id));
    // Announced only 10 hours ahead: no day-before reminder, the announcement is enough
    expect(
      await ctx.app.telegramBot.sendDueReminders(
        new Date(lateStart - 9 * 3_600_000),
      ),
    ).toBe(0);
    expect(
      await ctx.app.telegramBot.sendDueReminders(
        new Date(lateStart - 3_600_000),
      ),
    ).toBe(1);
  });

  it('keeps Telegram-only accounts out of the people list', async () => {
    const { event, auth } = await futureMatch();
    await press(`rsvp:${event._id}:yes`);
    const list = (
      await ctx.app.inject({ url: '/v1/users', headers: auth })
    ).json() as { name: string }[];
    expect(list.map((u) => u.name)).not.toContain('Аня Котова');
  });
});
