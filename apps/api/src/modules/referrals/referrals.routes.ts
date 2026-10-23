import { Router } from 'express';
import { referralListSchema, referralRespondSchema } from '@referloop/shared';
import { requireAuth, requireVerified } from '../../middleware/auth.js';
import { rateLimits } from '../../middleware/rateLimit.js';
import { parse, parseId } from '../../lib/validate.js';
import { requestMeta } from '../audit/audit.service.js';
import * as referrals from './referrals.service.js';

/** Requests are created from the job (`POST /jobs/:id/referral-requests`); this router manages them afterwards. */
export const referralsRouter = Router();
referralsRouter.use(requireAuth);

referralsRouter.get('/', async (req, res) => {
  const query = parse(referralListSchema, req.query);
  res.json(await referrals.listReferrals(req.auth!.user, query));
});

referralsRouter.post('/:id/respond', requireVerified, rateLimits.referralWrite, async (req, res) => {
  const id = parseId(req.params.id, 'Referral request');
  const input = parse(referralRespondSchema, req.body);
  res.json({ referral: await referrals.respondToReferral(id, input, req.auth!.user, requestMeta(req)) });
});

referralsRouter.post('/:id/withdraw', rateLimits.referralWrite, async (req, res) => {
  const id = parseId(req.params.id, 'Referral request');
  res.json({ referral: await referrals.withdrawReferral(id, req.auth!.user, requestMeta(req)) });
});
