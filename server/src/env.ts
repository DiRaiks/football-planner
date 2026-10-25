export type ENVS = {
  PORT: number;
  MONGO_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  LOG_FORMAT: string;
  BOT_TOKEN?: string;
  OPENWEATHER_API_KEY?: string;
  PUBLIC_URL?: string;
  CORS_ORIGINS: string;
  TRUST_PROXY: string;
  AUTH_RATE_LIMIT_MAX: number;
  HTTPS_PRIVKEY_PATH?: string;
  HTTPS_FULLCHAIN_PATH?: string;
};

declare module 'fastify' {
  interface FastifyInstance {
    config: ENVS;
  }
}

const ENV_SCHEME = {
  type: 'object',
  required: ['PORT', 'MONGO_URI', 'JWT_SECRET'],
  properties: {
    PORT: { type: 'number', default: 3000 },
    // Any MongoDB connection string: Atlas (mongodb+srv://...) or self-hosted (mongodb://mongo:27017/db)
    MONGO_URI: { type: 'string', minLength: 1 },
    JWT_SECRET: { type: 'string', minLength: 32 },
    JWT_EXPIRES_IN: { type: 'string', default: '30d' },
    LOG_FORMAT: { type: 'string', default: 'json' },
    // Telegram notifications are disabled when the token is not set
    BOT_TOKEN: { type: 'string' },
    OPENWEATHER_API_KEY: { type: 'string' },
    // Public site URL used in links sent by the bot, e.g. https://football-planner.ru
    PUBLIC_URL: { type: 'string' },
    // Comma-separated list of allowed origins; empty means cross-origin requests are rejected
    CORS_ORIGINS: { type: 'string', default: '' },
    // Proxy hops (e.g. 1) or comma-separated proxy IPs/CIDRs; empty disables trusting X-Forwarded-For
    TRUST_PROXY: { type: 'string', default: '' },
    AUTH_RATE_LIMIT_MAX: { type: 'number', default: 10 },
    HTTPS_PRIVKEY_PATH: { type: 'string' },
    HTTPS_FULLCHAIN_PATH: { type: 'string' },
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
