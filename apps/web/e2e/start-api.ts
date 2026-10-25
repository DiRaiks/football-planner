/**
 * The real API on an in-memory MongoDB, for the end-to-end tests. Started by Playwright
 * (see playwright.config.ts); no database or bot token needed.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

import { buildApp } from '../../server/src/app.js';

const port = Number(process.env.E2E_API_PORT ?? 3101);
const mongo = await MongoMemoryServer.create();
const app = await buildApp({
  fastify: { logger: false },
  env: {
    PORT: port,
    MONGO_URI: mongo.getUri(),
    JWT_SECRET: 'e2e-secret-that-is-long-enough-1234567890',
    LOG_FORMAT: 'json',
    LOG_LEVEL: 'warn',
    // Every test registers users from the same address
    AUTH_RATE_LIMIT_MAX: 1000,
  },
});
await app.listen({ port, host: '127.0.0.1' });

const stop = async () => {
  await app.close();
  await mongo.stop();
  process.exit(0);
};
process.once('SIGTERM', () => void stop());
process.once('SIGINT', () => void stop());
