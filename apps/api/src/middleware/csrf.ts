import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { generateToken, hmac, safeEqual } from '../lib/crypto.js';
import { forbidden } from '../lib/errors.js';

/**
 * Signed double-submit CSRF protection. A readable `rl_csrf` cookie carries `<random>.<hmac>`;
 * state-changing requests must echo it in the `X-CSRF-Token` header. Combined with SameSite=Lax
 * session cookies and a strict CORS allow-list this blocks cross-site form and fetch attacks.
 */
export const CSRF_COOKIE = 'rl_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const sign = (nonce: string) => `${nonce}.${hmac(env.SESSION_SECRET, nonce)}`;

function isValidToken(token: unknown): token is string {
  if (typeof token !== 'string' || token.length > 200) return false;
  const [nonce, signature] = token.split('.');
  if (!nonce || !signature) return false;
  return safeEqual(sign(nonce), token);
}

export function issueCsrfToken(req: Request, res: Response): string {
  const existing: unknown = req.cookies?.[CSRF_COOKIE];
  if (isValidToken(existing)) return existing;
  const token = sign(generateToken(18));
  res.cookie(CSRF_COOKIE, token, { httpOnly: false, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/' });
  return token;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  issueCsrfToken(req, res);
  if (SAFE_METHODS.has(req.method)) return next();
  const cookie: unknown = req.cookies?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);
  if (!isValidToken(cookie) || !header || !safeEqual(cookie, header)) {
    return next(forbidden('Your session security token is missing or expired. Refresh the page and try again.', 'CSRF_INVALID'));
  }
  next();
}
