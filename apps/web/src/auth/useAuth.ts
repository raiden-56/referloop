import { useMe } from '@/api/queries';

export function useAuth() {
  const { data: user, isLoading, isError } = useMe();
  return {
    user: user ?? null,
    isLoading,
    isError,
    isAuthenticated: Boolean(user),
    isVerified: Boolean(user?.emailVerified),
    isAdmin: user?.role === 'ADMIN' && Boolean(user.emailVerified),
  };
}

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNext(next: string | null | undefined, fallback = '/jobs'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
