import type { NotificationItem, NotificationType } from '@referloop/shared';
import { prisma, type Db } from '../../lib/prisma.js';

export interface NewNotification {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

/** Creates the same notification for several users, skipping duplicates and the acting user. */
export async function notifyUsers(userIds: Iterable<string>, n: NewNotification, opts: { exclude?: string | null; db?: Db } = {}) {
  const recipients = [...new Set(userIds)].filter((id) => id !== opts.exclude);
  if (recipients.length === 0) return;
  await (opts.db ?? prisma).notification.createMany({
    data: recipients.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null })),
  });
}

export function toNotificationItem(n: {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
