import { buildApp } from './app.js';
import { parseTrustProxy } from './env.js';

// TLS terminates at the reverse proxy (Caddy); the API speaks plain HTTP inside the network
const start = async () => {
  const fastify = await buildApp({
    fastify: { trustProxy: parseTrustProxy(process.env.TRUST_PROXY) },
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
