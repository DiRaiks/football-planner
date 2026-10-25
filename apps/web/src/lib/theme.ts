import { useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'fp.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

const read = (): ThemePreference => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

const resolve = (preference: ThemePreference) =>
  preference === 'system' ? (media().matches ? 'dark' : 'light') : preference;

/** Applies the theme to <html> so CSS variables switch */
export const applyTheme = (preference = read()) => {
  document.documentElement.dataset.theme = resolve(preference);
};

/** Colours of the host app (Telegram), unless the user picked a theme here */
export const applyHostTheme = (scheme: 'light' | 'dark') => {
  if (read() === 'system') document.documentElement.dataset.theme = scheme;
};

export const setThemePreference = (preference: ThemePreference) => {
  try {
    if (preference === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, preference);
  } catch {
    // Storage blocked: the choice lasts until reload
  }
  applyTheme(preference);
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useThemePreference = () =>
  useSyncExternalStore<ThemePreference>(subscribe, read, () => 'system');

/** Follows the system theme while the preference is "system" */
export const useSystemThemeSync = () => {
  useEffect(() => {
    const query = media();
    const onChange = () => applyTheme();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
};
