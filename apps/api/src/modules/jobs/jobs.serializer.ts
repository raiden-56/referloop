import type { JobDetail, JobFreshness, JobSummary } from '@referloop/shared';
import type { Job } from '../../generated/prisma/client.js';
import type { Prisma } from '../../lib/prisma.js';
import { publicUserSelect, toPublicUser } from '../users/users.serializer.js';

export const jobInclude = {
  category: { select: { id: true, name: true, slug: true } },
  createdBy: publicUserSelect,
  lastEditedBy: publicUserSelect,
} satisfies Prisma.JobInclude;

export type JobWithRelations = Prisma.JobGetPayload<{ include: typeof jobInclude }>;

export interface SerializeContext {
  savedJobIds?: Set<string>;
  staleAfterDays: number;
  now?: Date;
}

export const toDateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function computeFreshness(
  job: Pick<Job, 'status' | 'applicationDeadline' | 'updatedAt' | 'statusConfirmedAt' | 'statusChangedAt'>,
  staleAfterDays: number,
  now = new Date(),
): JobFreshness {
  if (job.status !== 'ACTIVE') return { deadlinePassed: false, stale: false };
  const today = now.toISOString().slice(0, 10);
  const deadline = toDateOnly(job.applicationDeadline);
  const lastTouched = Math.max(job.updatedAt.getTime(), job.statusChangedAt.getTime(), job.statusConfirmedAt?.getTime() ?? 0);
  return {
    deadlinePassed: deadline !== null && deadline < today,
    stale: now.getTime() - lastTouched > staleAfterDays * 24 * 60 * 60 * 1000,
  };
}

export function toJobSummary(job: JobWithRelations, ctx: SerializeContext): JobSummary {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    companyName: job.companyName,
    category: job.category,
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    requiredSkills: job.requiredSkills,
    summary: job.summary,
    status: job.status,
    referralAvailable: job.referralAvailable,
    applicationDeadline: toDateOnly(job.applicationDeadline),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    statusChangedAt: job.statusChangedAt.toISOString(),
    createdBy: toPublicUser(job.createdBy),
    lastEditedBy: job.lastEditedBy ? toPublicUser(job.lastEditedBy) : null,
    version: job.version,
    isSaved: ctx.savedJobIds?.has(job.id) ?? false,
    freshness: computeFreshness(job, ctx.staleAfterDays, ctx.now),
    archivedAt: job.archivedAt?.toISOString() ?? null,
  };
}

export function toJobDetail(
  job: JobWithRelations,
  ctx: SerializeContext & { editorCount: number; viewerReferral?: JobDetail['viewerReferral'] },
): JobDetail {
  return {
    ...toJobSummary(job, ctx),
    categoryId: job.categoryId,
    department: job.department,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency as JobDetail['salaryCurrency'],
    numberOfOpenings: job.numberOfOpenings,
    description: job.description,
    responsibilities: job.responsibilities,
    preferredSkills: job.preferredSkills,
    eligibility: job.eligibility,
    posterCanRefer: job.posterCanRefer,
    referralInstructions: job.referralInstructions,
    applicationUrl: job.applicationUrl,
    recruiterUrl: job.recruiterUrl,
    applicantNotes: job.applicantNotes,
    statusConfirmedAt: job.statusConfirmedAt?.toISOString() ?? null,
    editorCount: ctx.editorCount,
    viewerReferral: ctx.viewerReferral ?? null,
  };
}
