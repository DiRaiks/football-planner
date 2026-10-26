export type ENVS = {
  PORT: number;
  DATABASE_URL?: string;
  /** No longer used; only to explain at startup that DATABASE_URL replaced it */
  MONGO_URI?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  LOG_LEVEL: string;
  LOG_FORMAT: string;
  BOT_TOKEN?: string;
  BOT_MODE: 'polling' | 'webhook';
  BOT_WEBHOOK_URL?: string;
  BOT_WEBHOOK_SECRET?: string;
  TELEGRAM_ADMIN_IDS: string;
  WEATHER_DEFAULT_LAT?: number;
  WEATHER_DEFAULT_LON?: number;
  PUBLIC_URL?: string;
  TELEGRAM_LOGIN_CLIENT_ID?: string;
  TELEGRAM_LOGIN_CLIENT_SECRET?: string;
  TELEGRAM_APP_URL?: string;
  CORS_ORIGINS: string;
  TRUST_PROXY: string;
  AUTH_RATE_LIMIT_MAX: number;
  TIME_ZONE: string;
};

declare module 'fastify' {
  interface FastifyInstance {
    config: ENVS;
  }
}

const ENV_SCHEME = {
  type: 'object',
  // DATABASE_URL is required too: the database plugin says so, with a hint for MONGO_URI
  required: ['PORT', 'JWT_SECRET'],
  properties: {
    PORT: { type: 'number', default: 3000 },
    // Postgres connection string: postgres://user:password@host:5432/football
    DATABASE_URL: { type: 'string' },
    // The MongoDB of older versions: only read to fail with a clear message
    MONGO_URI: { type: 'string' },
    JWT_SECRET: { type: 'string', minLength: 32 },
    JWT_EXPIRES_IN: { type: 'string', default: '30d' },
    LOG_LEVEL: {
      type: 'string',
      enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
    },
    // json for production, pretty for local development (needs pino-pretty).
    // `simple` is accepted for old .env files from the winston era and logs JSON.
    LOG_FORMAT: {
      type: 'string',
      enum: ['json', 'pretty', 'simple'],
      default: 'json',
    },
    // Telegram notifications are disabled when the token is not set
    BOT_TOKEN: { type: 'string' },
    // polling for local development, webhook in production (needs a public HTTPS URL)
    BOT_MODE: {
      type: 'string',
      enum: ['polling', 'webhook'],
      default: 'polling',
    },
    // Public base URL of this API; Telegram posts updates to <url>/telegram/webhook
    BOT_WEBHOOK_URL: { type: 'string' },
    // Random string (1-256 chars of A-Z, a-z, 0-9, _ and -) that Telegram sends with each update
    BOT_WEBHOOK_SECRET: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,256}$' },
    // Comma-separated Telegram user ids allowed to run admin bot commands
    TELEGRAM_ADMIN_IDS: { type: 'string', default: '' },
    // Weather location for events without coordinates; weather is disabled when unset
    WEATHER_DEFAULT_LAT: { type: 'number', minimum: -90, maximum: 90 },
    WEATHER_DEFAULT_LON: { type: 'number', minimum: -180, maximum: 180 },
    // Public site URL used in links sent by the bot, e.g. https://football-planner.ru
    PUBLIC_URL: { type: 'string' },
    // "Log in with Telegram" on the site: Client ID and Secret from @BotFather (Login
    // Widget), with <PUBLIC_URL>/auth/telegram registered there as a redirect URI
    TELEGRAM_LOGIN_CLIENT_ID: { type: 'string', pattern: '^[0-9]+$' },
    TELEGRAM_LOGIN_CLIENT_SECRET: { type: 'string', minLength: 1 },
    // Link that opens the site as a Mini App, e.g. https://t.me/<bot>/<app> or
    // https://t.me/<bot> for the main Mini App; announcements open matches through it
    TELEGRAM_APP_URL: {
      type: 'string',
      pattern: '^https://t\\.me/[A-Za-z0-9_/]+$',
    },
    // Comma-separated list of allowed origins; empty means cross-origin requests are rejected
    CORS_ORIGINS: { type: 'string', default: '' },
    // Proxy hops (e.g. 1) or comma-separated proxy IPs/CIDRs; empty disables trusting X-Forwarded-For
    TRUST_PROXY: { type: 'string', default: '' },
    AUTH_RATE_LIMIT_MAX: { type: 'number', default: 10 },
    // IANA time zone of the venues, e.g. Europe/Moscow: match times are entered in it
    TIME_ZONE: { type: 'string', default: 'UTC' },
  },
};

export const getEnvOptions = (data?: Record<string, unknown>) => ({
  dotenv: !data,
  schema: ENV_SCHEME,
  data: data ?? process.env,
});

export const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Converts TRUST_PROXY into Fastify's `trustProxy` option. `true` is refused: it trusts any
 * client-supplied X-Forwarded-For value, which lets attackers bypass IP-based rate limits.
 */
export const parseTrustProxy = (
  value = '',
): false | string[] | ((address: string, hop: number) => boolean) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'false') return false;
  if (trimmed === 'true') {
    throw new Error(
      'TRUST_PROXY=true is unsafe, set the number of proxy hops (e.g. 1) or proxy IPs/CIDRs',
    );
  }
  if (/^\d+$/.test(trimmed)) {
    // Trust only the given number of hops closest to the server
    const hops = Number(trimmed);
    return (_address, hop) => hop < hops;
  }

  return splitList(trimmed);
};

/** Fastify logger options; read before the env plugin runs because the logger is created first */
export const getLoggerOptions = (
  env: Record<string, unknown> = process.env,
) => {
  const level = typeof env.LOG_LEVEL === 'string' ? env.LOG_LEVEL : 'info';
  if (env.LOG_FORMAT === 'pretty') {
    return { level, transport: { target: 'pino-pretty' } };
  }
  return { level };
};
