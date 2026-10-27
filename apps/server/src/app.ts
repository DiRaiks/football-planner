import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyEnv from '@fastify/env';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { errors, loggerOptions, splitList } from '@dirai-kit/fastify';

import { getEnvOptions } from './env.js';
import { isTimeZone } from './lib/time.js';
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
import type { Database } from './db/index.js';

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
  /** A database instead of DATABASE_URL (PGlite in tests); the caller closes it */
  database?: Database;
};

export const buildApp = async ({
  env,
  fastify: fastifyOptions,
  telegram,
  jobs = true,
  telegramLogin,
  database,
}: BuildAppOptions = {}) => {
  // The logger is created before the env plugin reads the settings
  const { LOG_LEVEL, LOG_FORMAT } = env ?? process.env;
  const fastify = Fastify({
    logger: loggerOptions({
      level: typeof LOG_LEVEL === 'string' ? LOG_LEVEL : undefined,
      pretty: LOG_FORMAT === 'pretty',
    }),
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

  // { code, message } errors, 404 for unknown routes
  await fastify.register(errors);

  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: splitList(fastify.config.CORS_ORIGINS),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // Opt-in per route via `config.rateLimit`
  await fastify.register(rateLimit, { global: false });

  await fastify.register(DatabasePlugin, { database });
  // /health and /metrics; before Telegram: the bot adds its metrics to the same registry
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

  return fastify;
};
