import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { sendError } from '../../lib/http.js';
import {
  UserModel,
  type UserDocument,
} from '../../modules/users/user.model.js';

type TokenPayload = { id: string; v?: number; iat?: number; exp?: number };

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; v: number };
    user: TokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    isAdmin: (user: UserDocument) => boolean;
    issueToken: (user: UserDocument) => string;
  }
  interface FastifyRequest {
    currentUser: UserDocument | null;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const { JWT_SECRET, JWT_EXPIRES_IN } = fastify.config;

  await fastify.register(fastifyJwt, {
    secret: JWT_SECRET,
    sign: { expiresIn: JWT_EXPIRES_IN },
  });

  fastify.decorateRequest('currentUser', null);

  fastify.decorate('isAdmin', (user: UserDocument) => user.role === 'admin');

  fastify.decorate('issueToken', (user: UserDocument) =>
    fastify.jwt.sign({ id: user._id.toString(), v: user.tokenVersion ?? 0 }),
  );

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      let payload: TokenPayload;
      try {
        payload = await request.jwtVerify<TokenPayload>();
      } catch {
        return sendError(
          reply,
          401,
          'UNAUTHORIZED',
          'invalid or expired token',
        );
      }

      // Tokens issued before expiration was introduced never expire; force a new login
      if (!payload.exp || !payload.iat) {
        return sendError(
          reply,
          401,
          'UNAUTHORIZED',
          'token expired, please log in again',
        );
      }

      const user = await UserModel.findById(payload.id);
      if (!user) return sendError(reply, 401, 'UNAUTHORIZED', 'user not found');

      // Tokens issued before the last password change carry an outdated version
      if ((payload.v ?? 0) !== (user.tokenVersion ?? 0)) {
        return sendError(
          reply,
          401,
          'UNAUTHORIZED',
          'token revoked, please log in again',
        );
      }

      request.currentUser = user;
    },
  );
};

export default fp(authPlugin, { fastify: '5.x', name: 'auth' });
