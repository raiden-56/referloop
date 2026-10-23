import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Archive, ArchiveRestore, Flag, History, MoreVertical, Pencil, RotateCcw, Search, SearchX } from 'lucide-react';
import { JOB_FIELD_LABELS, type AdminJob, type JobHistoryEntry } from '@referloop/shared';
import { ApiError, errorMessage } from '@/api/client';
import { useAdminJobs, useArchiveJob, useRestoreJob, useRevertJob } from '@/api/admin';
import { useConfig, useJobHistory } from '@/api/queries';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useNotify } from '@/components/notify';
import { PaginationBar } from '@/components/PaginationBar';
import { StatusChip } from '@/components/StatusChip';
import { fromNow } from '@/lib/dates';
import { JobHistoryTimeline } from '@/features/jobs/JobHistoryTimeline';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

const PAGE_SIZE = 20;

const fieldLabel = (f: string) => (JOB_FIELD_LABELS as Record<string, string>)[f] ?? f;

function HistoryDialog({ job, onClose }: { job: AdminJob | null; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useJobHistory(job?.id, Boolean(job));
  const { data: config } = useConfig();
  const revert = useRevertJob();
  const notify = useNotify();
  const [target, setTarget] = useState<JobHistoryEntry | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);

  return (
    <Dialog open={Boolean(job)} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>
        History — {job?.title}
        <Typography variant="body2" color="text.secondary">
          {job?.companyName} · current version {job?.version}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading || !data ? (
          <Stack spacing={1}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={64} />
            ))}
          </Stack>
        ) : (
          <JobHistoryTimeline
            entries={data.edits}
            categories={config?.categories ?? []}
            renderAction={(e) =>
              (e.action === 'UPDATED' || e.action === 'REVERTED') && e.previousValues && e.changedFields.length > 0 ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RotateCcw size={14} />}
                  onClick={() => {
                    setRevertError(null);
                    setTarget(e);
                  }}
                >
                  Restore these values
                </Button>
              ) : null
            }
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <ConfirmDialog
        open={Boolean(target)}
        title="Restore previous values"
        description={
          target
            ? `The ${target.changedFields.map(fieldLabel).join(', ')} field(s) will be set back to their values before this change. This is recorded as a new edit; history is never erased.`
            : undefined
        }
        confirmLabel="Restore values"
        confirmColor="warning"
        reason={{ label: 'Reason', required: true, placeholder: 'e.g. Undo incorrect edit' }}
        pending={revert.isPending}
        error={revertError}
        onClose={() => setTarget(null)}
        onConfirm={(reason) => {
          if (!job || !target) return;
          revert.mutate(
            { id: job.id, historyId: target.id, version: job.version, reason },
            {
              onSuccess: () => {
                notify('Previous values restored');
                setTarget(null);
                onClose();
              },
              onError: (err) =>
                setRevertError(
                  err instanceof ApiError && err.status === 409
                    ? 'This job changed since the list was loaded. Close this dialog, refresh the list and try again.'
                    : errorMessage(err),
                ),
            },
          );
        }}
      />
    </Dialog>
  );
}

