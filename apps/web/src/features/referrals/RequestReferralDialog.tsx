import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { referralRequestCreateSchema, type ReferralRequestCreateInput } from '@referloop/shared';
import { errorMessage } from '@/api/client';
import { useRequestReferral } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';
import { useNotify } from '@/components/notify';

interface Props {
  jobId: string;
  jobTitle: string;
  referrerName: string;
  open: boolean;
  onClose: () => void;
}

export function RequestReferralDialog({ jobId, jobTitle, referrerName, open, onClose }: Props) {
  const request = useRequestReferral();
  const notify = useNotify();
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ReferralRequestCreateInput>({
    resolver: zodResolver(referralRequestCreateSchema),
    defaultValues: { message: '', profileUrl: '' },
  });
  const messageLength = watch('message')?.length ?? 0;

  const close = () => {
    if (request.isPending) return;
    reset();
    request.reset();
    onClose();
  };

  const onSubmit = handleSubmit((input) =>
    request.mutate(
      { jobId, input },
      {
        onSuccess: () => {
          notify(`Request sent — we will let you know when ${referrerName} responds.`);
          close();
        },
      },
    ),
  );

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle>Ask {referrerName} for a referral</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Introduce yourself and explain why you are a good fit for “{jobTitle}”. A short, specific message gets the best response.
          </Typography>
          {request.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(request.error)}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              label="Your message"
              multiline
              minRows={5}
              autoFocus
              placeholder="e.g. I have 4 years of React experience, most recently leading the checkout rebuild at…"
              {...register('message')}
              error={Boolean(errors.message)}
              helperText={errors.message?.message ?? `${messageLength}/2000 · at least 30 characters`}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
            <TextField
              label="Resume or LinkedIn link (optional)"
              placeholder="https://"
              {...register('profileUrl')}
              error={Boolean(errors.profileUrl)}
              helperText={errors.profileUrl?.message ?? 'Make sure the link is viewable by anyone who has it.'}
              slotProps={{ htmlInput: { maxLength: 2048, inputMode: 'url' } }}
            />
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            Your email address ({user?.email}) will be shared with {referrerName} so they can contact you. Nobody else will see it.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} color="inherit" disabled={request.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={request.isPending}>
            {request.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
