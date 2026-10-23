import { z } from 'zod';
import { ACCOUNT_STATUSES, REPORT_STATUSES, ROLES } from '../enums.js';
import { changeReasonSchema } from './job.js';
import { optionalText, paginationSchema, requiredText } from './common.js';

const queryText = z
  .string()
  .max(120)
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const adminUserListSchema = paginationSchema.extend({
  q: queryText,
  role: z.enum(ROLES).optional().catch(undefined),
  status: z.enum(ACCOUNT_STATUSES).optional().catch(undefined),
  verified: z.enum(['yes', 'no']).optional().catch(undefined),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminUserListQuery = z.output<typeof adminUserListSchema>;

export const userStatusUpdateSchema = z.object({
  status: z.enum(ACCOUNT_STATUSES),
  reason: optionalText('Reason', 500),
});
export type UserStatusUpdateInput = z.input<typeof userStatusUpdateSchema>;

export const userRoleUpdateSchema = z.object({
  role: z.enum(ROLES),
});
export type UserRoleUpdateInput = z.input<typeof userRoleUpdateSchema>;

export const adminReportListSchema = paginationSchema.extend({
  status: z
    .enum([...REPORT_STATUSES, 'PENDING', 'ALL'] as const)
    .default('PENDING')
    .catch('PENDING'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminReportListQuery = z.output<typeof adminReportListSchema>;

export const REPORT_ACTIONS = ['RESOLVE', 'DISMISS', 'ESCALATE'] as const;
export const REPORT_JOB_ACTIONS = ['NONE', 'CLOSE', 'ARCHIVE'] as const;

export const reportResolutionSchema = z
  .object({
    action: z.enum(REPORT_ACTIONS),
    resolutionNote: optionalText('Resolution note', 2_000),
    jobAction: z.enum(REPORT_JOB_ACTIONS).default('NONE'),
  })
  .refine((d) => d.action === 'RESOLVE' || d.jobAction === 'NONE', {
    path: ['jobAction'],
    message: 'Job changes can only be applied when resolving a report',
  })
  .refine((d) => d.action === 'ESCALATE' || d.resolutionNote !== null, {
    path: ['resolutionNote'],
    message: 'Add a resolution note',
  });
export type ReportResolutionInput = z.input<typeof reportResolutionSchema>;

export const adminJobListSchema = paginationSchema.extend({
  q: queryText,
  status: z.enum(['active', 'closed', 'all']).default('all').catch('all'),
  archived: z.enum(['exclude', 'include', 'only']).default('include').catch('include'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminJobListQuery = z.output<typeof adminJobListSchema>;

export const archiveJobSchema = z.object({
  reason: requiredText('Reason', 3, 500),
});
export type ArchiveJobInput = z.input<typeof archiveJobSchema>;

export const restoreJobSchema = z.object({ reason: changeReasonSchema });

export const revertJobSchema = z.object({
  historyId: z.uuid(),
  version: z.number().int().min(1),
  reason: requiredText('Reason', 3, 500),
});
export type RevertJobInput = z.input<typeof revertJobSchema>;

export const auditLogListSchema = paginationSchema.extend({
  action: queryText,
  targetType: queryText,
  actorId: z.uuid().optional().catch(undefined),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export type AuditLogListQuery = z.output<typeof auditLogListSchema>;

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Enter a domain such as example.com');

export const appSettingsSchema = z.object({
  publicBrowsingEnabled: z.boolean(),
  registrationEnabled: z.boolean(),
  allowedEmailDomains: z.array(domain).max(50),
  staleAfterDays: z.number().int().min(7, 'At least 7 days').max(365, 'At most 365 days'),
  notifyCreatorOnEdit: z.boolean(),
  notifySaversOnStatusChange: z.boolean(),
  notifyReporterOnResolution: z.boolean(),
});
export type AppSettingsInput = z.input<typeof appSettingsSchema>;
export type AppSettings = z.output<typeof appSettingsSchema>;

export const categorySchema = z.object({
  name: requiredText('Category name', 2, 60),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});
export type CategoryInput = z.input<typeof categorySchema>;
