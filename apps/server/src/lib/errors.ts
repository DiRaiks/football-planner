import { AppError } from '@dirai-kit/fastify';

/** Expected business errors, rendered by the `errors` plugin as `{ code, message }` with `status` */
export { AppError };

export const notFoundError = (entity: string) =>
  new AppError(404, 'NOT_FOUND', `${entity} not found`);

export const forbiddenError = () =>
  new AppError(403, 'FORBIDDEN', 'not allowed');

export { isUniqueViolation as isDuplicateKeyError } from '../db/index.js';
