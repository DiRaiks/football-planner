import Fastify from "fastify";
import fs from "fs";
import path from "path";
import fastifyEnv from "@fastify/env";

import { ENV_OPTIONS } from "./env.js";
import {
  TelegramBotPlugin,
  LoggerPlugin,
  DatabasePlugin,
  AuthPlugin,
} from "./plugins/index.js";
import EventsRoutes from "./modules/events/routes.js";
import PlayersRoutes from "./modules/players/routes.js";
import UsersRoutes from "./modules/users/routes.js";
import AuthRoutes from "./modules/auth/routes.js";

const httpsKeyPath = process.env.HTTPS_PRIVKEY_PATH
  ? path.resolve(process.env.HTTPS_PRIVKEY_PATH)
  : undefined;
const httpsCertPath = process.env.HTTPS_FULLCHAIN_PATH
  ? path.resolve(process.env.HTTPS_FULLCHAIN_PATH)
  : undefined;

const httpsOptions =
  httpsKeyPath && httpsCertPath &&
  fs.existsSync(httpsKeyPath) &&
  fs.existsSync(httpsCertPath)
    ? {
        https: {
          key: fs.readFileSync(httpsKeyPath),
          cert: fs.readFileSync(httpsCertPath),
        },
      }
    : {};

const fastify = Fastify({
  logger: true,
  ...httpsOptions,
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

  fastify.register(EventsRoutes, { prefix: "/events" });
  fastify.register(PlayersRoutes, { prefix: "/players" });
  fastify.register(UsersRoutes, { prefix: "/users" });
  fastify.register(AuthRoutes, { prefix: "/auth" });

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
