import { createBrowserRouter, Navigate } from 'react-router';
import { SoccerBall } from '@phosphor-icons/react';

import { ButtonLink, EmptyState } from '@/components/ui';
import { TelegramCallbackPage } from '@/features/auth/TelegramLogin';
import { AccountPage } from '@/routes/AccountPage';
import { LoginPage, RegisterPage } from '@/routes/AuthPages';
import { EditEventPage, NewEventPage } from '@/routes/EventFormPages';
import { EventPage } from '@/routes/EventPage';
import { EventsPage } from '@/routes/EventsPage';
import { AppLayout, AuthLayout } from '@/routes/Layout';

function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon={<SoccerBall className="size-10" weight="duotone" />}
        title="Такой страницы нет"
        action={<ButtonLink to="/events">К матчам</ButtonLink>}
      >
        Возможно, матч удалили или ссылка устарела.
      </EmptyState>
    </div>
  );
}

export const router = createBrowserRouter([
  // Telegram's login returns here; registered in @BotFather as the redirect URI
  { path: '/auth/telegram', element: <TelegramCallbackPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/events" replace /> },
      { path: '/events', element: <EventsPage /> },
      { path: '/events/new', element: <NewEventPage /> },
      { path: '/events/:eventId', element: <EventPage /> },
      { path: '/events/:eventId/edit', element: <EditEventPage /> },
      { path: '/account', element: <AccountPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
