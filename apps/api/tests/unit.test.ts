import { describe, expect, it } from 'vitest';
import { jobSearchSchema } from '@referloop/shared';
import { diffSnapshots, normalizeSkills, type JobSnapshot } from '../src/modules/jobs/jobs.diff.js';
import { buildJobSearchWhere, escapeLike } from '../src/modules/jobs/jobs.search.js';
import { computeFreshness } from '../src/modules/jobs/jobs.serializer.js';
import { isEmailDomainAllowed } from '../src/modules/settings/settings.service.js';

describe('diffSnapshots', () => {
  it('reports only changed fields with previous and new values', () => {
    const before = { title: 'A', requiredSkills: ['x', 'y'], salaryMin: null, applicationDeadline: '2026-01-01' } as unknown as JobSnapshot;
    const after = { title: 'B', requiredSkills: ['x', 'y'], salaryMin: 10, applicationDeadline: '2026-01-01' } as unknown as JobSnapshot;
    const diff = diffSnapshots(before, after);
    expect(diff.changedFields).toEqual(['title', 'salaryMin']);
    expect(diff.previousValues).toEqual({ title: 'A', salaryMin: null });
    expect(diff.newValues).toEqual({ title: 'B', salaryMin: 10 });
  });

  it('treats skill re-ordering as a change', () => {
    const diff = diffSnapshots(
      { requiredSkills: ['a', 'b'] } as unknown as JobSnapshot,
      { requiredSkills: ['b', 'a'] } as unknown as JobSnapshot,
    );
    expect(diff.changedFields).toEqual(['requiredSkills']);
  });
});

describe('normalizeSkills', () => {
  it('lower-cases and de-duplicates across lists', () => {
    expect(normalizeSkills(['React', 'Node.js'], ['react', ' SQL '])).toEqual(['react', 'node.js', 'sql']);
  });
});

describe('computeFreshness', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const base = {
    status: 'ACTIVE' as const,
    applicationDeadline: null,
    updatedAt: new Date('2026-06-10T00:00:00Z'),
    statusChangedAt: new Date('2026-06-01T00:00:00Z'),
    statusConfirmedAt: null,
  };
  it('flags passed deadlines and stale listings for active jobs only', () => {
    expect(computeFreshness({ ...base, applicationDeadline: new Date('2026-06-14T00:00:00Z') }, 30, now)).toEqual({
      deadlinePassed: true,
      stale: false,
    });
    expect(computeFreshness({ ...base, applicationDeadline: new Date('2026-06-15T00:00:00Z') }, 30, now).deadlinePassed).toBe(false);
    expect(
      computeFreshness({ ...base, updatedAt: new Date('2026-04-01T00:00:00Z'), statusChangedAt: new Date('2026-04-01T00:00:00Z') }, 30, now)
        .stale,
    ).toBe(true);
    expect(computeFreshness({ ...base, status: 'CLOSED', applicationDeadline: new Date('2020-01-01') }, 30, now)).toEqual({
      deadlinePassed: false,
      stale: false,
    });
  });
  it('treats a recent confirmation as fresh', () => {
    const old = new Date('2026-01-01T00:00:00Z');
    expect(
      computeFreshness({ ...base, updatedAt: old, statusChangedAt: old, statusConfirmedAt: new Date('2026-06-14T00:00:00Z') }, 30, now)
        .stale,
    ).toBe(false);
  });
});

describe('buildJobSearchWhere', () => {
  it('always excludes archived jobs and defaults to active', () => {
    const where = buildJobSearchWhere(jobSearchSchema.parse({}));
    expect(where.AND).toEqual([{ archivedAt: null }, { status: 'ACTIVE' }]);
  });
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

describe('isEmailDomainAllowed', () => {
  it('allows everything when no domains are configured and matches subdomains', () => {
    expect(isEmailDomainAllowed('a@x.com', [])).toBe(true);
    expect(isEmailDomainAllowed('a@eu.corp.com', ['corp.com'])).toBe(true);
    expect(isEmailDomainAllowed('a@evilcorp.com', ['corp.com'])).toBe(false);
  });
});
