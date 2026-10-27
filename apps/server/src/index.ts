import { closeOnSignals, parseTrustProxy } from '@dirai-kit/fastify';

import { buildApp } from './app.js';

// TLS terminates at the reverse proxy (Caddy); the API speaks plain HTTP inside the network
const start = async () => {
  const fastify = await buildApp({
    fastify: { trustProxy: parseTrustProxy(process.env.TRUST_PROXY) },
  });

  // SIGINT/SIGTERM close the app; the database closes in its plugin's onClose hook
  closeOnSignals(fastify);

  const { PORT } = fastify.config;
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
