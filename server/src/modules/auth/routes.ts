import { FastifyInstance } from 'fastify';
import { pbkdf2Sync, randomBytes } from 'crypto';
import { UserModel } from '../users/user.model.js';

export type PasswordHash = { hash: string; salt: string };

export function setPassword(password: string): PasswordHash {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
  return { hash, salt };
}

export function validatePassword(
  password: string,
  user: { hash: string; salt: string },
): boolean {
  const hash = pbkdf2Sync(password, user.salt, 10000, 512, 'sha512').toString(
    'hex',
  );
  return user.hash === hash;
}

const authRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      reply.code(400);
      return { message: 'email and password required' };
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      reply.code(401);
      return { message: 'invalid credentials' };
    }

    if (!validatePassword(password, user)) {
      reply.code(401);
      return { message: 'invalid credentials' };
    }

    const token = fastify.jwt.sign({ id: user._id.toString() });
    return { email: user.email, name: user.name, token };
  });

  fastify.post('/registration', async (request, reply) => {
    const { email, name, password } = request.body as {
      email?: string;
      name?: string;
      password?: string;
    };

    if (!email || !name || !password) {
      reply.code(400);
      return { message: 'email, name and password required' };
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      reply.code(409);
      return { message: 'user already exists' };
    }

    const { hash, salt } = setPassword(password);
    const user = await UserModel.create({ email, name, hash, salt });

    const token = fastify.jwt.sign({ id: user._id.toString() });
    return {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      token,
    };
  });

  fastify.get(
    '/profile',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { id } = request.user as { id: string };
      const user = await UserModel.findById(id);
      if (!user) return null;
      return { _id: user._id.toString(), email: user.email, name: user.name };
    },
  );

  fastify.get(
    '/check',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { id } = request.user as { id: string };
      const user = await UserModel.findById(id);
      if (!user) return null;
      return { _id: user._id.toString(), email: user.email, name: user.name };
    },
  );
};

export default authRoutes;