function RowActions({
  job,
  onArchive,
  onRestore,
  onHistory,
}: {
  job: AdminJob;
  onArchive: () => void;
  onRestore: () => void;
  onHistory: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = (fn?: () => void) => {
    setAnchor(null);
    fn?.();
  };
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Actions for ${job.title}`} aria-haspopup="menu">
        <MoreVertical size={18} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => close()}>
        <MenuItem onClick={() => close(onHistory)}>
          <ListItemIcon>
            <History size={18} />
          </ListItemIcon>
          View history
        </MenuItem>
        <MenuItem component={RouterLink} to={`/jobs/${job.slug}/edit`} onClick={() => close()}>
          <ListItemIcon>
            <Pencil size={18} />
          </ListItemIcon>
          Edit job
        </MenuItem>
        {job.archivedAt ? (
          <MenuItem onClick={() => close(onRestore)}>
            <ListItemIcon>
              <ArchiveRestore size={18} />
            </ListItemIcon>
            Restore listing
          </MenuItem>
        ) : (
          <MenuItem onClick={() => close(onArchive)} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'inherit' }}>
              <Archive size={18} />
            </ListItemIcon>
            Archive listing
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

function ReportsBadge({ count }: { count: number }) {
  if (!count)
    return (
      <Typography variant="body2" color="text.secondary">
        0
      </Typography>
    );
  return (
    <Tooltip title="Open reports">
      <Chip
        component={RouterLink}
        to="/admin/reports"
        clickable
        size="small"
        icon={<Flag size={13} />}
        label={count}
        sx={{ bgcolor: '#fee2e2', color: '#991b1b', '& .MuiChip-icon': { color: 'inherit' } }}
      />
    </Tooltip>
  );
}

export default function AdminJobsPage() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debounced = useDebouncedValue(search, 350);

  const update = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced.trim()) update({ q: debounced.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? 'all';
  const archived = params.get('archived') ?? 'include';
  const { data, isLoading, isFetching, error, refetch } = useAdminJobs({
    q: params.get('q') ?? undefined,
    status,
    archived,
    page,
    pageSize: PAGE_SIZE,
  });

  const archive = useArchiveJob();
  const restore = useRestoreJob();
  const [dialog, setDialog] = useState<{ kind: 'archive' | 'restore'; job: AdminJob } | null>(null);
  const [historyJob, setHistoryJob] = useState<AdminJob | null>(null);

  const confirmDialog = (reason: string) => {
    if (!dialog) return;
    const opts = {
      onSuccess: () => {
        notify(dialog.kind === 'archive' ? 'Listing archived' : 'Listing restored');
        setDialog(null);
      },
      onError: (err: unknown) => notify(errorMessage(err), 'error'),
    };
    if (dialog.kind === 'archive') archive.mutate({ id: dialog.job.id, reason }, opts);
    else restore.mutate({ id: dialog.job.id, reason }, opts);
  };

  const actions = (job: AdminJob) => (
    <RowActions
      job={job}
      onArchive={() => setDialog({ kind: 'archive', job })}
      onRestore={() => setDialog({ kind: 'restore', job })}
      onHistory={() => setHistoryJob(job)}
    />
  );

  let body;
  if (error) {
    body = <ErrorState error={error} onRetry={() => void refetch()} />;
  } else if (isLoading || !data) {
    body = (
      <Stack spacing={1}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  } else if (data.items.length === 0) {
    body = <EmptyState icon={<SearchX size={40} />} title="No jobs match" description="Try a different search or change the filters." />;
  } else if (desktop) {
    body = (
      <TableContainer component={Paper} variant="outlined" sx={{ opacity: isFetching ? 0.7 : 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Job</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Reports</TableCell>
              <TableCell>Posted by</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((job) => (
              <TableRow key={job.id} hover>
                <TableCell sx={{ maxWidth: 340 }}>
                  <Link component={RouterLink} to={`/jobs/${job.slug}`} sx={{ fontWeight: 600 }}>
                    {job.title}
                  </Link>
                  <Typography variant="caption" color="text.secondary" component="div" noWrap>
                    {job.companyName}
                    {job.archiveReason ? ` · Archived: ${job.archiveReason}` : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusChip status={job.status} archived={Boolean(job.archivedAt)} />
                </TableCell>
                <TableCell align="center">
                  <ReportsBadge count={job.openReports} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{job.createdBy.name}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{fromNow(job.updatedAt)}</Typography>
                  {job.lastEditedBy && (
                    <Typography variant="caption" color="text.secondary">
                      by {job.lastEditedBy.name}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{actions(job)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  } else {
    body = (
      <Stack spacing={1.5} sx={{ opacity: isFetching ? 0.7 : 1 }}>
        {data.items.map((job) => (
          <Card key={job.id}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Link component={RouterLink} to={`/jobs/${job.slug}`} sx={{ fontWeight: 600 }}>
                    {job.title}
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    {job.companyName}
                  </Typography>
                </Box>
                {actions(job)}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ my: 1, alignItems: 'center' }}>
                <StatusChip status={job.status} archived={Boolean(job.archivedAt)} />
                {job.openReports > 0 && <ReportsBadge count={job.openReports} />}
              </Stack>
              {job.archiveReason && (
                <Typography variant="caption" color="text.secondary" component="div">
                  Archived: {job.archiveReason}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Posted by {job.createdBy.name} · updated {fromNow(job.updatedAt)}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, company, skills…"
          slotProps={{
            htmlInput: { 'aria-label': 'Search jobs', maxLength: 120 },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 2 }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => update({ status: e.target.value === 'all' ? undefined : e.target.value })}
          sx={{ flex: 1, minWidth: 140 }}
        >
          <MenuItem value="all">All statuses</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="closed">Closed</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Archived"
          value={archived}
          onChange={(e) => update({ archived: e.target.value === 'include' ? undefined : e.target.value })}
          sx={{ flex: 1, minWidth: 160 }}
        >
          <MenuItem value="include">Include archived</MenuItem>
          <MenuItem value="exclude">Hide archived</MenuItem>
          <MenuItem value="only">Archived only</MenuItem>
        </TextField>
      </Stack>
      {body}
      {data && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onChange={(p) => update({ page: String(p) })}
        />
      )}

      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialog?.kind === 'archive' ? 'Archive listing' : 'Restore listing'}
        description={
          dialog?.kind === 'archive' ? (
            <>“{dialog.job.title}” will be hidden from members. Its history is kept and it can be restored later. The poster is notified.</>
          ) : dialog ? (
            <>“{dialog.job.title}” will be visible to members again with its current status.</>
          ) : undefined
        }
        confirmLabel={dialog?.kind === 'archive' ? 'Archive' : 'Restore'}
        confirmColor={dialog?.kind === 'archive' ? 'error' : 'primary'}
        reason={
          dialog?.kind === 'archive'
            ? { label: 'Reason', required: true, placeholder: 'e.g. Spam or misleading listing' }
            : { label: 'Reason' }
        }
        pending={archive.isPending || restore.isPending}
        onConfirm={confirmDialog}
        onClose={() => setDialog(null)}
      />
      <HistoryDialog job={historyJob} onClose={() => setHistoryJob(null)} />
    </Box>
  );
}
