import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyEnv from '@fastify/env';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { getEnvOptions, getLoggerOptions, splitList } from './env.js';
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

export type BuildAppOptions = {
  /** Environment overrides; when set, `.env` and `process.env` are not read (used in tests) */
  env?: Record<string, unknown>;
  fastify?: FastifyServerOptions;
  /** Fake Telegram API for tests */
  telegram?: TelegramTestOptions;
};

export const buildApp = async ({
  env,
  fastify: fastifyOptions,
  telegram,
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
  await fastify.register(TelegramPlugin, { test: telegram });
  await fastify.register(AuthPlugin);
  await fastify.register(ServicesPlugin);
  await fastify.register(MonitoringPlugin);

  await fastify.register(V1Routes, { prefix: '/v1' });

  fastify.get('/metrics', fastify.metrics.routeHandler);
  fastify.get('/health', fastify.healthChecker.routeHandler);

  return fastify;
};
