import { Router } from 'express';
import { z } from 'zod';
import { changePasswordSchema, paginationSchema, profileUpdateSchema } from '@referloop/shared';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { parse } from '../../lib/validate.js';
import { audit, requestMeta } from '../audit/audit.service.js';
import { changePassword } from '../auth/auth.service.js';
import { listMyJobs, listSavedJobs } from '../jobs/jobs.service.js';
import { toCurrentUser } from './users.serializer.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', (req, res) => {
  res.json({ user: toCurrentUser(req.auth!.user) });
});

/** Only profile fields are accepted here: role, status and email cannot be changed by the member. */
usersRouter.patch('/me', async (req, res) => {
  const input = parse(profileUpdateSchema, req.body);
  const user = await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { name: input.name, companyName: input.companyName, jobTitle: input.jobTitle },
  });
  await audit({ actorId: user.id, action: 'PROFILE_UPDATED', targetType: 'User', targetId: user.id }, requestMeta(req));
  res.json({ user: toCurrentUser(user) });
});

usersRouter.post('/me/password', async (req, res) => {
  const input = parse(changePasswordSchema, req.body);
  await changePassword(req.auth!.user, input.currentPassword, input.newPassword, req.auth!.sessionId, requestMeta(req));
  res.json({ message: 'Password updated. Other sessions have been signed out.' });
});

usersRouter.get('/me/sessions', async (req, res) => {
  const sessions = await prisma.userSession.findMany({
    where: { userId: req.auth!.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true, createdAt: true, lastUsedAt: true, userAgent: true, ipAddress: true },
  });
  res.json({ items: sessions.map((s) => ({ ...s, current: s.id === req.auth!.sessionId })) });
});

const myJobsQuery = paginationSchema.extend({ scope: z.enum(['posted', 'edited']).default('posted').catch('posted') });

usersRouter.get('/me/jobs', async (req, res) => {
  const { scope, page, pageSize } = parse(myJobsQuery, req.query);
  res.json(await listMyJobs(req.auth!.user, scope, page, pageSize));
});

usersRouter.get('/me/saved-jobs', async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  res.json(await listSavedJobs(req.auth!.user, page, pageSize));
});
