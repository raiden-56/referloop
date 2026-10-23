import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, sampleJob } from '@/test/render';
import { ShareMenu } from './ShareMenu';

describe('ShareMenu', () => {
  it('opens WhatsApp with the encoded job message and ReferLoop link', async () => {
    const target = { opener: {}, location: { href: '' } };
    const open = vi.spyOn(window, 'open').mockReturnValue(target as unknown as Window);
    renderWithProviders(<ShareMenu job={sampleJob} />);

    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Share on WhatsApp' }));

    await waitFor(() => expect(target.location.href).toMatch(/^https:\/\/wa\.me\/\?text=/));
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(target.opener).toBeNull();
    const text = decodeURIComponent(target.location.href.split('text=')[1]!);
    expect(text).toContain('Job Opening: Senior Software Engineer');
    expect(text).toContain('Status: Active');
    expect(text).toContain(`${window.location.origin}/jobs/${sampleJob.slug}`);
    expect(text).toContain('Official application:\nhttps://careers.example.com/jobs/123');
  });

  it('copies the job link and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithProviders(<ShareMenu job={sampleJob} />);

    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy job link' }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/jobs/${sampleJob.slug}`);
    expect(await screen.findByText('Job link copied to clipboard')).toBeInTheDocument();
  });
});
