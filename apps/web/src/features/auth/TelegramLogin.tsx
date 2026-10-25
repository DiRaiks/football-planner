import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { TelegramLogo } from '@phosphor-icons/react';
import type { Session } from '@football-planner/shared';

import { Button, ErrorNote, Skeleton } from '@/components/ui';
import { safeRedirect } from '@/routes/Layout';
import { ApiError, api, errorMessage } from '@/lib/api';
import { startTelegramLogin, takeTelegramLogin } from '@/lib/telegram';
import { useAuth, useAuthProviders } from './auth';

/** "Войти через Telegram" with a divider, when the server has the login configured */
export function TelegramLoginButton() {
  const { data: providers } = useAuthProviders();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const telegram = providers?.telegram;
  if (!telegram) return null;

  const from = safeRedirect(
    (location.state as { from?: unknown } | null)?.from,
  );
  return (
    <div className="grid gap-5">
      <Button
        variant="secondary"
        size="lg"
        loading={pending}
        icon={<TelegramLogo className="size-5" weight="fill" aria-hidden />}
        onClick={() => {
          setPending(true);
          void startTelegramLogin(telegram, from).catch(() =>
            setPending(false),
          );
        }}
      >
        Войти через Telegram
      </Button>
      <p className="flex items-center gap-3 text-sm text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        или по почте
      </p>
    </div>
  );
}

/** Where Telegram sends the browser back after the login, with a code */
export function TelegramCallbackPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Once: the code works a single time, and StrictMode runs effects twice
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(search);
    const pending = takeTelegramLogin(params.get('state'));
    const code = params.get('code');
    const login = async () => {
      if (!pending || !code) {
        throw new Error(
          params.get('error')
            ? 'Вход через Telegram отменён'
            : 'Ссылка входа устарела. Попробуйте ещё раз',
        );
      }
      setSession(
        await api<Session>('POST', '/auth/telegram', {
          code,
          codeVerifier: pending.verifier,
        }),
      );
      await navigate(pending.from, { replace: true });
    };
    login().catch((err: unknown) =>
      setError(
        err instanceof Error && !(err instanceof ApiError)
          ? err.message
          : errorMessage(err),
      ),
    );
  }, [search, setSession, navigate]);

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm gap-4">
        {error ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              Не получилось войти
            </h1>
            <ErrorNote>{error}</ErrorNote>
            <Link
              to="/login"
              replace
              className="font-medium text-ink underline underline-offset-4"
            >
              Ко входу
            </Link>
          </>
        ) : (
          <div
            role="status"
            aria-label="Входим через Telegram"
            className="grid gap-3"
          >
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12" />
          </div>
        )}
      </div>
    </div>
  );
}
