import { JOB_EDITABLE_FIELDS, type JobEditableField, type JobInputParsed } from '@referloop/shared';
import type { Job } from '../../generated/prisma/client.js';
import { toDateOnly } from './jobs.serializer.js';

export type JobSnapshot = Record<JobEditableField, unknown>;

/** Editable fields of a stored job in the same shape as validated input (dates as YYYY-MM-DD). */
export function snapshotJob(job: Job): JobSnapshot {
  const out = {} as JobSnapshot;
  for (const field of JOB_EDITABLE_FIELDS) {
    const value = job[field];
    out[field] = value instanceof Date ? toDateOnly(value) : value;
  }
  return out;
}

export function snapshotInput(input: JobInputParsed): JobSnapshot {
  const out = {} as JobSnapshot;
  for (const field of JOB_EDITABLE_FIELDS) out[field] = input[field];
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface JobDiff {
  changedFields: JobEditableField[];
  previousValues: Partial<JobSnapshot>;
  newValues: Partial<JobSnapshot>;
}

export function diffSnapshots(before: JobSnapshot, after: JobSnapshot): JobDiff {
  const diff: JobDiff = { changedFields: [], previousValues: {}, newValues: {} };
  for (const field of JOB_EDITABLE_FIELDS) {
    if (same(before[field], after[field])) continue;
    diff.changedFields.push(field);
    diff.previousValues[field] = before[field] ?? null;
    diff.newValues[field] = after[field] ?? null;
  }
  return diff;
}

/** Converts validated job input into Prisma column values. */
export function toJobData(input: JobInputParsed) {
  const data = snapshotInput(input) as Record<JobEditableField, never>;
  return {
    ...data,
    applicationDeadline: input.applicationDeadline ? new Date(`${input.applicationDeadline}T00:00:00.000Z`) : null,
    skillsNormalized: normalizeSkills(input.requiredSkills, input.preferredSkills),
  };
}

export function normalizeSkills(...lists: string[][]): string[] {
  return [
    ...new Set(
      lists
        .flat()
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
