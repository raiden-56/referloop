import { describe, expect, it } from 'vitest';
import { jobInputSchema, jobSearchSchema } from './schemas/job.js';
import { registerSchema } from './schemas/auth.js';
import { isSafeExternalUrl } from './url.js';
import { formatExperience } from './format.js';

const validJob = {
  title: 'Backend Engineer',
  companyName: 'Acme',
  workMode: 'ONSITE',
  employmentType: 'FULL_TIME',
  location: 'Pune',
  summary: 'Own our payments APIs end to end.',
  description: 'You will design, build and operate the services that move money for our customers every day.',
  requiredSkills: ['Go', 'go', ' PostgreSQL '],
  preferredSkills: [],
  referralAvailable: false,
  posterCanRefer: false,
} as const;

describe('jobInputSchema', () => {
  it('normalises optional values and de-duplicates skills', () => {
    const parsed = jobInputSchema.parse({ ...validJob, department: '  ', applicationUrl: '' });
    expect(parsed.department).toBeNull();
    expect(parsed.applicationUrl).toBeNull();
    expect(parsed.requiredSkills).toEqual(['Go', 'PostgreSQL']);
  });

  it('requires a location unless fully remote', () => {
    expect(jobInputSchema.safeParse({ ...validJob, location: '' }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...validJob, location: '', workMode: 'REMOTE' }).success).toBe(true);
  });

  it('rejects inverted ranges and salary without currency', () => {
    const r = jobInputSchema.safeParse({ ...validJob, experienceMin: 5, experienceMax: 2, salaryMin: 10 });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['experienceMax', 'salaryCurrency']));
  });

  it('rejects unsafe links', () => {
    for (const url of ['javascript:alert(1)', 'ftp://a.com/x', 'https://user:pw@a.com', 'http://localhost/x', 'http://10.0.0.1/']) {
      expect(jobInputSchema.safeParse({ ...validJob, applicationUrl: url }).success, url).toBe(false);
    }
  });

  it('does not allow claiming personal referral without referral availability', () => {
    expect(jobInputSchema.safeParse({ ...validJob, posterCanRefer: true }).success).toBe(false);
  });
});

describe('jobSearchSchema', () => {
  it('applies defaults and parses lists', () => {
    const q = jobSearchSchema.parse({ workMode: 'REMOTE,HYBRID', skills: 'react, ,node' });
    expect(q).toMatchObject({ status: 'active', sort: 'newest', page: 1, workMode: ['REMOTE', 'HYBRID'], skills: ['react', 'node'] });
  });

  it('falls back on invalid sort or status instead of failing', () => {
    expect(jobSearchSchema.parse({ sort: 'evil', status: 'x' })).toMatchObject({ sort: 'newest', status: 'active' });
  });
});

describe('registerSchema', () => {
  const base = {
    name: 'Asha Rao',
    email: '  Asha@Example.COM ',
    password: 'longpassword1',
    confirmPassword: 'longpassword1',
    acceptTerms: true,
  };
  it('normalises email', () => {
    expect(registerSchema.parse(base).email).toBe('asha@example.com');
  });
  it('requires matching passwords, strength and terms', () => {
    expect(registerSchema.safeParse({ ...base, confirmPassword: 'other' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });
});

describe('helpers', () => {
  it('isSafeExternalUrl', () => {
    expect(isSafeExternalUrl('https://careers.example.com/a?b=1')).toBe(true);
    expect(isSafeExternalUrl('data:text/html,hi')).toBe(false);
  });
  it('formatExperience', () => {
    expect(formatExperience(3, 5)).toBe('3–5 years');
    expect(formatExperience(2, null)).toBe('2+ years');
    expect(formatExperience(null, 1)).toBe('Up to 1 year');
    expect(formatExperience(null, null)).toBeNull();
  });
});
