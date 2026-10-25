import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog, Segmented } from '@/components/ui';
import { AuthProvider, useAuth } from '@/features/auth/auth';
import { JoinPanel } from '@/features/players/JoinPanel';
import { usePlayers } from '@/features/players/api';
import { safeRedirect } from '@/routes/Layout';
import { mockApi, renderWithQuery, user } from './helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('safeRedirect', () => {
  it('follows only same-site paths after login', () => {
    expect(safeRedirect('/events/abc?tab=1#roster')).toBe(
      '/events/abc?tab=1#roster',
    );
    expect(safeRedirect('//evil.example')).toBe('/events');
    expect(safeRedirect('/\\evil.example')).toBe('/events');
    expect(safeRedirect('https://evil.example')).toBe('/events');
    expect(safeRedirect('/login')).toBe('/events');
    expect(safeRedirect(undefined)).toBe('/events');
  });
});

describe('logout', () => {
  it('signs out immediately and forgets the previous user', async () => {
    localStorage.setItem('fp.token', 'old-token');
    mockApi(() => ({ body: user }));

    const Probe = () => {
      const { user: current, logout } = useAuth();
      return (
        <button type="button" onClick={logout}>
          {current ? current.name : 'гость'}
        </button>
      );
    };
    const { queryClient } = renderWithQuery(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await userEvent.click(
      await screen.findByRole('button', { name: user.name }),
    );

    expect(screen.getByRole('button', { name: 'гость' })).toBeInTheDocument();
    expect(localStorage.getItem('fp.token')).toBeNull();
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
  });

  it('does not send an old token or log out on a failed login', async () => {
    localStorage.setItem('fp.token', 'old-token');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/auth/me')
        ? Response.json(user)
        : Response.json(
            { code: 'INVALID_CREDENTIALS', message: 'x' },
            { status: 401 },
          ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const Probe = () => {
      const { login } = useAuth();
      return (
        <button
          type="button"
          onClick={() =>
            login({ email: 'a@example.com', password: 'x' }).catch(
              () => undefined,
            )
          }
        >
          войти
        </button>
      );
    };
    renderWithQuery(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'войти' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(localStorage.getItem('fp.token')).toBe('old-token');
  });
});

describe('JoinPanel after an error', () => {
  it('re-reads the roster from the server', async () => {
    const calls = mockApi(({ method }) =>
      method === 'POST'
        ? { status: 409, body: { code: 'PLAYER_EXISTS', message: 'exists' } }
        : { body: [] },
    );
    const Panel = () => {
      const { data } = usePlayers('e1');
      return data ? (
        <JoinPanel eventId="e1" user={user} players={data} />
      ) : null;
    };
    renderWithQuery(<Panel />);

    await userEvent.click(await screen.findByRole('button', { name: 'Иду' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Вы уже записаны',
    );
    await waitFor(() =>
      expect(
        calls.filter(
          (call) => call.method === 'GET' && call.path === '/events/e1/players',
        ),
      ).toHaveLength(2),
    );
  });
});

describe('Segmented', () => {
  it('has one tab stop and moves the selection with arrow keys', async () => {
    const Example = () => {
      const [value, setValue] = useState<'sure' | 'maybe'>('sure');
      return (
        <Segmented
          label="Статус"
          value={value}
          onChange={setValue}
          options={[
            { value: 'sure', label: 'Иду' },
            { value: 'maybe', label: 'Возможно' },
          ]}
        />
      );
    };
    renderWithQuery(<Example />);

    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Иду' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Возможно' })).toHaveAttribute(
      'tabindex',
      '-1',
    );

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Возможно' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Возможно' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

describe('ConfirmDialog', () => {
  it('is named by its title', () => {
    // happy-dom has no showModal; the dialog is rendered closed and checked by its markup
    HTMLDialogElement.prototype.showModal ??= function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    };
    renderWithQuery(
      <ConfirmDialog
        open
        title="Удалить матч?"
        confirmLabel="Удалить"
        onConfirm={() => undefined}
        onClose={() => undefined}
      >
        Текст
      </ConfirmDialog>,
    );

    expect(
      screen.getByRole('dialog', { name: 'Удалить матч?' }),
    ).toBeInTheDocument();
  });
});
