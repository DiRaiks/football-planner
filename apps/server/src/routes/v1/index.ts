import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import authRoutes from './auth.js';
import eventsRoutes from './events.js';
import playersRoutes from './players.js';
import statsRoutes from './stats.js';
import usersRoutes from './users.js';

const v1Routes: FastifyPluginAsyncTypebox = async (fastify) => {
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(usersRoutes, { prefix: '/users' });
  await fastify.register(eventsRoutes, { prefix: '/events' });
  await fastify.register(playersRoutes, { prefix: '/events/:eventId/players' });
  await fastify.register(statsRoutes, { prefix: '/stats' });
};

export default v1Routes;
