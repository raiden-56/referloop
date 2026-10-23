import { describe, expect, it } from 'vitest';
import type { AdminDashboard, AdminReport, JobDetail, JobHistoryResponse, Paginated } from '@referloop/shared';
import { prisma } from '../src/lib/prisma.js';
import { client, createUser, loggedInUser, login, PASSWORD, postJob } from './helpers.js';

const ADMIN_ENDPOINTS: [method: 'get' | 'post' | 'patch' | 'put', url: string][] = [
  ['get', '/api/v1/admin/dashboard'],
  ['get', '/api/v1/admin/users'],
  ['patch', '/api/v1/admin/users/00000000-0000-4000-8000-000000000000/status'],
  ['patch', '/api/v1/admin/users/00000000-0000-4000-8000-000000000000/role'],
  ['post', '/api/v1/admin/users/00000000-0000-4000-8000-000000000000/revoke-sessions'],
  ['get', '/api/v1/admin/jobs'],
  ['patch', '/api/v1/admin/jobs/00000000-0000-4000-8000-000000000000/archive'],
  ['post', '/api/v1/admin/jobs/00000000-0000-4000-8000-000000000000/restore'],
  ['post', '/api/v1/admin/jobs/00000000-0000-4000-8000-000000000000/revert'],
  ['get', '/api/v1/admin/reports'],
  ['patch', '/api/v1/admin/reports/00000000-0000-4000-8000-000000000000'],
  ['get', '/api/v1/admin/audit-logs'],
  ['get', '/api/v1/admin/settings'],
  ['put', '/api/v1/admin/settings'],
  ['get', '/api/v1/admin/categories'],
  ['post', '/api/v1/admin/categories'],
];

describe('admin authorization (acceptance 13)', () => {
  it('rejects guests and ordinary members on every admin endpoint', async () => {
    const guest = await client();
    const { api: member } = await loggedInUser();
    for (const [method, url] of ADMIN_ENDPOINTS) {
      expect((await guest[method](url)).status, `${method} ${url} as guest`).toBe(401);
      expect((await member[method](url)).status, `${method} ${url} as member`).toBe(403);
    }
  });

  it('allows administrators', async () => {
    const { api } = await loggedInUser({ role: 'ADMIN' });
    await api.get('/api/v1/admin/dashboard').expect(200);
  });
});

describe('reporting and moderation (acceptance 11–12)', () => {
  it('lets members report once per job and admins resolve with an audited job action', async () => {
    const { api: poster } = await loggedInUser();
    const { user: reporter, api: reporterApi } = await loggedInUser();
    const { user: admin, api: adminApi } = await loggedInUser({ role: 'ADMIN' });
    const job = await postJob(poster);

    const created = await reporterApi
      .post(`/api/v1/jobs/${job.id}/report`, { reason: 'CLOSED_OR_OUTDATED', description: 'Careers page says filled' })
      .expect(201);
    const dup = await reporterApi.post(`/api/v1/jobs/${job.id}/report`, { reason: 'SPAM' }).expect(409);
    expect(dup.body.error.code).toBe('ALREADY_REPORTED');

    // Reporting alone never closes the job.
    expect((await poster.get(`/api/v1/jobs/${job.id}`).expect(200)).body.job.status).toBe('ACTIVE');

    const queue = (await adminApi.get('/api/v1/admin/reports').expect(200)).body as Paginated<AdminReport>;
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({
      id: created.body.report.id,
      reason: 'CLOSED_OR_OUTDATED',
      status: 'OPEN',
      reporter: { id: reporter.id },
      job: { id: job.id, slug: job.slug },
    });
    expect(queue.items[0]!.reporter).not.toHaveProperty('email');

    // Resolution needs a note.
    await adminApi.patch(`/api/v1/admin/reports/${created.body.report.id}`, { action: 'RESOLVE', jobAction: 'CLOSE' }).expect(400);
    const resolved = await adminApi
      .patch(`/api/v1/admin/reports/${created.body.report.id}`, {
        action: 'RESOLVE',
        jobAction: 'CLOSE',
        resolutionNote: 'Verified on careers page',
      })
      .expect(200);
    expect(resolved.body.report).toMatchObject({
      status: 'RESOLVED',
      resolvedBy: { id: admin.id },
      resolutionNote: 'Verified on careers page',
    });

    const after = (await poster.get(`/api/v1/jobs/${job.id}`).expect(200)).body.job as JobDetail;
    expect(after.status).toBe('CLOSED');
    const history = (await poster.get(`/api/v1/jobs/${job.id}/history`).expect(200)).body as JobHistoryResponse;
    expect(history.statusChanges[0]).toMatchObject({ newStatus: 'CLOSED', actor: { id: admin.id } });

    const audit = await prisma.auditLog.findMany({ where: { actorId: admin.id }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['JOB_CLOSED', 'REPORT_RESOLVED']));

    // Closed reports cannot be re-resolved; the reporter is notified.
    await adminApi.patch(`/api/v1/admin/reports/${created.body.report.id}`, { action: 'DISMISS', resolutionNote: 'x' }).expect(409);
    const notes = (await reporterApi.get('/api/v1/notifications').expect(200)).body;
    expect(notes.items.some((n: { type: string }) => n.type === 'REPORT_RESOLVED')).toBe(true);
  });

  it('supports escalation and dismissal', async () => {
    const { api: poster } = await loggedInUser();
    const { api: reporter } = await loggedInUser();
    const { api: adminApi } = await loggedInUser({ role: 'ADMIN' });
    const job = await postJob(poster);
    const { body } = await reporter.post(`/api/v1/jobs/${job.id}/report`, { reason: 'SUSPICIOUS' }).expect(201);
    await adminApi
      .patch(`/api/v1/admin/reports/${body.report.id}`, { action: 'ESCALATE', resolutionNote: 'Needs legal review' })
      .expect(200);
    const pending = (await adminApi.get('/api/v1/admin/reports?status=PENDING').expect(200)).body as Paginated<AdminReport>;
    expect(pending.items[0]!.status).toBe('ESCALATED');
    await adminApi.patch(`/api/v1/admin/reports/${body.report.id}`, { action: 'DISMISS', resolutionNote: 'Legit listing' }).expect(200);
    expect((await adminApi.get('/api/v1/admin/reports').expect(200)).body.total).toBe(0);
  });
});

