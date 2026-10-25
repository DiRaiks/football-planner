import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Player } from '@football-planner/shared';

import { AuthProvider, useAuth } from '@/features/auth/auth';
import { EventForm } from '@/features/events/EventForm';
import { Scoreboard } from '@/features/events/Scoreboard';
import { JoinPanel } from '@/features/players/JoinPanel';
import { playersKey, usePlayers } from '@/features/players/api';
import { LoginPage } from '@/routes/AuthPages';
import { EditEventPage } from '@/routes/EventFormPages';
import { EventPage } from '@/routes/EventPage';
import {
  event,
  mockApi,
  player,
  renderRoutes,
  renderWithQuery,
  testQueryClient,
  user,
} from './helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Scoreboard', () => {
  it('shows the score, what is missing and the maybe count', () => {
    mockApi(() => ({ body: { location: { lat: 1, lon: 2 }, forecast: null } }));
    renderWithQuery(
      <Scoreboard event={event()} count={{ all: 8, exactly: 6, maybe: 2 }} />,
    );

    const board = screen.getByRole('region', { name: 'Табло матча' });
    expect(
      within(board).getByRole('heading', { name: 'Вторничный футбол' }),
    ).toBeInTheDocument();
    expect(board).toHaveTextContent('вт, 3 ноября, 20:00');
    expect(board).toHaveTextContent('6/ 10');
    expect(board).toHaveTextContent('Нужно ещё 4 игрока');
    expect(board).toHaveTextContent('ещё 2 под вопросом');
  });
});

describe('JoinPanel', () => {
  const change = (players: Player[]) => ({
    player: players[players.length - 1],
    players,
    event: event({ playersAmount: players.length }),
    count: { all: players.length, exactly: players.length, maybe: 0 },
  });

  it('signs up with one tap and shows the sign-up instantly', async () => {
    const mine = player({ _id: 'p2', userId: user._id, name: user.name });
    // Stateful fake: after the sign-up the server lists the new player
    let roster: Player[] = [];
    const calls = mockApi(({ method }) => {
      if (method !== 'POST') return { body: roster };
      roster = [mine];
      return { status: 201, body: change(roster) };
    });
    // Reads the roster through the same hook as the event page
    const Panel = () => {
      const { data } = usePlayers('e1');
      return data ? (
        <JoinPanel eventId="e1" user={user} players={data} />
      ) : null;
    };
    renderWithQuery(<Panel />);

    await userEvent.click(await screen.findByRole('button', { name: 'Иду' }));

    expect(
      await screen.findByRole('region', { name: 'Ваша запись' }),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')).toEqual({
      method: 'POST',
      path: '/events/e1/players',
      body: { name: user.name, status: true, friends: [] },
    });
  });

  it('rolls back and explains when the sign-up fails', async () => {
    mockApi(() => ({
      status: 409,
      body: { code: 'PLAYER_EXISTS', message: 'exists' },
    }));
    const queryClient = testQueryClient();
    queryClient.setQueryData(playersKey('e1'), []);
    renderWithQuery(
      <JoinPanel eventId="e1" user={user} players={[]} />,
      queryClient,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Возможно' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Вы уже записаны на этот матч',
    );
    expect(queryClient.getQueryData(playersKey('e1'))).toEqual([]);
  });

  it('switches the status and adds a friend', async () => {
    const mine = player({
      _id: 'p2',
      userId: user._id,
      name: user.name,
      status: true,
    });
    const calls = mockApi(() => ({ body: change([mine]) }));
    renderWithQuery(<JoinPanel eventId="e1" user={user} players={[mine]} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Возможно' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Привести друга' }),
    );
    await userEvent.type(screen.getByLabelText('Имя друга'), 'Петя');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      path: '/events/e1/players/p2',
      body: { status: false },
    });
    expect(calls[1]).toMatchObject({
      body: { friends: [{ name: 'Петя', status: true }] },
    });
  });
});

describe('EventForm', () => {
  it('validates required fields and trims the values', async () => {
    const onSubmit = vi.fn();
    renderWithQuery(
      <EventForm
        submitLabel="Создать матч"
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Создать матч' }));
    expect(screen.getByText('Как назовём матч?')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(
      screen.getByLabelText('Название'),
      '  Пятничная игра ',
    );
    await userEvent.type(screen.getByLabelText('Место'), 'Манеж');
    await userEvent.click(screen.getByRole('button', { name: 'Больше' }));
    await userEvent.click(screen.getByRole('button', { name: 'Создать матч' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'Пятничная игра',
        place: 'Манеж',
        minimum: 11,
      }),
    );
  });
});

describe('LoginPage', () => {
  it('shows a readable error for wrong credentials', async () => {
    mockApi(() => ({
      status: 401,
      body: { code: 'INVALID_CREDENTIALS', message: 'invalid credentials' },
    }));
    renderRoutes(
      [{ path: '/login', element: <LoginPage /> }],
      '/login',
      (node) => <AuthProvider>{node}</AuthProvider>,
    );

    await userEvent.type(screen.getByLabelText('Почта'), 'andrey@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Неверная почта или пароль',
    );
    expect(localStorage.getItem('fp.token')).toBeNull();
  });

  it('stores the token after a successful login', async () => {
    mockApi(() => ({ body: { ...user, token: 'jwt-token' } }));
    renderRoutes(
      [{ path: '/login', element: <LoginPage /> }],
      '/login',
      (node) => <AuthProvider>{node}</AuthProvider>,
    );

    await userEvent.type(screen.getByLabelText('Почта'), 'andrey@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() =>
      expect(localStorage.getItem('fp.token')).toBe('jwt-token'),
    );
  });
});

describe('missing match', () => {
  // Like Layout: pages under it render once the user is known
  const SignedIn = ({ children }: { children: ReactNode }) =>
    useAuth().user ? children : null;

  const signedIn = (eventStatus: number) => {
    localStorage.setItem('fp.token', 'jwt-token');
    return mockApi(({ path }) =>
      path === '/auth/me'
        ? { body: user }
        : {
            status: eventStatus,
            body: {
              code: eventStatus === 404 ? 'NOT_FOUND' : 'INTERNAL',
              message: 'error',
            },
          },
    );
  };

  it.each([
    ['/events/:eventId', EventPage],
    ['/events/:eventId/edit', EditEventPage],
  ])(
    'explains that %s is gone and links back to the list',
    async (path, Page) => {
      signedIn(404);
      renderRoutes(
        [
          {
            path,
            element: (
              <SignedIn>
                <Page />
              </SignedIn>
            ),
          },
        ],
        path.replace(':eventId', 'gone'),
        (node) => <AuthProvider>{node}</AuthProvider>,
      );

      expect(
        await screen.findByRole('heading', { name: 'Матч не найден' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'К списку матчей' }),
      ).toHaveAttribute('href', '/events');
    },
  );

  it('shows other errors as they are', async () => {
    signedIn(500);
    renderRoutes(
      [
        {
          path: '/events/:eventId',
          element: (
            <SignedIn>
              <EventPage />
            </SignedIn>
          ),
        },
      ],
      '/events/e1',
      (node) => <AuthProvider>{node}</AuthProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('error');
    expect(screen.queryByText('Матч не найден')).not.toBeInTheDocument();
  });
});
