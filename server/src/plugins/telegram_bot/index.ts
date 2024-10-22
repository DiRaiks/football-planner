import { Telegraf } from "telegraf";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { ENVS } from "../../env.js";

declare module "fastify" {
  interface FastifyInstance {
    telegramBot: Telegraf;
  }
}

const telegramBot: FastifyPluginAsync = async (fastify) => {
  const { BOT_TOKEN } = fastify.getEnvs<ENVS>();
  const { logger } = fastify;

  const bot = new Telegraf(BOT_TOKEN);

  logger.info("Telegram bot plugin initialized");

  if (!fastify.telegramBot) {
    fastify.decorate("telegramBot", bot);
  }
};

export default fp(telegramBot, "4.x");
