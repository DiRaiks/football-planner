import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import { router } from '@/app/router';
import { AuthProvider } from '@/features/auth/auth';
import { shouldRetry } from '@/lib/api';
import { listenForInstallPrompt, registerServiceWorker } from '@/lib/pwa';
import { loadWebApp, startMatch } from '@/lib/telegram';
import { applyHostTheme, applyTheme, useSystemThemeSync } from '@/lib/theme';
import './styles.css';

applyTheme();
registerServiceWorker();
listenForInstallPrompt();

// Inside Telegram: Telegram's colours, and the match the link pointed to
void loadWebApp().then((app) => {
  if (!app) return;
  applyHostTheme(app.colorScheme);
  const path = startMatch(app);
  if (path) void router.navigate(path, { replace: true });
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: shouldRetry,
    },
  },
});

function App() {
  useSystemThemeSync();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
