import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { ChartBar, UserCircle } from '@phosphor-icons/react';

import { Skeleton, cn } from '@/components/ui';
import { useAuth } from '@/features/auth/auth';

/** Only same-site paths are followed after login; "//evil.com" and absolute URLs are not */
export const safeRedirect = (from: unknown) => {
  if (typeof from !== 'string' || !/^\/(?![/\\])/.test(from)) return '/events';
  if (/^\/(login|register)\b/.test(from)) return '/events';
  return from;
};

function Logo() {
  return (
    <Link
      to="/events"
      className="flex items-center gap-2.5 font-semibold tracking-tight"
    >
      <span
        aria-hidden
        className="relative grid size-8 place-items-center rounded-[9px] bg-pitch ring-1 ring-accent/25"
      >
        <span className="size-3.5 rounded-full bg-accent" />
      </span>
      Football Planner
    </Link>
  );
}

/** Screens of a signed-in user: header and a narrow, phone-friendly column */
export function AppLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-2xl gap-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!user) {
    // Remember where the user was going, e.g. a match link from Telegram
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only rounded-control bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        К содержимому
      </a>
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Logo />
          <nav aria-label="Разделы" className="flex items-center gap-1">
            <NavLink
              to="/stats"
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-2 rounded-control px-2 text-sm transition-colors duration-150 hover:bg-surface-2 hover:text-ink',
                  isActive ? 'text-ink' : 'text-muted',
                )
              }
            >
              <ChartBar className="size-6" weight="duotone" aria-hidden />
              <span className="hidden sm:inline">Статистика</span>
              <span className="sr-only sm:hidden">Статистика</span>
            </NavLink>
            <Link
              to="/account"
              className="flex h-11 items-center gap-2 rounded-control px-2 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
            >
              <span className="hidden max-w-[16ch] truncate sm:inline">
                {user.name}
              </span>
              <UserCircle
                className="size-7"
                weight="duotone"
                aria-label="Профиль"
              />
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 pt-6 pb-24">
        <Outlet />
      </main>
    </div>
  );
}

/** Login and registration: centered, without the app header */
export function AuthLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const from = safeRedirect(
    (location.state as { from?: unknown } | null)?.from,
  );

  if (user) return <Navigate to={from} replace />;

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm gap-8">
        <Logo />
        <Outlet />
      </div>
    </div>
  );
}
