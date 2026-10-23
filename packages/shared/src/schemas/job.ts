import { z } from 'zod';
import {
  CURRENCIES,
  EMPLOYMENT_TYPES,
  JOB_SORTS,
  JOB_STATUSES,
  POSTED_WITHIN,
  REPORT_REASONS,
  STATUS_FILTERS,
  WORK_MODES,
} from '../enums.js';
import { cleanText, optionalText, optionalUrl, paginationSchema, requiredText } from './common.js';

export const MAX_SKILLS = 25;
export const MAX_EXPERIENCE_YEARS = 50;

const skillList = (label: string) =>
  z
    .array(
      z.string().transform(cleanText).pipe(z.string().min(1, 'Skill cannot be empty').max(40, 'Each skill must be at most 40 characters')),
    )
    .max(MAX_SKILLS, `${label}: at most ${MAX_SKILLS} skills`)
    // De-duplicate case-insensitively while keeping the first spelling the user typed.
    .transform((skills) => {
      const seen = new Set<string>();
      return skills.filter((s) => {
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

const years = z
  .number({ error: 'Enter a number of years' })
  .int('Use whole years')
  .min(0, 'Cannot be negative')
  .max(MAX_EXPERIENCE_YEARS, `At most ${MAX_EXPERIENCE_YEARS} years`)
  .nullish()
  .transform((v) => v ?? null);

const money = z
  .number({ error: 'Enter an amount' })
  .int('Use whole amounts')
  .min(0, 'Cannot be negative')
  .max(1_000_000_000, 'Amount is too large')
  .nullish()
  .transform((v) => v ?? null);

/** ISO date (YYYY-MM-DD) or null. */
const optionalDate = z
  .union([z.iso.date('Enter a valid date'), z.literal('')])
  .nullish()
  .transform((v) => (v ? v : null));

const jobFields = z.object({
  title: requiredText('Job title', 3, 150),
  companyName: requiredText('Company name', 1, 120),
  categoryId: z
    .union([z.uuid('Invalid category'), z.literal('')])
    .nullish()
    .transform((v) => (v ? v : null)),
  department: optionalText('Department', 120),
  location: optionalText('Location', 150),
  workMode: z.enum(WORK_MODES, { error: 'Select a work mode' }),
  employmentType: z.enum(EMPLOYMENT_TYPES, { error: 'Select an employment type' }),
  experienceMin: years,
  experienceMax: years,
  salaryMin: money,
  salaryMax: money,
  salaryCurrency: z
    .union([z.enum(CURRENCIES), z.literal('')])
    .nullish()
    .transform((v) => (v ? v : null)),
  numberOfOpenings: z
    .number({ error: 'Enter a number' })
    .int()
    .min(1, 'At least 1')
    .max(1000, 'At most 1000')
    .nullish()
    .transform((v) => v ?? null),
  summary: requiredText('Short summary', 20, 500),
  description: requiredText('Full job description', 50, 20_000),
  responsibilities: optionalText('Responsibilities', 10_000),
  requiredSkills: skillList('Required skills'),
  preferredSkills: skillList('Preferred skills'),
  eligibility: optionalText('Eligibility requirements', 5_000),
  referralAvailable: z.boolean(),
  posterCanRefer: z.boolean(),
  referralInstructions: optionalText('Referral instructions', 2_000),
  applicationUrl: optionalUrl('Application URL'),
  recruiterUrl: optionalUrl('Recruiter or careers-page URL'),
  applicantNotes: optionalText('Additional notes', 2_000),
  applicationDeadline: optionalDate,
});

type JobFieldsOutput = z.output<typeof jobFields>;

function checkJobConsistency(job: JobFieldsOutput, ctx: z.RefinementCtx) {
  if (job.workMode !== 'REMOTE' && !job.location) {
    ctx.addIssue({ code: 'custom', path: ['location'], message: 'Location is required unless the role is fully remote' });
  }
  if (job.experienceMin !== null && job.experienceMax !== null && job.experienceMax < job.experienceMin) {
    ctx.addIssue({ code: 'custom', path: ['experienceMax'], message: 'Maximum must be greater than or equal to minimum' });
  }
  if (job.salaryMin !== null && job.salaryMax !== null && job.salaryMax < job.salaryMin) {
    ctx.addIssue({ code: 'custom', path: ['salaryMax'], message: 'Maximum must be greater than or equal to minimum' });
  }
  if ((job.salaryMin !== null || job.salaryMax !== null) && !job.salaryCurrency) {
    ctx.addIssue({ code: 'custom', path: ['salaryCurrency'], message: 'Select a currency for the salary range' });
  }
  if (job.posterCanRefer && !job.referralAvailable) {
    ctx.addIssue({
      code: 'custom',
      path: ['posterCanRefer'],
      message: 'Mark referral as available if you can personally refer applicants',
    });
  }
  if (job.requiredSkills.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['requiredSkills'], message: 'Add at least one required skill' });
  }
}

export const jobInputSchema = jobFields.superRefine(checkJobConsistency);
export type JobInput = z.input<typeof jobInputSchema>;
export type JobInputParsed = z.output<typeof jobInputSchema>;

export const changeReasonSchema = optionalText('Reason', 500);

export const jobUpdateSchema = jobFields
  .extend({
    status: z.enum(JOB_STATUSES).optional(),
    version: z.number().int().min(1),
    reason: changeReasonSchema,
  })
  .superRefine(checkJobConsistency);
export type JobUpdateInput = z.input<typeof jobUpdateSchema>;
export type JobUpdateParsed = z.output<typeof jobUpdateSchema>;

/** Fields recorded in edit history and compared when computing diffs. */
export const JOB_EDITABLE_FIELDS = [
  'title',
  'companyName',
  'categoryId',
  'department',
  'location',
  'workMode',
  'employmentType',
  'experienceMin',
  'experienceMax',
  'salaryMin',
  'salaryMax',
  'salaryCurrency',
  'numberOfOpenings',
  'summary',
  'description',
  'responsibilities',
  'requiredSkills',
  'preferredSkills',
  'eligibility',
  'referralAvailable',
  'posterCanRefer',
  'referralInstructions',
  'applicationUrl',
  'recruiterUrl',
  'applicantNotes',
  'applicationDeadline',
] as const satisfies readonly (keyof JobFieldsOutput)[];
export type JobEditableField = (typeof JOB_EDITABLE_FIELDS)[number];

export const JOB_FIELD_LABELS: Record<JobEditableField | 'status', string> = {
  title: 'Job title',
  companyName: 'Company',
  categoryId: 'Category',
  department: 'Department',
  location: 'Location',
  workMode: 'Work mode',
  employmentType: 'Employment type',
  experienceMin: 'Minimum experience',
  experienceMax: 'Maximum experience',
  salaryMin: 'Minimum salary',
  salaryMax: 'Maximum salary',
  salaryCurrency: 'Salary currency',
  numberOfOpenings: 'Number of openings',
  summary: 'Short summary',
  description: 'Full description',
  responsibilities: 'Responsibilities',
  requiredSkills: 'Required skills',
  preferredSkills: 'Preferred skills',
  eligibility: 'Eligibility requirements',
  referralAvailable: 'Referral available',
  posterCanRefer: 'Poster can refer',
  referralInstructions: 'Referral instructions',
  applicationUrl: 'Application URL',
  recruiterUrl: 'Recruiter / careers URL',
  applicantNotes: 'Applicant notes',
  applicationDeadline: 'Application deadline',
  status: 'Status',
};

export const statusChangeSchema = z.object({ reason: changeReasonSchema });
export type StatusChangeInput = z.input<typeof statusChangeSchema>;

/** Splits a comma-separated query parameter into a trimmed, non-empty list. */
const csv = <T extends z.ZodType<string, string>>(item: T) =>
  z
    .string()
    .max(500)
    .optional()
    .transform((s) =>
      s
        ? s
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(item).max(20));

const optionalQueryText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined));

