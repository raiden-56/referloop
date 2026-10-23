import { describe, expect, it } from 'vitest';
import {
  buildShareMessage,
  buildWhatsAppUrl,
  type JobDetail,
  type JobHistoryResponse,
  type JobSummary,
  type Paginated,
} from '@referloop/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { client, loggedInUser, postJob, validJob } from './helpers.js';
import request from 'supertest';

const editBody = (job: JobDetail, changes: Record<string, unknown> = {}) => ({
  ...job,
  ...changes,
  version: job.version,
});

describe('posting jobs', () => {
  it('publishes an active job with creator, timestamps and a unique URL (acceptance 3)', async () => {
    const { user, api } = await loggedInUser();
    const res = await api.post('/api/v1/jobs', validJob()).expect(201);
    const job = res.body.job as JobDetail;
    expect(job).toMatchObject({ status: 'ACTIVE', version: 1, createdBy: { id: user.id, name: user.name }, lastEditedBy: null });
    expect(job.slug).toMatch(/^senior-software-engineer-example-company-[a-z0-9]{6}$/);
    expect(job.createdBy).not.toHaveProperty('email');

    const bySlug = await api.get(`/api/v1/jobs/${job.slug}`).expect(200);
    expect(bySlug.body.job.id).toBe(job.id);

    const history = await prisma.jobEditHistory.findMany({ where: { jobId: job.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ action: 'CREATED', actorId: user.id, version: 1 });
    expect(await prisma.jobStatusHistory.count({ where: { jobId: job.id, newStatus: 'ACTIVE' } })).toBe(1);
  });

  it('treats repeated submissions with the same idempotency key as one job', async () => {
    const { api } = await loggedInUser();
    const key = 'submit-key-12345';
    const [a, b] = await Promise.all([
      api.post('/api/v1/jobs', validJob()).set('Idempotency-Key', key),
      api.post('/api/v1/jobs', validJob()).set('Idempotency-Key', key),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.job.id).toBe(b.body.job.id);
    expect(await prisma.job.count()).toBe(1);
  });

  it('validates required fields, ranges and external links', async () => {
    const { api } = await loggedInUser();
    const res = await api
      .post(
        '/api/v1/jobs',
        validJob({ title: '', location: '', experienceMin: 9, experienceMax: 2, applicationUrl: 'javascript:alert(1)' }),
      )
      .expect(400);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['title', 'location', 'experienceMax', 'applicationUrl']));
  });

  it('stores markup as inert text', async () => {
    const { api } = await loggedInUser();
    const job = await postJob(api, { summary: '<img src=x onerror=alert(1)> great role here' });
    const res = await api.get(`/api/v1/jobs/${job.id}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.job.summary).toBe('<img src=x onerror=alert(1)> great role here');
  });

  it('warns about likely duplicates', async () => {
    const { api } = await loggedInUser();
    const job = await postJob(api, { title: 'Senior Software Engineer', companyName: 'Example Company' });
    const res = await api
      .post('/api/v1/jobs/duplicates', { title: 'Sr. Senior Software Engineer', companyName: 'example company' })
      .expect(200);
    expect(res.body.items.map((d: { id: string }) => d.id)).toContain(job.id);
    const none = await api.post('/api/v1/jobs/duplicates', { title: 'Office Manager', companyName: 'Example Company' }).expect(200);
    expect(none.body.items).toHaveLength(0);
  });
});

describe('collaborative editing', () => {
  it('lets another verified member edit, keeping the creator and recording the change (acceptance 4–6)', async () => {
    const { user: creator, api: creatorApi } = await loggedInUser({ name: 'Creator' });
    const { user: editor, api: editorApi } = await loggedInUser({ name: 'Editor' });
    const job = await postJob(creatorApi);

    const res = await editorApi
      .patch(
        `/api/v1/jobs/${job.id}`,
        editBody(job, { title: 'Staff Software Engineer', requiredSkills: ['React', 'Go'], reason: 'Level updated' }),
      )
      .expect(200);
    const updated = res.body.job as JobDetail;
    expect(updated).toMatchObject({
      title: 'Staff Software Engineer',
      version: 2,
      createdBy: { id: creator.id },
      lastEditedBy: { id: editor.id, name: 'Editor' },
    });

    const history = (await creatorApi.get(`/api/v1/jobs/${job.id}/history`).expect(200)).body as JobHistoryResponse;
    const edit = history.edits.find((e) => e.action === 'UPDATED')!;
    expect(edit.actor).toEqual({ id: editor.id, name: 'Editor' });
    expect(edit.changedFields.sort()).toEqual(['requiredSkills', 'title']);
    expect(edit.previousValues).toEqual({ title: 'Senior Software Engineer', requiredSkills: ['React', 'TypeScript', 'Node.js'] });
    expect(edit.newValues).toEqual({ title: 'Staff Software Engineer', requiredSkills: ['React', 'Go'] });
    expect(edit.reason).toBe('Level updated');
    expect(new Date(edit.createdAt).getTime()).toBeGreaterThan(0);

    // The creator is notified about edits by others.
    const notes = await creatorApi.get('/api/v1/notifications').expect(200);
    expect(notes.body.items[0]).toMatchObject({ type: 'JOB_EDITED' });
    expect(notes.body.unreadCount).toBe(1);
  });

  it('rejects stale versions instead of silently overwriting (acceptance 15)', async () => {
    const { api: a } = await loggedInUser();
    const { api: b } = await loggedInUser();
    const job = await postJob(a);

    await a.patch(`/api/v1/jobs/${job.id}`, editBody(job, { title: 'First Editor Title' })).expect(200);
    const conflict = await b.patch(`/api/v1/jobs/${job.id}`, editBody(job, { title: 'Second Editor Title' })).expect(409);
    expect(conflict.body.error).toMatchObject({ code: 'VERSION_CONFLICT', details: { currentVersion: 2 } });

    const current = (await a.get(`/api/v1/jobs/${job.id}`).expect(200)).body.job as JobDetail;
    expect(current.title).toBe('First Editor Title');
  });

  it('allows exactly one of two truly concurrent edits', async () => {
    const { api: a } = await loggedInUser();
    const { api: b } = await loggedInUser();
    const job = await postJob(a);
    const results = await Promise.all([
      a.patch(`/api/v1/jobs/${job.id}`, editBody(job, { title: 'Concurrent A' })),
      b.patch(`/api/v1/jobs/${job.id}`, editBody(job, { title: 'Concurrent B' })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.jobEditHistory.count({ where: { jobId: job.id, action: 'UPDATED' } })).toBe(1);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).version).toBe(2);
  });

  it('does not write history or bump the version when nothing changed', async () => {
    const { api } = await loggedInUser();
    const job = await postJob(api);
    const res = await api.patch(`/api/v1/jobs/${job.id}`, editBody(job)).expect(200);
    expect(res.body).toMatchObject({ changed: false, job: { version: 1 } });
    expect(await prisma.jobEditHistory.count({ where: { jobId: job.id } })).toBe(1);
  });

  it('rolls back the edit and its audit entries together when the update fails', async () => {
    const { api } = await loggedInUser();
    const job = await postJob(api);
    // Unknown category makes the transaction fail after validation.
    await api.patch(`/api/v1/jobs/${job.id}`, editBody(job, { categoryId: '00000000-0000-4000-8000-000000000000' })).expect(400);
    expect(await prisma.jobEditHistory.count({ where: { jobId: job.id } })).toBe(1);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).version).toBe(1);
  });
});

describe('status management', () => {
  it('closes and reopens with history, removing closed jobs from default results (acceptance 7–8)', async () => {
    const { api: creator } = await loggedInUser();
    const { user: other, api } = await loggedInUser();
    const job = await postJob(creator);

    const closed = await api.post(`/api/v1/jobs/${job.id}/close`, { reason: 'Hiring complete' }).expect(200);
    expect(closed.body.job).toMatchObject({ status: 'CLOSED', lastEditedBy: { id: other.id } });
    await api.post(`/api/v1/jobs/${job.id}/close`).expect(409);

    const active = (await api.get('/api/v1/jobs').expect(200)).body as Paginated<JobSummary>;
    expect(active.items.map((j) => j.id)).not.toContain(job.id);
    const closedList = (await api.get('/api/v1/jobs?status=closed').expect(200)).body as Paginated<JobSummary>;
    expect(closedList.items.map((j) => j.id)).toContain(job.id);
    // Closed jobs stay reachable directly.
    await api.get(`/api/v1/jobs/${job.slug}`).expect(200);

    await api.post(`/api/v1/jobs/${job.id}/reopen`, { reason: 'Role re-opened' }).expect(200);
    const history = (await api.get(`/api/v1/jobs/${job.id}/history`).expect(200)).body as JobHistoryResponse;
    expect(history.statusChanges.map((s) => [s.previousStatus, s.newStatus, s.reason])).toEqual([
      ['CLOSED', 'ACTIVE', 'Role re-opened'],
      ['ACTIVE', 'CLOSED', 'Hiring complete'],
      [null, 'ACTIVE', 'Job posted'],
    ]);
  });

  it('flags a passed deadline without closing the job, and records confirmations', async () => {
    const { api } = await loggedInUser();
    const job = await postJob(api, { applicationDeadline: '2020-01-31' });
    const fetched = (await api.get(`/api/v1/jobs/${job.id}`).expect(200)).body.job as JobDetail;
    expect(fetched.status).toBe('ACTIVE');
    expect(fetched.freshness.deadlinePassed).toBe(true);

    const confirmed = await api.post(`/api/v1/jobs/${job.id}/confirm-active`, { reason: 'Recruiter confirmed it is open' }).expect(200);
    expect(confirmed.body.job.statusConfirmedAt).not.toBeNull();
    expect(await prisma.jobEditHistory.count({ where: { jobId: job.id, action: 'CONFIRMED_ACTIVE' } })).toBe(1);
  });

  it('notifies members who saved a job when it closes', async () => {
    const { api: creator } = await loggedInUser();
    const { api: saver } = await loggedInUser();
    const job = await postJob(creator);
    await saver.put(`/api/v1/jobs/${job.id}/save`).expect(200);
    await creator.post(`/api/v1/jobs/${job.id}/close`).expect(200);
    const notes = (await saver.get('/api/v1/notifications').expect(200)).body;
    expect(notes.items[0]).toMatchObject({ type: 'JOB_CLOSED', link: `/jobs/${job.slug}` });
    const saved = (await saver.get('/api/v1/users/me/saved-jobs').expect(200)).body;
    expect(saved.items[0]).toMatchObject({ id: job.id, status: 'CLOSED', isSaved: true });
  });
});

describe('search and filtering (acceptance 9)', () => {
  async function seedBoard() {
    const { api } = await loggedInUser();
    const react = await postJob(api, {
      title: 'Frontend Engineer',
      companyName: 'Northwind',
      requiredSkills: ['React', 'TypeScript'],
      experienceMin: 2,
      experienceMax: 4,
      workMode: 'REMOTE',
      location: null,
    });
    const go = await postJob(api, {
      title: 'Backend Engineer',
      companyName: 'Contoso',
      requiredSkills: ['Go', 'PostgreSQL'],
      experienceMin: 5,
      experienceMax: 8,
      location: 'Pune',
      workMode: 'ONSITE',
    });
    const intern = await postJob(api, {
      title: 'Data Intern',
      companyName: 'Fabrikam',
      requiredSkills: ['Python'],
      experienceMin: 0,
      experienceMax: 0,
      employmentType: 'INTERNSHIP',
      description: 'Learn analytics with pandas and SQL alongside a mentor while working on real business problems.',
    });
    const closed = await postJob(api, { title: 'Frontend Lead', companyName: 'Northwind', requiredSkills: ['React'] });
    await api.post(`/api/v1/jobs/${closed.id}/close`).expect(200);
    return { api, react, go, intern, closed };
  }

  const ids = (res: request.Response) => (res.body as Paginated<JobSummary>).items.map((j) => j.id);

  it('searches title, company, skills, location and description', async () => {
    const { api, react, go, intern } = await seedBoard();
    expect(ids(await api.get('/api/v1/jobs?q=frontend'))).toEqual([react.id]);
    expect(ids(await api.get('/api/v1/jobs?q=contoso'))).toEqual([go.id]);
    expect(ids(await api.get('/api/v1/jobs?q=postgresql'))).toEqual([go.id]);
    expect(ids(await api.get('/api/v1/jobs?q=pune'))).toEqual([go.id]);
    expect(ids(await api.get('/api/v1/jobs?q=pandas'))).toEqual([intern.id]);
    expect(ids(await api.get('/api/v1/jobs?q=%25'))).toEqual([]);
  });

  it('filters by skills, work mode, type, company, experience and status', async () => {
    const { api, react, go, intern, closed } = await seedBoard();
    expect(ids(await api.get('/api/v1/jobs?skills=react'))).toEqual([react.id]);
    expect(ids(await api.get('/api/v1/jobs?workMode=REMOTE'))).toEqual([react.id]);
    expect(ids(await api.get('/api/v1/jobs?employmentType=INTERNSHIP'))).toEqual([intern.id]);
    expect(ids(await api.get('/api/v1/jobs?company=north'))).toEqual([react.id]);
    expect(ids(await api.get('/api/v1/jobs?company=north&status=all')).sort()).toEqual([react.id, closed.id].sort());
    expect(ids(await api.get('/api/v1/jobs?expMin=5')).sort()).toEqual([go.id]);
    expect(ids(await api.get('/api/v1/jobs?expMin=0&expMax=1'))).toEqual([intern.id]);
  });

  it('sorts and paginates with totals', async () => {
    const { api } = await seedBoard();
    const page1 = (await api.get('/api/v1/jobs?sort=title&pageSize=2&page=1').expect(200)).body as Paginated<JobSummary>;
    expect(page1).toMatchObject({ total: 3, totalPages: 2, page: 1, pageSize: 2 });
    expect(page1.items.map((j) => j.title)).toEqual(['Backend Engineer', 'Data Intern']);
    const page2 = (await api.get('/api/v1/jobs?sort=title&pageSize=2&page=2').expect(200)).body as Paginated<JobSummary>;
    expect(page2.items.map((j) => j.title)).toEqual(['Frontend Engineer']);
    const byCompany = (await api.get('/api/v1/jobs?sort=company').expect(200)).body as Paginated<JobSummary>;
    expect(byCompany.items.map((j) => j.companyName)).toEqual(['Contoso', 'Fabrikam', 'Northwind']);
  });

  it('suggests skills and companies from real records', async () => {
    const { api } = await seedBoard();
    expect((await api.get('/api/v1/jobs/suggestions/skills?q=typ').expect(200)).body.items).toEqual(['TypeScript']);
    expect((await api.get('/api/v1/jobs/suggestions/companies?q=north').expect(200)).body.items).toEqual(['Northwind']);
  });

  it('respects the public browsing policy for guests', async () => {
    await seedBoard();
    const guest = await client();
    await guest.get('/api/v1/jobs').expect(200);
    await prisma.appSetting.upsert({
      where: { id: 1 },
      create: { id: 1, publicBrowsingEnabled: false },
      update: { publicBrowsingEnabled: false },
    });
    const { invalidateSettingsCache } = await import('../src/modules/settings/settings.service.js');
    invalidateSettingsCache();
    await guest.get('/api/v1/jobs').expect(401);
  });

  it('keeps history private to verified members', async () => {
    const { api, react } = await seedBoard();
    const guest = await client();
    await guest.get(`/api/v1/jobs/${react.id}/history`).expect(401);
    const { api: unverified } = await loggedInUser({ verified: false });
    await unverified.get(`/api/v1/jobs/${react.id}/history`).expect(403);
    await api.get(`/api/v1/jobs/${react.id}/history`).expect(200);
  });
});

describe('sharing data (acceptance 10)', () => {
  it('provides everything the WhatsApp message needs, reflecting the current status', async () => {
    const { api } = await loggedInUser();
    const job = await postJob(api);
    const fetched = (await api.get(`/api/v1/jobs/${job.slug}`).expect(200)).body.job as JobDetail;
    const message = buildShareMessage(fetched, 'https://referloop.example.com');
    expect(message).toContain('Job Opening: Senior Software Engineer');
    expect(message).toContain('Company: Example Company');
    expect(message).toContain('Experience: 3–5 years');
    expect(message).toContain('Status: Active');
    expect(message).toContain(`https://referloop.example.com/jobs/${job.slug}`);
    expect(message).toContain('https://careers.example.com/jobs/123');
    expect(decodeURIComponent(buildWhatsAppUrl(message).split('text=')[1]!)).toBe(message);

    await api.post(`/api/v1/jobs/${job.id}/close`).expect(200);
    const afterClose = (await api.get(`/api/v1/jobs/${job.slug}`).expect(200)).body.job as JobDetail;
    expect(buildShareMessage(afterClose, 'https://referloop.example.com')).toContain('Status: Closed');
  });
});

describe('persistence (acceptance 16)', () => {
  it('serves data written by one app instance from a fresh instance', async () => {
    const { api } = await loggedInUser();
    const job = await postJob(api);
    const restarted = createApp();
    const res = await request(restarted).get(`/api/v1/jobs/${job.slug}`).expect(200);
    expect(res.body.job.title).toBe(job.title);
  });
});
