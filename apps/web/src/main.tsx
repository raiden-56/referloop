import '@fontsource-variable/inter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { keys, resetUserData } from '@/api/queries';
import { NotifierProvider } from '@/components/Notifier';
import { router } from './router';
import { theme } from './theme';

/**
 * A session can end server-side (expiry, "sign out everywhere", password reset, suspension). Treat any
 * UNAUTHENTICATED response as signed out so guards redirect to sign-in instead of failing every action.
 */
const onAuthError = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401 && err.code === 'UNAUTHENTICATED' && queryClient.getQueryData(keys.me)) {
    resetUserData(queryClient, null);
  }
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthError }),
  mutationCache: new MutationCache({ onError: onAuthError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Client errors (401/403/404/409) will not succeed on retry.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <NotifierProvider>
          <RouterProvider router={router} />
        </NotifierProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
