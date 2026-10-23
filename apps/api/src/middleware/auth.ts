import type { NextFunction, Request, Response } from 'express';
import type { User } from '../generated/prisma/client.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { clearSessionCookie, findActiveSession, revokeSession, SESSION_COOKIE, touchSession } from '../modules/auth/session.service.js';

export interface AuthContext {
  user: User;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Resolves the session cookie (if any) on every request. Never rejects: guards below do that. */
export async function loadSession(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return next();

  const session = await findActiveSession(token);
  if (!session) {
    clearSessionCookie(res);
    return next();
  }
  if (session.user.accountStatus !== 'ACTIVE') {
    // Suspended accounts lose their sessions immediately, even if revocation was missed.
    await revokeSession(session.id);
    clearSessionCookie(res);
    return next();
  }
  req.auth = { user: session.user, sessionId: session.id };
  await touchSession(res, token, session);
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  next();
}

/** Verified, active member. Required for every action that modifies job records. */
export function requireVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  if (!req.auth.user.emailVerifiedAt) {
    return next(forbidden('Verify your email address before posting, editing or reporting jobs.', 'EMAIL_NOT_VERIFIED'));
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  if (req.auth.user.role !== 'ADMIN' || !req.auth.user.emailVerifiedAt) return next(forbidden('Administrator access required.'));
  next();
}

/** Narrowing helper for handlers that run after `requireAuth`. */
export function currentUser(req: Request): User {
  if (!req.auth) throw unauthorized();
  return req.auth.user;
}