describe('user management', () => {
  it('suspends a member: sessions revoked, job changes blocked, sign-in refused (acceptance 14)', async () => {
    const { user: member, api: memberApi } = await loggedInUser();
    const { api: adminApi } = await loggedInUser({ role: 'ADMIN' });
    const job = await postJob(memberApi);

    await adminApi.patch(`/api/v1/admin/users/${member.id}/status`, { status: 'SUSPENDED', reason: 'Spam' }).expect(200);
    expect(await prisma.userSession.count({ where: { userId: member.id, revokedAt: null } })).toBe(0);

    await memberApi.patch(`/api/v1/jobs/${job.id}`, { ...job, version: job.version, title: 'Hijacked' }).expect(401);
    await memberApi.post(`/api/v1/jobs/${job.id}/close`).expect(401);
    const c = await client();
    await c.post('/api/v1/auth/login', { email: member.email, password: PASSWORD }).expect(403);

    await adminApi.patch(`/api/v1/admin/users/${member.id}/status`, { status: 'ACTIVE' }).expect(200);
    await login(member.email);
  });

  it('prevents self-modification and removing the last administrator', async () => {
    const { user: admin, api } = await loggedInUser({ role: 'ADMIN' });
    const self = await api.patch(`/api/v1/admin/users/${admin.id}/role`, { role: 'MEMBER' }).expect(403);
    expect(self.body.error.code).toBe('SELF_MODIFICATION');
    await api.patch(`/api/v1/admin/users/${admin.id}/status`, { status: 'SUSPENDED' }).expect(403);

    const member = await createUser();
    await api.patch(`/api/v1/admin/users/${member.id}/role`, { role: 'ADMIN' }).expect(200);
    const promoted = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(promoted.role).toBe('ADMIN');
    expect(await prisma.auditLog.count({ where: { action: 'USER_ROLE_CHANGED', targetId: member.id } })).toBe(1);
  });

  it('keeps one administrator when two admins remove each other at the same time', async () => {
    const a = await loggedInUser({ role: 'ADMIN' });
    const b = await loggedInUser({ role: 'ADMIN' });
    const results = await Promise.all([
      a.api.patch(`/api/v1/admin/users/${b.user.id}/role`, { role: 'MEMBER' }),
      b.api.patch(`/api/v1/admin/users/${a.user.id}/status`, { status: 'SUSPENDED', reason: 'Race' }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    // The second request may also fail with 401/403 because the first one revoked its sessions.
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: 'ADMIN', accountStatus: 'ACTIVE' } })).toBe(1);
  });

  it('lists and filters users without exposing password hashes', async () => {
    const { api } = await loggedInUser({ role: 'ADMIN', name: 'Admin Person' });
    await createUser({ name: 'Unverified Person', verified: false });
    const res = await api.get('/api/v1/admin/users?verified=no').expect(200);
    expect(res.body.items.map((u: { name: string }) => u.name)).toEqual(['Unverified Person']);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('argon2');
  });
});

