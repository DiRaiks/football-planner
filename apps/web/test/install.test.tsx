import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { InstallBanner } from '@/features/install/InstallBanner';
import { isIos, listenForInstallPrompt } from '@/lib/pwa';
import { renderWithQuery } from './helpers';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

/** A browser where only the listed media queries match */
const device = ({ touch = true, standalone = false, ua = ANDROID } = {}) => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches:
          (query === '(pointer: coarse)' && touch) ||
          (query === '(display-mode: standalone)' && standalone),
      }) as MediaQueryList,
  );
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
};

const offerInstall = (outcome: 'accepted' | 'dismissed') => {
  const event = Object.assign(
    new Event('beforeinstallprompt', { cancelable: true }),
    {
      prompt: vi.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome }),
    },
  );
  window.dispatchEvent(event);
  return event;
};

beforeAll(() => listenForInstallPrompt());

afterEach(() => {
  // A prompt left over from a test goes away like after an install
  window.dispatchEvent(new Event('appinstalled'));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('install banner', () => {
  it('installs with the browser dialog on Android, then hides', async () => {
    device();
    renderWithQuery(<InstallBanner />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    const prompt = offerInstall('accepted');
    expect(prompt.defaultPrevented).toBe(true);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Установить' }),
    );

    expect(prompt.prompt).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('complementary', { name: 'Установка приложения' }),
      ).not.toBeInTheDocument(),
    );
    expect(localStorage.getItem('fp.installDismissed')).toBe('1');
  });

  it('explains the share menu on iPhone and stays hidden once dismissed', async () => {
    device({ ua: IPHONE });
    const { unmount } = renderWithQuery(<InstallBanner />);

    const banner = screen.getByRole('complementary', {
      name: 'Установка приложения',
    });
    expect(banner).toHaveTextContent('выберите «На экран „Домой“»');
    expect(screen.queryByRole('button', { name: 'Установить' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    expect(banner).not.toBeInTheDocument();

    unmount();
    renderWithQuery(<InstallBanner />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('stays away from desktops and installed apps', () => {
    device({ touch: false });
    offerInstall('dismissed');
    const { unmount } = renderWithQuery(<InstallBanner />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    unmount();

    device({ ua: IPHONE, standalone: true });
    renderWithQuery(<InstallBanner />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('tells iPads that look like Macs from Macs', () => {
    const mac =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
    vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(5);
    expect(isIos(mac)).toBe(true);
    vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(0);
    expect(isIos(mac)).toBe(false);
    expect(isIos(IPHONE)).toBe(true);
  });
});
