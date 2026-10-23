import { useEffect, useRef, useState } from 'react';
import { TextField, type TextFieldProps } from '@mui/material';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

type Props = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string;
  onCommit: (value: string) => void;
  delayMs?: number;
};

/** A text field that edits locally and commits (e.g. to the URL) after the user pauses typing. */
export function DebouncedTextField({ value, onCommit, delayMs = 350, ...props }: Props) {
  const [local, setLocal] = useState(value);
  const debounced = useDebouncedValue(local, delayMs);
  const commit = useRef(onCommit);
  commit.current = onCommit;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (debounced.trim() !== value.trim()) commit.current(debounced.trim());
    // Only react to the user's debounced input, not to external value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return <TextField {...props} value={local} onChange={(e) => setLocal(e.target.value)} />;
}
