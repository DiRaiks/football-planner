import fs from 'fs';
import path from 'path';

import { buildApp } from './app.js';
import { parseTrustProxy } from './env.js';

const readHttpsOptions = () => {
  const { HTTPS_PRIVKEY_PATH, HTTPS_FULLCHAIN_PATH } = process.env;
  if (!HTTPS_PRIVKEY_PATH || !HTTPS_FULLCHAIN_PATH) return {};

  const keyPath = path.resolve(HTTPS_PRIVKEY_PATH);
  const certPath = path.resolve(HTTPS_FULLCHAIN_PATH);
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) return {};

  return {
    https: { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
  };
};

const start = async () => {
  const fastify = await buildApp({
    fastify: {
      ...readHttpsOptions(),
      trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    },
  });

  process.on('unhandledRejection', (reason) => {
    fastify.log.error({ reason }, 'unhandledRejection');
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void fastify.close().then(() => process.exit(0));
    });
  }

  const { PORT } = fastify.config;
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
