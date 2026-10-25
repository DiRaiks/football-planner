import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  LoginBody,
  RegisterBody,
  Session,
  User,
} from '@football-planner/shared';

import { toPublicUser } from '../../modules/users/user.model.js';

const authRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const { users } = fastify.services;
  const rateLimit = {
    max: fastify.config.AUTH_RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  };

  fastify.post(
    '/login',
    {
      schema: { body: LoginBody, response: { 200: Session } },
      config: { rateLimit },
    },
    async (request) => {
      const user = await users.login(request.body);
      return { ...toPublicUser(user), token: fastify.issueToken(user) };
    },
  );

  fastify.post(
    '/register',
    {
      schema: { body: RegisterBody, response: { 200: Session } },
      config: { rateLimit },
    },
    async (request) => {
      const user = await users.register(request.body);
      return { ...toPublicUser(user), token: fastify.issueToken(user) };
    },
  );

  fastify.get(
    '/me',
    { onRequest: [fastify.authenticate], schema: { response: { 200: User } } },
    async (request) => toPublicUser(request.currentUser!),
  );
};

export default authRoutes;
