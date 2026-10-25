import { Type } from 'typebox';
import type { FastifyReply } from 'fastify';

export const ObjectId = Type.String({ pattern: '^[a-fA-F0-9]{24}$' });

export const ErrorResponse = Type.Object({
  code: Type.String(),
  message: Type.String(),
});

export const sendError = (
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
) => reply.code(status).send({ code, message });

export const notFound = (reply: FastifyReply, entity: string) =>
  sendError(reply, 404, 'NOT_FOUND', `${entity} not found`);

export const forbidden = (reply: FastifyReply) =>
  sendError(reply, 403, 'FORBIDDEN', 'not allowed');

export const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 11000;
