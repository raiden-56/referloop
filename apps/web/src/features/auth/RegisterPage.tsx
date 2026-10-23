import { Link as RouterLink } from 'react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Checkbox, FormControlLabel, FormHelperText, Grid, Link, Stack, TextField, Typography } from '@mui/material';
import { MailCheck } from 'lucide-react';
import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterInput } from '@referloop/shared';
import { ApiError, errorMessage } from '@/api/client';
import { useConfig, useRegister, useResendVerification } from '@/api/queries';
import { useNotify } from '@/components/notify';
import { applyServerErrors } from '@/lib/forms';
import { PasswordField } from './PasswordField';

export default function RegisterPage() {
  const registerMutation = useRegister();
  const resend = useResendVerification();
  const notify = useNotify();
  const { data: config } = useConfig();
  const {
    register,
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      jobTitle: '',
      acceptTerms: false as unknown as true,
    },
  });

  const onSubmit = handleSubmit((values) => registerMutation.mutate(values, { onError: (err) => applyServerErrors(err, setError) }));

  if (registerMutation.isSuccess) {
    const email = getValues('email').trim().toLowerCase();
    return (
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <Box sx={{ color: 'primary.main' }}>
          <MailCheck size={48} />
        </Box>
        <Typography variant="h2" component="h1">
          Check your inbox
        </Typography>
        <Typography color="text.secondary">
          {registerMutation.data.message} The link expires in 24 hours. You can sign in now, but you will need to verify before posting or
          editing jobs.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
          <Button component={RouterLink} to="/login" variant="contained">
            Go to sign in
          </Button>
          <Button
            disabled={resend.isPending || resend.isSuccess}
            onClick={() =>
              resend.mutate(email, {
                onSuccess: (r) => notify(r.message),
                onError: (err) => notify(errorMessage(err), 'error'),
              })
            }
          >
            {resend.isSuccess ? 'Email sent' : 'Resend email'}
          </Button>
        </Stack>
      </Stack>
    );
  }

  const closed =
    config?.registrationEnabled === false ||
    (registerMutation.error instanceof ApiError && registerMutation.error.code === 'REGISTRATION_CLOSED');

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h2" component="h1" gutterBottom>
        Create your account
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Post openings from your company and help colleagues find their next role.
      </Typography>

      {closed && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Registration is currently closed by the administrators.
        </Alert>
      )}
      {config && config.allowedEmailDomains.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Registration is limited to these email domains: {config.allowedEmailDomains.join(', ')}.
        </Alert>
      )}
      {registerMutation.isError && !closed && !(registerMutation.error instanceof ApiError && registerMutation.error.fields) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(registerMutation.error)}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField
            label="Full name"
            required
            autoComplete="name"
            autoFocus
            {...register('name')}
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Email address"
            type="email"
            required
            autoComplete="email"
            {...register('email')}
            error={Boolean(errors.email)}
            helperText={errors.email?.message ?? 'We will send a verification link. Your email is never shown to other members.'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <PasswordField
            label="Password"
            required
            autoComplete="new-password"
            {...register('password')}
            error={Boolean(errors.password)}
            helperText={errors.password?.message ?? `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <PasswordField
            label="Confirm password"
            required
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Company name (optional)"
            autoComplete="organization"
            {...register('companyName')}
            error={Boolean(errors.companyName)}
            helperText={errors.companyName?.message}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Job title (optional)"
            autoComplete="organization-title"
            {...register('jobTitle')}
            error={Boolean(errors.jobTitle)}
            helperText={errors.jobTitle?.message}
          />
        </Grid>
        <Grid size={12}>
          <Controller
            name="acceptTerms"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.target.checked)}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                  />
                }
                label={
                  <Typography variant="body2">
                    I agree to the{' '}
                    <Link component={RouterLink} to="/terms" target="_blank">
                      terms of use
                    </Link>{' '}
                    and{' '}
                    <Link component={RouterLink} to="/terms#privacy" target="_blank">
                      privacy policy
                    </Link>
                    .
                  </Typography>
                }
              />
            )}
          />
          {errors.acceptTerms && <FormHelperText error>{errors.acceptTerms.message}</FormHelperText>}
        </Grid>
        <Grid size={12}>
          <Button type="submit" variant="contained" size="large" fullWidth disabled={registerMutation.isPending || closed}>
            {registerMutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </Grid>
      </Grid>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link component={RouterLink} to="/login">
          Sign in
        </Link>
      </Typography>
    </Box>
  );
}
