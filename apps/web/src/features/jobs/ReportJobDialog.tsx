import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { REPORT_REASONS, REPORT_REASON_LABELS, reportCreateSchema, type ReportCreateInput } from '@referloop/shared';
import { ApiError, errorMessage } from '@/api/client';
import { useReportJob } from '@/api/queries';
import { useNotify } from '@/components/notify';

interface Props {
  jobId: string;
  jobTitle: string;
  open: boolean;
  onClose: () => void;
}

export function ReportJobDialog({ jobId, jobTitle, open, onClose }: Props) {
  const report = useReportJob();
  const notify = useNotify();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportCreateInput>({ resolver: zodResolver(reportCreateSchema), defaultValues: { reason: undefined, description: '' } });

  const close = () => {
    if (report.isPending) return;
    reset();
    report.reset();
    onClose();
  };

  const onSubmit = handleSubmit((input) =>
    report.mutate(
      { id: jobId, input },
      {
        onSuccess: () => {
          notify('Thanks — an administrator will review your report.');
          close();
        },
      },
    ),
  );

  const already = report.error instanceof ApiError && report.error.code === 'ALREADY_REPORTED';

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle>Report this listing</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tell the administrators what is wrong with “{jobTitle}”. Reports are reviewed by a person — the job is not changed
            automatically.
          </Typography>
          {report.isError && (
            <Alert severity={already ? 'info' : 'error'} sx={{ mb: 2 }}>
              {errorMessage(report.error)}
            </Alert>
          )}
          <Controller
            name="reason"
            control={control}
            render={({ field }) => (
              <RadioGroup {...field} value={field.value ?? ''} aria-label="Report reason">
                {REPORT_REASONS.map((r) => (
                  <FormControlLabel key={r} value={r} control={<Radio size="small" />} label={REPORT_REASON_LABELS[r]} />
                ))}
              </RadioGroup>
            )}
          />
          {errors.reason && <FormHelperText error>{errors.reason.message}</FormHelperText>}
          <TextField
            label="Details (optional)"
            multiline
            minRows={3}
            sx={{ mt: 2 }}
            placeholder="e.g. the careers page says the role is filled, or this duplicates another listing"
            {...register('description')}
            error={Boolean(errors.description)}
            helperText={errors.description?.message}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} color="inherit" disabled={report.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="warning" disabled={report.isPending || already}>
            {report.isPending ? 'Sending…' : 'Submit report'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
