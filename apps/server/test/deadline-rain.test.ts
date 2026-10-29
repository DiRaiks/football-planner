import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { events } from '../src/db/index.js';
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

const ctx = setupApp(
  {
    AUTH_RATE_LIMIT_MAX: 1000,
    BOT_TOKEN: '123:test',
    WEATHER_DEFAULT_LAT: 59.94,
    WEATHER_DEFAULT_LON: 30.31,
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
const HOUR = 3_600_000;
const sent = () =>
  calls
    .filter((c) => c.method === 'sendMessage' && c.payload.chat_id === CHAT)
    .map((c) => String(c.payload.text));

/** Open-Meteo answers with the same weather for every hour of the next 16 days */
let weather = { code: 3, chance: 10 };
const realFetch = globalThis.fetch;
beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== 'api.open-meteo.com') return realFetch(input, init);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const time = Array.from({ length: 16 * 24 }, (_, hour) =>
      new Date(start.getTime() + hour * HOUR).toISOString().slice(0, 16),
    );
    return Response.json({
      hourly: {
        time,
        weather_code: time.map(() => weather.code),
        temperature_2m: time.map(() => 8),
        precipitation_probability: time.map(() => weather.chance),
        wind_speed_10m: time.map(() => 10),
      },
    });
  });
});
afterEach(() => vi.restoreAllMocks());

let owners = 0;
// The forecast is cached per place: each test gets its own
let place = 0;
const match = async (payload: Record<string, unknown> = {}) => {
  const { auth } = await register(ctx.app, {
    email: `owner-${++owners}@example.com`,
  });
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const event = await createEvent(ctx.app, auth, {
    date: day,
    eventName: 'Четверг',
    minimum: 4,
    location: { lat: 10 + ++place, lon: 10 },
    ...payload,
  });
  const startsAt = (await getEvent(ctx.app, event._id))!.startsAt!.getTime();
  await vi.waitFor(() => expect(sent().length).toBeGreaterThan(0));
  calls.length = 0;
  return {
    event,
    auth,
    at: (hoursBefore: number) => new Date(startsAt - hoursBefore * HOUR),
  };
};
const remind = (now: Date) => ctx.app.telegramBot.sendDueReminders(now);

beforeEach(async () => {
  calls.length = 0;
  weather = { code: 3, chance: 10 };
  await addChat(ctx.app, CHAT);
});

describe('sign-up deadline', () => {
  it('warns the chat once when the minimum is not reached in time', async () => {
    const { at } = await match();

    // Before the deadline: the day-before reminder only
    expect(await remind(at(13))).toBe(1);
    expect(sent().join()).not.toContain('Не набираемся');
    expect(await remind(at(11))).toBe(1);
    expect(sent().at(-1)).toContain(
      '⚠️ <b>Не набираемся</b> на <b>Четверг</b>: 0 из 4, до начала 11 ч',
    );
    expect(sent().at(-1)).toContain('Нужно ещё 4');
    expect(await remind(at(10))).toBe(0);
  });

  it('keeps quiet when the minimum is reached, or the check is off', async () => {
    const full = await match({ minimum: 1 });
    await ctx.app.inject({
      method: 'POST',
      url: `/v1/events/${full.event._id}/players`,
      headers: full.auth,
      payload: { name: 'Owner', status: true, friends: [] },
    });
    const off = await match({ deadlineHours: 0 });
    calls.length = 0;

    await remind(full.at(11));
    await remind(off.at(11));
    expect(sent().join()).not.toContain('Не набираемся');
  });

  it('skips matches announced after their deadline', async () => {
    const { event, at } = await match();
    await ctx.app.db
      .update(events)
      .set({
        createdAt: at(6),
        telegram: { scheduledAt: at(6).toISOString() },
      })
      .where(eq(events._id, event._id));

    await remind(at(5));
    expect(sent().join()).not.toContain('Не набираемся');
  });

  it('cancels when asked to, and a weekly series goes on', async () => {
    const { event, at } = await match({
      autoCancel: true,
      repeat: 'weekly',
      deadlineHours: 24,
    });

    expect(await remind(at(23))).toBeGreaterThanOrEqual(1);
    await vi.waitFor(() =>
      expect(sent().join('\n')).toContain('❌ Матч <b>Четверг</b>'),
    );
    expect(sent().join('\n')).toContain('отменён: к сроку набралось 0 из 4');
    expect(await getEvent(ctx.app, event._id)).toBeNull();
    const [next] = await ctx.app.db
      .select()
      .from(events)
      .where(eq(events.repeatOf, event._id));
    expect(next).toMatchObject({
      eventName: 'Четверг',
      autoCancel: true,
      deadlineHours: 24,
    });
    expect(next!.startsAt!.getTime() - at(0).getTime()).toBe(7 * 24 * HOUR);
  });
});

describe('rain', () => {
  it('stresses rain in the reminder and sends no note after it', async () => {
    weather = { code: 61, chance: 80 };
    const { at } = await match({ deadlineHours: 0 });

    expect(await remind(at(20))).toBe(1);
    expect(sent().at(-1)).toContain(
      '☔ <b>Небольшой дождь, осадки 80%</b>, 8°',
    );
    expect(await remind(at(10))).toBe(0);
  });

  it('notes once when the forecast turns rainy after the day-before reminder', async () => {
    const { event, at } = await match({ deadlineHours: 0 });
    // The day-before reminder went out while the forecast was dry; a new place
    // leaves the dry forecast in the cache behind
    await ctx.app.db
      .update(events)
      .set({
        telegram: { reminders: { day: true } },
        location: { lat: 50, lon: 50 },
      })
      .where(eq(events._id, event._id));
    weather = { code: 95, chance: 70 };

    expect(await remind(at(10))).toBe(1);
    expect(sent().at(-1)).toContain('☔ Прогноз испортился: <b>Четверг</b>');
    expect(sent().at(-1)).toContain('⛈ <b>');
    expect(await remind(at(9))).toBe(0);
  });

  it('says nothing about dry weather', async () => {
    const { event, at } = await match({ deadlineHours: 0 });
    await ctx.app.db
      .update(events)
      .set({ telegram: { reminders: { day: true } } })
      .where(eq(events._id, event._id));

    expect(await remind(at(10))).toBe(0);
  });
});
