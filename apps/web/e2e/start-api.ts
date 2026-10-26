/**
 * The real API on Postgres in memory (PGlite), for the end-to-end tests. Started by
 * Playwright (see playwright.config.ts); no database or bot token needed.
 */
import { buildApp } from '../../server/src/app.js';
import { createPgliteDatabase } from '../../server/src/db/pglite.js';

const port = Number(process.env.E2E_API_PORT ?? 3101);
const database = await createPgliteDatabase();
const app = await buildApp({
  fastify: { logger: false },
  jobs: false,
  database,
  env: {
    PORT: port,
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
  await database.close();
  process.exit(0);
};
process.once('SIGTERM', () => void stop());
process.once('SIGINT', () => void stop());
