import { useEffect, useState, type ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  /** Show an optional (or required) reason field and pass its value to onConfirm. */
  reason?: { label: string; required?: boolean; placeholder?: string };
  pending?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmColor = 'primary',
  reason,
  pending,
  error,
  onConfirm,
  onClose,
}: Props) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue('');
  }, [open]);
  const invalid = Boolean(reason?.required) && value.trim().length < 3;

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="xs" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid && !pending) onConfirm(value.trim());
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {description && <DialogContentText sx={{ mb: reason ? 2 : 0 }}>{description}</DialogContentText>}
          {reason && (
            <TextField
              autoFocus
              label={reason.required ? reason.label : `${reason.label} (optional)`}
              placeholder={reason.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
          )}
          {error && <DialogContentText sx={{ color: 'error.main', mt: 2 }}>{error}</DialogContentText>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={pending} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" color={confirmColor} disabled={pending || invalid}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
