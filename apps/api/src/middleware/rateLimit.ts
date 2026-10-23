import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env.js';
import type { ApiErrorBody } from '@referloop/shared';

// In-memory stores suit a single API instance. For horizontal scaling plug in a shared store
// (e.g. rate-limit-redis) here; see docs/DEPLOYMENT.md.

const MINUTE = 60_000;

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? '0.0.0.0');
const userOrIpKey = (req: Request) => req.auth?.user.id ?? ipKey(req);
const ipAndEmailKey = (req: Request) => {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return `${ipKey(req)}|${typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : ''}`;
};

function limiter(name: string, windowMs: number, limit: number, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs,
    limit: Math.ceil(limit * env.RATE_LIMIT_SCALE),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: ipKey,
    handler: (_req, res, _next, options) => {
      const body: ApiErrorBody = {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a few minutes and try again.' },
      };
      res.status(options.statusCode).json(body);
    },
    identifier: name,
    ...extra,
  });
}

export const rateLimits = {
  api: limiter('api', 15 * MINUTE, 1500),
  authGeneral: limiter('auth', 15 * MINUTE, 100),
  // Counts only failures, keyed by IP + email: same response whether or not the account exists.
  login: limiter('login', 15 * MINUTE, 8, { keyGenerator: ipAndEmailKey, skipSuccessfulRequests: true }),
  register: limiter('register', 60 * MINUTE, 10),
  passwordReset: limiter('password-reset', 60 * MINUTE, 5, { keyGenerator: ipAndEmailKey }),
  tokenRedemption: limiter('token', 60 * MINUTE, 30),
  resendVerification: limiter('resend-verification', 60 * MINUTE, 5, { keyGenerator: userOrIpKey }),
  jobCreate: limiter('job-create', 60 * MINUTE, 30, { keyGenerator: userOrIpKey }),
  jobWrite: limiter('job-write', 60 * MINUTE, 200, { keyGenerator: userOrIpKey }),
  report: limiter('report', 60 * MINUTE, 10, { keyGenerator: userOrIpKey }),
  // Each request emails another member, so keep the daily volume per member low.
  referralRequest: limiter('referral-request', 24 * 60 * MINUTE, 15, { keyGenerator: userOrIpKey }),
  referralWrite: limiter('referral-write', 60 * MINUTE, 100, { keyGenerator: userOrIpKey }),
};
