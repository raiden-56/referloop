import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/api/client';

/**
 * Copies field-level validation messages from an API error onto the form.
 * Returns true when at least one field error was applied.
 */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>): boolean {
  if (!(err instanceof ApiError) || !err.fields) return false;
  let applied = false;
  for (const [field, message] of Object.entries(err.fields)) {
    if (field === '_') continue;
    setError(field as Path<T>, { type: 'server', message });
    applied = true;
  }
  return applied;
}

/** Converts a number input's raw value to number | null for React Hook Form. */
export const toNumberOrNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