const optionalYears = z.coerce.number().int().min(0).max(MAX_EXPERIENCE_YEARS).optional().catch(undefined);

export const jobSearchSchema = paginationSchema.extend({
  q: optionalQueryText(100),
  company: optionalQueryText(120),
  category: optionalQueryText(80),
  location: optionalQueryText(150),
  skills: csv(z.string().min(1).max(40)),
  workMode: csv(z.enum(WORK_MODES)),
  employmentType: csv(z.enum(EMPLOYMENT_TYPES)),
  expMin: optionalYears,
  expMax: optionalYears,
  postedWithin: z.enum(POSTED_WITHIN).optional().catch(undefined),
  referral: z.enum(['true']).optional().catch(undefined),
  status: z.enum(STATUS_FILTERS).default('active').catch('active'),
  sort: z.enum(JOB_SORTS).default('newest').catch('newest'),
});
export type JobSearchQuery = z.output<typeof jobSearchSchema>;

export const duplicateCheckSchema = z.object({
  title: z.string().trim().min(3).max(150),
  companyName: z.string().trim().min(1).max(120),
  location: z.string().trim().max(150).nullish(),
  excludeJobId: z.uuid().optional(),
});
export type DuplicateCheckInput = z.input<typeof duplicateCheckSchema>;

export const reportCreateSchema = z.object({
  reason: z.enum(REPORT_REASONS, { error: 'Select a reason' }),
  description: optionalText('Details', 2_000),
});
export type ReportCreateInput = z.input<typeof reportCreateSchema>;
