import type { z } from 'zod';

/** An error whose message is safe to show to API clients. Anything else becomes a generic 500. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, extra?: { fields?: Record<string, string>; details?: unknown }) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.fields = extra?.fields;
    this.details = extra?.details;
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', fields?: Record<string, string>) =>
  new HttpError(400, code, message, { fields });
export const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to do that.', code = 'FORBIDDEN') => new HttpError(403, code, message);
export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (message: string, code = 'CONFLICT', details?: unknown) => new HttpError(409, code, message, { details });

export function validationError(error: z.ZodError): HttpError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    fields[key] ??= issue.message;
  }
  return new HttpError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', { fields });
}
