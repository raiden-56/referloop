import { Router } from 'express';
import {
  adminJobListSchema,
  adminReportListSchema,
  adminUserListSchema,
  appSettingsSchema,
  archiveJobSchema,
  auditLogListSchema,
  categorySchema,
  reportResolutionSchema,
  restoreJobSchema,
  revertJobSchema,
  userRoleUpdateSchema,
  userStatusUpdateSchema,
} from '@referloop/shared';
import { requireAdmin } from '../../middleware/auth.js';
import { parse, parseId } from '../../lib/validate.js';
import { audit, requestMeta } from '../audit/audit.service.js';
import { archiveJob, restoreJob, revertJob } from '../jobs/jobs.service.js';
import { getSettings, updateSettings } from '../settings/settings.service.js';
import * as admin from './admin.service.js';

/** Every route below is authorised server-side; hiding the UI is not relied upon. */
export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get('/dashboard', async (_req, res) => {
  res.json(await admin.getDashboard());
});

// Users
adminRouter.get('/users', async (req, res) => {
  res.json(await admin.listUsers(parse(adminUserListSchema, req.query)));
});

adminRouter.patch('/users/:id/status', async (req, res) => {
  const id = parseId(req.params.id, 'User');
  const { status, reason } = parse(userStatusUpdateSchema, req.body);
  res.json({ user: await admin.setUserStatus(id, status, reason, req.auth!.user, requestMeta(req)) });
});

adminRouter.patch('/users/:id/role', async (req, res) => {
  const id = parseId(req.params.id, 'User');
  const { role } = parse(userRoleUpdateSchema, req.body);
  res.json({ user: await admin.setUserRole(id, role, req.auth!.user, requestMeta(req)) });
});

adminRouter.post('/users/:id/revoke-sessions', async (req, res) => {
  const id = parseId(req.params.id, 'User');
  res.json(await admin.revokeUserSessions(id, req.auth!.user, requestMeta(req)));
});

// Jobs
adminRouter.get('/jobs', async (req, res) => {
  res.json(await admin.listAdminJobs(parse(adminJobListSchema, req.query)));
});

adminRouter.patch('/jobs/:id/archive', async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const { reason } = parse(archiveJobSchema, req.body);
  res.json({ job: await archiveJob(id, reason, req.auth!.user, requestMeta(req)) });
});

adminRouter.post('/jobs/:id/restore', async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const { reason } = parse(restoreJobSchema, req.body);
  res.json({ job: await restoreJob(id, reason, req.auth!.user, requestMeta(req)) });
});

adminRouter.post('/jobs/:id/revert', async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const { historyId, version, reason } = parse(revertJobSchema, req.body);
  res.json({ job: await revertJob(id, historyId, version, reason, req.auth!.user, requestMeta(req)) });
});

// Reports
adminRouter.get('/reports', async (req, res) => {
  res.json(await admin.listReports(parse(adminReportListSchema, req.query)));
});

adminRouter.patch('/reports/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Report');
  const input = parse(reportResolutionSchema, req.body);
  res.json({ report: await admin.resolveReport(id, input, req.auth!.user, requestMeta(req)) });
});

// Audit log
adminRouter.get('/audit-logs', async (req, res) => {
  res.json(await admin.listAuditLogs(parse(auditLogListSchema, req.query)));
});

// Settings and categories
adminRouter.get('/settings', async (_req, res) => {
  res.json({ settings: await getSettings() });
});

adminRouter.put('/settings', async (req, res) => {
  const input = parse(appSettingsSchema, req.body);
  const before = await getSettings();
  const settings = await updateSettings(input, req.auth!.user.id);
  await audit(
    {
      actorId: req.auth!.user.id,
      action: 'SETTINGS_UPDATED',
      targetType: 'AppSetting',
      targetId: '1',
      metadata: { before, after: settings },
    },
    requestMeta(req),
  );
  res.json({ settings });
});

adminRouter.get('/categories', async (_req, res) => {
  res.json({ items: await admin.listCategories() });
});

adminRouter.post('/categories', async (req, res) => {
  const input = parse(categorySchema, req.body);
  res.status(201).json({ category: await admin.saveCategory(null, input, req.auth!.user, requestMeta(req)) });
});

adminRouter.patch('/categories/:id', async (req, res) => {
  const id = parseId(req.params.id, 'Category');
  const input = parse(categorySchema, req.body);
  res.json({ category: await admin.saveCategory(id, input, req.auth!.user, requestMeta(req)) });
});
