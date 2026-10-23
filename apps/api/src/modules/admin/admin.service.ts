import {
  slugify,
  type AdminCategory,
  type AdminDashboard,
  type AdminJob,
  type AdminJobListQuery,
  type AdminReport,
  type AdminReportListQuery,
  type AdminUser,
  type AdminUserListQuery,
  type AuditLogEntry,
  type AuditLogListQuery,
  type CategoryInput,
  type Paginated,
  type ReportResolutionInput,
  type Role,
} from '@referloop/shared';
import type { z } from 'zod';
import type { categorySchema, reportResolutionSchema } from '@referloop/shared';
import type { User } from '../../generated/prisma/client.js';
import { emails } from '../../lib/email.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { prisma, type Prisma, type Tx } from '../../lib/prisma.js';
import { paged, paginate } from '../../lib/validate.js';
import { audit, type RequestMeta } from '../audit/audit.service.js';
import { revokeAllSessions } from '../auth/session.service.js';
import { archiveJobTx, changeStatusTx, serializeSummaries } from '../jobs/jobs.service.js';
import { escapeLike, textSearchWhere } from '../jobs/jobs.search.js';
import { jobInclude } from '../jobs/jobs.serializer.js';
import { notifyUsers } from '../notifications/notifications.service.js';
import { getSettings } from '../settings/settings.service.js';
import { toCurrentUser, toPublicUser } from '../users/users.serializer.js';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(): Promise<AdminDashboard> {
  const [users, verifiedMembers, suspendedUsers, activeJobs, closedJobs, archivedJobs, pendingReports, referralsMade, recent] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerifiedAt: { not: null }, accountStatus: 'ACTIVE' } }),
      prisma.user.count({ where: { accountStatus: 'SUSPENDED' } }),
      prisma.job.count({ where: { status: 'ACTIVE', archivedAt: null } }),
      prisma.job.count({ where: { status: 'CLOSED', archivedAt: null } }),
      prisma.job.count({ where: { archivedAt: { not: null } } }),
      prisma.jobReport.count({ where: { status: { in: ['OPEN', 'ESCALATED'] } } }),
      prisma.referralRequest.count({ where: { status: 'REFERRED' } }),
      prisma.job.findMany({
        include: { ...jobInclude, editHistory: { orderBy: { createdAt: 'desc' }, take: 1, select: { action: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
    ]);
  const summaries = await serializeSummaries(recent, null);
  return {
    totals: { users, verifiedMembers, suspendedUsers, activeJobs, closedJobs, archivedJobs, pendingReports, referralsMade },
    recentJobs: summaries.map((s, i) => ({ ...s, lastAction: recent[i]?.editHistory[0]?.action ?? null })),
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(query: AdminUserListQuery): Promise<Paginated<AdminUser>> {
  const and: Prisma.UserWhereInput[] = [];
  if (query.q)
    and.push({
      OR: [
        { name: { contains: escapeLike(query.q), mode: 'insensitive' } },
        { email: { contains: escapeLike(query.q), mode: 'insensitive' } },
      ],
    });
  if (query.role) and.push({ role: query.role });
  if (query.status) and.push({ accountStatus: query.status });
  if (query.verified) and.push({ emailVerifiedAt: query.verified === 'yes' ? { not: null } : null });
  const where: Prisma.UserWhereInput = { AND: and };
  const now = new Date();
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: now } } }, jobsCreated: true } },
      },
      ...paginate(query.page, query.pageSize),
    }),
  ]);
  return paged(
    users.map((u) => ({
      ...toCurrentUser(u),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      activeSessions: u._count.sessions,
      jobsPosted: u._count.jobsCreated,
    })),
    total,
    query.page,
    query.pageSize,
  );
}

async function getTargetUser(id: string, actor: User) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User');
  if (user.id === actor.id) throw forbidden('You cannot change your own account status or role.', 'SELF_MODIFICATION');
  return user;
}

