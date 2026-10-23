import {
  OPEN_REFERRAL_STATUSES,
  REFERRAL_TRANSITIONS,
  type ReferralList,
  type ReferralListQuery,
  type ReferralRequestItem,
  type ReferralResponse,
  type ReferralStatus,
} from '@referloop/shared';
import type { User } from '../../generated/prisma/client.js';
import { emails } from '../../lib/email.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { prisma, type Db, type Prisma, type Tx } from '../../lib/prisma.js';
import { paginate } from '../../lib/validate.js';
import { audit, type RequestMeta } from '../audit/audit.service.js';
import { notifyUsers } from '../notifications/notifications.service.js';
import { toPublicUser } from '../users/users.serializer.js';

const RECEIVED_LINK = '/referrals?box=received';
const SENT_LINK = '/referrals?box=sent';

/** A new request is blocked while an earlier one is open or decided; only a withdrawn one can be re-sent. */
const BLOCKING_STATUSES: ReferralStatus[] = ['PENDING', 'ACCEPTED', 'REFERRED', 'DECLINED'];

const OUTCOME_TEXT: Record<ReferralResponse, string> = {
  ACCEPTED: 'accepted your referral request',
  REFERRED: 'has referred you',
  DECLINED: 'declined your referral request',
};

const referralInclude = {
  job: { select: { id: true, slug: true, title: true, companyName: true, status: true, archivedAt: true } },
  requester: { select: { id: true, name: true, email: true } },
  referrer: { select: { id: true, name: true } },
} satisfies Prisma.ReferralRequestInclude;

type ReferralWithRelations = Prisma.ReferralRequestGetPayload<{ include: typeof referralInclude }>;

export function toReferralItem(r: ReferralWithRelations, viewerId: string): ReferralRequestItem {
  return {
    id: r.id,
    status: r.status,
    message: r.message,
    profileUrl: r.profileUrl,
    responseNote: r.responseNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
    job: { ...r.job, archivedAt: r.job.archivedAt?.toISOString() ?? null },
    // The requester consented to share their email with this referrer when sending the request.
    requester: { ...toPublicUser(r.requester), email: r.referrerId === viewerId ? r.requester.email : null },
    referrer: toPublicUser(r.referrer),
  };
}

