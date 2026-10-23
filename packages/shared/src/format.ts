import { EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS, type EmploymentType, type WorkMode } from './enums.js';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "3–5 years", "3+ years", "Up to 2 years", "Fresher" or null when not specified. */
export function formatExperience(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    if (min === max) return min === 0 ? 'Fresher' : plural(min, 'year');
    return `${min}–${max} years`;
  }
  if (min !== null) return min === 0 ? 'Any experience' : `${min}+ years`;
  return `Up to ${plural(max as number, 'year')}`;
}

export function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (min === null && max === null) return null;
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat('en', {
        style: currency ? 'currency' : 'decimal',
        currency: currency ?? undefined,
        maximumFractionDigits: 0,
        notation: n >= 100_000 ? 'compact' : 'standard',
      }).format(n);
    } catch {
      return `${currency ?? ''} ${n}`.trim();
    }
  };
  if (min !== null && max !== null) return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  if (min !== null) return `From ${fmt(min)}`;
  return `Up to ${fmt(max as number)}`;
}

export function formatLocation(location: string | null, workMode: WorkMode): string {
  if (!location) return workMode === 'REMOTE' ? 'Remote' : 'Location not specified';
  return location;
}

export const workModeLabel = (mode: WorkMode) => WORK_MODE_LABELS[mode];
export const employmentTypeLabel = (type: EmploymentType) => EMPLOYMENT_TYPE_LABELS[type];
