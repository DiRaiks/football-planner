/**
 * Telegram on the client: the login on the site (OpenID Connect with PKCE) and the
 * Mini App, when the site is opened inside Telegram.
 */

const OAUTH_URL = 'https://oauth.telegram.org/auth';
// core.telegram.org/bots/webapps, "Initializing Mini Apps"
const WEB_APP_SCRIPT = 'https://telegram.org/js/telegram-web-app.js?64';
const LOGIN_KEY = 'fp.telegramLogin';

type PendingLogin = { state: string; verifier: string; from: string };

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const randomString = () =>
  base64url(crypto.getRandomValues(new Uint8Array(32)));

/** Sends the browser to Telegram; it comes back to `redirectUri` with a code */
export const startTelegramLogin = async (
  { clientId, redirectUri }: { clientId: string; redirectUri: string },
  from: string,
) => {
  const pending: PendingLogin = {
    state: randomString(),
    verifier: randomString(),
    from,
  };
  const challenge = base64url(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(pending.verifier),
      ),
    ),
  );
  sessionStorage.setItem(LOGIN_KEY, JSON.stringify(pending));
  const url = new URL(OAUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile',
    state: pending.state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  window.location.assign(url.toString());
};

/**
 * The login this tab started, matched by `state`; read once, so a reloaded or forged
 * callback cannot reuse it
 */
export const takeTelegramLogin = (state: string | null) => {
  let pending: PendingLogin | null;
  try {
    pending = JSON.parse(
      sessionStorage.getItem(LOGIN_KEY) ?? 'null',
    ) as PendingLogin | null;
    sessionStorage.removeItem(LOGIN_KEY);
  } catch {
    return null;
  }
  return pending && state && pending.state === state ? pending : null;
};

type WebApp = {
  initData: string;
  initDataUnsafe: { start_param?: string };
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
    TelegramWebviewProxy?: unknown;
  }
}

/**
 * Telegram's own webview, as telegram-web-app.js tells it: a bridge object in the
 * apps, an iframe in Telegram Web (only web.telegram.org may frame the site, see
 * deploy/Caddyfile). A link cannot fake these, unlike the fragment.
 */
const inTelegramWebview = () =>
  window.TelegramWebviewProxy !== undefined ||
  (typeof window.external === 'object' &&
    window.external !== null &&
    'notify' in window.external) ||
  window.parent !== window;

/**
 * Telegram opens Mini Apps with its launch data in the URL fragment. The fragment
 * alone is not enough: a link with someone else's data would sign the reader in as
 * that person.
 */
export const isMiniAppLaunch = (hash = window.location.hash) =>
  /[#&]tgWebAppData=/.test(hash) && inTelegramWebview();

let webApp: Promise<WebApp | null> | null = null;

/**
 * Telegram's Mini App script, loaded only inside Telegram so the site itself runs no
 * third-party code; null outside Telegram or when the script fails
 */
export const loadWebApp = () => {
  webApp ??= !isMiniAppLaunch()
    ? Promise.resolve(null)
    : new Promise<WebApp | null>((resolve) => {
        const script = document.createElement('script');
        script.src = WEB_APP_SCRIPT;
        script.onload = () => {
          const app = window.Telegram?.WebApp;
          if (!app?.initData) return resolve(null);
          app.ready();
          app.expand();
          // The launch data is a credential for a day: keep it out of history and
          // links copied from the address bar
          history.replaceState(
            history.state,
            '',
            window.location.pathname + window.location.search,
          );
          resolve(app);
        };
        script.onerror = () => resolve(null);
        document.head.append(script);
      });
  return webApp;
};

/** A match passed through `startapp` in the link that opened the Mini App */
export const startMatch = (app: WebApp) => {
  const param = app.initDataUnsafe.start_param;
  return param && /^[a-f0-9]{24}$/.test(param) ? `/events/${param}` : null;
};
