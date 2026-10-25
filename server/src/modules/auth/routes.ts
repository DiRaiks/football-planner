import { randomBytes } from 'node:crypto';
import { Type } from 'typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { hashPassword, verifyPassword } from '../../lib/password.js';
import { isDuplicateKeyError, sendError } from '../../lib/http.js';
import {
  UserModel,
  findUserByEmail,
  toPublicUser,
} from '../users/user.model.js';

const Email = Type.String({ format: 'email', maxLength: 254 });
const Password = Type.String({ minLength: 8, maxLength: 128 });

const LoginBody = Type.Object(
  { email: Email, password: Type.String({ minLength: 1, maxLength: 128 }) },
  { additionalProperties: false },
);

const RegistrationBody = Type.Object(
  {
    email: Email,
    name: Type.String({ minLength: 1, maxLength: 50 }),
    password: Password,
  },
  { additionalProperties: false },
);

const authRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Unknown emails are checked against this hash so they take as long as real accounts
  const dummyHash = await hashPassword(randomBytes(16).toString('hex'));

  const rateLimit = {
    max: fastify.config.AUTH_RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  };

  fastify.post(
    '/login',
    { schema: { body: LoginBody }, config: { rateLimit } },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await findUserByEmail(email).select('+hash +salt');
      const result = await verifyPassword(
        password,
        user ?? { hash: dummyHash },
      );

      if (!user || !result.ok) {
        return sendError(
          reply,
          401,
          'INVALID_CREDENTIALS',
          'invalid credentials',
        );
      }

      if (result.needsRehash) {
        user.hash = await hashPassword(password);
        user.salt = undefined;
        await user.save();
      }

      const token = fastify.issueToken(user);
      return { ...toPublicUser(user), token };
    },
  );

  fastify.post(
    '/registration',
    { schema: { body: RegistrationBody }, config: { rateLimit } },
    async (request, reply) => {
      const { email, name, password } = request.body;

      if (await findUserByEmail(email)) {
        return sendError(reply, 409, 'USER_EXISTS', 'user already exists');
      }

      const hash = await hashPassword(password);
      let user;
      try {
        user = await UserModel.create({ email, name, hash });
      } catch (error) {
        // Concurrent registration of the same email hits the unique index
        if (isDuplicateKeyError(error)) {
          return sendError(reply, 409, 'USER_EXISTS', 'user already exists');
        }
        throw error;
      }

      const token = fastify.issueToken(user);
      return { ...toPublicUser(user), token };
    },
  );

  const profile = {
    onRequest: [fastify.authenticate],
    handler: async (request: {
      currentUser: Parameters<typeof toPublicUser>[0] | null;
    }) => (request.currentUser ? toPublicUser(request.currentUser) : null),
  };

  fastify.get('/profile', profile);
  // Kept for the current frontend, which checks the session via /auth/check
  fastify.get('/check', profile);
};

export default authRoutes;
