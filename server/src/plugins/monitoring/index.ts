import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    metrics: {
      routeHandler: (req: any, reply: any) => Promise<void>;
    };
    healthChecker: {
      routeHandler: (req: any, reply: any) => Promise<void>;
    };
  }
}

const monitoringPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('metrics', {
    routeHandler: async (_request: any, reply: any) => {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      reply.send({ uptime, memoryUsage });
    },
  });

  fastify.decorate('healthChecker', {
    routeHandler: async (_request: any, reply: any) => {
      const dbState = fastify?.mongoose?.connection?.readyState === 1 ? 'connected' : 'disconnected';
      reply.send({ status: 'ok', dbState });
    },
  });
};

export default fp(monitoringPlugin, '4.x');
