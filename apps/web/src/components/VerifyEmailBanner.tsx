import { Alert, Button, type ButtonProps } from '@mui/material';
import { useResendVerification } from '@/api/queries';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/auth/useAuth';
import { useNotify } from './notify';

export function ResendVerificationButton(props: ButtonProps) {
  const resend = useResendVerification();
  const notify = useNotify();
  return (
    <Button
      size="small"
      {...props}
      disabled={resend.isPending || resend.isSuccess}
      onClick={() =>
        resend.mutate(undefined, {
          onSuccess: () => notify('A new verification link is on its way. Check your inbox.'),
          onError: (err) => notify(errorMessage(err), 'error'),
        })
      }
    >
      {resend.isSuccess ? 'Email sent' : resend.isPending ? 'Sending…' : 'Resend verification email'}
    </Button>
  );
}

/** Reminds signed-in, unverified members why posting and editing are unavailable. */
export function VerifyEmailBanner() {
  const { user, isVerified } = useAuth();
  if (!user || isVerified) return null;
  return (
    <Alert severity="warning" sx={{ borderRadius: 0, alignItems: 'center' }} action={<ResendVerificationButton color="inherit" />}>
      Verify your email address ({user.email}) to post, edit or report jobs.
    </Alert>
  );
}
