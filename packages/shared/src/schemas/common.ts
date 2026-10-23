import { z } from 'zod';
import { isSafeExternalUrl } from '../url.js';

/** Strips ASCII control characters (except tab/newline) that have no place in user-entered text. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const cleanText = (value: string) => value.replace(CONTROL_CHARS, '').trim();

/** Required single-line or multi-line text. */
export const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`),
    );

/** Optional text: empty strings become null so the database never stores "". */
export const optionalText = (label: string, max: number) =>
  z
    .string()
    .max(max * 2, `${label} is too long`)
    .transform(cleanText)
    .pipe(z.string().max(max, `${label} must be at most ${max} characters`))
    .transform((v) => (v === '' ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `${label} is too long`)
    .refine((v) => v === '' || isSafeExternalUrl(v), `${label} must be a valid https:// or http:// link`)
    .transform((v) => (v === '' ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

export const PASSWORD_MIN_LENGTH = 10;

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain at least one letter and one number');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const idSchema = z.uuid('Invalid identifier');
