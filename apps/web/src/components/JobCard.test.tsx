import { screen } from '@testing-library/react';
import { member, renderWithProviders, sampleJob } from '@/test/render';
import { JobCard } from './JobCard';

describe('JobCard', () => {
  it('shows the key facts and attribution', () => {
    renderWithProviders(<JobCard job={sampleJob} />);
    expect(screen.getByRole('link', { name: 'Senior Software Engineer' })).toHaveAttribute('href', `/jobs/${sampleJob.slug}`);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/Full-time · 3–5 years/)).toBeInTheDocument();
    expect(screen.getByText('Referral available')).toBeInTheDocument();
    expect(screen.getByText(/Arjun Mehta/)).toBeInTheDocument();
  });

  it('hides edit and save for guests but shows them to verified members', () => {
    const { unmount } = renderWithProviders(<JobCard job={sampleJob} />, { user: null });
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save job' })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<JobCard job={sampleJob} />, { user: member });
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/jobs/${sampleJob.slug}/edit`);
    expect(screen.getByRole('button', { name: 'Save job' })).toBeInTheDocument();
  });

  it('hides edit for unverified members', () => {
    renderWithProviders(<JobCard job={sampleJob} />, { user: { ...member, emailVerified: false } });
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('flags a passed deadline on active jobs without calling them closed', () => {
    renderWithProviders(<JobCard job={{ ...sampleJob, freshness: { deadlinePassed: true, stale: false } }} />);
    expect(screen.getByText(/Deadline passed — status needs confirmation/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
