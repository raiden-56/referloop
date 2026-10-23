import { Router } from 'express';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema, emailSchema } from '@referloop/shared';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { issueCsrfToken } from '../../middleware/csrf.js';
import { rateLimits } from '../../middleware/rateLimit.js';
import { parse } from '../../lib/validate.js';
import { prisma } from '../../lib/prisma.js';
import { audit, requestMeta } from '../audit/audit.service.js';
import { toCurrentUser } from '../users/users.serializer.js';
import * as auth from './auth.service.js';
import { clearSessionCookie, revokeAllSessions, revokeSession, setSessionCookie } from './session.service.js';

export const authRouter = Router();
authRouter.use(rateLimits.authGeneral);

/** Returns (and sets, if missing) the CSRF token for clients that cannot read cookies. */
authRouter.get('/csrf', (req, res) => {
  res.json({ csrfToken: issueCsrfToken(req, res) });
});

authRouter.post('/register', rateLimits.register, async (req, res) => {
  const input = parse(registerSchema, req.body);
  await auth.register(input, requestMeta(req));
  res.status(202).json({ message: auth.GENERIC_REGISTER_MESSAGE });
});

authRouter.post('/verify-email', rateLimits.tokenRedemption, async (req, res) => {
  const { token } = parse(tokenSchema, req.body);
  await auth.verifyEmail(token, requestMeta(req));
  res.json({ message: 'Your email address is verified. You can now post and edit jobs.' });
});

/** Signed-in users resend for themselves; otherwise an email may be supplied (generic response). */
authRouter.post('/resend-verification', rateLimits.resendVerification, async (req, res) => {
  if (req.auth) {
    await auth.sendVerificationEmail(req.auth.user);
  } else {
    const { email } = parse(z.object({ email: emailSchema }), req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.accountStatus === 'ACTIVE') await auth.sendVerificationEmail(user);
  }
  res.status(202).json({ message: 'If the account still needs verification, a new link is on its way.' });
});

authRouter.post('/login', rateLimits.login, async (req, res) => {
  const input = parse(loginSchema, req.body);
  // Rotate any existing session on login (prevents session fixation).
  if (req.auth) await revokeSession(req.auth.sessionId);
  const { user, session } = await auth.login(input, requestMeta(req));
  setSessionCookie(res, session.token, session.expiresAt);
  res.json({ user: toCurrentUser(user) });
});

authRouter.post('/logout', async (req, res) => {
  if (req.auth) {
    await revokeSession(req.auth.sessionId);
    await audit({ actorId: req.auth.user.id, action: 'LOGOUT', targetType: 'User', targetId: req.auth.user.id }, requestMeta(req));
  }
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  const user = req.auth!.user;
  const count = await revokeAllSessions(user.id);
  await audit(
    { actorId: user.id, action: 'SESSIONS_REVOKED', targetType: 'User', targetId: user.id, metadata: { count } },
    requestMeta(req),
  );
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.post('/forgot-password', rateLimits.passwordReset, async (req, res) => {
  const input = parse(forgotPasswordSchema, req.body);
  await auth.requestPasswordReset(input, requestMeta(req));
  res.status(202).json({ message: auth.GENERIC_RESET_MESSAGE });
});

authRouter.post('/reset-password', rateLimits.tokenRedemption, async (req, res) => {
  const input = parse(resetPasswordSchema, req.body);
  await auth.resetPassword(input, requestMeta(req));
  clearSessionCookie(res);
  res.json({ message: 'Your password has been reset. Please sign in with your new password.' });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toCurrentUser(req.auth!.user) });
});
