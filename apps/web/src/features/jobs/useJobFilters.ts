import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  EMPLOYMENT_TYPES,
  JOB_SORTS,
  POSTED_WITHIN,
  STATUS_FILTERS,
  WORK_MODES,
  type EmploymentType,
  type JobSort,
  type PostedWithin,
  type StatusFilter,
  type WorkMode,
} from '@referloop/shared';

export interface JobFilters {
  q: string;
  company: string;
  category: string;
  location: string;
  skills: string[];
  workMode: WorkMode[];
  employmentType: EmploymentType[];
  expMin: string;
  expMax: string;
  postedWithin: PostedWithin | '';
  referral: boolean;
  status: StatusFilter;
  sort: JobSort;
  page: number;
}

const list = (v: string | null) =>
  v
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
const oneOf = <T extends string>(allowed: readonly T[], v: string | null, fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const years = (v: string | null) => (v && /^\d{1,2}$/.test(v) ? v : '');

export const PAGE_SIZE = 12;

/** Job board filters live in the URL so searches are shareable and survive reloads. */
export function useJobFilters() {
  const [params, setParams] = useSearchParams();

  const filters: JobFilters = useMemo(
    () => ({
      q: params.get('q') ?? '',
      company: params.get('company') ?? '',
      category: params.get('category') ?? '',
      location: params.get('location') ?? '',
      skills: list(params.get('skills')),
      workMode: list(params.get('workMode')).filter((m): m is WorkMode => (WORK_MODES as readonly string[]).includes(m)),
      employmentType: list(params.get('employmentType')).filter((t): t is EmploymentType =>
        (EMPLOYMENT_TYPES as readonly string[]).includes(t),
      ),
      expMin: years(params.get('expMin')),
      expMax: years(params.get('expMax')),
      postedWithin: oneOf([...POSTED_WITHIN, ''] as const, params.get('postedWithin'), ''),
      referral: params.get('referral') === 'true',
      status: oneOf(STATUS_FILTERS, params.get('status'), 'active'),
      sort: oneOf(JOB_SORTS, params.get('sort'), 'newest'),
      page: Math.max(1, Number(params.get('page')) || 1),
    }),
    [params],
  );

  /** Applies changes; any change other than paging returns to page 1. */
  const update = useCallback(
    (patch: Partial<JobFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            const str = Array.isArray(value) ? value.join(',') : value === false ? '' : String(value ?? '');
            const isDefault =
              str === '' ||
              (key === 'status' && str === 'active') ||
              (key === 'sort' && str === 'newest') ||
              (key === 'page' && str === '1');
            if (isDefault) next.delete(key);
            else next.set(key, str);
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: !('page' in patch) },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams();
      const sort = prev.get('sort');
      if (sort) next.set('sort', sort);
      return next;
    });
  }, [setParams]);

  const activeCount =
    (filters.company ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.location ? 1 : 0) +
    (filters.skills.length ? 1 : 0) +
    (filters.workMode.length ? 1 : 0) +
    (filters.employmentType.length ? 1 : 0) +
    (filters.expMin || filters.expMax ? 1 : 0) +
    (filters.postedWithin ? 1 : 0) +
    (filters.referral ? 1 : 0) +
    (filters.status !== 'active' ? 1 : 0);

  const apiParams = useMemo(
    () => ({
      q: filters.q,
      company: filters.company,
      category: filters.category,
      location: filters.location,
      skills: filters.skills,
      workMode: filters.workMode,
      employmentType: filters.employmentType,
      expMin: filters.expMin,
      expMax: filters.expMax,
      postedWithin: filters.postedWithin,
      referral: filters.referral ? 'true' : undefined,
      status: filters.status,
      sort: filters.sort,
      page: filters.page,
      pageSize: PAGE_SIZE,
    }),
    [filters],
  );

  return { filters, update, clear, activeCount, apiParams };
}
