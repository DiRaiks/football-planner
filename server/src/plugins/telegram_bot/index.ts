import { Telegraf } from "telegraf";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { initBotCommands } from "./commands.js";
import {
  sendMessageAddEvent,
  sendMessageAddPlayer,
  sendMessageRemovePlayer,
  sendMessageUpdatePlayer,
} from "./messages.js";

declare module "fastify" {
  interface FastifyInstance {
    telegramBot: {
      bot: Telegraf;
      sendMessageAddEvent: typeof sendMessageAddEvent;
      sendMessageAddPlayer: typeof sendMessageAddPlayer;
      sendMessageRemovePlayer: typeof sendMessageRemovePlayer;
      sendMessageUpdatePlayer: typeof sendMessageUpdatePlayer;
    };
  }
}

const telegramBot: FastifyPluginAsync = async (fastify) => {
  const { BOT_TOKEN } = fastify.config;
  const { logger } = fastify;

  let bot = new Telegraf(BOT_TOKEN);
  initBotCommands(bot, logger);

  bot.launch();

  if (!fastify.telegramBot) {
    fastify.decorate("telegramBot", {
      bot,
      sendMessageAddEvent,
      sendMessageAddPlayer,
      sendMessageRemovePlayer,
      sendMessageUpdatePlayer,
    });
  }

  logger.info("Telegram bot plugin initialized");
};

export default fp(telegramBot, "5.x");
