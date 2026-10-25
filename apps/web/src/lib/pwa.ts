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
