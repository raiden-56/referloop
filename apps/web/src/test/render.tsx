import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CurrentUser, JobDetail } from '@referloop/shared';
import { keys } from '@/api/queries';
import { NotifierProvider } from '@/components/Notifier';
import { theme } from '@/theme';

/** Renders with router, theme, query client and toasts. `user` seeds the signed-in member (or guest). */
export function renderWithProviders(ui: ReactElement, opts: { user?: CurrentUser | null; route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.me, opts.user ?? null);
  return {
    client,
    ...render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={client}>
          <NotifierProvider>
            <MemoryRouter initialEntries={[opts.route ?? '/']}>{ui}</MemoryRouter>
          </NotifierProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  };
}

export const member: CurrentUser = {
  id: 'u1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  role: 'MEMBER',
  accountStatus: 'ACTIVE',
  emailVerified: true,
  companyName: null,
  jobTitle: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const sampleJob: JobDetail = {
  id: '6a1c3b0e-0000-4000-8000-000000000001',
  slug: 'senior-software-engineer-example-company-ab12cd',
  title: 'Senior Software Engineer',
  companyName: 'Example Company',
  category: null,
  categoryId: null,
  department: null,
  location: 'Bangalore',
  workMode: 'HYBRID',
  employmentType: 'FULL_TIME',
  experienceMin: 3,
  experienceMax: 5,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  numberOfOpenings: null,
  requiredSkills: ['React', 'TypeScript', 'Node.js'],
  preferredSkills: [],
  summary: 'Build the core product with a small, senior team.',
  description: 'Long description',
  responsibilities: null,
  eligibility: null,
  status: 'ACTIVE',
  referralAvailable: true,
  posterCanRefer: true,
  referralInstructions: null,
  applicationUrl: 'https://careers.example.com/jobs/123',
  recruiterUrl: null,
  applicantNotes: null,
  applicationDeadline: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  statusChangedAt: '2026-10-01T10:00:00.000Z',
  statusConfirmedAt: null,
  createdBy: { id: 'u2', name: 'Arjun Mehta' },
  lastEditedBy: null,
  version: 1,
  isSaved: false,
  freshness: { deadlinePassed: false, stale: false },
  archivedAt: null,
  editorCount: 1,
  viewerReferral: null,
};
