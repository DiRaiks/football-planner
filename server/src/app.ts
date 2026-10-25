import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyEnv from '@fastify/env';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { getEnvOptions, splitList } from './env.js';
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

export type BuildAppOptions = {
  /** Environment overrides; when set, `.env` and `process.env` are not read (used in tests) */
  env?: Record<string, unknown>;
  fastify?: FastifyServerOptions;
};

export const buildApp = async ({
  env,
  fastify: fastifyOptions,
}: BuildAppOptions = {}) => {
  const fastify = Fastify({
    logger: true,
    ...fastifyOptions,
    ajv: {
      customOptions: {
        allowUnionTypes: true,
        // Strip unknown fields instead of rejecting: the client sends whole documents back
        removeAdditional: 'all',
      },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(fastifyEnv, getEnvOptions(env));

  // The client sends `Content-Type: application/json` with an empty body on DELETE requests
  const parseJson = fastify.getDefaultJsonParser('error', 'error');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body, done) => {
      if (body === '') return done(null, undefined);
      return parseJson(request, body.toString(), done);
    },
  );

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply
        .code(400)
        .send({ code: 'VALIDATION_ERROR', message: error.message });
    }

    const status =
      error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) request.log.error(error);

    return reply.code(status).send({
      code: typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR',
      message: status >= 500 ? 'internal server error' : error.message,
    });
  });

  fastify.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      code: 'NOT_FOUND',
      message: `route ${request.method} ${request.url} not found`,
    }),
  );

  const { CORS_ORIGINS } = fastify.config;

  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: splitList(CORS_ORIGINS),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // Opt-in per route via `config.rateLimit`
  await fastify.register(rateLimit, { global: false });

  await fastify.register(LoggerPlugin);
  await fastify.register(DatabasePlugin);
  await fastify.register(TelegramBotPlugin);
  await fastify.register(AuthPlugin);
  await fastify.register(MonitoringPlugin);

  await fastify.register(EventsRoutes, { prefix: '/events' });
  await fastify.register(PlayersRoutes, { prefix: '/players' });
  await fastify.register(UsersRoutes, { prefix: '/users' });
  await fastify.register(AuthRoutes, { prefix: '/auth' });
  await fastify.register(WeatherRoutes, { prefix: '/weather' });

  fastify.get('/metrics', fastify.metrics.routeHandler);
  fastify.get('/health', fastify.healthChecker.routeHandler);

  return fastify;
};
