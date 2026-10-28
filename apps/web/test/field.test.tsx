import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Field } from '@/components/ui';

describe('Field', () => {
  it('shows and hides a password', async () => {
    render(<Field label="Пароль" type="password" defaultValue="secret-1" />);
    const input = screen.getByLabelText('Пароль');
    expect(input.getAttribute('type')).toBe('password');

    await userEvent.click(
      screen.getByRole('button', { name: 'Показать пароль' }),
    );
    expect(input.getAttribute('type')).toBe('text');

    await userEvent.click(
      screen.getByRole('button', { name: 'Скрыть пароль' }),
    );
    expect(input.getAttribute('type')).toBe('password');
  });

  it('has no such button on other fields', () => {
    render(<Field label="Почта" type="email" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
