import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

type RouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    metrics: { routeHandler: RouteHandler };
    healthChecker: { routeHandler: RouteHandler };
  }
}

const monitoringPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('metrics', {
    routeHandler: async (_request, reply) => {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      reply.send({ uptime, memoryUsage });
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
