import { Link as RouterLink, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Link, Stack, Typography } from '@mui/material';
import { PASSWORD_MIN_LENGTH, resetPasswordSchema, type ResetPasswordInput } from '@referloop/shared';
import { ApiError, errorMessage } from '@/api/client';
import { useResetPassword } from '@/api/queries';
import { applyServerErrors } from '@/lib/forms';
import { PasswordField } from './PasswordField';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">This reset link is incomplete. Open the link from your email again.</Alert>
        <Button component={RouterLink} to="/forgot-password">
          Request a new link
        </Button>
      </Stack>
    );
  }

  if (reset.isSuccess) {
    return (
      <Stack spacing={2}>
        <Typography variant="h2" component="h1">
          Password updated
        </Typography>
        <Alert severity="success">{reset.data.message}</Alert>
        <Button component={RouterLink} to="/login" variant="contained">
          Sign in
        </Button>
      </Stack>
    );
  }

  const tokenInvalid = reset.error instanceof ApiError && reset.error.code === 'INVALID_TOKEN';

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit((v) => reset.mutate(v, { onError: (err) => applyServerErrors(err, setError) }))}
    >
      <Typography variant="h2" component="h1" gutterBottom>
        Choose a new password
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        You will be signed out of all devices after the change.
      </Typography>
      {reset.isError && !(reset.error instanceof ApiError && reset.error.fields) && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            tokenInvalid ? (
              <Button color="inherit" size="small" component={RouterLink} to="/forgot-password">
                New link
              </Button>
            ) : undefined
          }
        >
          {errorMessage(reset.error)}
        </Alert>
      )}
      <Stack spacing={2}>
        <input type="hidden" {...register('token')} />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          autoFocus
          {...register('password')}
          error={Boolean(errors.password)}
          helperText={errors.password?.message ?? `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number`}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={Boolean(errors.confirmPassword)}
          helperText={errors.confirmPassword?.message}
        />
        <Button type="submit" variant="contained" size="large" disabled={reset.isPending}>
          {reset.isPending ? 'Saving…' : 'Update password'}
        </Button>
        <Link component={RouterLink} to="/login" variant="body2" sx={{ textAlign: 'center' }}>
          Back to sign in
        </Link>
      </Stack>
    </Box>
  );
}
