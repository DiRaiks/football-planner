import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/features/auth/auth';
import { TelegramCallbackPage } from '@/features/auth/TelegramLogin';
import * as telegram from '@/lib/telegram';
import { LoginPage } from '@/routes/AuthPages';
import { mockApi, renderRoutes, user } from './helpers';

const PROVIDER = {
  clientId: '123456789',
  redirectUri: 'https://football-planner.ru/auth/telegram',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

const base64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('Telegram login on the site', () => {
  it('sends the browser to Telegram with PKCE and remembers the login', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    await telegram.startTelegramLogin(PROVIDER, '/events/42');

    const url = new URL(assign.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://oauth.telegram.org/auth');
    const pending = JSON.parse(sessionStorage.getItem('fp.telegramLogin')!);
    expect(pending.from).toBe('/events/42');
    expect(pending.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: '123456789',
      redirect_uri: PROVIDER.redirectUri,
      response_type: 'code',
      scope: 'openid profile',
      state: pending.state,
      code_challenge: base64url(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(pending.verifier),
        ),
      ),
      code_challenge_method: 'S256',
    });
  });

  it('takes the login back only with its own state, and only once', () => {
    const pending = { state: 's1', verifier: 'v'.repeat(43), from: '/events' };
    sessionStorage.setItem('fp.telegramLogin', JSON.stringify(pending));
    expect(telegram.takeTelegramLogin('forged')).toBeNull();
    // A wrong state also drops it: the next try starts over
    expect(telegram.takeTelegramLogin('s1')).toBeNull();

    sessionStorage.setItem('fp.telegramLogin', JSON.stringify(pending));
    expect(telegram.takeTelegramLogin('s1')).toEqual(pending);
    expect(telegram.takeTelegramLogin('s1')).toBeNull();
  });

  it('shows the button only when the server has the login', async () => {
    mockApi(() => ({ body: { telegram: PROVIDER, miniApp: true } }));
    renderRoutes(
      [{ path: '/login', element: <LoginPage /> }],
      '/login',
      (node) => <AuthProvider>{node}</AuthProvider>,
    );
    expect(
      await screen.findByRole('button', { name: 'Войти через Telegram' }),
    ).toBeInTheDocument();
  });

  it('has no button without it', async () => {
    const calls = mockApi(() => ({ body: { telegram: null, miniApp: false } }));
    renderRoutes(
      [{ path: '/login', element: <LoginPage /> }],
      '/login',
      (node) => <AuthProvider>{node}</AuthProvider>,
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(
      screen.queryByRole('button', { name: 'Войти через Telegram' }),
    ).not.toBeInTheDocument();
  });
});

describe('TelegramCallbackPage', () => {
  const Where = () => {
    const { user: me } = useAuth();
    return <p>{me ? `Вошёл: ${me.name}` : 'никто'}</p>;
  };
  const render = (url: string) =>
    renderRoutes(
      [
        { path: '/auth/telegram', element: <TelegramCallbackPage /> },
        { path: '/events/:id', element: <Where /> },
        { path: '/login', element: <p>Вход</p> },
      ],
      url,
      (node: ReactNode) => <AuthProvider>{node}</AuthProvider>,
    );

  it('trades the code for a session and goes where the user was going', async () => {
    sessionStorage.setItem(
      'fp.telegramLogin',
      JSON.stringify({
        state: 's1',
        verifier: 'v'.repeat(43),
        from: '/events/7',
      }),
    );
    const calls = mockApi(({ path }) => ({
      body: path === '/auth/me' ? user : { ...user, token: 'jwt' },
    }));
    render('/auth/telegram?code=c1&state=s1');

    expect(await screen.findByText(`Вошёл: ${user.name}`)).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/auth/telegram',
      body: { code: 'c1', codeVerifier: 'v'.repeat(43) },
    });
    expect(localStorage.getItem('fp.token')).toBe('jwt');
  });

  it('refuses a callback this tab did not start', async () => {
    const calls = mockApi(() => ({ body: {} }));
    render('/auth/telegram?code=c1&state=forged');
    expect(
      await screen.findByText('Ссылка входа устарела. Попробуйте ещё раз'),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('explains a failed exchange', async () => {
    sessionStorage.setItem(
      'fp.telegramLogin',
      JSON.stringify({
        state: 's1',
        verifier: 'v'.repeat(43),
        from: '/events',
      }),
    );
    mockApi(() => ({
      status: 401,
      body: { code: 'TELEGRAM_AUTH_FAILED', message: 'x' },
    }));
    render('/auth/telegram?code=c1&state=s1');
    expect(
      await screen.findByText(
        'Telegram не подтвердил вход. Попробуйте ещё раз',
      ),
    ).toBeInTheDocument();
  });
});

describe('Mini App', () => {
  it('signs in with the data Telegram gives the app', async () => {
    vi.spyOn(telegram, 'isMiniAppLaunch').mockReturnValue(true);
    vi.spyOn(telegram, 'loadWebApp').mockResolvedValue({
      initData: 'auth_date=1&hash=abc',
      initDataUnsafe: {},
      colorScheme: 'dark',
      ready: vi.fn(),
      expand: vi.fn(),
    });
    const calls = mockApi(({ path }) => ({
      body: path === '/auth/me' ? user : { ...user, token: 'mini-jwt' },
    }));
    const Who = () => <p>{useAuth().user?.name ?? 'никто'}</p>;
    renderRoutes([{ path: '/', element: <Who /> }], '/', (node) => (
      <AuthProvider>{node}</AuthProvider>
    ));

    expect(await screen.findByText(user.name)).toBeInTheDocument();
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/auth/telegram/webapp',
      body: { initData: 'auth_date=1&hash=abc' },
    });
    expect(localStorage.getItem('fp.token')).toBe('mini-jwt');
  });

  it('opens the match the link pointed to', () => {
    const app = {
      initData: 'x',
      colorScheme: 'light' as const,
      ready: vi.fn(),
      expand: vi.fn(),
    };
    expect(
      telegram.startMatch({
        ...app,
        initDataUnsafe: { start_param: '507f1f77bcf86cd799439011' },
      }),
    ).toBe('/events/507f1f77bcf86cd799439011');
    expect(
      telegram.startMatch({
        ...app,
        initDataUnsafe: { start_param: '../account' },
      }),
    ).toBeNull();
  });

  it('trusts the fragment only inside Telegram', () => {
    const launch = '#tgWebAppData=query_id%3D1&tgWebAppVersion=8.0';
    // A link with someone's launch data, opened in a browser
    expect(telegram.isMiniAppLaunch(launch)).toBe(false);

    vi.stubGlobal('TelegramWebviewProxy', { postEvent: vi.fn() });
    expect(telegram.isMiniAppLaunch(launch)).toBe(true);
    expect(telegram.isMiniAppLaunch('#main')).toBe(false);
  });
});

it('keeps the user on the page while Telegram signs in', async () => {
  vi.spyOn(telegram, 'isMiniAppLaunch').mockReturnValue(true);
  let finish: (value: null) => void = () => undefined;
  vi.spyOn(telegram, 'loadWebApp').mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  mockApi(() => ({ body: {} }));
  const State = () => {
    const { isLoading } = useAuth();
    return <p>{isLoading ? 'загрузка' : 'готово'}</p>;
  };
  renderRoutes([{ path: '/', element: <State /> }], '/', (node) => (
    <AuthProvider>{node}</AuthProvider>
  ));
  expect(screen.getByText('загрузка')).toBeInTheDocument();
  finish(null);
  expect(await screen.findByText('готово')).toBeInTheDocument();
});
