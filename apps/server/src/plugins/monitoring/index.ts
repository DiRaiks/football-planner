import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry,
} from '@prometheus-io/client';

type RouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    metrics: { routeHandler: RouteHandler; registry: Registry };
    healthChecker: { routeHandler: RouteHandler };
  }
}

const monitoringPlugin: FastifyPluginAsync = async (fastify) => {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const registers = [registry];

  const requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP requests by method, route pattern and status',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers,
  });
  new Gauge({
    name: 'database_connected',
    help: '1 while Postgres answers queries',
    registers,
    async collect() {
      this.set((await fastify.databaseConnected()) ? 1 : 0);
    },
  });

  fastify.addHook('onResponse', async (request, reply) => {
    // The route pattern (/v1/events/:id), not the URL: ids would explode the label set
    const route = request.routeOptions.url;
    if (!route || route === '/metrics') return;
    requestDuration.observe(
      { method: request.method, route, status: String(reply.statusCode) },
      reply.elapsedTime / 1000,
    );
  });

  fastify.decorate('metrics', {
    registry,
    routeHandler: async (_request, reply) => {
      reply.type(registry.contentType).send(await registry.metrics());
    },
  });

  // Always 200 while the process runs: a Telegram outage should not restart the
  // container; the status says what is wrong
  fastify.decorate('healthChecker', {
    routeHandler: async (_request, reply) => {
      const dbState = (await fastify.databaseConnected())
        ? 'connected'
        : 'disconnected';
      // Without BOT_TOKEN there is no bot to check
      const report = fastify.hasDecorator('tgHealth')
        ? await fastify.tgHealth.check()
        : null;
      // The route is public: Telegram's error text and the webhook host stay in the logs
      const telegram = report && {
        ...report,
        webhook: report.webhook && {
          set: report.webhook.set,
          pendingUpdates: report.webhook.pendingUpdates,
          lastErrorAt: report.webhook.lastErrorAt,
        },
      };
      const degraded =
        dbState !== 'connected' || (report !== null && !report.ok);
      reply.send({ status: degraded ? 'degraded' : 'ok', dbState, telegram });
    },
  });
};

export default fp(monitoringPlugin, { fastify: '5.x', name: 'monitoring' });
