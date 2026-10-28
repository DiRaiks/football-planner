import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';

import { AppError } from '../../lib/errors.js';
import { telegramPhotoUrl, type TelegramUser } from './users.service.js';

/** How long Mini App data stays valid after Telegram signed it */
const INIT_DATA_MAX_AGE_S = 24 * 60 * 60;

const OIDC_ISSUER = 'https://oauth.telegram.org';
const OIDC_TOKEN_URL = `${OIDC_ISSUER}/token`;
const OIDC_JWKS_URL = `${OIDC_ISSUER}/.well-known/jwks.json`;
const OIDC_TIMEOUT_MS = 10_000;
// Signing algorithms in Telegram's discovery document that jose supports
const OIDC_ALGORITHMS = ['RS256', 'ES256', 'EdDSA'];
/** Mini App data from the future: clocks differ a little, not more */
const CLOCK_SKEW_S = 60;

const invalid = (message: string) =>
  new AppError(401, 'TELEGRAM_AUTH_FAILED', message);

const unavailable = () =>
  new AppError(502, 'TELEGRAM_UNAVAILABLE', 'telegram did not answer');

const sameHex = (a: string, b: string) => {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Checks the `initData` a Mini App gets from Telegram: the hash is an HMAC of every
 * other field, keyed with the bot token (core.telegram.org/bots/webapps, "Validating
 * data received via the Mini App"). Returns the user who opened the app.
 */
export const verifyInitData = (
  initData: string,
  botToken: string,
  now = Date.now(),
): { user: TelegramUser; startParam?: string } => {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw invalid('init data has no hash');
  params.delete('hash');

  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret)
    .update(checkString)
    .digest('hex');
  if (!sameHex(hash, expected)) throw invalid('init data hash mismatch');

  const authDate = Number(params.get('auth_date'));
  const age = now / 1000 - authDate;
  if (
    !Number.isFinite(authDate) ||
    age > INIT_DATA_MAX_AGE_S ||
    age < -CLOCK_SKEW_S
  ) {
    throw invalid('init data expired');
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(params.get('user') ?? '') as TelegramUser;
  } catch {
    throw invalid('init data has no user');
  }
  if (!Number.isSafeInteger(user.id) || user.id <= 0) {
    throw invalid('init data has no user');
  }
  const startParam = params.get('start_param') ?? undefined;
  const photoUrl = telegramPhotoUrl(user.photo_url);
  return {
    user: {
      id: user.id,
      first_name: String(user.first_name ?? ''),
      ...(user.last_name && { last_name: String(user.last_name) }),
      ...(user.username && { username: String(user.username) }),
      ...(photoUrl && { photo_url: photoUrl }),
    },
    ...(startParam && { startParam }),
  };
};

export type TelegramOidcOptions = {
  clientId: string;
  clientSecret: string;
  /** Registered in @BotFather; the site's /auth/telegram page */
  redirectUri: string;
  /** Tests replace Telegram's keys and token endpoint */
  keys?: JWTVerifyGetKey;
  fetch?: typeof fetch;
};

/**
 * "Log in with Telegram" on the site: OpenID Connect, authorization code with PKCE
 * (core.telegram.org/widgets/login). The browser gets the code; the server trades it
 * for an ID token with the client secret and checks the token's signature.
 */
export class TelegramOidc {
  private readonly keys: JWTVerifyGetKey;
  private readonly fetch: typeof fetch;

  constructor(private readonly options: TelegramOidcOptions) {
    this.keys =
      options.keys ??
      createRemoteJWKSet(new URL(OIDC_JWKS_URL), {
        timeoutDuration: OIDC_TIMEOUT_MS,
      });
    this.fetch = options.fetch ?? fetch;
  }

  get clientId() {
    return this.options.clientId;
  }

  get redirectUri() {
    return this.options.redirectUri;
  }

  async exchange(code: string, codeVerifier: string): Promise<TelegramUser> {
    const { clientId, clientSecret, redirectUri } = this.options;
    let response: Response;
    try {
      response = await this.fetch(OIDC_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(OIDC_TIMEOUT_MS),
      });
    } catch {
      throw unavailable();
    }
    // A used, expired or forged code; Telegram's own trouble is not the user's
    if (response.status >= 500) throw unavailable();
    if (!response.ok) throw invalid(`token endpoint said ${response.status}`);

    const body = (await response.json().catch(() => null)) as {
      id_token?: unknown;
      error?: unknown;
    } | null;
    // Telegram answers refusals with 200 and an OAuth error code such as
    // `invalid_grant` or `invalid_client`; the code names the cause
    if (typeof body?.error === 'string') {
      throw invalid(`token endpoint said ${body.error.slice(0, 64)}`);
    }
    const idToken = body?.id_token;
    if (typeof idToken !== 'string') throw invalid('no id token');

    let claims: Record<string, unknown>;
    try {
      ({ payload: claims } = await jwtVerify(idToken, this.keys, {
        issuer: OIDC_ISSUER,
        audience: clientId,
        algorithms: OIDC_ALGORITHMS,
        requiredClaims: ['exp', 'iat'],
      }));
    } catch (error) {
      // Telegram's keys could not be fetched: not the token's fault
      const keysUnavailable =
        !(error instanceof errors.JOSEError) ||
        error instanceof errors.JWKSTimeout;
      throw keysUnavailable ? unavailable() : invalid('id token is not valid');
    }

    // The Telegram user id; `sub` is a different, OIDC-only identifier
    const id =
      typeof claims.id === 'number'
        ? claims.id
        : typeof claims.id === 'string' && /^\d+$/.test(claims.id)
          ? Number(claims.id)
          : NaN;
    if (!Number.isSafeInteger(id) || id <= 0) throw invalid('no telegram id');
    const text = (value: unknown) =>
      typeof value === 'string' && value ? value : undefined;
    const firstName = text(claims.given_name) ?? text(claims.name) ?? '';
    // `name` is the full name already: a family name only goes with `given_name`
    const lastName = text(claims.given_name) && text(claims.family_name);
    const username = text(claims.preferred_username);
    const photoUrl = telegramPhotoUrl(claims.picture);
    return {
      id,
      first_name: firstName,
      ...(lastName && { last_name: lastName }),
      ...(username && { username }),
      ...(photoUrl && { photo_url: photoUrl }),
    };
  }
}
