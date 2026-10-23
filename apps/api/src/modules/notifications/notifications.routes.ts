import { Router } from 'express';
import { z } from 'zod';
import type { NotificationList } from '@referloop/shared';
import { paginationSchema } from '@referloop/shared';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { paginate, parse, parseId } from '../../lib/validate.js';
import { toNotificationItem } from './notifications.service.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const listQuery = paginationSchema.extend({ unread: z.enum(['true', 'false']).optional().catch(undefined) });

notificationsRouter.get('/', async (req, res) => {
  const { page, pageSize, unread } = parse(listQuery, req.query);
  const userId = req.auth!.user.id;
  const where = { userId, ...(unread === 'true' ? { readAt: null } : {}) };
  const [total, unreadCount, rows] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(page, pageSize) }),
  ]);
  const body: NotificationList = {
    items: rows.map(toNotificationItem),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    unreadCount,
  };
  res.json(body);
});

notificationsRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.auth!.user.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const id = parseId(req.params.id, 'Notification');
  // Scoped to the current user: other members' notifications are indistinguishable from missing ones.
  await prisma.notification.updateMany({ where: { id, userId: req.auth!.user.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});
