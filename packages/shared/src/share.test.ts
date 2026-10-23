import { describe, expect, it } from 'vitest';
import { buildJobUrl, buildShareMessage, buildWhatsAppUrl, type ShareableJob } from './share.js';

const job: ShareableJob = {
  slug: 'senior-software-engineer-example-company-ab12cd',
  title: 'Senior Software Engineer',
  companyName: 'Example Company',
  location: 'Bangalore',
  workMode: 'HYBRID',
  experienceMin: 3,
  experienceMax: 5,
  requiredSkills: ['React', 'TypeScript', 'Node.js'],
  summary: 'Build the core product with a small, senior team.',
  status: 'ACTIVE',
  referralAvailable: true,
  posterCanRefer: true,
  applicationUrl: 'https://careers.example.com/jobs/123',
};

describe('buildShareMessage', () => {
  it('produces the documented message format', () => {
    const msg = buildShareMessage(job, 'https://referloop.example.com/');
    expect(msg).toBe(
      [
        'Job Opening: Senior Software Engineer',
        'Company: Example Company',
        'Experience: 3–5 years',
        'Location: Bangalore',
        'Work Mode: Hybrid',
        'Skills: React, TypeScript, Node.js',
        'Status: Active',
        '',
        'Referral information and job requirements:',
        'Referral available — the poster can personally refer applicants.',
        'Build the core product with a small, senior team.',
        '',
        'View full details:',
        'https://referloop.example.com/jobs/senior-software-engineer-example-company-ab12cd',
        '',
        'Official application:',
        'https://careers.example.com/jobs/123',
      ].join('\n'),
    );
  });

  it('reflects closed status', () => {
    expect(buildShareMessage({ ...job, status: 'CLOSED' }, 'https://x.io')).toContain('Status: Closed (no longer accepting applications)');
  });

  it('never claims a referral the poster has not confirmed', () => {
    const msg = buildShareMessage({ ...job, referralAvailable: false, posterCanRefer: false }, 'https://x.io');
    expect(msg).not.toMatch(/Referral available/);
  });

  it('omits missing optional data instead of inventing it', () => {
    const msg = buildShareMessage(
      { ...job, experienceMin: null, experienceMax: null, location: null, workMode: 'REMOTE', applicationUrl: null },
      'https://x.io',
    );
    expect(msg).not.toContain('Experience:');
    expect(msg).not.toContain('Location:');
    expect(msg).not.toContain('Official application');
    expect(msg).toContain('Work Mode: Remote');
  });

  it('drops unsafe application links', () => {
    const msg = buildShareMessage({ ...job, applicationUrl: 'javascript:alert(1)' }, 'https://x.io');
    expect(msg).not.toContain('javascript:');
  });
});

describe('buildWhatsAppUrl', () => {
  it('encodes newlines, ampersands and unicode', () => {
    const url = buildWhatsAppUrl('A & B\nC – D #1');
    expect(url).toBe('https://wa.me/?text=A%20%26%20B%0AC%20%E2%80%93%20D%20%231');
    expect(decodeURIComponent(url.split('text=')[1]!)).toBe('A & B\nC – D #1');
  });
});

describe('buildJobUrl', () => {
  it('joins without double slashes', () => {
    expect(buildJobUrl('https://a.io///', 'x-y')).toBe('https://a.io/jobs/x-y');
  });
});