describe('job administration', () => {
  it('archives and restores listings without losing history', async () => {
    const { api: member } = await loggedInUser();
    const { api: adminApi } = await loggedInUser({ role: 'ADMIN' });
    const job = await postJob(member);

    await adminApi.patch(`/api/v1/admin/jobs/${job.id}/archive`, { reason: 'Spam listing' }).expect(200);
    await member.get(`/api/v1/jobs/${job.id}`).expect(404);
    await member.patch(`/api/v1/jobs/${job.id}`, { ...job, version: 2 }).expect(404);
    expect((await member.get('/api/v1/jobs?status=all').expect(200)).body.total).toBe(0);
    const adminList = (await adminApi.get('/api/v1/admin/jobs?archived=only').expect(200)).body;
    expect(adminList.items[0]).toMatchObject({ id: job.id, archiveReason: 'Spam listing' });

    await adminApi.post(`/api/v1/admin/jobs/${job.id}/restore`, { reason: 'False positive' }).expect(200);
    await member.get(`/api/v1/jobs/${job.id}`).expect(200);
    const history = (await member.get(`/api/v1/jobs/${job.id}/history`).expect(200)).body as JobHistoryResponse;
    expect(history.edits.map((e) => e.action)).toEqual(['RESTORED', 'ARCHIVED', 'CREATED']);
  });

  it('restores previous values through a new audited edit', async () => {
    const { api: member } = await loggedInUser();
    const { user: admin, api: adminApi } = await loggedInUser({ role: 'ADMIN' });
    const job = await postJob(member);
    const edited = (await member.patch(`/api/v1/jobs/${job.id}`, { ...job, version: 1, title: 'Vandalised Title' }).expect(200)).body
      .job as JobDetail;
    const history = (await adminApi.get(`/api/v1/jobs/${job.id}/history`).expect(200)).body as JobHistoryResponse;
    const editEntry = history.edits.find((e) => e.action === 'UPDATED')!;

    const reverted = await adminApi
      .post(`/api/v1/admin/jobs/${job.id}/revert`, { historyId: editEntry.id, version: edited.version, reason: 'Undo vandalism' })
      .expect(200);
    expect(reverted.body.job).toMatchObject({ title: 'Senior Software Engineer', version: 3, lastEditedBy: { id: admin.id } });

    const after = (await adminApi.get(`/api/v1/jobs/${job.id}/history`).expect(200)).body as JobHistoryResponse;
    expect(after.edits.map((e) => e.action)).toEqual(['REVERTED', 'UPDATED', 'CREATED']);
    expect(after.edits[0]).toMatchObject({
      previousValues: { title: 'Vandalised Title' },
      newValues: { title: 'Senior Software Engineer' },
    });
    // Ordinary members cannot revert.
    await member.post(`/api/v1/admin/jobs/${job.id}/revert`, { historyId: editEntry.id, version: 3, reason: 'nope' }).expect(403);
  });

  it('reports database-derived dashboard metrics', async () => {
    const { api: member } = await loggedInUser();
    const { api: adminApi } = await loggedInUser({ role: 'ADMIN' });
    await createUser({ verified: false });
    const a = await postJob(member);
    await postJob(member, { title: 'Another Role Entirely' });
    await member.post(`/api/v1/jobs/${a.id}/close`).expect(200);
    await member.post(`/api/v1/jobs/${a.id}/report`, { reason: 'OTHER' }).expect(201);
    const dash = (await adminApi.get('/api/v1/admin/dashboard').expect(200)).body as AdminDashboard;
    expect(dash.totals).toMatchObject({ users: 3, verifiedMembers: 2, activeJobs: 1, closedJobs: 1, pendingReports: 1 });
    expect(dash.recentJobs[0]).toMatchObject({ id: a.id, lastAction: 'CLOSED' });
  });

  it('manages categories and settings with audit entries', async () => {
    const { api } = await loggedInUser({ role: 'ADMIN' });
    const created = await api.post('/api/v1/admin/categories', { name: 'Engineering', isActive: true, sortOrder: 1 }).expect(201);
    await api.post('/api/v1/admin/categories', { name: 'engineering' }).expect(400);
    const config = (await api.get('/api/v1/config').expect(200)).body;
    expect(config.categories).toEqual([{ id: created.body.category.id, name: 'Engineering', slug: 'engineering' }]);

    const settings = {
      publicBrowsingEnabled: false,
      registrationEnabled: true,
      allowedEmailDomains: ['Example.com'],
      staleAfterDays: 45,
      notifyCreatorOnEdit: true,
      notifySaversOnStatusChange: false,
      notifyReporterOnResolution: true,
    };
    const res = await api.put('/api/v1/admin/settings', settings).expect(200);
    expect(res.body.settings).toMatchObject({ publicBrowsingEnabled: false, allowedEmailDomains: ['example.com'], staleAfterDays: 45 });
    const logs = (await api.get('/api/v1/admin/audit-logs?action=SETTINGS').expect(200)).body;
    expect(logs.items[0]).toMatchObject({ action: 'SETTINGS_UPDATED' });
  });
});