export async function setUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', reason: string | null, actor: User, meta: RequestMeta) {
  const target = await getTargetUser(id, actor);
  if (target.accountStatus === status)
    throw conflict(`This account is already ${status === 'ACTIVE' ? 'active' : 'suspended'}.`, 'NO_CHANGE');

  const updated = await prisma.$transaction(async (tx) => {
    if (status === 'SUSPENDED' && target.role === 'ADMIN') await assertAnotherAdmin(tx, target.id);
    const user = await tx.user.update({
      where: { id },
      data:
        status === 'SUSPENDED'
          ? { accountStatus: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason }
          : { accountStatus: 'ACTIVE', suspendedAt: null, suspensionReason: null, failedLoginCount: 0, lockedUntil: null },
    });
    const revoked = status === 'SUSPENDED' ? await revokeAllSessions(id, { db: tx }) : 0;
    await audit(
      {
        actorId: actor.id,
        action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REINSTATED',
        targetType: 'User',
        targetId: id,
        metadata: { reason, revokedSessions: revoked },
      },
      meta,
      tx,
    );
    if (status === 'ACTIVE') {
      await notifyUsers(
        [id],
        { type: 'ACCOUNT', title: 'Your account was reinstated', body: 'An administrator reinstated your account.' },
        { db: tx },
      );
    }
    return user;
  });
  if (status === 'SUSPENDED') emails.accountSuspended(updated.email, reason);
  return toCurrentUser(updated);
}

export async function setUserRole(id: string, role: Role, actor: User, meta: RequestMeta) {
  const target = await getTargetUser(id, actor);
  if (target.role === role) throw conflict(`This user is already ${role === 'ADMIN' ? 'an administrator' : 'a member'}.`, 'NO_CHANGE');
  if (role === 'ADMIN' && (!target.emailVerifiedAt || target.accountStatus !== 'ACTIVE')) {
    throw badRequest('Only verified, active members can become administrators.', 'NOT_ELIGIBLE');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (role === 'MEMBER') await assertAnotherAdmin(tx, target.id);
    const user = await tx.user.update({ where: { id }, data: { role } });
    // Privilege changes take effect on fresh sessions only.
    await revokeAllSessions(id, { db: tx });
    await audit(
      { actorId: actor.id, action: 'USER_ROLE_CHANGED', targetType: 'User', targetId: id, metadata: { from: target.role, to: role } },
      meta,
      tx,
    );
    await notifyUsers(
      [id],
      {
        type: 'ACCOUNT',
        title: role === 'ADMIN' ? 'You are now an administrator' : 'Administrator access removed',
        body: role === 'ADMIN' ? 'You can now access the Admin Console.' : 'Your account is now a standard member account.',
      },
      { db: tx },
    );
    return user;
  });
  return toCurrentUser(updated);
}

/**
 * Runs inside the transaction that demotes or suspends. Locking the active admin rows serialises
 * concurrent changes, so two admins removing each other at the same moment cannot leave zero admins.
 */
