// Domain enumerations shared by the API (Prisma enums mirror these values) and the web app.

export const ROLES = ['MEMBER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const JOB_STATUSES = ['ACTIVE', 'CLOSED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const WORK_MODES = ['REMOTE', 'HYBRID', 'ONSITE'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const REPORT_REASONS = ['CLOSED_OR_OUTDATED', 'DUPLICATE', 'INCORRECT_INFO', 'BROKEN_LINK', 'SPAM', 'SUSPICIOUS', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['OPEN', 'ESCALATED', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const JOB_HISTORY_ACTIONS = [
  'CREATED',
  'UPDATED',
  'CLOSED',
  'REOPENED',
  'CONFIRMED_ACTIVE',
  'ARCHIVED',
  'RESTORED',
  'REVERTED',
] as const;
export type JobHistoryAction = (typeof JOB_HISTORY_ACTIONS)[number];

export const NOTIFICATION_TYPES = [
  'JOB_EDITED',
  'JOB_CLOSED',
  'JOB_REOPENED',
  'JOB_ARCHIVED',
  'REPORT_RESOLVED',
  'ACCOUNT',
  'REFERRAL_REQUESTED',
  'REFERRAL_UPDATED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REFERRAL_STATUSES = ['PENDING', 'ACCEPTED', 'REFERRED', 'DECLINED', 'WITHDRAWN'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

/** Statuses a referrer can move a request to. */
export const REFERRAL_RESPONSES = ['ACCEPTED', 'REFERRED', 'DECLINED'] as const;
export type ReferralResponse = (typeof REFERRAL_RESPONSES)[number];

/** Requests still waiting on the referrer: the requester can withdraw them. */
export const OPEN_REFERRAL_STATUSES = ['PENDING', 'ACCEPTED'] as const satisfies readonly ReferralStatus[];

/** Allowed referrer transitions. Anything else is rejected, so a decision cannot be silently reversed. */
export const REFERRAL_TRANSITIONS: Record<ReferralStatus, readonly ReferralResponse[]> = {
  PENDING: ['ACCEPTED', 'REFERRED', 'DECLINED'],
  ACCEPTED: ['REFERRED', 'DECLINED'],
  REFERRED: [],
  DECLINED: [],
  WITHDRAWN: [],
};

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'PLN'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const JOB_SORTS = ['newest', 'updated', 'title', 'company'] as const;
export type JobSort = (typeof JOB_SORTS)[number];

export const POSTED_WITHIN = ['1', '7', '30', '90'] as const;
export type PostedWithin = (typeof POSTED_WITHIN)[number];

export const STATUS_FILTERS = ['active', 'closed', 'all'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'Onsite',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  TEMPORARY: 'Temporary',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  CLOSED_OR_OUTDATED: 'Closed or outdated',
  DUPLICATE: 'Duplicate listing',
  INCORRECT_INFO: 'Incorrect job information',
  BROKEN_LINK: 'Broken application link',
  SPAM: 'Spam or misleading content',
  SUSPICIOUS: 'Suspicious or fraudulent opening',
  OTHER: 'Other issue',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: 'Open',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

export const JOB_HISTORY_ACTION_LABELS: Record<JobHistoryAction, string> = {
  CREATED: 'Posted the job',
  UPDATED: 'Edited the job',
  CLOSED: 'Marked as closed',
  REOPENED: 'Reopened the job',
  CONFIRMED_ACTIVE: 'Confirmed still active',
  ARCHIVED: 'Archived the listing',
  RESTORED: 'Restored the listing',
  REVERTED: 'Restored previous values',
};

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  PENDING: 'Awaiting response',
  ACCEPTED: 'Accepted',
  REFERRED: 'Referred',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
};

export const JOB_SORT_LABELS: Record<JobSort, string> = {
  newest: 'Newest first',
  updated: 'Recently updated',
  title: 'Job title (A–Z)',
  company: 'Company (A–Z)',
};
