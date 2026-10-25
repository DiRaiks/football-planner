import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { createEvent, register, setupApp } from './helpers.js';

const ctx = setupApp(
  { AUTH_RATE_LIMIT_MAX: 1000, BOT_TOKEN: '123:test' },
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
      api.config.use(async (_prev, method) => {
        const result =
          method === 'sendMessage'
            ? { message_id: 1, date: 0, chat: { id: -100, type: 'group' } }
            : true;
        return { ok: true, result } as never;
      });
    },
  },
);

const metrics = async () => (await ctx.app.inject({ url: '/metrics' })).body;

describe('bot metrics', () => {
  it('counts updates, commands and sent messages next to the app metrics', async () => {
    await mongoose.connection
      .collection('chats')
      .insertOne({ chatId: -100, topics: ['events'] });
    const { auth } = await register(ctx.app);
    await createEvent(ctx.app, auth);
    await ctx.app.tg.bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 7, type: 'private', first_name: 'Ильдар' },
        from: { id: 7, is_bot: false, first_name: 'Ильдар' },
        text: '/help',
        entities: [{ type: 'bot_command', offset: 0, length: 5 }],
      },
    });

    await vi.waitFor(async () =>
      expect(await metrics()).toMatch(
        /tg_messages_total\{status="sent"\} [1-9]/,
      ),
    );
    const text = await metrics();
    expect(text).toContain('tg_updates_total 1');
    expect(text).toContain(
      'tg_commands_total{command="help",allowed="true"} 1',
    );
    expect(text).toContain('tg_notifier_queue');
    // One registry: the app's own metrics are still there
    expect(text).toContain('mongodb_connected 1');
    // The kit serves no routes of its own
    expect((await ctx.app.inject({ url: '/telegram/health' })).statusCode).toBe(
      404,
    );
  });

  it('reports the bot in /health', async () => {
    const response = await ctx.app.inject({ url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      dbState: 'connected',
      telegram: {
        ok: true,
        mode: 'none',
        username: 'football_bot',
        store: 'ok',
      },
    });
  });
});
