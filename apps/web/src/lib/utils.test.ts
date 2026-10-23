import { toQueryString } from '@/api/client';
import { safeNext } from '@/auth/useAuth';
import { initials } from './initials';

describe('safeNext', () => {
  it('allows same-site paths only', () => {
    expect(safeNext('/jobs/new')).toBe('/jobs/new');
    expect(safeNext('//evil.example.com')).toBe('/jobs');
    expect(safeNext('/\\evil.example.com')).toBe('/jobs');
    expect(safeNext('https://evil.example.com')).toBe('/jobs');
    expect(safeNext(null, '/')).toBe('/');
  });
});

describe('toQueryString', () => {
  it('skips empty values and joins lists', () => {
    expect(toQueryString({ q: 'react dev', skills: ['a', 'b'], empty: '', none: undefined, page: 2, list: [] })).toBe(
      '?q=react+dev&skills=a%2Cb&page=2',
    );
    expect(toQueryString({})).toBe('');
  });
});

describe('initials', () => {
  it('uses up to two words', () => {
    expect(initials('asha  rao kumar')).toBe('AR');
    expect(initials('Priya')).toBe('P');
  });
});
