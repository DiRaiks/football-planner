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
    name: 'mongodb_connected',
    help: '1 while the MongoDB connection is open',
    registers,
    collect() {
      this.set(fastify.mongoose?.connection?.readyState === 1 ? 1 : 0);
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

  fastify.decorate('healthChecker', {
    routeHandler: async (_request, reply) => {
      const dbState =
        fastify?.mongoose?.connection?.readyState === 1
          ? 'connected'
          : 'disconnected';
      reply.send({ status: 'ok', dbState });
    },
  });
};

export default fp(monitoringPlugin, { fastify: '5.x', name: 'monitoring' });
