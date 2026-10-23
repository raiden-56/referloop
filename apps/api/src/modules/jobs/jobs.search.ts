import type { JobSearchQuery, JobSort } from '@referloop/shared';
import type { Prisma } from '../../lib/prisma.js';

const DAY = 24 * 60 * 60 * 1000;
const MAX_TERMS = 6;

/** Each whitespace-separated term must match at least one searchable field. */
export function textSearchWhere(q: string | undefined): Prisma.JobWhereInput[] {
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
  return terms.map((term) => {
    const like = escapeLike(term);
    return {
      OR: [
        { title: { contains: like, mode: 'insensitive' } },
        { companyName: { contains: like, mode: 'insensitive' } },
        { location: { contains: like, mode: 'insensitive' } },
        { summary: { contains: like, mode: 'insensitive' } },
        { description: { contains: like, mode: 'insensitive' } },
        { skillsNormalized: { has: term.toLowerCase() } },
      ],
    };
  });
}

/** Builds the WHERE clause for the public job board. Archived listings are never included. */
export function buildJobSearchWhere(query: JobSearchQuery, now = new Date()): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [{ archivedAt: null }, ...textSearchWhere(query.q)];

  if (query.status === 'active') and.push({ status: 'ACTIVE' });
  else if (query.status === 'closed') and.push({ status: 'CLOSED' });

  if (query.company) and.push({ companyName: { contains: escapeLike(query.company), mode: 'insensitive' } });
  if (query.category) and.push({ category: { slug: query.category } });
  if (query.location) and.push({ location: { contains: escapeLike(query.location), mode: 'insensitive' } });
  if (query.skills.length) and.push({ skillsNormalized: { hasEvery: query.skills.map((s) => s.toLowerCase()) } });
  if (query.workMode.length) and.push({ workMode: { in: query.workMode } });
  if (query.employmentType.length) and.push({ employmentType: { in: query.employmentType } });

  // Experience: keep jobs whose [min, max] range overlaps the requested range. Unspecified bounds are open.
  if (query.expMax !== undefined) and.push({ OR: [{ experienceMin: null }, { experienceMin: { lte: query.expMax } }] });
  if (query.expMin !== undefined) and.push({ OR: [{ experienceMax: null }, { experienceMax: { gte: query.expMin } }] });

  if (query.referral) and.push({ referralAvailable: true });
  if (query.postedWithin) and.push({ createdAt: { gte: new Date(now.getTime() - Number(query.postedWithin) * DAY) } });

  return { AND: and };
}

export function jobOrderBy(sort: JobSort): Prisma.JobOrderByWithRelationInput[] {
  switch (sort) {
    case 'updated':
      return [{ updatedAt: 'desc' }, { id: 'asc' }];
    case 'title':
      return [{ title: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }];
    case 'company':
      return [{ companyName: 'asc' }, { title: 'asc' }, { id: 'asc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}

/** Escapes LIKE wildcards so user input is matched literally (Prisma's `contains` does not escape them). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
