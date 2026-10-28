import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import authRoutes from './auth.js';
import eventsRoutes from './events.js';
import playersRoutes from './players.js';
import statsRoutes from './stats.js';
import weatherRoutes from './weather.js';
import usersRoutes from './users.js';

/** Id params of the routes below */
const ID_PARAMS = ['id', 'eventId', 'playerId', 'userId'];

const v1Routes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Ids are stored in lower case; MongoDB matched upper-case hex too
  fastify.addHook('preValidation', async (request) => {
    const params = request.params as Record<string, unknown>;
    for (const name of ID_PARAMS) {
      const value = params?.[name];
      if (typeof value === 'string') params[name] = value.toLowerCase();
    }
  });
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(usersRoutes, { prefix: '/users' });
  await fastify.register(eventsRoutes, { prefix: '/events' });
  await fastify.register(playersRoutes, { prefix: '/events/:eventId/players' });
  await fastify.register(statsRoutes, { prefix: '/stats' });
  await fastify.register(weatherRoutes, { prefix: '/weather' });
};

export default v1Routes;
