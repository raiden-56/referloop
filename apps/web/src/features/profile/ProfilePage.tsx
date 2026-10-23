import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { BadgeCheck, LogOut, MailWarning, Monitor } from 'lucide-react';
import {
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  profileUpdateSchema,
  type ChangePasswordInput,
  type ProfileUpdateInput,
} from '@referloop/shared';
import { errorMessage } from '@/api/client';
import { useChangePassword, useLogout, useSessions, useUpdateProfile } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useNotify } from '@/components/notify';
import { PageHeader } from '@/components/PageHeader';
import { ResendVerificationButton } from '@/components/VerifyEmailBanner';
import { PasswordField } from '@/features/auth/PasswordField';
import { formatDate, fromNow } from '@/lib/dates';
import { applyServerErrors } from '@/lib/forms';

function ProfileForm() {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const notify = useNotify();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { name: user?.name ?? '', companyName: user?.companyName ?? '', jobTitle: user?.jobTitle ?? '' },
  });

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit((values) =>
        update.mutate(values, {
          onSuccess: ({ user: u }) => {
            reset({ name: u.name, companyName: u.companyName ?? '', jobTitle: u.jobTitle ?? '' });
            notify('Profile updated');
          },
          onError: (err) => applyServerErrors(err, setError) || notify(errorMessage(err), 'error'),
        }),
      )}
    >
      <Stack spacing={2}>
        <TextField
          label="Full name"
          required
          {...register('name')}
          error={Boolean(errors.name)}
          helperText={errors.name?.message ?? 'Shown on jobs you post or edit'}
        />
        <TextField
          label="Company"
          {...register('companyName')}
          error={Boolean(errors.companyName)}
          helperText={errors.companyName?.message}
        />
        <TextField label="Job title" {...register('jobTitle')} error={Boolean(errors.jobTitle)} helperText={errors.jobTitle?.message} />
        <Box>
          <Button type="submit" variant="contained" disabled={!isDirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save profile'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const notify = useNotify();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit((values) =>
        change.mutate(values, {
          onSuccess: (r) => {
            reset();
            notify(r.message);
          },
          onError: (err) => applyServerErrors(err, setError) || notify(errorMessage(err), 'error'),
        }),
      )}
    >
      <Stack spacing={2}>
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          {...register('currentPassword')}
          error={Boolean(errors.currentPassword)}
          helperText={errors.currentPassword?.message}
        />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          {...register('newPassword')}
          error={Boolean(errors.newPassword)}
          helperText={errors.newPassword?.message ?? `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number`}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={Boolean(errors.confirmPassword)}
          helperText={errors.confirmPassword?.message}
        />
        <Box>
          <Button type="submit" variant="contained" disabled={change.isPending}>
            {change.isPending ? 'Updating…' : 'Change password'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

const describeAgent = (ua: string | null) => {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return `${browser}${os ? ` on ${os}` : ''}`;
};

function SessionsCard() {
  const { data, isLoading } = useSessions();
  const logout = useLogout();
  const navigate = useNavigate();
  const notify = useNotify();
  const [confirm, setConfirm] = useState(false);

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          Active sessions
        </Typography>
        {isLoading ? (
          <Skeleton height={60} />
        ) : (
          <List dense disablePadding>
            {data?.map((s) => (
              <ListItem
                key={s.id}
                disableGutters
                secondaryAction={s.current ? <Chip size="small" color="primary" label="This device" /> : undefined}
              >
                <Box sx={{ mr: 1.5, color: 'text.secondary', display: 'flex' }}>
                  <Monitor size={18} />
                </Box>
                <ListItemText
                  primary={describeAgent(s.userAgent)}
                  secondary={`Signed in ${formatDate(s.createdAt)} · active ${fromNow(s.lastUsedAt)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
        <Button sx={{ mt: 1.5 }} variant="outlined" color="error" startIcon={<LogOut size={16} />} onClick={() => setConfirm(true)}>
          Sign out of all devices
        </Button>
      </CardContent>
      <ConfirmDialog
        open={confirm}
        title="Sign out everywhere?"
        description="All sessions, including this one, will be signed out immediately."
        confirmLabel="Sign out everywhere"
        confirmColor="error"
        pending={logout.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          logout.mutate(
            { everywhere: true },
            {
              onSettled: () => {
                notify('Signed out of all devices.');
                navigate('/login');
              },
            },
          )
        }
      />
    </Card>
  );
}

export default function ProfilePage() {
  const { user, isVerified } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader title="My profile" subtitle="Manage how you appear to other members and how you sign in." />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" component="h2" gutterBottom>
                  Profile
                </Typography>
                <ProfileForm />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="h4" component="h2" gutterBottom>
                  Password
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Changing your password signs out your other sessions.
                </Typography>
                <PasswordForm />
              </CardContent>
            </Card>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" component="h2" gutterBottom>
                  Account
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Email (private — never shown to other members)
                </Typography>
                <Typography sx={{ fontWeight: 500, mb: 1.5, wordBreak: 'break-all' }}>{user.email}</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
                  {isVerified ? (
                    <Chip color="success" variant="outlined" icon={<BadgeCheck size={16} />} label="Email verified" />
                  ) : (
                    <Chip color="warning" variant="outlined" icon={<MailWarning size={16} />} label="Email not verified" />
                  )}
                  <Chip variant="outlined" label={user.role === 'ADMIN' ? 'Administrator' : 'Member'} />
                </Stack>
                {!isVerified && <ResendVerificationButton variant="contained" />}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  Member since {formatDate(user.createdAt)}
                </Typography>
              </CardContent>
            </Card>
            <SessionsCard />
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
