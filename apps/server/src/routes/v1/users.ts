import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  ChangePasswordBody,
  ObjectId,
  PublicUser,
  Session,
  UpdateMeBody,
  User,
  UserStats,
} from '@football-planner/shared';

import { toPublicUser } from '../../modules/users/user.model.js';

const usersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const { users, players } = fastify.services;

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get(
    '/',
    { schema: { response: { 200: Type.Array(PublicUser) } } },
    async () => users.listPublic(),
  );

  fastify.patch(
    '/me',
    { schema: { body: UpdateMeBody, response: { 200: User } } },
    async (request) =>
      toPublicUser(await users.updateMe(request.currentUser!, request.body)),
  );

  fastify.post(
    '/me/password',
    {
      schema: { body: ChangePasswordBody, response: { 200: Session } },
      config: {
        rateLimit: {
          max: fastify.config.AUTH_RATE_LIMIT_MAX,
          timeWindow: '1 minute',
        },
      },
    },
    async (request) => {
      const user = await users.changePassword(
        request.currentUser!,
        request.body,
      );
      return { ...toPublicUser(user), token: fastify.issueToken(user) };
    },
  );

  fastify.get(
    '/:userId/stats',
    {
      schema: {
        params: Type.Object({ userId: ObjectId }),
        response: { 200: UserStats },
      },
    },
    async (request) => ({
      eventsCount: await players.countEventsOfUser(request.params.userId),
    }),
  );
};

export default usersRoutes;
