import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import {
  UserModel,
  type UserDocument,
} from '../../modules/users/user.model.js';

const unauthorized = (reply: FastifyReply, message: string) =>
  reply.code(401).send({ code: 'UNAUTHORIZED', message });

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
    /** `expiresIn` shortens the session, e.g. for one opened from a Mini App */
    issueToken: (user: UserDocument, expiresIn?: string) => string;
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

  fastify.decorate('issueToken', (user: UserDocument, expiresIn?: string) =>
    fastify.jwt.sign(
      { id: user._id.toString(), v: user.tokenVersion ?? 0 },
      expiresIn ? { expiresIn } : {},
    ),
  );

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      let payload: TokenPayload;
      try {
        payload = await request.jwtVerify<TokenPayload>();
      } catch {
        return unauthorized(reply, 'invalid or expired token');
      }

      // Tokens issued before expiration was introduced never expire; force a new login
      if (!payload.exp || !payload.iat) {
        return unauthorized(reply, 'token expired, please log in again');
      }

      const user = await UserModel.findById(payload.id);
      if (!user) return unauthorized(reply, 'user not found');

      // Tokens issued before the last password change carry an outdated version
      if ((payload.v ?? 0) !== (user.tokenVersion ?? 0)) {
        return unauthorized(reply, 'token revoked, please log in again');
      }

      request.currentUser = user;
    },
  );
};

export default fp(authPlugin, { fastify: '5.x', name: 'auth' });
