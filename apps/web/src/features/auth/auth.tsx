import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthProviders,
  LoginBody,
  RegisterBody,
  Session,
  User,
} from '@football-planner/shared';

import { api, setUnauthorizedHandler, tokenStorage } from '@/lib/api';
import { clearOfflineCache } from '@/lib/pwa';
import { isMiniAppLaunch, loadWebApp } from '@/lib/telegram';

type AuthState = {
  user: User | null;
  isLoading: boolean;
  login: (body: LoginBody) => Promise<User>;
  register: (body: RegisterBody) => Promise<User>;
  logout: () => void;
  /** Stores a new session, e.g. after a password change issues a fresh token */
  setSession: (session: Session) => void;
  /** Inside Telegram: signing in with the Mini App's data failed */
  miniAppError: unknown;
};

const AuthContext = createContext<AuthState | null>(null);

export const meKey = ['me'] as const;

const userFromSession = ({
  _id,
  email,
  name,
  role,
  telegramLinked,
}: Session): User => ({
  _id,
  ...(email && { email }),
  name,
  role,
  telegramLinked,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Kept in state so signing in or out re-renders and toggles the "me" query
  const [token, setToken] = useState(() => tokenStorage.get());

  const me = useQuery({
    queryKey: meKey,
    queryFn: () => api<User>('GET', '/auth/me'),
    enabled: Boolean(token),
    staleTime: Infinity,
    retry: false,
  });

  const logout = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    void clearOfflineCache();
    // Drop everything of the previous user, including requests still in flight
    void queryClient.cancelQueries();
    queryClient.getMutationCache().clear();
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const setSession = useCallback(
    (session: Session) => {
      // Saved answers of another user must not show up offline
      const previous = queryClient.getQueryData<User>(meKey);
      if (previous && previous._id !== session._id) void clearOfflineCache();
      tokenStorage.set(session.token);
      queryClient.setQueryData(meKey, userFromSession(session));
      setToken(session.token);
    },
    [queryClient],
  );

  const { mutateAsync: loginAsync } = useMutation({
    mutationFn: (body: LoginBody) => api<Session>('POST', '/auth/login', body),
    onSuccess: setSession,
  });
  const { mutateAsync: registerAsync } = useMutation({
    mutationFn: (body: RegisterBody) =>
      api<Session>('POST', '/auth/register', body),
    onSuccess: setSession,
  });

  // Inside Telegram the Mini App's data signs in, as whoever opened it, even over an
  // older session in this webview
  const [miniApp, setMiniApp] = useState<'pending' | 'done' | 'failed'>(() =>
    isMiniAppLaunch() ? 'pending' : 'done',
  );
  const [miniAppError, setMiniAppError] = useState<unknown>(null);
  useEffect(() => {
    if (miniApp !== 'pending') return;
    let cancelled = false;
    void loadWebApp()
      .then(async (app) => {
        if (!app) return 'done' as const;
        setSession(
          await api<Session>('POST', '/auth/telegram/webapp', {
            initData: app.initData,
          }),
        );
        return 'done' as const;
      })
      .catch((error: unknown) => {
        setMiniAppError(error);
        return 'failed' as const;
      })
      .then((state) => !cancelled && setMiniApp(state));
    return () => {
      cancelled = true;
    };
  }, [miniApp, setSession]);

  const user = token ? (me.data ?? null) : null;
  const isLoading = miniApp === 'pending' || (Boolean(token) && me.isPending);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      login: async (body) => userFromSession(await loginAsync(body)),
      register: async (body) => userFromSession(await registerAsync(body)),
      logout,
      setSession,
      miniAppError,
    }),
    [
      user,
      isLoading,
      loginAsync,
      registerAsync,
      logout,
      setSession,
      miniAppError,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export const useAuth = () => {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};

/** The signed-in user; only for screens behind the auth guard */
export const useUser = () => {
  const { user } = useAuth();
  if (!user) throw new Error('useUser needs a signed-in user');
  return user;
};

/** Ways to sign in besides email, as the server has them configured */
export const useAuthProviders = () =>
  useQuery({
    queryKey: ['auth', 'providers'] as const,
    queryFn: () => api<AuthProviders>('GET', '/auth/providers'),
    staleTime: Infinity,
    retry: false,
  });