async function assertAnotherAdmin(tx: Tx, excludingId: string) {
  const admins = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE role = 'ADMIN' AND "accountStatus" = 'ACTIVE' FOR UPDATE`;
  const others = admins.filter((a) => a.id !== excludingId).length;
  if (others === 0) throw conflict('At least one active administrator must remain.', 'LAST_ADMIN');
}

export async function revokeUserSessions(id: string, actor: User, meta: RequestMeta) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User');
  const count = await revokeAllSessions(id);
  await audit({ actorId: actor.id, action: 'USER_SESSIONS_REVOKED', targetType: 'User', targetId: id, metadata: { count } }, meta);
  return { revoked: count };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function listAdminJobs(query: AdminJobListQuery): Promise<Paginated<AdminJob>> {
  const and: Prisma.JobWhereInput[] = [...textSearchWhere(query.q)];
  if (query.status === 'active') and.push({ status: 'ACTIVE' });
  if (query.status === 'closed') and.push({ status: 'CLOSED' });
  if (query.archived === 'exclude') and.push({ archivedAt: null });
  if (query.archived === 'only') and.push({ archivedAt: { not: null } });
  const where: Prisma.JobWhereInput = { AND: and };
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      include: { ...jobInclude, _count: { select: { reports: { where: { status: { in: ['OPEN', 'ESCALATED'] } } } } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      ...paginate(query.page, query.pageSize),
    }),
  ]);
  const summaries = await serializeSummaries(jobs, null);
  return paged(
    summaries.map((s, i) => ({ ...s, archiveReason: jobs[i]!.archiveReason, openReports: jobs[i]!._count.reports })),
    total,
    query.page,
    query.pageSize,
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const reportInclude = {
  reporter: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
  job: { select: { id: true, slug: true, title: true, companyName: true, status: true, archivedAt: true } },
} satisfies Prisma.JobReportInclude;

type ReportRow = Prisma.JobReportGetPayload<{ include: typeof reportInclude }>;

async function toAdminReports(rows: ReportRow[]): Promise<AdminReport[]> {
  const jobIds = [...new Set(rows.map((r) => r.jobId))];
  const counts = jobIds.length
    ? await prisma.jobReport.groupBy({
        by: ['jobId'],
        where: { jobId: { in: jobIds }, status: { in: ['OPEN', 'ESCALATED'] } },
        _count: { _all: true },
      })
    : [];
  const countByJob = new Map(counts.map((c) => [c.jobId, c._count._all]));
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    description: r.description,
    status: r.status,
    resolutionNote: r.resolutionNote,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    reporter: toPublicUser(r.reporter),
    resolvedBy: r.resolvedBy ? toPublicUser(r.resolvedBy) : null,
    job: { ...r.job, archivedAt: r.job.archivedAt?.toISOString() ?? null },
    openReportsForJob: countByJob.get(r.jobId) ?? 0,
  }));
}

export async function listReports(query: AdminReportListQuery): Promise<Paginated<AdminReport>> {
  const where: Prisma.JobReportWhereInput =
    query.status === 'ALL' ? {} : query.status === 'PENDING' ? { status: { in: ['OPEN', 'ESCALATED'] } } : { status: query.status };
  const [total, rows] = await Promise.all([
    prisma.jobReport.count({ where }),
    prisma.jobReport.findMany({
      where,
      include: reportInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...paginate(query.page, query.pageSize),
    }),
  ]);
  return paged(await toAdminReports(rows), total, query.page, query.pageSize);
}

/**
 * Resolves, dismisses or escalates a report. When resolving, an optional job action (close or
 * archive) is applied in the same transaction, and other open reports for that job are resolved too.
 */
export async function resolveReport(id: string, input: z.output<typeof reportResolutionSchema>, actor: User, meta: RequestMeta) {
  const settings = await getSettings();
  await prisma.$transaction(async (tx) => {
    const report = await tx.jobReport.findUnique({ where: { id }, include: { job: true } });
    if (!report) throw notFound('Report');
    if (report.status === 'RESOLVED' || report.status === 'DISMISSED')
      throw conflict('This report has already been closed.', 'ALREADY_RESOLVED');
    if (input.action === 'ESCALATE' && report.status === 'ESCALATED') throw conflict('This report is already escalated.', 'NO_CHANGE');

    const now = new Date();
    if (input.action === 'ESCALATE') {
      await tx.jobReport.update({ where: { id }, data: { status: 'ESCALATED', escalatedAt: now, resolutionNote: input.resolutionNote } });
    } else {
      const status = input.action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED';
      await tx.jobReport.update({
        where: { id },
        data: { status, resolvedById: actor.id, resolvedAt: now, resolutionNote: input.resolutionNote },
      });
    }

    const note = input.resolutionNote ?? 'Resolved by an administrator';
    if (input.jobAction === 'CLOSE' && report.job.status === 'ACTIVE' && !report.job.archivedAt) {
      await changeStatusTx(tx, report.jobId, 'CLOSED', `Report resolved: ${note}`, actor, meta);
    } else if (input.jobAction === 'ARCHIVE' && !report.job.archivedAt) {
      await archiveJobTx(tx, report.jobId, note, actor, meta);
    }

    let alsoResolved: string[] = [];
    if (input.jobAction !== 'NONE') {
      const others = await tx.jobReport.findMany({
        where: { jobId: report.jobId, id: { not: id }, status: { in: ['OPEN', 'ESCALATED'] } },
        select: { id: true },
      });
      alsoResolved = others.map((o) => o.id);
      if (alsoResolved.length) {
        await tx.jobReport.updateMany({
          where: { id: { in: alsoResolved } },
          data: { status: 'RESOLVED', resolvedById: actor.id, resolvedAt: now, resolutionNote: `Resolved with related report: ${note}` },
        });
      }
    }

    await audit(
      {
        actorId: actor.id,
        action: `REPORT_${input.action === 'RESOLVE' ? 'RESOLVED' : input.action === 'DISMISS' ? 'DISMISSED' : 'ESCALATED'}`,
        targetType: 'JobReport',
        targetId: id,
        metadata: { jobId: report.jobId, jobAction: input.jobAction, note: input.resolutionNote, alsoResolved },
      },
      meta,
      tx,
    );

    if (input.action !== 'ESCALATE' && settings.notifyReporterOnResolution) {
      const reporters = await tx.jobReport.findMany({ where: { id: { in: [id, ...alsoResolved] } }, select: { reporterId: true } });
      await notifyUsers(
        reporters.map((r) => r.reporterId),
        {
          type: 'REPORT_RESOLVED',
          title: 'Your report was reviewed',
          body: `An administrator reviewed your report on "${report.job.title}". Thank you for helping keep listings accurate.`,
          link: report.job.archivedAt || input.jobAction === 'ARCHIVE' ? null : `/jobs/${report.job.slug}`,
        },
        { exclude: actor.id, db: tx },
      );
    }
  });
  const row = await prisma.jobReport.findUniqueOrThrow({ where: { id }, include: reportInclude });
  return (await toAdminReports([row]))[0]!;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function listAuditLogs(query: AuditLogListQuery): Promise<Paginated<AuditLogEntry>> {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: { contains: escapeLike(query.action), mode: 'insensitive' } } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...paginate(query.page, query.pageSize),
    }),
  ]);
  return paged(
    rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      actor: r.actor ? toPublicUser(r.actor) : null,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    query.page,
    query.pageSize,
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(): Promise<AdminCategory[]> {
  const rows = await prisma.jobCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { jobs: true } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, isActive: c.isActive, sortOrder: c.sortOrder, jobCount: c._count.jobs }));
}

export async function saveCategory(id: string | null, input: z.output<typeof categorySchema>, actor: User, meta: RequestMeta) {
  const slug = slugify(input.name, 60);
  if (!slug) throw badRequest('Category name must contain letters or numbers.', 'VALIDATION_ERROR', { name: 'Use letters or numbers' });
  const clash = await prisma.jobCategory.findFirst({
    where: { OR: [{ slug }, { name: { equals: input.name, mode: 'insensitive' } }], ...(id ? { id: { not: id } } : {}) },
  });
  if (clash) throw badRequest('A category with this name already exists.', 'VALIDATION_ERROR', { name: 'This category already exists' });
  const data = { name: input.name, slug, isActive: input.isActive, sortOrder: input.sortOrder };
  const category = id ? await prisma.jobCategory.update({ where: { id }, data }) : await prisma.jobCategory.create({ data });
  await audit(
    {
      actorId: actor.id,
      action: id ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED',
      targetType: 'JobCategory',
      targetId: category.id,
      metadata: data,
    },
    meta,
  );
  return category;
}

export type { CategoryInput, ReportResolutionInput };
