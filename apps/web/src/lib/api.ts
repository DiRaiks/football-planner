import type { ErrorResponse } from '@football-planner/shared';

const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/v1`;
const TOKEN_KEY = 'fp.token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Private mode: the session lasts until the tab is closed
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing stored
    }
  },
};

type Unauthorized = () => void;
let onUnauthorized: Unauthorized = () => undefined;

/** Called once by the auth provider: a 401 anywhere ends the session */
export const setUnauthorizedHandler = (handler: Unauthorized) => {
  onUnauthorized = handler;
};

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function api<T>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  // Login and registration never send an old token, and their 401 is not a session expiry
  const isPublic = path === '/auth/login' || path === '/auth/register';
  const token = isPublic ? null : tokenStorage.get();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data ?? {}) as Partial<ErrorResponse>;
    if (response.status === 401 && token) onUnauthorized();
    throw new ApiError(
      response.status,
      error.code ?? 'UNKNOWN',
      error.message ?? 'Сервер недоступен, попробуйте ещё раз',
    );
  }
  return data as T;
}

/**
 * Retry policy for queries: answers like 404 or 403 will not change on a retry, so only
 * network failures and server errors are retried, at most twice
 */
export const shouldRetry = (failureCount: number, error: unknown) =>
  failureCount < 2 && !(error instanceof ApiError && error.status < 500);

export const isNotFound = (error: unknown) =>
  error instanceof ApiError && error.status === 404;

/** Human-readable message for a failed request */
export const errorMessage = (error: unknown) => {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? error.message;
  return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз';
};

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Неверная почта или пароль',
  USER_EXISTS: 'Пользователь с такой почтой уже есть',
  PLAYER_EXISTS: 'Вы уже записаны на этот матч',
  FORBIDDEN: 'Недостаточно прав',
  NOT_FOUND: 'Не найдено',
  VALIDATION_ERROR: 'Проверьте заполнение полей',
  INVALID_PASSWORD: 'Текущий пароль указан неверно',
  WEATHER_UNAVAILABLE: 'Прогноз сейчас недоступен',
  WEATHER_DISABLED: 'Прогноз для этого места не настроен',
};
