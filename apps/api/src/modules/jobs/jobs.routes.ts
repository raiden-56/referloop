import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  duplicateCheckSchema,
  jobInputSchema,
  jobSearchSchema,
  jobUpdateSchema,
  referralRequestCreateSchema,
  reportCreateSchema,
  statusChangeSchema,
} from '@referloop/shared';
import { requireAuth, requireVerified } from '../../middleware/auth.js';
import { rateLimits } from '../../middleware/rateLimit.js';
import { unauthorized } from '../../lib/errors.js';
import { parse, parseId } from '../../lib/validate.js';
import { requestMeta } from '../audit/audit.service.js';
import { requestReferral } from '../referrals/referrals.service.js';
import { getSettings } from '../settings/settings.service.js';
import * as jobs from './jobs.service.js';

export const jobsRouter = Router();

/** Guests may browse only when the administrator has enabled public browsing. */
async function browsingAllowed(req: Request, _res: Response, next: NextFunction) {
  if (req.auth) return next();
  const settings = await getSettings();
  if (!settings.publicBrowsingEnabled) return next(unauthorized('Sign in to browse job openings.'));
  next();
}

const slugOrIdSchema = z.string().min(1).max(200);
const suggestionSchema = z.object({ q: z.string().trim().min(1).max(40) });

jobsRouter.get('/', browsingAllowed, async (req, res) => {
  const query = parse(jobSearchSchema, req.query);
  res.json(await jobs.listJobs(query, req.auth?.user.id));
});

jobsRouter.get('/suggestions/skills', browsingAllowed, async (req, res) => {
  const { q } = parse(suggestionSchema, req.query);
  res.json({ items: await jobs.suggestSkills(q) });
});

jobsRouter.get('/suggestions/companies', browsingAllowed, async (req, res) => {
  const { q } = parse(suggestionSchema, req.query);
  res.json({ items: await jobs.suggestCompanies(q) });
});

jobsRouter.post('/duplicates', requireVerified, async (req, res) => {
  const input = parse(duplicateCheckSchema, req.body);
  res.json({ items: await jobs.findDuplicates(input) });
});

jobsRouter.post('/', requireVerified, rateLimits.jobCreate, async (req, res) => {
  const input = parse(jobInputSchema, req.body);
  const header = req.get('idempotency-key');
  const key = header && /^[A-Za-z0-9_-]{8,100}$/.test(header) ? header : undefined;
  const { job, created } = await jobs.createJob(input, req.auth!.user, key, requestMeta(req));
  res
    .status(created ? 201 : 200)
    .location(`/api/v1/jobs/${job.id}`)
    .json({ job, created });
});

jobsRouter.get('/:idOrSlug', browsingAllowed, async (req, res) => {
  const idOrSlug = parse(slugOrIdSchema, req.params.idOrSlug);
  res.json({ job: await jobs.getJob(idOrSlug, req.auth?.user ?? null) });
});

jobsRouter.patch('/:id', requireVerified, rateLimits.jobWrite, async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const input = parse(jobUpdateSchema, req.body);
  res.json(await jobs.updateJob(id, input, req.auth!.user, requestMeta(req)));
});

jobsRouter.post('/:id/close', requireVerified, rateLimits.jobWrite, async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const { reason } = parse(statusChangeSchema, req.body);
  res.json({ job: await jobs.changeStatus(id, 'CLOSED', reason, req.auth!.user, requestMeta(req)) });
});

jobsRouter.post('/:id/reopen', requireVerified, rateLimits.jobWrite, async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const { reason } = parse(statusChangeSchema, req.body);
  res.json({ job: await jobs.changeStatus(id, 'ACTIVE', reason, req.auth!.user, requestMeta(req)) });
});

jobsRouter.post('/:id/confirm-active', requireVerified, rateLimits.jobWrite, async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const { reason } = parse(statusChangeSchema, req.body);
  res.json({ job: await jobs.confirmActive(id, reason, req.auth!.user, requestMeta(req)) });
});

jobsRouter.get('/:id/history', requireVerified, async (req, res) => {
  const idOrSlug = parse(slugOrIdSchema, req.params.id);
  res.json(await jobs.getHistory(idOrSlug, req.auth!.user));
});

jobsRouter.post('/:id/report', requireVerified, rateLimits.report, async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const input = parse(reportCreateSchema, req.body);
  res.status(201).json({ report: await jobs.reportJob(id, input, req.auth!.user, requestMeta(req)) });
});

jobsRouter.post('/:id/referral-requests', requireVerified, rateLimits.referralRequest, async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  const input = parse(referralRequestCreateSchema, req.body);
  res.status(201).json({ referral: await requestReferral(id, input, req.auth!.user, requestMeta(req)) });
});

jobsRouter.put('/:id/save', requireAuth, async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  res.json(await jobs.setSaved(id, req.auth!.user, true));
});

jobsRouter.delete('/:id/save', requireAuth, async (req, res) => {
  const id = parseId(req.params.id, 'Job');
  res.json(await jobs.setSaved(id, req.auth!.user, false));
});
