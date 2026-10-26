/** Expected business error, rendered by the error handler as `{ code, message }` with `status` */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundError = (entity: string) =>
  new AppError(404, 'NOT_FOUND', `${entity} not found`);

export const forbiddenError = () =>
  new AppError(403, 'FORBIDDEN', 'not allowed');

export { isUniqueViolation as isDuplicateKeyError } from '../db/index.js';
