import { JOB_STATUS_LABELS, WORK_MODE_LABELS, type JobStatus, type WorkMode } from './enums.js';
import { formatExperience } from './format.js';
import { isSafeExternalUrl } from './url.js';

/** The subset of job data that may appear in a shared message. No account information is included. */
export interface ShareableJob {
  slug: string;
  title: string;
  companyName: string;
  location: string | null;
  workMode: WorkMode;
  experienceMin: number | null;
  experienceMax: number | null;
  requiredSkills: string[];
  summary: string;
  status: JobStatus;
  referralAvailable: boolean;
  posterCanRefer?: boolean;
  applicationUrl?: string | null;
}

/** Canonical public URL of a job page, e.g. https://referloop.example.com/jobs/senior-engineer-acme-x1y2z3 */
export function buildJobUrl(appUrl: string, slug: string): string {
  return `${appUrl.replace(/\/+$/, '')}/jobs/${encodeURIComponent(slug)}`;
}

const MAX_SKILLS_IN_MESSAGE = 8;

/**
 * Builds the plain-text message used for WhatsApp and "copy details". Every line comes from the
 * stored job; optional lines are omitted rather than filled with placeholders, and the official
 * application link is only included when it is a valid external URL.
 */
export function buildShareMessage(job: ShareableJob, appUrl: string): string {
  const lines: string[] = [];
  lines.push(`Job Opening: ${job.title}`);
  lines.push(`Company: ${job.companyName}`);

  const experience = formatExperience(job.experienceMin, job.experienceMax);
  if (experience) lines.push(`Experience: ${experience}`);
  if (job.location) lines.push(`Location: ${job.location}`);
  lines.push(`Work Mode: ${WORK_MODE_LABELS[job.workMode]}`);

  if (job.requiredSkills.length > 0) {
    const skills = job.requiredSkills.slice(0, MAX_SKILLS_IN_MESSAGE).join(', ');
    const more = job.requiredSkills.length > MAX_SKILLS_IN_MESSAGE ? ` +${job.requiredSkills.length - MAX_SKILLS_IN_MESSAGE} more` : '';
    lines.push(`Skills: ${skills}${more}`);
  }

  lines.push(
    job.status === 'CLOSED'
      ? `Status: ${JOB_STATUS_LABELS.CLOSED} (no longer accepting applications)`
      : `Status: ${JOB_STATUS_LABELS.ACTIVE}`,
  );

  lines.push('');
  lines.push('Referral information and job requirements:');
  if (job.referralAvailable) {
    lines.push(
      job.posterCanRefer
        ? 'Referral available — the poster can personally refer applicants.'
        : 'Referral available — see the job page for referral instructions.',
    );
  }
  lines.push(job.summary.trim());

  lines.push('');
  lines.push('View full details:');
  lines.push(buildJobUrl(appUrl, job.slug));

  if (job.applicationUrl && isSafeExternalUrl(job.applicationUrl)) {
    lines.push('');
    lines.push('Official application:');
    lines.push(job.applicationUrl);
  }

  return lines.join('\n');
}

/** wa.me works on mobile (opens the app) and desktop (opens WhatsApp Web / Desktop). */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
