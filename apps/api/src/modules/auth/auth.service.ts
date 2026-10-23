import type { z } from 'zod';
import type { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@referloop/shared';
import type { User } from '../../generated/prisma/client.js';
import { generateToken, hashToken } from '../../lib/crypto.js';
import { emails } from '../../lib/email.js';
import { forbidden, HttpError } from '../../lib/errors.js';
import { getDummyHash, hashPassword, passwordNeedsRehash, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { audit, type RequestMeta } from '../audit/audit.service.js';
import { getSettings, isEmailDomainAllowed } from '../settings/settings.service.js';
import { createSession, revokeAllSessions } from './session.service.js';

const HOUR = 60 * 60 * 1000;
const VERIFICATION_TTL = 24 * HOUR;
const RESET_TTL = HOUR;
const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;

export const GENERIC_REGISTER_MESSAGE = 'Thanks! If this email can be used for a new account, we have sent a verification link to it.';
export const GENERIC_RESET_MESSAGE = 'If an account exists for that email, we have sent password reset instructions.';
const invalidCredentials = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
const invalidToken = () => new HttpError(400, 'INVALID_TOKEN', 'This link is invalid or has expired. Please request a new one.');

export async function register(input: z.output<typeof registerSchema>, meta: RequestMeta): Promise<void> {
  const settings = await getSettings();
  if (!settings.registrationEnabled) throw forbidden('Registration is currently closed.', 'REGISTRATION_CLOSED');
  if (!isEmailDomainAllowed(input.email, settings.allowedEmailDomains)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      fields: { email: 'Registration is limited to approved company email domains.' },
    });
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Same response as a fresh sign-up; the owner is told by email instead (prevents account enumeration).
    // Pay the same hashing cost too, otherwise the faster response reveals that the account exists.
    await hashPassword(input.password);
    emails.accountAlreadyExists(existing.email);
    return;
  }

  const passwordHash = await hashPassword(input.password);
  const token = generateToken();
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          companyName: input.companyName,
          jobTitle: input.jobTitle,
          passwordChangedAt: new Date(),
        },
      });
      await tx.emailVerificationToken.create({
        data: { userId: created.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFICATION_TTL) },
      });
      await audit({ actorId: created.id, action: 'USER_REGISTERED', targetType: 'User', targetId: created.id }, meta, tx);
      return created;
    });
    emails.verifyEmail(user.email, user.name, token);
  } catch (err) {
    // A concurrent registration for the same email lost the race; respond identically.
    if ((err as { code?: string }).code === 'P2002') return;
    throw err;
  }
}

export async function sendVerificationEmail(user: User): Promise<void> {
  if (user.emailVerifiedAt) return;
  const token = generateToken();
  // Issuing a new link invalidates any earlier unused ones.
  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFICATION_TTL) },
    });
  });
  emails.verifyEmail(user.email, user.name, token);
}

export async function verifyEmail(token: string, meta: RequestMeta): Promise<void> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) throw invalidToken();

  await prisma.$transaction(async (tx) => {
    // Conditional update makes the token single-use even under concurrent requests.
    const claimed = await tx.emailVerificationToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw invalidToken();
    if (!record.user.emailVerifiedAt) {
      await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      await audit({ actorId: record.userId, action: 'EMAIL_VERIFIED', targetType: 'User', targetId: record.userId }, meta, tx);
    }
  });
}

export async function login(input: z.output<typeof loginSchema>, meta: RequestMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await verifyPassword(await getDummyHash(), input.password);
    throw invalidCredentials();
  }

  const locked = user.lockedUntil !== null && user.lockedUntil > new Date();
  const valid = await verifyPassword(user.passwordHash, input.password);

  if (locked || !valid) {
    if (!locked) {
      // Atomic increment: parallel attempts (e.g. from several IPs) must each count towards the lockout.
      const { failedLoginCount } = await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      const lockNow = failedLoginCount >= MAX_FAILED_LOGINS;
      if (lockNow) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
        });
        await audit({ actorId: null, action: 'ACCOUNT_LOCKED', targetType: 'User', targetId: user.id }, meta);
        emails.accountLocked(user.email, LOCK_MINUTES);
      }
    }
    await audit({ actorId: null, action: 'LOGIN_FAILED', targetType: 'User', targetId: user.id, metadata: { locked } }, meta);
    throw invalidCredentials();
  }

  // Only revealed after the correct password was supplied.
  if (user.accountStatus === 'SUSPENDED') {
    throw forbidden('This account has been suspended. Contact an administrator for help.', 'ACCOUNT_SUSPENDED');
  }

  const rehash = passwordNeedsRehash(user.passwordHash) ? await hashPassword(input.password) : undefined;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), ...(rehash ? { passwordHash: rehash } : {}) },
  });
  const session = await createSession(user.id, meta);
  await audit({ actorId: user.id, action: 'LOGIN_SUCCEEDED', targetType: 'User', targetId: user.id }, meta);
  return { user: updated, session };
}

export async function requestPasswordReset(input: z.output<typeof forgotPasswordSchema>, meta: RequestMeta): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.accountStatus !== 'ACTIVE') {
    await getDummyHash(); // keep timing roughly comparable
    return;
  }
  const token = generateToken();
  // Issuing a new link invalidates any earlier unused ones.
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL) },
    });
  });
  await audit({ actorId: null, action: 'PASSWORD_RESET_REQUESTED', targetType: 'User', targetId: user.id }, meta);
  emails.passwordReset(user.email, token);
}

export async function resetPassword(input: z.output<typeof resetPasswordSchema>, meta: RequestMeta): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(input.token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.accountStatus !== 'ACTIVE') throw invalidToken();

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw invalidToken();
    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        // Following the emailed link proves control of the address.
        emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(),
      },
    });
    await revokeAllSessions(record.userId, { db: tx });
    await audit({ actorId: record.userId, action: 'PASSWORD_RESET_COMPLETED', targetType: 'User', targetId: record.userId }, meta, tx);
  });
  emails.passwordChanged(record.user.email);
}

export async function changePassword(user: User, currentPassword: string, newPassword: string, sessionId: string, meta: RequestMeta) {
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      fields: { currentPassword: 'Current password is incorrect' },
    });
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date() } });
    await revokeAllSessions(user.id, { exceptSessionId: sessionId, db: tx });
    await audit({ actorId: user.id, action: 'PASSWORD_CHANGED', targetType: 'User', targetId: user.id }, meta, tx);
  });
  emails.passwordChanged(user.email);
}
