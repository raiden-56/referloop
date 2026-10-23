import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { loginSchema, type LoginInput } from '@referloop/shared';
import { ApiError, errorMessage } from '@/api/client';
import { useLogin } from '@/api/queries';
import { safeNext } from '@/auth/useAuth';
import { useNotify } from '@/components/notify';
import { applyServerErrors } from '@/lib/forms';
import { PasswordField } from './PasswordField';

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const login = useLogin();
  const next = safeNext(params.get('next'));
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: ({ user }) => {
        notify(`Welcome back, ${user.name.split(' ')[0]}!`);
        navigate(next, { replace: true });
      },
      onError: (err) => applyServerErrors(err, setError),
    }),
  );

  const suspended = login.error instanceof ApiError && login.error.code === 'ACCOUNT_SUSPENDED';

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h2" component="h1" gutterBottom>
        Sign in
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Share openings and referrals with your network.
      </Typography>

      {login.isError && !(login.error instanceof ApiError && login.error.fields) && (
        <Alert severity={suspended ? 'warning' : 'error'} sx={{ mb: 2 }}>
          {errorMessage(login.error)}
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          autoFocus
          {...register('email')}
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          {...register('password')}
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
        />
        <Box sx={{ textAlign: 'right', mt: -1 }}>
          <Link component={RouterLink} to="/forgot-password" variant="body2">
            Forgot password?
          </Link>
        </Box>
        <Button type="submit" variant="contained" size="large" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        New to ReferLoop?{' '}
        <Link component={RouterLink} to="/register">
          Create an account
        </Link>
      </Typography>
    </Box>
  );
}
