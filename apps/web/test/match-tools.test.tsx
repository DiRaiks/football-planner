import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Event, Player } from '@football-planner/shared';

import { AuthProvider, useAuth } from '@/features/auth/auth';
import { EventForm } from '@/features/events/EventForm';
import { Roster } from '@/features/players/Roster';
import { EventPage } from '@/routes/EventPage';
import { StatsPage } from '@/routes/StatsPage';
import {
  event,
  mockApi,
  player,
  renderRoutes,
  renderWithQuery,
  user,
} from './helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const SignedIn = ({ children }: { children: ReactNode }) =>
  useAuth().user ? children : null;

const renderSignedIn = (path: string, url: string, page: ReactNode) => {
  localStorage.setItem('fp.token', 'jwt-token');
  return renderRoutes(
    [{ path, element: <SignedIn>{page}</SignedIn> }],
    url,
    (node) => <AuthProvider>{node}</AuthProvider>,
  );
};

describe('EventForm', () => {
  it('sends a weekly match with a price', async () => {
    const onSubmit = vi.fn();
    renderWithQuery(
      <EventForm
        submitLabel="Создать матч"
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    );

    await userEvent.clear(screen.getByLabelText('Название'));
    await userEvent.type(screen.getByLabelText('Название'), 'Вторник');
    await userEvent.type(screen.getByLabelText('Место'), 'Манеж');
    await userEvent.click(screen.getByRole('radio', { name: 'Каждую неделю' }));
    // Only digits are kept
    await userEvent.type(screen.getByLabelText('Цена с человека, ₽'), '3a50');
    await userEvent.click(screen.getByRole('button', { name: 'Создать матч' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ repeat: 'weekly', price: 350 }),
    );
  });
});

describe('payments', () => {
  const roster = [
    player({
      _id: 'p1',
      name: 'Аня',
      paid: true,
      friends: [{ name: 'Гость', status: true }],
    }),
    player({ _id: 'p2', name: 'Боря', userId: 'u3' }),
    player({ _id: 'p3', name: 'Вера', userId: 'u4', status: false }),
  ];

  it('shows what is collected and who paid, friends with their player', () => {
    renderWithQuery(
      <Roster players={roster} myUserId="u1" payments={{ price: 300 }} />,
    );

    // Three sure people: Аня paid for herself and her guest
    expect(screen.getByText(/Собрано/)).toHaveTextContent(
      'Собрано 600 ₽ из 900 ₽',
    );
    expect(screen.getAllByText('оплачено')).toHaveLength(2);
    // Viewers get no switches
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('lets the organiser mark a player as paid', async () => {
    const onToggle = vi.fn();
    renderWithQuery(
      <Roster
        players={roster}
        myUserId="u1"
        payments={{ price: 300, onToggle }}
      />,
    );

    const switches = screen.getAllByRole('button', {
      name: /оплатил, изменить$/,
    });
    // Аня and Боря: not the guest, and not the maybe sign-up
    expect(switches).toHaveLength(2);
    await userEvent.click(
      screen.getByRole('button', { name: 'Боря: не оплатил, изменить' }),
    );
    expect(onToggle).toHaveBeenCalledWith('p2', true);
    expect(
      screen.getByRole('button', { name: 'Аня: оплатил, изменить' }),
    ).toBeInTheDocument();
  });

  it('lets the organiser mark a maybe player who brings a sure friend', () => {
    renderWithQuery(
      <Roster
        players={[
          player({
            _id: 'p5',
            name: 'Гена',
            status: false,
            friends: [{ name: 'Друг', status: true }],
          }),
        ]}
        myUserId="u1"
        payments={{ price: 300, onToggle: vi.fn() }}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Гена: не оплатил, изменить' }),
    ).toBeInTheDocument();
  });
});

describe('teams', () => {
  const setup = (match: Event) => {
    let current = match;
    const players: Player[] = [player({ _id: 'p1' })];
    const calls = mockApi(({ method, path }) => {
      if (path === '/auth/me') return { body: user };
      if (path.endsWith('/weather')) return { status: 404, body: {} };
      if (path.endsWith('/players')) return { body: players };
      if (method === 'POST' && path.endsWith('/teams')) {
        current = { ...current, teams: [['Аня', 'Вера'], ['Боря']] };
      }
      return { body: current };
    });
    renderSignedIn('/events/:eventId', '/events/e1', <EventPage />);
    return calls;
  };

  it('lets the organiser split the squad and shows the teams', async () => {
    const calls = setup(event({ creatorId: user._id, date: '2099-01-01' }));

    await userEvent.click(await screen.findByRole('radio', { name: '3' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Разбить на команды' }),
    );

    const teams = await screen.findByRole('region', { name: 'Команды' });
    await waitFor(() =>
      expect(within(teams).getByText('Команда 2')).toBeInTheDocument(),
    );
    expect(teams).toHaveTextContent('Вера');
    expect(
      within(teams).getByRole('button', { name: 'Перемешать' }),
    ).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/events/e1/teams',
      body: { count: 3 },
    });
  });

  it('shows teams to players and hides the split', async () => {
    setup(event({ date: '2099-01-01', teams: [['Аня'], ['Боря']] }));

    const teams = await screen.findByRole('region', { name: 'Команды' });
    expect(teams).toHaveTextContent('Команда 1');
    expect(within(teams).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('StatsPage', () => {
  it('lists attendance and asks again for another period', async () => {
    const calls = mockApi(({ path }) =>
      path === '/auth/me'
        ? { body: user }
        : {
            body: [
              {
                userId: user._id,
                name: user.name,
                played: 5,
                maybe: 1,
                lastPlayed: '2026-10-20',
              },
              {
                userId: 'u9',
                name: 'Боря',
                played: 0,
                maybe: 2,
                lastPlayed: null,
              },
            ],
          },
    );
    renderSignedIn('/stats', '/stats', <StatsPage />);

    const list = await screen.findByRole('list');
    const [me, other] = within(list).getAllByRole('listitem');
    expect(me).toHaveTextContent('Андрей Финаев (вы)');
    expect(me).toHaveTextContent('5 матчей');
    expect(me).toHaveTextContent('последний: вт, 20 октября · «возможно» 1');
    expect(other).toHaveTextContent('ещё не играл');

    await userEvent.click(screen.getByRole('radio', { name: 'Год' }));
    await waitFor(() =>
      expect(calls.map((call) => call.path)).toContain(
        '/stats/attendance?days=365',
      ),
    );
  });
});
