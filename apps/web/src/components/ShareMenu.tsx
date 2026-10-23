import { useState, type MouseEvent } from 'react';
import { Button, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Link2, MessageCircle, Share2 } from 'lucide-react';
import { buildJobUrl, buildShareMessage, buildWhatsAppUrl, type JobDetail, type JobSummary } from '@referloop/shared';
import { api } from '@/api/client';
import { keys } from '@/api/queries';
import { copyText } from '@/lib/clipboard';
import { useNotify } from './notify';

interface Props {
  job: JobSummary | JobDetail;
  variant?: 'button' | 'icon';
}

const appOrigin = () => window.location.origin;
const isDetail = (job: JobSummary | JobDetail): job is JobDetail => 'applicationUrl' in job;

/**
 * Sharing actions for a job. Messages are always built from the latest job data, including the
 * current status and the official application link (fetched on demand for cards).
 */
export function ShareMenu({ job, variant = 'button' }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const notify = useNotify();
  const qc = useQueryClient();

  const loadDetail = async (): Promise<JobDetail | JobSummary> => {
    if (isDetail(job)) return job;
    try {
      return await qc.fetchQuery({
        queryKey: keys.job(job.slug),
        queryFn: () => api<{ job: JobDetail }>(`/jobs/${encodeURIComponent(job.slug)}`).then((r) => r.job),
        staleTime: 30_000,
      });
    } catch {
      return job; // fall back to card data: the message still contains the ReferLoop link
    }
  };

  const message = async () => buildShareMessage(await loadDetail(), appOrigin());
  const close = () => setAnchor(null);

  const shareWhatsApp = async () => {
    // Open synchronously to avoid popup blockers, then point the window at the final URL.
    const win = window.open('about:blank', '_blank');
    const url = buildWhatsAppUrl(await message());
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else {
      window.location.href = url;
    }
    close();
  };

  const copyLink = async () => {
    close();
    const ok = await copyText(buildJobUrl(appOrigin(), job.slug));
    notify(ok ? 'Job link copied to clipboard' : 'Could not copy the link', ok ? 'success' : 'error');
  };

  const copyDetails = async () => {
    close();
    const ok = await copyText(await message());
    notify(ok ? 'Job details copied — paste them anywhere' : 'Could not copy the details', ok ? 'success' : 'error');
  };

  const nativeShare = async () => {
    close();
    try {
      await navigator.share({ title: `${job.title} at ${job.companyName}`, text: await message() });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') notify('Sharing is not available here. Try copying the link instead.', 'warning');
    }
  };

  const open = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchor(e.currentTarget);
  };

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip title="Share">
          <IconButton size="small" onClick={open} aria-label={`Share ${job.title}`} aria-haspopup="menu">
            <Share2 size={18} />
          </IconButton>
        </Tooltip>
      ) : (
        <Button variant="outlined" startIcon={<Share2 size={16} />} onClick={open} aria-haspopup="menu">
          Share
        </Button>
      )}
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={shareWhatsApp}>
          <ListItemIcon>
            <MessageCircle size={18} color="#16a34a" />
          </ListItemIcon>
          <ListItemText primary="Share on WhatsApp" />
        </MenuItem>
        <MenuItem onClick={copyLink}>
          <ListItemIcon>
            <Link2 size={18} />
          </ListItemIcon>
          <ListItemText primary="Copy job link" />
        </MenuItem>
        <MenuItem onClick={copyDetails}>
          <ListItemIcon>
            <ClipboardList size={18} />
          </ListItemIcon>
          <ListItemText primary="Copy formatted details" />
        </MenuItem>
        {typeof navigator !== 'undefined' &&
          typeof navigator.share === 'function' && [
            <Divider key="d" />,
            <MenuItem key="native" onClick={nativeShare}>
              <ListItemIcon>
                <Share2 size={18} />
              </ListItemIcon>
              <ListItemText primary="More sharing options…" />
            </MenuItem>,
          ]}
      </Menu>
    </>
  );
}
