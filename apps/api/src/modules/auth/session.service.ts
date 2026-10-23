import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env.js';
import { generateToken, hashToken } from '../../lib/crypto.js';
import { prisma, type Db } from '../../lib/prisma.js';
import type { RequestMeta } from '../audit/audit.service.js';

export const SESSION_COOKIE = 'rl_session';
const TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;

const cookieOptions = (expires: Date): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: '/',
  expires,
});

export async function createSession(userId: string, meta: RequestMeta, db: Db = prisma) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_MS);
  const session = await db.userSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
  });
  return { token, expiresAt, sessionId: session.id };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export function clearSessionCookie(res: Response) {
  const { expires: _expires, ...opts } = cookieOptions(new Date(0));
  res.clearCookie(SESSION_COOKIE, opts);
}

export async function findActiveSession(token: string) {
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return session;
}

/** Sliding expiry: once half the lifetime has elapsed, extend the session and re-issue the cookie. */
export async function touchSession(res: Response, token: string, session: { id: string; expiresAt: Date; lastUsedAt: Date }) {
  const now = Date.now();
  const halfLifeReached = session.expiresAt.getTime() - now < TTL_MS / 2;
  const staleLastUsed = now - session.lastUsedAt.getTime() > 5 * 60 * 1000;
  if (!halfLifeReached && !staleLastUsed) return;
  const expiresAt = halfLifeReached ? new Date(now + TTL_MS) : session.expiresAt;
  await prisma.userSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date(now), expiresAt } });
  if (halfLifeReached) setSessionCookie(res, token, expiresAt);
}

export async function revokeSession(sessionId: string) {
  await prisma.userSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string, opts: { exceptSessionId?: string; db?: Db } = {}) {
  const result = await (opts.db ?? prisma).userSession.updateMany({
    where: { userId, revokedAt: null, ...(opts.exceptSessionId ? { id: { not: opts.exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
