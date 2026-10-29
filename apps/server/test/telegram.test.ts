import { beforeEach, describe, expect, it, vi } from 'vitest';

import { events } from '../src/db/index.js';
import { computeRoster } from '../src/modules/players/count.js';
import {
  MAX_MESSAGE_LENGTH,
  announcementMessage,
  formatWhen,
  progressBar,
} from '../src/plugins/telegram/messages.js';
import {
  addChat,
  createEvent,
  getEvent,
  register,
  setupApp,
} from './helpers.js';

type Call = { method: string; payload: Record<string, unknown> };
const calls: Call[] = [];
let messageId = 0;
// Runs inside the fake API before it answers, to simulate concurrent changes
let beforeSend: ((call: Call) => Promise<void>) | undefined;

const ctx = setupApp(
  {
    AUTH_RATE_LIMIT_MAX: 1000,
    BOT_TOKEN: '123:test',
    PUBLIC_URL: 'https://football-planner.ru/',
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
        const call = { method, payload: payload as Record<string, unknown> };
        calls.push(call);
        if (method === 'sendMessage') await beforeSend?.(call);
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

const callsOf = (method: string) =>
  calls.filter((c) => c.method === method && c.payload.chat_id === CHAT);
const lastText = (method: string) =>
  String(callsOf(method).at(-1)?.payload.text);

const signUp = (
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
  beforeSend = undefined;
  await addChat(ctx.app, CHAT);
});

describe('telegram announcements', () => {
  it('pins an announcement with the roster and a sign-up button', async () => {
    const { auth } = await register(ctx.app);

    const event = await createEvent(ctx.app, auth, {
      eventName: 'Match <Tuesday>',
      date: '2026-11-03',
      minimum: 4,
    });

    await vi.waitFor(() => expect(callsOf('pinChatMessage')).toHaveLength(1));
    const { payload } = callsOf('sendMessage')[0]!;
    expect(payload.parse_mode).toBe('HTML');
    expect(payload.text).toBe(
      [
        '⚽ <b>Match &lt;Tuesday&gt;</b>',
        '📅 вт, 3 ноября · 20:00',
        '📍 Stadium',
        '',
        '👥 <b>0</b> из 4  ▱▱▱▱▱▱▱▱▱▱',
        '✅ Точно: пока никого',
        '<i>Нужно ещё 4</i>',
      ].join('\n'),
    );
    expect(payload.reply_markup).toEqual({
      inline_keyboard: [
        [
          { text: '✅ Иду', callback_data: `rsvp:${event._id}:yes` },
          { text: '🤔 Возможно', callback_data: `rsvp:${event._id}:maybe` },
          { text: '❌ Не иду', callback_data: `rsvp:${event._id}:no` },
        ],
        [
          { text: '➕ Друг', callback_data: `rsvp:${event._id}:friend` },
          {
            text: '🔗 Открыть',
            url: `https://football-planner.ru/events/${event._id}`,
          },
        ],
      ],
    });
    await vi.waitFor(async () =>
      expect(
        (await getEvent(ctx.app, event._id))?.telegram?.announcements,
      ).toEqual([{ chatId: CHAT, messageId: expect.any(Number) }]),
    );
  });

  it('edits the announcement and sends silent notes on sign-ups, loud once at the minimum', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const bob = await register(ctx.app, { email: 'b@example.com' });
    const event = await createEvent(ctx.app, alice.auth, { minimum: 3 });
    await vi.waitFor(async () =>
      expect(
        (await getEvent(ctx.app, event._id))?.telegram?.announcements,
      ).toHaveLength(1),
    );

    await signUp(alice.auth, event._id, {
      name: 'Alice & Co',
      status: true,
      friends: [
        { name: 'Ann', status: true },
        { name: 'Max', status: false },
      ],
    });

    await vi.waitFor(() => expect(callsOf('editMessageText')).toHaveLength(1));
    expect(lastText('editMessageText')).toContain(
      '✅ Точно: Alice &amp; Co, Ann (от Alice &amp; Co)',
    );
    expect(lastText('editMessageText')).toContain(
      '🤔 Возможно: Max (от Alice &amp; Co)',
    );
    expect(lastText('editMessageText')).toContain('<i>Нужно ещё 1</i>');
    await vi.waitFor(() => expect(callsOf('sendMessage')).toHaveLength(2));
    expect(callsOf('sendMessage')[1]!.payload).toMatchObject({
      text: '✅ <b>Alice &amp; Co</b> (+Ann, Max) идёт на «Tuesday game» · 2/3',
      disable_notification: true,
    });

    await signUp(bob.auth, event._id, { name: 'Bob', status: true });

    await vi.waitFor(() => expect(callsOf('sendMessage')).toHaveLength(4));
    const [note, reached] = callsOf('sendMessage').slice(2);
    expect(note!.payload.text).toBe(
      '✅ <b>Bob</b> идёт на «Tuesday game» · 3/3',
    );
    expect(reached!.payload.text).toContain(
      '🎉 На <b>Tuesday game</b> набрался минимум: 3 игроков',
    );
    expect(reached!.payload.disable_notification).toBeUndefined();
    expect(lastText('editMessageText')).toContain('🎉 <b>Минимум набран</b>');

    // Changing a record after the minimum does not repeat the loud message
    const player = (
      await ctx.app.inject({
        method: 'GET',
        url: `/v1/events/${event._id}/players/me`,
        headers: bob.auth,
      })
    ).json() as { _id: string };
    await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/events/${event._id}/players/${player._id}`,
      headers: bob.auth,
      payload: { friends: [{ name: 'Tom', status: true }] },
    });

    await vi.waitFor(() => expect(callsOf('sendMessage')).toHaveLength(5));
    expect(lastText('sendMessage')).toBe(
      '✏️ <b>Bob</b> (+Tom) изменил запись на «Tuesday game» · 4/3',
    );
  });

  it('announces schedule changes loudly and keeps quiet about other edits', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(ctx.app, auth);
    await vi.waitFor(() => expect(callsOf('sendMessage')).toHaveLength(1));

    const patch = (payload: Record<string, unknown>) =>
      ctx.app.inject({
        method: 'PATCH',
        url: `/v1/events/${event._id}`,
        headers: auth,
        payload,
      });

    await patch({ eventName: 'Renamed' });
    await vi.waitFor(() => expect(callsOf('editMessageText')).toHaveLength(1));
    expect(callsOf('sendMessage')).toHaveLength(1);

    await patch({ place: 'Arena' });
    await vi.waitFor(() => expect(callsOf('sendMessage')).toHaveLength(2));
    expect(lastText('sendMessage')).toContain('✏️ Матч <b>Renamed</b> изменён');
    expect(lastText('sendMessage')).toContain('📍 Arena');
  });

  it('marks the announcement as cancelled, unpins it and notifies on deletion', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(ctx.app, auth, { date: '2026-11-03' });
    await vi.waitFor(async () =>
      expect(
        (await getEvent(ctx.app, event._id))?.telegram?.announcements,
      ).toHaveLength(1),
    );

    await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/events/${event._id}`,
      headers: auth,
    });

    await vi.waitFor(() => expect(callsOf('sendMessage')).toHaveLength(2));
    expect(lastText('editMessageText')).toContain('<b>Матч отменён</b>');
    expect(callsOf('unpinChatMessage')).toHaveLength(1);
    expect(lastText('sendMessage')).toBe(
      '❌ Матч <b>Tuesday game</b> (вт, 3 ноября · 20:00) отменён',
    );
  });

  it('leaves no pinned announcement when an event is deleted right away', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(ctx.app, auth);
    await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/events/${event._id}`,
      headers: auth,
    });

    await vi.waitFor(() =>
      expect(lastText('sendMessage')).toContain('отменён'),
    );
    // Whatever the timing, every pinned announcement ends up unpinned
    expect(callsOf('unpinChatMessage')).toHaveLength(
      callsOf('pinChatMessage').length,
    );
  });

  it('strikes through announcements of an event deleted while they were sent', async () => {
    const { auth } = await register(ctx.app);
    beforeSend = async () => {
      beforeSend = undefined;
      await ctx.app.db.delete(events);
    };

    await createEvent(ctx.app, auth);

    await vi.waitFor(() => expect(callsOf('unpinChatMessage')).toHaveLength(1));
    expect(lastText('editMessageText')).toContain('<b>Матч отменён</b>');
  });

  it('announces the minimum when it is lowered, and again after it was lost', async () => {
    const alice = await register(ctx.app, { email: 'a@example.com' });
    const event = await createEvent(ctx.app, alice.auth, { minimum: 5 });
    await vi.waitFor(() => expect(callsOf('sendMessage')).toHaveLength(1));
    await signUp(alice.auth, event._id, { name: 'Alice', status: true });
    await vi.waitFor(() => expect(callsOf('sendMessage')).toHaveLength(2));

    const patch = (payload: Record<string, unknown>) =>
      ctx.app.inject({
        method: 'PATCH',
        url: `/v1/events/${event._id}`,
        headers: alice.auth,
        payload,
      });
    const loud = () =>
      callsOf('sendMessage').filter((c) =>
        String(c.payload.text).includes('набрался минимум'),
      );

    await patch({ minimum: 1 });
    await vi.waitFor(() => expect(loud()).toHaveLength(1));

    await patch({ minimum: 3 });
    await vi.waitFor(async () =>
      expect(
        (await getEvent(ctx.app, event._id))?.telegram?.minimumReached,
      ).toBe(false),
    );

    await patch({ minimum: 1 });
    await vi.waitFor(() => expect(loud()).toHaveLength(2));
  });

  it('edits the announcement once for a burst of sign-ups', async () => {
    const { auth } = await register(ctx.app);
    const event = await createEvent(ctx.app, auth, { minimum: 0 });
    await vi.waitFor(async () =>
      expect(
        (await getEvent(ctx.app, event._id))?.telegram?.announcements,
      ).toHaveLength(1),
    );
    const others = await Promise.all(
      [1, 2, 3, 4].map((n) =>
        register(ctx.app, { email: `p${n}@example.com` }),
      ),
    );

    await Promise.all(
      others.map((u, n) =>
        signUp(u.auth, event._id, { name: `P${n}`, status: true }),
      ),
    );

    await vi.waitFor(() =>
      expect(
        callsOf('sendMessage').filter((c) => c.payload.disable_notification),
      ).toHaveLength(4),
    );
    expect(callsOf('editMessageText').length).toBeLessThan(4);
    expect(lastText('editMessageText')).toContain('👥 Точно идут: <b>4</b>');
  });

  it('subscribes a chat with /subscribe', async () => {
    await ctx.app.tg.bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 300, type: 'private', first_name: 'U' },
        from: { id: 300, is_bot: false, first_name: 'U' },
        text: '/subscribe',
        entities: [{ type: 'bot_command', offset: 0, length: 10 }],
      },
    });

    expect(await ctx.app.subscriptions.store.get(300)).toMatchObject({
      topics: ['events'],
    });
  });
});

describe('message helpers', () => {
  it('formats dates and progress', () => {
    expect(formatWhen({ date: '2026-12-31', time: '19:30' })).toBe(
      'чт, 31 декабря · 19:30',
    );
    expect(progressBar(0, 10)).toBe('▱▱▱▱▱▱▱▱▱▱');
    expect(progressBar(7, 10)).toBe('▰▰▰▰▰▰▰▱▱▱');
    expect(progressBar(15, 10)).toBe('▰▰▰▰▰▰▰▰▰▰');
  });

  it('keeps long rosters under the Telegram message limit', () => {
    const players = computeRoster(
      Array.from({ length: 200 }, (_, n) => ({
        _id: String(n),
        name: `Player with a long name ${n}`,
        status: n % 2 === 0,
        friends: [{ name: `Friend ${n}`, status: true }],
      })),
    ).people;

    const message = announcementMessage(
      {
        _id: '1',
        eventName: 'E',
        date: '2026-11-03',
        time: '20:00',
        place: 'P',
        minimum: 10,
      },
      players,
      { all: 400, exactly: 300, maybe: 100 },
    );

    expect(message.value.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(message.value).toMatch(/и ещё \d+/);
  });

  it('shows the weather at the start under the place', () => {
    const event = {
      _id: '1',
      eventName: 'E',
      date: '2026-11-03',
      time: '20:00',
      place: 'Манеж',
      minimum: 10,
    };
    const count = { all: 0, exactly: 0, maybe: 0 };
    const forecast = {
      time: '2026-11-03T17:00:00.000Z',
      weatherCode: 61,
      description: 'Небольшой дождь',
      temperature: 7.6,
      precipitationProbability: 80,
      windSpeed: 14.2,
    };

    const lines = announcementMessage(event, [], count, forecast).value.split(
      '\n',
    );
    expect(lines.slice(2, 4)).toEqual([
      '📍 Манеж',
      '☔ <b>Небольшой дождь, осадки 80%</b>, 8°',
    ]);
    // Beyond the forecast window: no line
    expect(announcementMessage(event, [], count).value).not.toContain('🌤');
  });
});
