import type { z } from 'zod';
import { badRequest, validationError } from './errors.js';
import { idSchema } from '@referloop/shared';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw validationError(result.error);
  return result.data;
}

/** Validates a UUID route parameter, returning 404-style errors for malformed IDs. */
export function parseId(value: unknown, what = 'Resource'): string {
  const result = idSchema.safeParse(value);
  if (!result.success) throw badRequest(`Invalid ${what.toLowerCase()} identifier.`, 'INVALID_ID');
  return result.data;
}

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
