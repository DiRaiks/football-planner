import { useState, useSyncExternalStore } from 'react';
import { DeviceMobile, Export, X } from '@phosphor-icons/react';

import { Button, IconButton } from '@/components/ui';
import {
  hasInstallPrompt,
  isInstalled,
  isIos,
  isTouchDevice,
  promptInstall,
  subscribeInstall,
} from '@/lib/pwa';
import { inTelegramWebview } from '@/lib/telegram';

const DISMISSED_KEY = 'fp.installDismissed';

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * How this browser installs the app: its own dialog (Android Chrome and friends), by
 * hand from the share menu (iOS), or not at all here (desktop, Telegram, installed)
 */
export const useInstallWay = () => {
  const canPrompt = useSyncExternalStore(subscribeInstall, hasInstallPrompt);
  if (isInstalled() || inTelegramWebview() || !isTouchDevice()) return null;
  if (canPrompt) return 'prompt';
  return isIos() ? 'ios' : null;
};

/** Suggests adding the app to the home screen, on phones only, until dismissed */
export function InstallBanner() {
  const way = useInstallWay();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (!way || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private mode: hidden until the page is reloaded
    }
  };

  return (
    <aside
      aria-label="Установка приложения"
      className="flex items-start gap-3 rounded-panel bg-surface p-4 shadow-panel"
    >
      <DeviceMobile
        className="mt-0.5 size-6 shrink-0 text-ink"
        weight="duotone"
        aria-hidden
      />
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-0.5">
          <p className="font-medium">Установите приложение</p>
          <p className="text-sm text-pretty text-muted">
            {way === 'ios' ? (
              <>
                Нажмите «Поделиться»{' '}
                <Export
                  className="inline size-4 align-text-bottom"
                  aria-hidden
                />{' '}
                в Safari и выберите «На экран „Домой“».
              </>
            ) : (
              'Матчи будут открываться с главного экрана, как обычное приложение.'
            )}
          </p>
        </div>
        {way === 'prompt' && (
          <Button
            className="justify-self-start"
            onClick={() =>
              void promptInstall().then((installed) => {
                if (installed) dismiss();
              })
            }
          >
            Установить
          </Button>
        )}
      </div>
      <IconButton label="Скрыть" className="-mt-2 -mr-2" onClick={dismiss}>
        <X className="size-4" aria-hidden />
      </IconButton>
    </aside>
  );
}
