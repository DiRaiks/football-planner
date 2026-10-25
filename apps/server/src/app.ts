import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyEnv from '@fastify/env';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { getEnvOptions, getLoggerOptions, splitList } from './env.js';
import { isTimeZone } from './lib/time.js';
import { AppError } from './lib/errors.js';
import {
  AuthPlugin,
  DatabasePlugin,
  MonitoringPlugin,
  ServicesPlugin,
  TelegramPlugin,
} from './plugins/index.js';
import V1Routes from './routes/v1/index.js';
import type { TelegramTestOptions } from './plugins/telegram/index.js';
import type { TelegramOidcOptions } from './modules/users/telegram-login.js';

export type BuildAppOptions = {
  /** Environment overrides; when set, `.env` and `process.env` are not read (used in tests) */
  env?: Record<string, unknown>;
  fastify?: FastifyServerOptions;
  /** Fake Telegram API for tests */
  telegram?: TelegramTestOptions;
  /** Background jobs such as the next match of a weekly series (default true) */
  jobs?: boolean;
  /** Fake keys and token endpoint of Telegram's login, for tests */
  telegramLogin?: Pick<TelegramOidcOptions, 'keys' | 'fetch'>;
};

export const buildApp = async ({
  env,
  fastify: fastifyOptions,
  telegram,
  jobs = true,
  telegramLogin,
}: BuildAppOptions = {}) => {
  const fastify = Fastify({
    logger: getLoggerOptions(env),
    ...fastifyOptions,
    ajv: {
      customOptions: {
        allowUnionTypes: true,
        // Strip unknown fields (e.g. server-managed `_id`, `creatorId`) instead of rejecting
        removeAdditional: 'all',
      },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(fastifyEnv, getEnvOptions(env));
  if (!isTimeZone(fastify.config.TIME_ZONE)) {
    throw new Error(
      `TIME_ZONE "${fastify.config.TIME_ZONE}" is not a known time zone, use e.g. Europe/Moscow`,
    );
  }

  // Clients often send `Content-Type: application/json` with an empty body on DELETE
  const parseJson = fastify.getDefaultJsonParser('error', 'error');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body, done) => {
      if (body === '') return done(null, undefined);
      return parseJson(request, body.toString(), done);
    },
  );

  fastify.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .code(error.status)
        .send({ code: error.code, message: error.message });
    }
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

  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: splitList(fastify.config.CORS_ORIGINS),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // Opt-in per route via `config.rateLimit`
  await fastify.register(rateLimit, { global: false });

  await fastify.register(DatabasePlugin);
  // Before Telegram: the bot adds its metrics to the same registry
  await fastify.register(MonitoringPlugin);
  await fastify.register(TelegramPlugin, { test: telegram });
  await fastify.register(AuthPlugin);
  await fastify.register(ServicesPlugin, { telegramLogin });

  await fastify.register(V1Routes, { prefix: '/v1' });

  if (jobs) {
    // Once a minute: weekly series get their next match when one starts
    let timer: NodeJS.Timeout | undefined;
    fastify.addHook('onReady', async () => {
      timer = setInterval(() => {
        fastify.services.events
          .createDueRepeats()
          .catch((err: unknown) =>
            fastify.log.error({ err }, 'weekly matches failed'),
          );
      }, 60_000);
    });
    fastify.addHook('onClose', async () => clearInterval(timer));
  }

  fastify.get('/metrics', fastify.metrics.routeHandler);
  // Public through Caddy, and each call reads the database
  fastify.get(
    '/health',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    fastify.healthChecker.routeHandler,
  );

  return fastify;
};
