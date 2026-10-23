import { createContext, useContext } from 'react';
import type { AlertColor } from '@mui/material';

export type Notify = (message: string, severity?: AlertColor) => void;
export const NotifyContext = createContext<Notify>(() => {});

/** Shows a toast message (rendered by NotifierProvider). */
export const useNotify = () => useContext(NotifyContext);