/** The viewer's latest request for a job, shown on the job page. */
export async function viewerReferralFor(jobId: string, viewerId: string | null | undefined, db: Db = prisma) {
  if (!viewerId) return null;
  return db.referralRequest.findFirst({
    where: { jobId, requesterId: viewerId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });
}

export async function requestReferral(
  jobId: string,
  input: { message: string; profileUrl: string | null },
  actor: User,
  meta: RequestMeta,
): Promise<ReferralRequestItem> {
  const { item, referrerEmail } = await prisma.$transaction(async (tx) => {
    // Serialises concurrent submissions from the same member for the same job (double clicks, retries).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`referral:${actor.id}:${jobId}`}))`;

    const job = await tx.job.findUnique({ where: { id: jobId }, include: { createdBy: true } });
    if (!job || job.archivedAt) throw notFound('Job');
    if (job.createdById === actor.id) throw badRequest('You cannot request a referral for a job you posted.', 'OWN_JOB');
    if (!job.referralAvailable || !job.posterCanRefer) {
      throw badRequest('The poster has not offered to refer applicants for this job.', 'REFERRAL_NOT_OFFERED');
    }
    if (job.status !== 'ACTIVE') throw conflict('This job is closed, so referral requests are no longer accepted.', 'JOB_CLOSED');
    const referrer = job.createdBy;
    if (referrer.accountStatus !== 'ACTIVE') {
      throw conflict('The poster of this job is not accepting referral requests right now.', 'REFERRER_UNAVAILABLE');
    }

    const existing = await tx.referralRequest.findFirst({
      where: { jobId, requesterId: actor.id, status: { in: BLOCKING_STATUSES } },
      select: { id: true },
    });
    if (existing) throw conflict('You have already requested a referral for this job.', 'ALREADY_REQUESTED');

    const created = await tx.referralRequest.create({
      data: { jobId, requesterId: actor.id, referrerId: referrer.id, message: input.message, profileUrl: input.profileUrl },
      include: referralInclude,
    });
    await notifyUsers(
      [referrer.id],
      {
        type: 'REFERRAL_REQUESTED',
        title: 'New referral request',
        body: `${actor.name} asked you for a referral for "${job.title}".`,
        link: RECEIVED_LINK,
      },
      { db: tx },
    );
    await audit(
      { actorId: actor.id, action: 'REFERRAL_REQUESTED', targetType: 'ReferralRequest', targetId: created.id, metadata: { jobId } },
      meta,
      tx,
    );
    return { item: toReferralItem(created, actor.id), referrerEmail: referrer.email };
  });
  // Sent only after the transaction commits, so a rolled-back request never produces an email.
  emails.referralRequested(referrerEmail, actor.name, item.job.title, item.message);
  return item;
}

export async function listReferrals(user: User, query: ReferralListQuery): Promise<ReferralList> {
  const where: Prisma.ReferralRequestWhereInput = {
    ...(query.box === 'received' ? { referrerId: user.id } : { requesterId: user.id }),
    ...(query.status ? { status: query.status } : {}),
  };
  const [total, rows, pendingReceived] = await Promise.all([
    prisma.referralRequest.count({ where }),
    prisma.referralRequest.findMany({
      where,
      include: referralInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...paginate(query.page, query.pageSize),
    }),
    prisma.referralRequest.count({ where: { referrerId: user.id, status: 'PENDING' } }),
  ]);
  return {
    items: rows.map((r) => toReferralItem(r, user.id)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    pendingReceived,
  };
}

/**
 * Moves a request to a new status, guarding against a concurrent change: the UPDATE only matches the
 * status the actor saw, so two quick responses (or a response racing a withdrawal) cannot both win.
 */
async function transition(tx: Tx, current: { id: string; status: ReferralStatus }, data: Prisma.ReferralRequestUpdateManyMutationInput) {
  const result = await tx.referralRequest.updateMany({ where: { id: current.id, status: current.status }, data });
  if (result.count === 0) throw conflict('This request changed a moment ago. Refresh and try again.', 'REFERRAL_CHANGED');
  return tx.referralRequest.findUniqueOrThrow({ where: { id: current.id }, include: referralInclude });
}

export async function respondToReferral(
  id: string,
  input: { status: ReferralResponse; note: string | null },
  actor: User,
  meta: RequestMeta,
): Promise<ReferralRequestItem> {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.referralRequest.findUnique({ where: { id } });
    // Other members' requests are indistinguishable from missing ones.
    if (!current || current.referrerId !== actor.id) throw notFound('Referral request');
    if (!REFERRAL_TRANSITIONS[current.status].includes(input.status)) {
      throw conflict(`This request is already ${current.status.toLowerCase()} and cannot be changed that way.`, 'INVALID_TRANSITION');
    }
    const row = await transition(tx, current, {
      status: input.status,
      responseNote: input.note ?? current.responseNote,
      respondedAt: new Date(),
    });
    await notifyUsers(
      [current.requesterId],
      {
        type: 'REFERRAL_UPDATED',
        title: input.status === 'DECLINED' ? 'Referral request declined' : 'Good news on your referral request',
        body: `${actor.name} ${OUTCOME_TEXT[input.status]} for "${row.job.title}".`,
        link: SENT_LINK,
      },
      { db: tx },
    );
    await audit(
      {
        actorId: actor.id,
        action: `REFERRAL_${input.status}`,
        targetType: 'ReferralRequest',
        targetId: id,
        metadata: { jobId: current.jobId, from: current.status },
      },
      meta,
      tx,
    );
    return row;
  });
  emails.referralUpdated(updated.requester.email, actor.name, updated.job.title, OUTCOME_TEXT[input.status], input.note);
  return toReferralItem(updated, actor.id);
}

export async function withdrawReferral(id: string, actor: User, meta: RequestMeta): Promise<ReferralRequestItem> {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.referralRequest.findUnique({ where: { id } });
    if (!current || current.requesterId !== actor.id) throw notFound('Referral request');
    if (!(OPEN_REFERRAL_STATUSES as readonly ReferralStatus[]).includes(current.status)) {
      throw conflict('Only requests that are still awaiting the referrer can be withdrawn.', 'INVALID_TRANSITION');
    }
    const row = await transition(tx, current, { status: 'WITHDRAWN' });
    await notifyUsers(
      [current.referrerId],
      {
        type: 'REFERRAL_UPDATED',
        title: 'Referral request withdrawn',
        body: `${actor.name} withdrew their referral request for "${row.job.title}".`,
        link: RECEIVED_LINK,
      },
      { db: tx },
    );
    await audit(
      { actorId: actor.id, action: 'REFERRAL_WITHDRAWN', targetType: 'ReferralRequest', targetId: id, metadata: { jobId: current.jobId } },
      meta,
      tx,
    );
    return row;
  });
  return toReferralItem(updated, actor.id);
}
