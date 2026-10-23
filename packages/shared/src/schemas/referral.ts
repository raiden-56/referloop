import { z } from 'zod';
import { REFERRAL_RESPONSES, REFERRAL_STATUSES } from '../enums.js';
import { optionalText, optionalUrl, paginationSchema, requiredText } from './common.js';

export const referralRequestCreateSchema = z.object({
  message: requiredText('Message', 30, 2_000),
  profileUrl: optionalUrl('Resume or profile link'),
});
export type ReferralRequestCreateInput = z.input<typeof referralRequestCreateSchema>;

export const referralRespondSchema = z.object({
  status: z.enum(REFERRAL_RESPONSES, { error: 'Choose a response' }),
  note: optionalText('Note', 1_000),
});
export type ReferralRespondInput = z.input<typeof referralRespondSchema>;

export const REFERRAL_BOXES = ['received', 'sent'] as const;
export type ReferralBox = (typeof REFERRAL_BOXES)[number];

export const referralListSchema = paginationSchema.extend({
  box: z.enum(REFERRAL_BOXES).default('received').catch('received'),
  status: z.enum(REFERRAL_STATUSES).optional().catch(undefined),
});
export type ReferralListQuery = z.output<typeof referralListSchema>;
