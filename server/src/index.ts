import Fastify from "fastify";
import fastifyEnv from "@fastify/env";

import { ENV_OPTIONS } from "./env.js";
import {
  TelegramBotPlugin,
  LoggerPlugin,
  DatabasePlugin,
  AuthPlugin,
} from "./plugins/index.js";
import EventsRoutes from "./modules/events/routes.js";

const fastify = Fastify({
  logger: true,
  ajv: {
    customOptions: {
      allowUnionTypes: true,
    },
  },
});

const fastifyInit = async () => {
  await Promise.all([
    fastify.register(fastifyEnv, ENV_OPTIONS),
    fastify.register(LoggerPlugin),
    fastify.register(DatabasePlugin),
    fastify.register(TelegramBotPlugin),
    fastify.register(AuthPlugin),
  ]);

  await fastify.register(async (instance) => {
    instance.register(EventsRoutes, { prefix: '/events' });
  });

  // await fastify.register(async (instance) => {
  //   instance.get('/metrics', instance.metrics.routeHandler())
  //   instance.get('/health', instance.healthChecker.routeHandler())
  // })
};

const start = async () => {
  try {
    await fastifyInit();

    const { PORT } = fastify.config;
    await fastify.listen({ port: PORT });

    fastify.log.info(`server listening on ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
process.on("unhandledRejection", function (reason) {
  fastify.logger.error("unhandledRejection", reason);
});

void start();
