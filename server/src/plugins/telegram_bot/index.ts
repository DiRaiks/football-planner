import { Telegraf } from 'telegraf';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { initBotCommands } from './commands.js';
import {
  sendMessageAddEvent,
  sendMessageAddPlayer,
  sendMessageRemovePlayer,
  sendMessageUpdatePlayer,
  type NotifyEvent,
  type NotifyPlayer,
  type PlayersCount,
} from './messages.js';

export type TelegramNotifier = {
  eventCreated: (event: NotifyEvent) => void;
  playerAdded: (
    player: NotifyPlayer,
    event: NotifyEvent,
    count: PlayersCount,
  ) => void;
  playerRemoved: (
    player: NotifyPlayer,
    event: NotifyEvent,
    count: PlayersCount,
  ) => void;
  playerUpdated: (
    player: NotifyPlayer,
    event: NotifyEvent,
    count: PlayersCount,
  ) => void;
};

declare module 'fastify' {
  interface FastifyInstance {
    telegramBot: TelegramNotifier;
  }
}

const noop = () => undefined;
const disabledNotifier: TelegramNotifier = {
  eventCreated: noop,
  playerAdded: noop,
  playerRemoved: noop,
  playerUpdated: noop,
};

const telegramBot: FastifyPluginAsync = async (fastify) => {
  const { BOT_TOKEN, PUBLIC_URL } = fastify.config;
  const { logger } = fastify;

  if (!BOT_TOKEN) {
    logger.warn('BOT_TOKEN is not set, Telegram notifications are disabled');
    fastify.decorate('telegramBot', disabledNotifier);
    return;
  }

  const bot = new Telegraf(BOT_TOKEN);
  initBotCommands(bot, logger);

  bot
    .launch()
    .catch((err: Error) =>
      logger.error(`Telegram bot stopped: ${err.message}`),
    );

  fastify.addHook('onClose', async () => {
    bot.stop();
  });

  const ctx = { bot, logger, publicUrl: PUBLIC_URL?.replace(/\/+$/, '') };
  // Notifications are fire-and-forget: a slow or failing Telegram must not block API responses
  const run = (task: Promise<void>) =>
    void task.catch((err: Error) =>
      logger.error(`Telegram notification failed: ${err.message}`),
    );

  fastify.decorate('telegramBot', {
    eventCreated: (event) => run(sendMessageAddEvent(ctx, event)),
    playerAdded: (player, event, count) =>
      run(sendMessageAddPlayer(ctx, player, event, count)),
    playerRemoved: (player, event, count) =>
      run(sendMessageRemovePlayer(ctx, player, event, count)),
    playerUpdated: (player, event, count) =>
      run(sendMessageUpdatePlayer(ctx, player, event, count)),
  } satisfies TelegramNotifier);

  logger.info('Telegram bot plugin initialized');
};

export default fp(telegramBot, {
  fastify: '5.x',
  name: 'telegram-bot',
  dependencies: ['logger'],
});
