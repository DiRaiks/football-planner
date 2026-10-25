import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ObjectId, sendError } from '../../lib/http.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { PlayerModel } from '../players/player.model.js';
import { UserModel, toPublicUser } from './user.model.js';

const usersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/all', async () => {
    const users = await UserModel.find({}, { name: 1 });
    return users.map((user) => ({ _id: user._id.toString(), name: user.name }));
  });

  fastify.get('/me', async (request) => toPublicUser(request.currentUser!));

  fastify.patch(
    '/me',
    {
      schema: {
        body: Type.Object(
          { name: Type.String({ minLength: 1, maxLength: 50 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const user = request.currentUser!;
      user.name = request.body.name;
      await user.save();

      return toPublicUser(user);
    },
  );

  fastify.post(
    '/me/password',
    {
      schema: {
        body: Type.Object(
          {
            currentPassword: Type.String({ minLength: 1, maxLength: 128 }),
            newPassword: Type.String({ minLength: 8, maxLength: 128 }),
          },
          { additionalProperties: false },
        ),
      },
      config: {
        rateLimit: {
          max: fastify.config.AUTH_RATE_LIMIT_MAX,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const user = await UserModel.findById(request.currentUser!._id).select(
        '+hash +salt',
      );
      if (
        !user ||
        !(await verifyPassword(request.body.currentPassword, user)).ok
      ) {
        return sendError(
          reply,
          400,
          'INVALID_PASSWORD',
          'current password is incorrect',
        );
      }

      user.hash = await hashPassword(request.body.newPassword);
      user.salt = undefined;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save();

      const token = fastify.issueToken(user);
      return { ...toPublicUser(user), token };
    },
  );

  fastify.get(
    '/userEventsCount/:userId',
    { schema: { params: Type.Object({ userId: ObjectId }) } },
    async (request) =>
      PlayerModel.countDocuments({ userId: request.params.userId }),
  );
};

export default usersRoutes;
