import type { Request } from 'express';
import { prisma, type Db, Prisma } from '../../lib/prisma.js';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export const requestMeta = (req: Request): RequestMeta => ({
  ipAddress: req.ip ?? null,
  userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
});

/** Writes an audit log row. Pass a transaction client so the entry commits atomically with the change. */
export async function audit(entry: AuditEntry, meta: RequestMeta | null, db: Db = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: (entry.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    },
  });
}
