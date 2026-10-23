import { useEffect, useRef } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { CircleCheck } from 'lucide-react';
import { errorMessage } from '@/api/client';
import { useVerifyEmail } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const verify = useVerifyEmail();
  const { isAuthenticated } = useAuth();
  const started = useRef(false);

  // Verification is a POST triggered once on load (StrictMode would otherwise call it twice).
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  if (!token) {
    return (
      <Alert severity="error">
        This verification link is incomplete. Open the link from your email again, or request a new one from your profile.
      </Alert>
    );
  }

  if (verify.isPending || verify.isIdle) {
    return (
      <Stack spacing={2} sx={{ alignItems: 'center', py: 3 }}>
        <CircularProgress />
        <Typography>Verifying your email…</Typography>
      </Stack>
    );
  }

  if (verify.isError) {
    return (
      <Stack spacing={2}>
        <Typography variant="h2" component="h1">
          Link not valid
        </Typography>
        <Alert severity="error">{errorMessage(verify.error)}</Alert>
        <Typography color="text.secondary" variant="body2">
          Verification links expire after 24 hours and can only be used once. Sign in and use “Resend verification email” to get a new link.
        </Typography>
        <Button component={RouterLink} to={isAuthenticated ? '/profile' : '/login'} variant="contained">
          {isAuthenticated ? 'Go to my profile' : 'Sign in'}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
      <Box sx={{ color: 'success.main' }}>
        <CircleCheck size={48} />
      </Box>
      <Typography variant="h2" component="h1">
        Email verified
      </Typography>
      <Typography color="text.secondary">{verify.data?.message}</Typography>
      <Button component={RouterLink} to={isAuthenticated ? '/jobs/new' : '/login?next=%2Fjobs%2Fnew'} variant="contained">
        {isAuthenticated ? 'Post your first job' : 'Sign in to continue'}
      </Button>
    </Stack>
  );
}
