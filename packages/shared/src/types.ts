// Response shapes returned by the REST API (`/api/v1`). Dates are ISO-8601 strings.
import type {
  AccountStatus,
  Currency,
  EmploymentType,
  JobHistoryAction,
  JobStatus,
  NotificationType,
  ReportReason,
  ReferralStatus,
  ReportStatus,
  Role,
  WorkMode,
} from './enums.js';
import type { AppSettings } from './schemas/admin.js';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Field-level validation messages keyed by dotted path. */
    fields?: Record<string, string>;
    details?: unknown;
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** The only user information shown to other members: never includes email. */
export interface PublicUser {
  id: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  companyName: string | null;
  jobTitle: string | null;
  createdAt: string;
}

export interface JobCategory {
  id: string;
  name: string;
  slug: string;
}

export interface JobFreshness {
  /** The application deadline has passed. This does NOT mean the employer has closed the role. */
  deadlinePassed: boolean;
  /** Nobody has updated or confirmed the job within the configured freshness window. */
  stale: boolean;
}

export interface JobSummary {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  category: JobCategory | null;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceMin: number | null;
  experienceMax: number | null;
  requiredSkills: string[];
  summary: string;
  status: JobStatus;
  referralAvailable: boolean;
  applicationDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string;
  createdBy: PublicUser;
  lastEditedBy: PublicUser | null;
  version: number;
  isSaved: boolean;
  freshness: JobFreshness;
  archivedAt: string | null;
}

export interface JobDetail extends JobSummary {
  categoryId: string | null;
  department: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: Currency | null;
  numberOfOpenings: number | null;
  description: string;
  responsibilities: string | null;
  preferredSkills: string[];
  eligibility: string | null;
  posterCanRefer: boolean;
  referralInstructions: string | null;
  applicationUrl: string | null;
  recruiterUrl: string | null;
  applicantNotes: string | null;
  statusConfirmedAt: string | null;
  editorCount: number;
  /** The viewer's most recent referral request for this job, if any. */
  viewerReferral: { id: string; status: ReferralStatus } | null;
}

export interface ReferralRequestItem {
  id: string;
  status: ReferralStatus;
  message: string;
  profileUrl: string | null;
  responseNote: string | null;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  job: { id: string; slug: string; title: string; companyName: string; status: JobStatus; archivedAt: string | null };
  /** The requester shares their email with the referrer only, so it is null for everyone else. */
  requester: PublicUser & { email: string | null };
  referrer: PublicUser;
}

export interface ReferralList extends Paginated<ReferralRequestItem> {
  /** Requests waiting for the viewer's response, independent of the current filter. */
  pendingReceived: number;
}

export interface DuplicateCandidate {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  location: string | null;
  status: JobStatus;
  createdAt: string;
}

export interface JobHistoryEntry {
  id: string;
  action: JobHistoryAction;
  actor: PublicUser;
  changedFields: string[];
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  reason: string | null;
  version: number;
  createdAt: string;
}

export interface JobStatusHistoryEntry {
  id: string;
  actor: PublicUser;
  previousStatus: JobStatus | null;
  newStatus: JobStatus;
  reason: string | null;
  createdAt: string;
}

export interface JobHistoryResponse {
  edits: JobHistoryEntry[];
  statusChanges: JobStatusHistoryEntry[];
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList extends Paginated<NotificationItem> {
  unreadCount: number;
}

export interface PublicConfig {
  publicBrowsingEnabled: boolean;
  registrationEnabled: boolean;
  allowedEmailDomains: string[];
  categories: JobCategory[];
}

// ---- Administration ----

export interface AdminUser extends CurrentUser {
  lastLoginAt: string | null;
  activeSessions: number;
  jobsPosted: number;
}

export interface AdminDashboard {
  totals: {
    users: number;
    verifiedMembers: number;
    suspendedUsers: number;
    activeJobs: number;
    closedJobs: number;
    archivedJobs: number;
    pendingReports: number;
    /** Referral requests the referrer marked as referred. */
    referralsMade: number;
  };
  recentJobs: (JobSummary & { lastAction: JobHistoryAction | null })[];
}

export interface AdminReport {
  id: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: PublicUser;
  resolvedBy: PublicUser | null;
  job: {
    id: string;
    slug: string;
    title: string;
    companyName: string;
    status: JobStatus;
    archivedAt: string | null;
  };
  openReportsForJob: number;
}

export interface AdminJob extends JobSummary {
  archiveReason: string | null;
  openReports: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actor: PublicUser | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminCategory extends JobCategory {
  isActive: boolean;
  sortOrder: number;
  jobCount: number;
}

export type { AppSettings };
