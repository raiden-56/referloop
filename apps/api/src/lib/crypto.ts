import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit random token encoded for URLs and cookies. */
export const generateToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Tokens are stored only as SHA-256 hashes so a database leak does not expose live credentials. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const hmac = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Short random suffix for job slugs (lower-case alphanumerics, no ambiguous characters). */
export function shortId(length = 6): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
