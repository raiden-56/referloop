import { Link as RouterLink } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@referloop/shared';
import { errorMessage } from '@/api/client';
import { useForgotPassword } from '@/api/queries';

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  return (
    <Box component="form" noValidate onSubmit={handleSubmit((v) => forgot.mutate(v))}>
      <Typography variant="h2" component="h1" gutterBottom>
        Reset your password
      </Typography>
      {forgot.isSuccess ? (
        <Stack spacing={2}>
          <Alert severity="success">{forgot.data.message}</Alert>
          <Typography variant="body2" color="text.secondary">
            The link expires in 1 hour. Check your spam folder if you do not see it within a few minutes.
          </Typography>
          <Button component={RouterLink} to="/login" variant="contained">
            Back to sign in
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Typography color="text.secondary">Enter the email address you registered with and we will send you a reset link.</Typography>
          {forgot.isError && <Alert severity="error">{errorMessage(forgot.error)}</Alert>}
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            autoFocus
            {...register('email')}
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
          />
          <Button type="submit" variant="contained" size="large" disabled={forgot.isPending}>
            {forgot.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
          <Link component={RouterLink} to="/login" variant="body2" sx={{ textAlign: 'center' }}>
            Back to sign in
          </Link>
        </Stack>
      )}
    </Box>
  );
}
