import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Box, CircularProgress } from '@mui/material';
import { MailWarning } from 'lucide-react';
import { useAuth } from './useAuth';
import { EmptyState } from '@/components/EmptyState';
import { ResendVerificationButton } from '@/components/VerifyEmailBanner';

function FullPageSpinner() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}

function useLoginRedirect() {
  const location = useLocation();
  return `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
}

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const loginUrl = useLoginRedirect();
  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to={loginUrl} replace />;
  return children ?? <Outlet />;
}

/** Posting and editing require a verified email. The API enforces this too. */
export function RequireVerified({ children }: { children?: ReactNode }) {
  const { isLoading, isAuthenticated, isVerified } = useAuth();
  const loginUrl = useLoginRedirect();
  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to={loginUrl} replace />;
  if (!isVerified) {
    return (
      <EmptyState
        icon={<MailWarning size={40} />}
        title="Verify your email to continue"
        description="Posting and editing jobs is available to verified members. Check your inbox for the verification link, or request a new one."
        action={<ResendVerificationButton variant="contained" />}
      />
    );
  }
  return children ?? <Outlet />;
}

/** Hides the admin console from non-admins. Every admin API call is also authorised server-side. */
export function RequireAdmin({ children }: { children?: ReactNode }) {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const loginUrl = useLoginRedirect();
  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to={loginUrl} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children ?? <Outlet />;
}

/** For login/register pages: signed-in users are sent on. */
export function RedirectIfAuthenticated({ children, to = '/jobs' }: { children: ReactNode; to?: string }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to={to} replace />;
  return children;
}

export { FullPageSpinner };
