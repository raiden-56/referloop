import {
  JOB_EDITABLE_FIELDS,
  jobInputSchema,
  slugify,
  type DuplicateCandidate,
  type JobDetail,
  type JobHistoryResponse,
  type JobInputParsed,
  type JobSearchQuery,
  type JobStatus,
  type JobSummary,
  type JobUpdateParsed,
  type Paginated,
  type ReportReason,
} from '@referloop/shared';
import type { Job, User } from '../../generated/prisma/client.js';
import { shortId } from '../../lib/crypto.js';
import { badRequest, conflict, HttpError, notFound } from '../../lib/errors.js';
import { prisma, Prisma, type Db, type Tx } from '../../lib/prisma.js';
import { paged, paginate } from '../../lib/validate.js';
import { audit, type RequestMeta } from '../audit/audit.service.js';
import { notifyUsers } from '../notifications/notifications.service.js';
import { viewerReferralFor } from '../referrals/referrals.service.js';
import { getSettings } from '../settings/settings.service.js';
import { toPublicUser } from '../users/users.serializer.js';
import { diffSnapshots, snapshotInput, snapshotJob, toJobData, type JobSnapshot } from './jobs.diff.js';
import { buildJobSearchWhere, escapeLike, jobOrderBy } from './jobs.search.js';
import { jobInclude, toJobDetail, toJobSummary, type JobWithRelations } from './jobs.serializer.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jobLink = (slug: string) => `/jobs/${slug}`;
const isAdmin = (user: User | null | undefined) => user?.role === 'ADMIN';
const json = (value: unknown) => value as Prisma.InputJsonValue;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function savedIdsFor(viewerId: string | null | undefined, jobIds: string[], db: Db = prisma) {
  if (!viewerId || jobIds.length === 0) return new Set<string>();
  const rows = await db.savedJob.findMany({ where: { userId: viewerId, jobId: { in: jobIds } }, select: { jobId: true } });
  return new Set(rows.map((r) => r.jobId));
}

export async function serializeSummaries(jobs: JobWithRelations[], viewerId: string | null | undefined): Promise<JobSummary[]> {
  const [settings, saved] = await Promise.all([
    getSettings(),
    savedIdsFor(
      viewerId,
      jobs.map((j) => j.id),
    ),
  ]);
  return jobs.map((j) => toJobSummary(j, { staleAfterDays: settings.staleAfterDays, savedJobIds: saved }));
}

export async function serializeDetail(job: JobWithRelations, viewerId: string | null | undefined): Promise<JobDetail> {
  const [settings, saved, editors, viewerReferral] = await Promise.all([
    getSettings(),
    savedIdsFor(viewerId, [job.id]),
    prisma.jobEditHistory.findMany({ where: { jobId: job.id }, distinct: ['actorId'], select: { actorId: true } }),
    viewerReferralFor(job.id, viewerId),
  ]);
  return toJobDetail(job, { staleAfterDays: settings.staleAfterDays, savedJobIds: saved, editorCount: editors.length, viewerReferral });
}

/** Loads a job for reading. Archived listings are only visible to administrators. */
async function findVisibleJob(idOrSlug: string, viewer: User | null, db: Db = prisma): Promise<JobWithRelations> {
  const where = UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
  const job = await db.job.findUnique({ where, include: jobInclude });
  if (!job || (job.archivedAt && !isAdmin(viewer))) throw notFound('Job');
  return job;
}

export async function getJob(idOrSlug: string, viewer: User | null): Promise<JobDetail> {
  return serializeDetail(await findVisibleJob(idOrSlug, viewer), viewer?.id);
}

export async function listJobs(query: JobSearchQuery, viewerId: string | null | undefined): Promise<Paginated<JobSummary>> {
  const where = buildJobSearchWhere(query);
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({ where, include: jobInclude, orderBy: jobOrderBy(query.sort), ...paginate(query.page, query.pageSize) }),
  ]);
  return paged(await serializeSummaries(jobs, viewerId), total, query.page, query.pageSize);
}

