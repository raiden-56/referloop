import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Snackbar, type AlertColor } from '@mui/material';
import { NotifyContext, type Notify } from './notify';

/** App-wide toast messages for success/error feedback. */
export function NotifierProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ key: number; message: string; severity: AlertColor } | null>(null);
  const notify = useCallback<Notify>((message, severity = 'success') => setToast({ key: Date.now(), message, severity }), []);
  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={toast?.severity === 'error' ? 7000 : 4000}
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') setToast(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifyContext.Provider>
  );
}
