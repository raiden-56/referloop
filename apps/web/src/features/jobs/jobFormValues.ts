import type { JobDetail, JobUpdateInput } from '@referloop/shared';

/** Form values: the update schema's input type (create simply ignores status/version/reason). */
export type JobFormValues = JobUpdateInput;

export const emptyJobForm: JobFormValues = {
  title: '',
  companyName: '',
  categoryId: '',
  department: '',
  location: '',
  workMode: 'HYBRID',
  employmentType: 'FULL_TIME',
  experienceMin: null,
  experienceMax: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: '',
  numberOfOpenings: null,
  summary: '',
  description: '',
  responsibilities: '',
  requiredSkills: [],
  preferredSkills: [],
  eligibility: '',
  referralAvailable: false,
  posterCanRefer: false,
  referralInstructions: '',
  applicationUrl: '',
  recruiterUrl: '',
  applicantNotes: '',
  applicationDeadline: '',
  status: 'ACTIVE',
  version: 1,
  reason: '',
};

/** Pre-populates the form from a stored job (nulls become empty strings for text inputs). */
export function jobToFormValues(job: JobDetail): JobFormValues {
  return {
    title: job.title,
    companyName: job.companyName,
    categoryId: job.categoryId ?? '',
    department: job.department ?? '',
    location: job.location ?? '',
    workMode: job.workMode,
    employmentType: job.employmentType,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency ?? '',
    numberOfOpenings: job.numberOfOpenings,
    summary: job.summary,
    description: job.description,
    responsibilities: job.responsibilities ?? '',
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    eligibility: job.eligibility ?? '',
    referralAvailable: job.referralAvailable,
    posterCanRefer: job.posterCanRefer,
    referralInstructions: job.referralInstructions ?? '',
    applicationUrl: job.applicationUrl ?? '',
    recruiterUrl: job.recruiterUrl ?? '',
    applicantNotes: job.applicantNotes ?? '',
    applicationDeadline: job.applicationDeadline ?? '',
    status: job.status,
    version: job.version,
    reason: '',
  };
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