export async function listMyJobs(user: User, scope: 'posted' | 'edited', page: number, pageSize: number) {
  const where: Prisma.JobWhereInput =
    scope === 'posted'
      ? { createdById: user.id, archivedAt: null }
      : { archivedAt: null, createdById: { not: user.id }, editHistory: { some: { actorId: user.id } } };
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({ where, include: jobInclude, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], ...paginate(page, pageSize) }),
  ]);
  return paged(await serializeSummaries(jobs, user.id), total, page, pageSize);
}

export async function listSavedJobs(user: User, page: number, pageSize: number) {
  const where: Prisma.SavedJobWhereInput = { userId: user.id, job: { archivedAt: null } };
  const [total, rows] = await Promise.all([
    prisma.savedJob.count({ where }),
    prisma.savedJob.findMany({
      where,
      include: { job: { include: jobInclude } },
      orderBy: { createdAt: 'desc' },
      ...paginate(page, pageSize),
    }),
  ]);
  return paged(
    await serializeSummaries(
      rows.map((r) => r.job),
      user.id,
    ),
    total,
    page,
    pageSize,
  );
}

export async function getHistory(idOrSlug: string, viewer: User): Promise<JobHistoryResponse> {
  const job = await findVisibleJob(idOrSlug, viewer);
  const actor = { select: { id: true, name: true } } as const;
  const [edits, statusChanges] = await Promise.all([
    prisma.jobEditHistory.findMany({ where: { jobId: job.id }, include: { actor }, orderBy: [{ createdAt: 'desc' }, { version: 'desc' }] }),
    prisma.jobStatusHistory.findMany({ where: { jobId: job.id }, include: { actor }, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    edits: edits.map((e) => ({
      id: e.id,
      action: e.action,
      actor: toPublicUser(e.actor),
      changedFields: e.changedFields,
      previousValues: (e.previousValues as Record<string, unknown> | null) ?? null,
      newValues: (e.newValues as Record<string, unknown> | null) ?? null,
      reason: e.reason,
      version: e.version,
      createdAt: e.createdAt.toISOString(),
    })),
    statusChanges: statusChanges.map((s) => ({
      id: s.id,
      actor: toPublicUser(s.actor),
      previousStatus: s.previousStatus,
      newStatus: s.newStatus,
      reason: s.reason,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Creating and editing
// ---------------------------------------------------------------------------

async function assertCategory(categoryId: string | null, db: Db = prisma) {
  if (!categoryId) return;
  const category = await db.jobCategory.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      fields: { categoryId: 'Select a valid category' },
    });
  }
}

const makeSlug = (input: { title: string; companyName: string }) =>
  [slugify(input.title, 50), slugify(input.companyName, 30), shortId()].filter(Boolean).join('-');

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export async function createJob(input: JobInputParsed, actor: User, submissionKey: string | undefined, meta: RequestMeta) {
  await assertCategory(input.categoryId);
  // Scoped per user so one member's key can never collide with or reveal another's job.
  const key = submissionKey ? `${actor.id}:${submissionKey}` : null;
  const findExisting = async () => (key ? prisma.job.findUnique({ where: { submissionKey: key }, include: jobInclude }) : null);

  const existing = await findExisting();
  if (existing) return { job: await serializeDetail(existing, actor.id), created: false };

  const data = toJobData(input);
  for (let attempt = 0; attempt < 3; attempt++) {
    let job: JobWithRelations;
    try {
      job = await prisma.$transaction(async (tx) => {
        const created = await tx.job.create({
          data: { ...data, slug: makeSlug(input), status: 'ACTIVE', createdById: actor.id, submissionKey: key },
          include: jobInclude,
        });
        const snapshot = snapshotJob(created);
        await tx.jobEditHistory.create({
          data: {
            jobId: created.id,
            actorId: actor.id,
            action: 'CREATED',
            changedFields: JOB_EDITABLE_FIELDS.filter((f) => snapshot[f] !== null && JSON.stringify(snapshot[f]) !== '[]'),
            previousValues: Prisma.DbNull,
            newValues: json(snapshot),
            version: created.version,
          },
        });
        await tx.jobStatusHistory.create({
          data: { jobId: created.id, actorId: actor.id, previousStatus: null, newStatus: 'ACTIVE', reason: 'Job posted' },
        });
        await audit({ actorId: actor.id, action: 'JOB_CREATED', targetType: 'Job', targetId: created.id }, meta, tx);
        return created;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Either a double-submitted request (same key) won the race, or a slug collided: retry.
      const raced = await findExisting();
      if (raced) return { job: await serializeDetail(raced, actor.id), created: false };
      continue;
    }
    return { job: await serializeDetail(job, actor.id), created: true };
  }
  throw new Error('Could not allocate a unique job URL');
}

function versionConflict(current: { version: number; updatedAt: Date }) {
  return conflict(
    'Someone else updated this job while you were editing. Review the latest version and apply your changes again.',
    'VERSION_CONFLICT',
    { currentVersion: current.version, updatedAt: current.updatedAt.toISOString() },
  );
}

/** Loads the job row for modification inside a transaction. Archived jobs are editable only by admins. */
async function lockableJob(tx: Tx, id: string, actor: User) {
  const job = await tx.job.findUnique({ where: { id } });
  if (!job || (job.archivedAt && !isAdmin(actor))) throw notFound('Job');
  return job;
}

interface ApplyEditOptions {
  action: 'UPDATED' | 'REVERTED';
  expectedVersion: number;
  next: JobSnapshot;
  nextData: ReturnType<typeof toJobData>;
  status?: JobStatus;
  reason: string | null;
}

/**
 * Applies an edit with optimistic locking. The UPDATE only matches the version the editor started
 * from, so a concurrent writer causes a 409 instead of a silent overwrite. History, status history
 * and notifications are written in the same transaction.
 */
async function applyEdit(tx: Tx, current: Job, actor: User, opts: ApplyEditOptions) {
  const id = current.id;
  if (current.version !== opts.expectedVersion) throw versionConflict(current);

  const diff = diffSnapshots(snapshotJob(current), opts.next);
  const statusChanged = opts.status !== undefined && opts.status !== current.status;
  if (diff.changedFields.length === 0 && !statusChanged) return { changed: false as const, slug: current.slug };

  const now = new Date();
  const result = await tx.job.updateMany({
    where: { id, version: opts.expectedVersion },
    data: {
      ...opts.nextData,
      version: { increment: 1 },
      lastEditedById: actor.id,
      ...(statusChanged
        ? { status: opts.status, statusChangedAt: now, ...(opts.status === 'ACTIVE' ? { statusConfirmedAt: now } : {}) }
        : {}),
    },
  });
  if (result.count === 0) throw versionConflict(await tx.job.findUniqueOrThrow({ where: { id } }));

  const newVersion = opts.expectedVersion + 1;
  await tx.jobEditHistory.create({
    data: {
      jobId: id,
      actorId: actor.id,
      action: opts.action,
      changedFields: [...diff.changedFields, ...(statusChanged ? ['status'] : [])],
      previousValues: json({ ...diff.previousValues, ...(statusChanged ? { status: current.status } : {}) }),
      newValues: json({ ...diff.newValues, ...(statusChanged ? { status: opts.status } : {}) }),
      reason: opts.reason,
      version: newVersion,
    },
  });
  if (statusChanged) {
    await tx.jobStatusHistory.create({
      data: { jobId: id, actorId: actor.id, previousStatus: current.status, newStatus: opts.status!, reason: opts.reason },
    });
  }

  const settings = await getSettings();
  if (settings.notifyCreatorOnEdit && diff.changedFields.length > 0) {
    await notifyUsers(
      [current.createdById],
      {
        type: 'JOB_EDITED',
        title: 'Your job post was updated',
        body: `${actor.name} updated "${current.title}" (${diff.changedFields.length} field${diff.changedFields.length === 1 ? '' : 's'} changed).`,
        link: jobLink(current.slug),
      },
      { exclude: actor.id, db: tx },
    );
  }
  if (statusChanged) await notifyStatusChange(tx, current, opts.status!, actor, settings.notifySaversOnStatusChange);
  return { changed: true as const, slug: current.slug, changedFields: diff.changedFields, statusChanged, newVersion };
}

export async function updateJob(
  id: string,
  input: JobUpdateParsed,
  actor: User,
  meta: RequestMeta,
): Promise<{ job: JobDetail; changed: boolean }> {
  const { version, reason, status, ...fields } = input;
  const result = await prisma.$transaction(async (tx) => {
    const current = await lockableJob(tx, id, actor);
    if (fields.categoryId !== current.categoryId) await assertCategory(fields.categoryId, tx);
    const outcome = await applyEdit(tx, current, actor, {
      action: 'UPDATED',
      expectedVersion: version,
      next: snapshotInput(fields),
      nextData: toJobData(fields),
      status,
      reason,
    });
    if (outcome.changed) {
      await audit(
        {
          actorId: actor.id,
          action: 'JOB_UPDATED',
          targetType: 'Job',
          targetId: id,
          metadata: { fields: outcome.changedFields, version: outcome.newVersion },
        },
        meta,
        tx,
      );
    }
    return outcome;
  });
  const job = await prisma.job.findUniqueOrThrow({ where: { id }, include: jobInclude });
  return { job: await serializeDetail(job, actor.id), changed: result.changed };
}

async function notifyStatusChange(
  tx: Tx,
  job: { id: string; title: string; slug: string; createdById: string },
  status: JobStatus,
  actor: User,
  notifySavers: boolean,
) {
  const savers = notifySavers ? await tx.savedJob.findMany({ where: { jobId: job.id }, select: { userId: true } }) : [];
  const closed = status === 'CLOSED';
  await notifyUsers(
    [job.createdById, ...savers.map((s) => s.userId)],
    {
      type: closed ? 'JOB_CLOSED' : 'JOB_REOPENED',
      title: closed ? 'A job you follow was closed' : 'A job you follow was reopened',
      body: `${actor.name} marked "${job.title}" as ${closed ? 'closed' : 'active again'}.`,
      link: jobLink(job.slug),
    },
    { exclude: actor.id, db: tx },
  );
}

// ---------------------------------------------------------------------------
// Status management
// ---------------------------------------------------------------------------

export async function changeStatus(id: string, target: JobStatus, reason: string | null, actor: User, meta: RequestMeta) {
  await prisma.$transaction((tx) => changeStatusTx(tx, id, target, reason, actor, meta));
  return getJob(id, actor);
}

/** Closes or reopens a job inside an existing transaction (also used by report resolution). */
export async function changeStatusTx(tx: Tx, id: string, target: JobStatus, reason: string | null, actor: User, meta: RequestMeta) {
  const current = await lockableJob(tx, id, actor);
  if (current.status === target) {
    throw conflict(
      target === 'CLOSED' ? 'This job is already closed.' : 'This job is already active.',
      target === 'CLOSED' ? 'ALREADY_CLOSED' : 'ALREADY_ACTIVE',
    );
  }
  const now = new Date();
  const result = await tx.job.updateMany({
    where: { id, version: current.version, status: current.status },
    data: {
      status: target,
      statusChangedAt: now,
      ...(target === 'ACTIVE' ? { statusConfirmedAt: now } : {}),
      lastEditedById: actor.id,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) throw conflict('This job changed a moment ago. Refresh and try again.', 'VERSION_CONFLICT');

  await tx.jobStatusHistory.create({ data: { jobId: id, actorId: actor.id, previousStatus: current.status, newStatus: target, reason } });
  await tx.jobEditHistory.create({
    data: {
      jobId: id,
      actorId: actor.id,
      action: target === 'CLOSED' ? 'CLOSED' : 'REOPENED',
      changedFields: ['status'],
      previousValues: json({ status: current.status }),
      newValues: json({ status: target }),
      reason,
      version: current.version + 1,
    },
  });
  await audit(
    { actorId: actor.id, action: target === 'CLOSED' ? 'JOB_CLOSED' : 'JOB_REOPENED', targetType: 'Job', targetId: id },
    meta,
    tx,
  );
  const settings = await getSettings();
  await notifyStatusChange(tx, current, target, actor, settings.notifySaversOnStatusChange);
}

/** A member confirms an active job is still open (e.g. after a deadline-passed or stale notice). */
export async function confirmActive(id: string, reason: string | null, actor: User, meta: RequestMeta) {
  await prisma.$transaction(async (tx) => {
    const current = await lockableJob(tx, id, actor);
    if (current.status !== 'ACTIVE') throw conflict('Only active jobs can be confirmed. Reopen the job instead.', 'NOT_ACTIVE');
    // Does not bump the version: no editable field changes, so concurrent editors are not disturbed.
    await tx.job.update({ where: { id }, data: { statusConfirmedAt: new Date() } });
    await tx.jobEditHistory.create({
      data: {
        jobId: id,
        actorId: actor.id,
        action: 'CONFIRMED_ACTIVE',
        changedFields: [],
        previousValues: Prisma.DbNull,
        newValues: Prisma.DbNull,
        reason,
        version: current.version,
      },
    });
    await audit({ actorId: actor.id, action: 'JOB_CONFIRMED_ACTIVE', targetType: 'Job', targetId: id }, meta, tx);
  });
  return getJob(id, actor);
}

// ---------------------------------------------------------------------------
// Administration: archive, restore and revert (all audited, none erase history)
// ---------------------------------------------------------------------------

export async function archiveJob(id: string, reason: string, actor: User, meta: RequestMeta) {
  await prisma.$transaction((tx) => archiveJobTx(tx, id, reason, actor, meta));
  return getJob(id, actor);
}

export async function archiveJobTx(tx: Tx, id: string, reason: string, actor: User, meta: RequestMeta) {
  const current = await tx.job.findUnique({ where: { id } });
  if (!current) throw notFound('Job');
  if (current.archivedAt) throw conflict('This job is already archived.', 'ALREADY_ARCHIVED');
  await tx.job.update({
    where: { id },
    data: { archivedAt: new Date(), archivedById: actor.id, archiveReason: reason, version: { increment: 1 } },
  });
  await tx.jobEditHistory.create({
    data: {
      jobId: id,
      actorId: actor.id,
      action: 'ARCHIVED',
      changedFields: ['archived'],
      previousValues: json({ archived: false }),
      newValues: json({ archived: true }),
      reason,
      version: current.version + 1,
    },
  });
  await audit(
    { actorId: actor.id, action: 'JOB_ARCHIVED', targetType: 'Job', targetId: id, metadata: { reason, title: current.title } },
    meta,
    tx,
  );
  await notifyUsers(
    [current.createdById],
    {
      type: 'JOB_ARCHIVED',
      title: 'Your job post was removed',
      body: `An administrator archived "${current.title}". Reason: ${reason}`,
      link: null,
    },
    { exclude: actor.id, db: tx },
  );
}

export async function restoreJob(id: string, reason: string | null, actor: User, meta: RequestMeta) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.job.findUnique({ where: { id } });
    if (!current) throw notFound('Job');
    if (!current.archivedAt) throw conflict('This job is not archived.', 'NOT_ARCHIVED');
    await tx.job.update({
      where: { id },
      data: { archivedAt: null, archivedById: null, archiveReason: null, version: { increment: 1 } },
    });
    await tx.jobEditHistory.create({
      data: {
        jobId: id,
        actorId: actor.id,
        action: 'RESTORED',
        changedFields: ['archived'],
        previousValues: json({ archived: true, archiveReason: current.archiveReason }),
        newValues: json({ archived: false }),
        reason,
        version: current.version + 1,
      },
    });
    await audit({ actorId: actor.id, action: 'JOB_RESTORED', targetType: 'Job', targetId: id, metadata: { reason } }, meta, tx);
  });
  return getJob(id, actor);
}

/** Re-applies the "previous values" of an earlier edit as a new, audited edit. */
export async function revertJob(id: string, historyId: string, version: number, reason: string, actor: User, meta: RequestMeta) {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.jobEditHistory.findUnique({ where: { id: historyId } });
    if (!entry || entry.jobId !== id) throw notFound('History entry');
    if (!['UPDATED', 'REVERTED'].includes(entry.action) || !entry.previousValues) {
      throw badRequest('Only edits with recorded previous values can be restored.', 'NOT_REVERTIBLE');
    }
    const current = await lockableJob(tx, id, actor);
    const previous = entry.previousValues as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...snapshotJob(current) };
    for (const field of JOB_EDITABLE_FIELDS) if (field in previous) merged[field] = previous[field];

    const parsed = jobInputSchema.safeParse(merged);
    if (!parsed.success) {
      throw badRequest(
        `These values cannot be restored because they conflict with the current job: ${parsed.error.issues[0]?.message ?? 'invalid data'}.`,
        'NOT_REVERTIBLE',
      );
    }
    if (parsed.data.categoryId !== current.categoryId) await assertCategory(parsed.data.categoryId, tx);
    const status = typeof previous.status === 'string' ? (previous.status as JobStatus) : undefined;
    const outcome = await applyEdit(tx, current, actor, {
      action: 'REVERTED',
      expectedVersion: version,
      next: snapshotInput(parsed.data),
      nextData: toJobData(parsed.data),
      status,
      reason,
    });
    if (!outcome.changed) throw badRequest('The job already has these values.', 'NO_CHANGES');
    await audit(
      {
        actorId: actor.id,
        action: 'JOB_REVERTED',
        targetType: 'Job',
        targetId: id,
        metadata: { historyId, fields: outcome.changedFields },
      },
      meta,
      tx,
    );
  });
  return getJob(id, actor);
}

// ---------------------------------------------------------------------------
// Reports, saved jobs, suggestions
// ---------------------------------------------------------------------------

export async function reportJob(id: string, input: { reason: ReportReason; description: string | null }, actor: User, meta: RequestMeta) {
  const job = await findVisibleJob(id, actor);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.jobReport.findFirst({
      where: { jobId: job.id, reporterId: actor.id, status: { in: ['OPEN', 'ESCALATED'] } },
    });
    if (existing) throw conflict('You already reported this job. An administrator will review it soon.', 'ALREADY_REPORTED');
    const report = await tx.jobReport.create({
      data: { jobId: job.id, reporterId: actor.id, reason: input.reason, description: input.description },
    });
    await audit(
      {
        actorId: actor.id,
        action: 'JOB_REPORTED',
        targetType: 'JobReport',
        targetId: report.id,
        metadata: { jobId: job.id, reason: input.reason },
      },
      meta,
      tx,
    );
    return { id: report.id, status: report.status };
  });
}

export async function setSaved(idOrSlug: string, user: User, saved: boolean) {
  const job = await findVisibleJob(idOrSlug, user);
  if (saved) {
    await prisma.savedJob.upsert({
      where: { userId_jobId: { userId: user.id, jobId: job.id } },
      create: { userId: user.id, jobId: job.id },
      update: {},
    });
  } else {
    await prisma.savedJob.deleteMany({ where: { userId: user.id, jobId: job.id } });
  }
  return { saved };
}

export async function findDuplicates(input: { title: string; companyName: string; excludeJobId?: string }): Promise<DuplicateCandidate[]> {
  const exclude = input.excludeJobId ?? null;
  const rows = await prisma.$queryRaw<
    { id: string; slug: string; title: string; companyName: string; location: string | null; status: JobStatus; createdAt: Date }[]
  >`
    SELECT id, slug, title, "companyName", location, status, "createdAt"
    FROM jobs
    WHERE "archivedAt" IS NULL
      AND (lower("companyName") = lower(${input.companyName}) OR similarity(lower("companyName"), lower(${input.companyName})) > 0.6)
      AND similarity(lower(title), lower(${input.title})) > 0.45
      AND (${exclude}::uuid IS NULL OR id <> ${exclude}::uuid)
    ORDER BY similarity(lower(title), lower(${input.title})) DESC, "createdAt" DESC
    LIMIT 5`;
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function suggestSkills(q: string): Promise<string[]> {
  const pattern = `${escapeLike(q.trim().toLowerCase())}%`;
  const rows = await prisma.$queryRaw<{ skill: string }[]>`
    SELECT min(skill) AS skill
    FROM (SELECT unnest("requiredSkills" || "preferredSkills") AS skill FROM jobs WHERE "archivedAt" IS NULL) s
    WHERE lower(skill) LIKE ${pattern}
    GROUP BY lower(skill)
    ORDER BY count(*) DESC, lower(skill)
    LIMIT 15`;
  return rows.map((r) => r.skill);
}

export async function suggestCompanies(q: string): Promise<string[]> {
  const pattern = `${escapeLike(q.trim().toLowerCase())}%`;
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT min("companyName") AS name
    FROM jobs
    WHERE "archivedAt" IS NULL AND lower("companyName") LIKE ${pattern}
    GROUP BY lower("companyName")
    ORDER BY count(*) DESC, lower("companyName")
    LIMIT 10`;
  return rows.map((r) => r.name);
}
