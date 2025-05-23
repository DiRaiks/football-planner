import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import fastifyEnv from '@fastify/env';

import { ENV_OPTIONS } from './env.js';
import {
  TelegramBotPlugin,
  LoggerPlugin,
  DatabasePlugin,
  AuthPlugin,
  MonitoringPlugin,
} from './plugins/index.js';
import EventsRoutes from './modules/events/routes.js';
import PlayersRoutes from './modules/players/routes.js';
import UsersRoutes from './modules/users/routes.js';
import AuthRoutes from './modules/auth/routes.js';
import WeatherRoutes from './modules/weather/routes.js';

const httpsKeyPath = process.env.HTTPS_PRIVKEY_PATH
  ? path.resolve(process.env.HTTPS_PRIVKEY_PATH)
  : undefined;
const httpsCertPath = process.env.HTTPS_FULLCHAIN_PATH
  ? path.resolve(process.env.HTTPS_FULLCHAIN_PATH)
  : undefined;

const httpsOptions =
  httpsKeyPath &&
  httpsCertPath &&
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

// TODO: Remove this hook after fixing the issue with empty body
fastify.addHook('preParsing', (request, _reply, _payload, done) => {
  if (
    ['POST', 'DELETE'].includes(request.method) &&
    request.headers['content-type'] == 'application/json; charset=utf-8' &&
    !request.body
  ) {
    delete request.headers['content-type'];
  }

  done();
});

const fastifyInit = async () => {
  await Promise.all([
    fastify.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
    fastify.register(fastifyEnv, ENV_OPTIONS),
    fastify.register(LoggerPlugin),
    fastify.register(DatabasePlugin),
    fastify.register(TelegramBotPlugin),
    fastify.register(AuthPlugin),
    fastify.register(MonitoringPlugin),
  ]);

  fastify.register(EventsRoutes, { prefix: '/events' });
  fastify.register(PlayersRoutes, { prefix: '/players' });
  fastify.register(UsersRoutes, { prefix: '/users' });
  fastify.register(AuthRoutes, { prefix: '/auth' });
  fastify.register(WeatherRoutes, { prefix: '/weather' });

  await fastify.register(async (instance) => {
    instance.get('/metrics', instance.metrics.routeHandler);
    instance.get('/health', instance.healthChecker.routeHandler);
  });
};

const start = async () => {
  try {
    await fastifyInit();

    const { PORT } = fastify.config;
    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    fastify.log.info(`server listening on ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
process.on('unhandledRejection', function (reason) {
  fastify.logger.error('unhandledRejection', reason);
});

void start();
