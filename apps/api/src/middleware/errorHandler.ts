import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorBody } from '@referloop/shared';
import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { Prisma } from '../lib/prisma.js';

export function notFoundHandler(req: Request, res: Response) {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: `No API route for ${req.method} ${req.path}.` } };
  res.status(404).json(body);
}

/** Converts every thrown error into the standard JSON error envelope without leaking internals. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let body: ApiErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' } };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, fields: err.fields, details: err.details } };
  } else if (isBodyParserError(err)) {
    status = err.status;
    body = {
      error: {
        code: err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_BODY',
        message: err.type === 'entity.too.large' ? 'Request body is too large.' : 'Request body is not valid JSON.',
      },
    };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    status = 404;
    body = { error: { code: 'NOT_FOUND', message: 'Resource not found.' } };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    // A concurrent request created the same unique record first (e.g. two saves of one category name).
    status = 409;
    body = { error: { code: 'CONFLICT', message: 'This was changed by another request at the same time. Refresh and try again.' } };
  }

  if (status >= 500) logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
  if (res.headersSent) return;
  res.status(status).json(body);
}

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number' &&
    String((err as { type: unknown }).type).startsWith('entity.')
  );
}
