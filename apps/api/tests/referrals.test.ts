import { describe, expect, it } from 'vitest';
import type { JobDetail, ReferralList, ReferralRequestItem } from '@referloop/shared';
import { sentEmails } from '../src/lib/email.js';
import { prisma } from '../src/lib/prisma.js';
import { loggedInUser, postJob, type Client } from './helpers.js';

const MESSAGE = 'I have five years of React and TypeScript experience and would love to be considered for this role.';

function request(api: Client, jobId: string, body: object = { message: MESSAGE }) {
  return api.post(`/api/v1/jobs/${jobId}/referral-requests`, body);
}

async function setup() {
  const poster = await loggedInUser({ name: 'Poster Person' });
  const seeker = await loggedInUser({ name: 'Seeker Person' });
  const job = await postJob(poster.api);
  return { poster, seeker, job };
}

describe('requesting a referral', () => {
  it('creates a pending request, notifies and emails the poster, and shows it on the job', async () => {
    const { poster, seeker, job } = await setup();
    const res = await request(seeker.api, job.id, { message: MESSAGE, profileUrl: 'https://linkedin.com/in/seeker' }).expect(201);
    const referral = res.body.referral as ReferralRequestItem;
    expect(referral).toMatchObject({
      status: 'PENDING',
      profileUrl: 'https://linkedin.com/in/seeker',
      requester: { id: seeker.user.id, name: 'Seeker Person', email: null },
      referrer: { id: poster.user.id, name: 'Poster Person' },
      job: { id: job.id, title: job.title },
    });
    expect(referral.referrer).not.toHaveProperty('email');

    const notes = await prisma.notification.findMany({ where: { userId: poster.user.id, type: 'REFERRAL_REQUESTED' } });
    expect(notes).toHaveLength(1);
    await expect.poll(() => sentEmails.filter((m) => m.to === poster.user.email && /referral/i.test(m.subject)).length).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'REFERRAL_REQUESTED', actorId: seeker.user.id } })).toBe(1);

    const detail = await seeker.api.get(`/api/v1/jobs/${job.slug}`).expect(200);
    expect((detail.body.job as JobDetail).viewerReferral).toEqual({ id: referral.id, status: 'PENDING' });
    const posterView = await poster.api.get(`/api/v1/jobs/${job.slug}`).expect(200);
    expect((posterView.body.job as JobDetail).viewerReferral).toBeNull();
  });

  it('shares the requester email with the referrer only', async () => {
    const { poster, seeker, job } = await setup();
    await request(seeker.api, job.id).expect(201);

    const received = (await poster.api.get('/api/v1/referrals?box=received').expect(200)).body as ReferralList;
    expect(received.total).toBe(1);
    expect(received.pendingReceived).toBe(1);
    expect(received.items[0]!.requester.email).toBe(seeker.user.email);

    const sent = (await seeker.api.get('/api/v1/referrals?box=sent').expect(200)).body as ReferralList;
    expect(sent.items[0]!.requester.email).toBeNull();

    const outsider = await loggedInUser();
    const none = (await outsider.api.get('/api/v1/referrals?box=received').expect(200)).body as ReferralList;
    expect(none.total).toBe(0);
  });

  it('rejects duplicates, own jobs, closed jobs and jobs without a personal referral offer', async () => {
    const { poster, seeker, job } = await setup();
    await request(seeker.api, job.id).expect(201);
    expect((await request(seeker.api, job.id).expect(409)).body.error.code).toBe('ALREADY_REQUESTED');
    expect((await request(poster.api, job.id).expect(400)).body.error.code).toBe('OWN_JOB');

    const noOffer = await postJob(poster.api, { posterCanRefer: false, title: 'Data Engineer' });
    expect((await request(seeker.api, noOffer.id).expect(400)).body.error.code).toBe('REFERRAL_NOT_OFFERED');

    const closed = await postJob(poster.api, { title: 'Platform Engineer' });
    await poster.api.post(`/api/v1/jobs/${closed.id}/close`, { reason: 'Filled' }).expect(200);
    expect((await request(seeker.api, closed.id).expect(409)).body.error.code).toBe('JOB_CLOSED');
  });

  it('allows only one request under concurrent submissions', async () => {
    const { seeker, job } = await setup();
    const results = await Promise.all([request(seeker.api, job.id), request(seeker.api, job.id), request(seeker.api, job.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.referralRequest.count({ where: { jobId: job.id } })).toBe(1);
  });

  it('validates the message and profile link, and requires a verified account', async () => {
    const { seeker, job } = await setup();
    const res = await request(seeker.api, job.id, { message: 'hi', profileUrl: 'javascript:alert(1)' }).expect(400);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['message', 'profileUrl']));

    const unverified = await loggedInUser({ verified: false });
    expect((await request(unverified.api, job.id).expect(403)).body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('refuses requests when the poster is suspended', async () => {
    const { poster, seeker, job } = await setup();
    await prisma.user.update({ where: { id: poster.user.id }, data: { accountStatus: 'SUSPENDED' } });
    expect((await request(seeker.api, job.id).expect(409)).body.error.code).toBe('REFERRER_UNAVAILABLE');
  });
});

describe('responding to referral requests', () => {
  async function pending() {
    const ctx = await setup();
    const res = await request(ctx.seeker.api, ctx.job.id).expect(201);
    return { ...ctx, referral: res.body.referral as ReferralRequestItem };
  }

  it('lets the referrer accept and then mark as referred, notifying the requester each time', async () => {
    const { poster, seeker, referral } = await pending();
    const accepted = await poster.api
      .post(`/api/v1/referrals/${referral.id}/respond`, { status: 'ACCEPTED', note: 'Send me your resume on email' })
      .expect(200);
    expect(accepted.body.referral).toMatchObject({ status: 'ACCEPTED', responseNote: 'Send me your resume on email' });
    expect(accepted.body.referral.respondedAt).not.toBeNull();

    const referred = await poster.api.post(`/api/v1/referrals/${referral.id}/respond`, { status: 'REFERRED' }).expect(200);
    // An empty note keeps the earlier one instead of erasing it.
    expect(referred.body.referral).toMatchObject({ status: 'REFERRED', responseNote: 'Send me your resume on email' });

    expect(await prisma.notification.count({ where: { userId: seeker.user.id, type: 'REFERRAL_UPDATED' } })).toBe(2);
    await expect.poll(() => sentEmails.filter((m) => m.to === seeker.user.email && /Referral update/.test(m.subject)).length).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: { in: ['REFERRAL_ACCEPTED', 'REFERRAL_REFERRED'] } } })).toBe(2);

    // A finished request cannot be reopened or declined afterwards.
    const again = await poster.api.post(`/api/v1/referrals/${referral.id}/respond`, { status: 'DECLINED' }).expect(409);
    expect(again.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('hides requests from anyone other than the referrer', async () => {
    const { seeker, referral } = await pending();
    await seeker.api.post(`/api/v1/referrals/${referral.id}/respond`, { status: 'REFERRED' }).expect(404);
    const outsider = await loggedInUser();
    await outsider.api.post(`/api/v1/referrals/${referral.id}/respond`, { status: 'DECLINED' }).expect(404);
    await outsider.api.post(`/api/v1/referrals/${referral.id}/withdraw`).expect(404);
  });

  it('lets the requester withdraw an open request and send a new one later', async () => {
    const { poster, seeker, job, referral } = await pending();
    const res = await seeker.api.post(`/api/v1/referrals/${referral.id}/withdraw`).expect(200);
    expect(res.body.referral.status).toBe('WITHDRAWN');
    expect(await prisma.notification.count({ where: { userId: poster.user.id, type: 'REFERRAL_UPDATED' } })).toBe(1);

    const late = await poster.api.post(`/api/v1/referrals/${referral.id}/respond`, { status: 'ACCEPTED' }).expect(409);
    expect(late.body.error.code).toBe('INVALID_TRANSITION');
    await seeker.api.post(`/api/v1/referrals/${referral.id}/withdraw`).expect(409);

    await request(seeker.api, job.id).expect(201);
  });

  it('does not allow a new request after a decline', async () => {
    const { poster, seeker, job, referral } = await pending();
    await poster.api.post(`/api/v1/referrals/${referral.id}/respond`, { status: 'DECLINED' }).expect(200);
    expect((await request(seeker.api, job.id).expect(409)).body.error.code).toBe('ALREADY_REQUESTED');
  });

  it('filters by box and status and counts pending requests', async () => {
    const { poster, seeker, job, referral } = await pending();
    const other = await loggedInUser();
    await request(other.api, job.id).expect(201);
    await poster.api.post(`/api/v1/referrals/${referral.id}/respond`, { status: 'DECLINED' }).expect(200);

    const all = (await poster.api.get('/api/v1/referrals?box=received').expect(200)).body as ReferralList;
    expect(all.total).toBe(2);
    expect(all.pendingReceived).toBe(1);
    const declined = (await poster.api.get('/api/v1/referrals?box=received&status=DECLINED').expect(200)).body as ReferralList;
    expect(declined.items.map((r) => r.id)).toEqual([referral.id]);
    const sent = (await seeker.api.get('/api/v1/referrals?box=sent').expect(200)).body as ReferralList;
    expect(sent.items.map((r) => r.status)).toEqual(['DECLINED']);
  });
});
