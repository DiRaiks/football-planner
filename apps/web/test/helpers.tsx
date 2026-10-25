import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import type { Event, Player, User } from '@football-planner/shared';

export const user: User = {
  _id: 'u1',
  email: 'andrey@example.com',
  name: 'Андрей Финаев',
  role: 'user',
  telegramLinked: false,
};

export const event = (overrides: Partial<Event> = {}): Event => ({
  _id: 'e1',
  eventName: 'Вторничный футбол',
  place: 'Стадион «Динамо»',
  date: '2026-11-03',
  time: '20:00',
  minimum: 10,
  playersAmount: 0,
  creatorId: 'u2',
  ...overrides,
});

export const player = (overrides: Partial<Player> = {}): Player => ({
  _id: 'p1',
  name: 'Ильдар Сафин',
  status: true,
  friends: [],
  eventId: 'e1',
  userId: 'u2',
  date: '2026-11-03',
  waitlisted: false,
  paid: false,
  ...overrides,
});

type Route = (request: { method: string; path: string; body: unknown }) => {
  status?: number;
  body?: unknown;
};

/** Replaces fetch with a router of fake API responses; returns the recorded calls */
export const mockApi = (route: Route) => {
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).replace(/^.*\/v1/, '');
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      const response = route({ method, path, body });
      return response.status === 204
        ? new Response(null, { status: 204 })
        : Response.json(response.body ?? null, {
            status: response.status ?? 200,
          });
    }),
  );
  return calls;
};

export const renderWithQuery = (
  ui: ReactNode,
  queryClient = testQueryClient(),
) => ({
  queryClient,
  ...render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  ),
});

export const testQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

/** Renders routes in memory, for screens that use links and navigation */
export const renderRoutes = (
  routes: Parameters<typeof createMemoryRouter>[0],
  initialPath: string,
  wrap: (node: ReactNode) => ReactNode = (node) => node,
) => {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const queryClient = testQueryClient();
  return {
    router,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        {wrap(<RouterProvider router={router} />)}
      </QueryClientProvider>,
    ),
  };
};
