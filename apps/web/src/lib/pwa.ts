/** The installed app: a service worker that keeps the app and the match list offline */
export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Without it the site works as before, only not offline
    });
  });
};

/** Saved answers of the API belong to the user who signed out (public/sw.js) */
export const clearOfflineCache = async () => {
  try {
    await caches.delete('fp-api');
  } catch {
    // No Cache API (old browser, insecure context): nothing was saved
  }
};

/** Chromium's install prompt, held back until the user asks for it */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let installPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const installChanged = () => installListeners.forEach((listener) => listener());

/**
 * Keeps the browser's install prompt for the install banner. Listens from the start:
 * the event may come before React renders anything.
 */
export const listenForInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Our banner instead of the browser's own bar
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    installChanged();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installChanged();
  });
};

export const subscribeInstall = (listener: () => void) => {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
};

export const hasInstallPrompt = () => installPrompt !== null;

/** Shows the browser's install dialog; resolves with whether the user installed */
export const promptInstall = async () => {
  const prompt = installPrompt;
  if (!prompt) return false;
  installPrompt = null;
  installChanged();
  await prompt.prompt();
  return (await prompt.userChoice).outcome === 'accepted';
};

const matches = (query: string) =>
  typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

/** Opened from the home screen already */
export const isInstalled = () =>
  matches('(display-mode: standalone)') ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone and iPad, iPads that pretend to be Macs included: install by hand only */
export const isIos = (ua = navigator.userAgent) =>
  /iPhone|iPad|iPod/.test(ua) ||
  (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

/** A phone or tablet: the banner is for them, not for desktops */
export const isTouchDevice = () => matches('(pointer: coarse)');
