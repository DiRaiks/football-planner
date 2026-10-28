import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from '@/components/ui';

describe('Avatar', () => {
  it('shows the photo, and initials when it fails to load', () => {
    const { container } = render(
      <Avatar
        name="Ильдар Сафин"
        photoUrl="https://t.me/i/userpic/320/x.jpg"
      />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://t.me/i/userpic/320/x.jpg');

    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('ИС')).toBeTruthy();
  });

  it('shows initials without a photo', () => {
    render(<Avatar name="Мария" />);
    expect(screen.getByText('М')).toBeTruthy();
  });
});
