import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CheckCircle2, Flag, ShieldAlert, XCircle } from 'lucide-react';
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS, type AdminReport, type ReportStatus } from '@referloop/shared';
import { errorMessage } from '@/api/client';
import { useAdminReports, useResolveReport } from '@/api/admin';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useNotify } from '@/components/notify';
import { PaginationBar } from '@/components/PaginationBar';
import { StatusChip } from '@/components/StatusChip';
import { formatDateTime, fromNow } from '@/lib/dates';

const PAGE_SIZE = 20;
const FILTERS = ['PENDING', 'OPEN', 'ESCALATED', 'RESOLVED', 'DISMISSED', 'ALL'] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  PENDING: 'Pending (open + escalated)',
  OPEN: 'Open',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
  ALL: 'All reports',
};

const STATUS_COLORS: Record<ReportStatus, { bg: string; fg: string }> = {
  OPEN: { bg: '#fef3c7', fg: '#92400e' },
  ESCALATED: { bg: '#fee2e2', fg: '#991b1b' },
  RESOLVED: { bg: '#dcfce7', fg: '#166534' },
  DISMISSED: { bg: '#f3f4f6', fg: '#4b5563' },
};

function ReportStatusChip({ status }: { status: ReportStatus }) {
  const c = STATUS_COLORS[status];
  return <Chip size="small" label={REPORT_STATUS_LABELS[status]} sx={{ bgcolor: c.bg, color: c.fg }} />;
}

function ResolveDialog({ report, onClose }: { report: AdminReport | null; onClose: () => void }) {
  const resolve = useResolveReport();
  const notify = useNotify();
  const [note, setNote] = useState('');
  const [jobAction, setJobAction] = useState<'NONE' | 'CLOSE' | 'ARCHIVE'>('NONE');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (report) {
      setNote('');
      setError(null);
      setJobAction(report.reason === 'CLOSED_OR_OUTDATED' && report.job.status === 'ACTIVE' ? 'CLOSE' : 'NONE');
    }
  }, [report]);

  const archived = Boolean(report?.job.archivedAt);
  const invalid = note.trim().length < 3;

  return (
    <Dialog open={Boolean(report)} onClose={resolve.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!report || invalid) return;
          setError(null);
          resolve.mutate(
            { id: report.id, input: { action: 'RESOLVE', resolutionNote: note.trim(), jobAction } },
            {
              onSuccess: () => {
                notify('Report resolved');
                onClose();
              },
              onError: (err) => setError(errorMessage(err)),
            },
          );
        }}
      >
        <DialogTitle>Resolve report</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {report && (
              <>
                “{report.job.title}” at {report.job.companyName} — reported as{' '}
                <strong>{REPORT_REASON_LABELS[report.reason].toLowerCase()}</strong>.
                {report.openReportsForJob > 1 &&
                  ` If you change the job, the other ${report.openReportsForJob - 1} open report(s) for it are resolved too.`}
              </>
            )}
          </DialogContentText>
          <FormControl sx={{ mb: 2 }}>
            <FormLabel id="job-action-label">Action on the job</FormLabel>
            <RadioGroup
              aria-labelledby="job-action-label"
              value={jobAction}
              onChange={(e) => setJobAction(e.target.value as typeof jobAction)}
            >
              <FormControlLabel value="NONE" control={<Radio />} label="No change to the job" />
              <FormControlLabel
                value="CLOSE"
                control={<Radio />}
                disabled={archived || report?.job.status !== 'ACTIVE'}
                label="Mark the job as closed (verified it is no longer hiring)"
              />
              <FormControlLabel
                value="ARCHIVE"
                control={<Radio />}
                disabled={archived}
                label="Archive the listing (spam, duplicate or inappropriate)"
              />
            </RadioGroup>
          </FormControl>
          <TextField
            autoFocus
            required
            label="Resolution note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            placeholder="What did you verify and what was done?"
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={resolve.isPending} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={invalid || resolve.isPending}>
            {resolve.isPending ? 'Resolving…' : 'Resolve report'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function ReportCard({
  report,
  onResolve,
  onDismiss,
  onEscalate,
}: {
  report: AdminReport;
  onResolve: () => void;
  onDismiss: () => void;
  onEscalate: () => void;
}) {
  const pending = report.status === 'OPEN' || report.status === 'ESCALATED';
  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Flag size={16} color="#b91c1c" />
              <Typography sx={{ fontWeight: 650 }}>{REPORT_REASON_LABELS[report.reason]}</Typography>
              <ReportStatusChip status={report.status} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Reported by {report.reporter.name} · {fromNow(report.createdAt)} ({formatDateTime(report.createdAt)})
            </Typography>
          </Box>
          {report.openReportsForJob > 1 && pending && (
            <Chip
              size="small"
              variant="outlined"
              color="error"
              label={`${report.openReportsForJob} open reports for this job`}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          )}
        </Stack>

        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f9fafb', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
            <Link component={RouterLink} to={`/jobs/${report.job.slug}`} sx={{ fontWeight: 600 }}>
              {report.job.title}
            </Link>
            <Typography variant="body2" color="text.secondary">
              at {report.job.companyName}
            </Typography>
            <StatusChip status={report.job.status} archived={Boolean(report.job.archivedAt)} />
          </Stack>
          {report.job.archivedAt && (
            <Typography variant="caption" color="text.secondary">
              This listing is archived and hidden from members.
            </Typography>
          )}
        </Box>

        {report.description && (
          <Typography variant="body2" sx={{ mt: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {report.description}
          </Typography>
        )}

        {report.resolutionNote && (
          <Box
            sx={{ mt: 1.5, pl: 1.5, borderLeft: '3px solid', borderColor: report.status === 'ESCALATED' ? 'error.light' : 'success.light' }}
          >
            <Typography variant="caption" color="text.secondary" component="div">
              {report.status === 'ESCALATED'
                ? 'Escalation note'
                : `${REPORT_STATUS_LABELS[report.status]}${report.resolvedBy ? ` by ${report.resolvedBy.name}` : ''}${report.resolvedAt ? ` · ${formatDateTime(report.resolvedAt)}` : ''}`}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {report.resolutionNote}
            </Typography>
          </Box>
        )}
      </CardContent>
      {pending && (
        <CardActions sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button variant="contained" size="small" startIcon={<CheckCircle2 size={15} />} onClick={onResolve}>
            Resolve
          </Button>
          <Button variant="outlined" size="small" startIcon={<XCircle size={15} />} onClick={onDismiss}>
            Dismiss
          </Button>
          {report.status === 'OPEN' && (
            <Button size="small" color="warning" startIcon={<ShieldAlert size={15} />} onClick={onEscalate}>
              Escalate
            </Button>
          )}
        </CardActions>
      )}
    </Card>
  );
}

export default function AdminReportsPage() {
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const status = (FILTERS as readonly string[]).includes(params.get('status') ?? '')
    ? (params.get('status') as (typeof FILTERS)[number])
    : 'PENDING';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isLoading, isFetching, error, refetch } = useAdminReports({ status, page, pageSize: PAGE_SIZE });
  const resolve = useResolveReport();

  const [resolving, setResolving] = useState<AdminReport | null>(null);
  const [simple, setSimple] = useState<{ kind: 'DISMISS' | 'ESCALATE'; report: AdminReport } | null>(null);
  const [simpleError, setSimpleError] = useState<string | null>(null);

  const setParam = (patch: Record<string, string | undefined>) =>
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

  let body;
  if (error) {
    body = <ErrorState error={error} onRetry={() => void refetch()} />;
  } else if (isLoading || !data) {
    body = (
      <Stack spacing={1.5}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={170} />
        ))}
      </Stack>
    );
  } else if (data.items.length === 0) {
    body = (
      <EmptyState
        icon={<CheckCircle2 size={40} />}
        title={status === 'PENDING' ? 'The moderation queue is empty' : 'No reports'}
        description={status === 'PENDING' ? 'New reports from members will appear here for review.' : 'No reports match this filter.'}
      />
    );
  } else {
    body = (
      <Stack spacing={1.5} sx={{ opacity: isFetching ? 0.7 : 1 }}>
        {data.items.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            onResolve={() => setResolving(r)}
            onDismiss={() => {
              setSimpleError(null);
              setSimple({ kind: 'DISMISS', report: r });
            }}
            onEscalate={() => {
              setSimpleError(null);
              setSimple({ kind: 'ESCALATE', report: r });
            }}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <TextField
          select
          size="small"
          label="Show"
          value={status}
          onChange={(e) => setParam({ status: e.target.value === 'PENDING' ? undefined : e.target.value })}
          sx={{ minWidth: 240, maxWidth: { sm: 280 } }}
        >
          {FILTERS.map((f) => (
            <MenuItem key={f} value={f}>
              {FILTER_LABELS[f]}
            </MenuItem>
          ))}
        </TextField>
        {data && (
          <Typography variant="body2" color="text.secondary">
            {data.total} report{data.total === 1 ? '' : 's'}
          </Typography>
        )}
      </Stack>
      {body}
      {data && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onChange={(p) => setParam({ page: String(p) })}
        />
      )}

      <ResolveDialog report={resolving} onClose={() => setResolving(null)} />
      <ConfirmDialog
        open={Boolean(simple)}
        title={simple?.kind === 'DISMISS' ? 'Dismiss report' : 'Escalate report'}
        description={
          simple?.kind === 'DISMISS'
            ? 'The report will be closed without changing the job. The reporter is notified that it was reviewed.'
            : 'Escalated reports stay in the pending queue and are flagged for further review.'
        }
        confirmLabel={simple?.kind === 'DISMISS' ? 'Dismiss' : 'Escalate'}
        confirmColor={simple?.kind === 'DISMISS' ? 'primary' : 'warning'}
        reason={
          simple?.kind === 'DISMISS'
            ? { label: 'Resolution note', required: true, placeholder: 'Why is no action needed?' }
            : { label: 'Escalation note' }
        }
        pending={resolve.isPending}
        error={simpleError}
        onClose={() => setSimple(null)}
        onConfirm={(note) => {
          if (!simple) return;
          resolve.mutate(
            { id: simple.report.id, input: { action: simple.kind, resolutionNote: note, jobAction: 'NONE' } },
            {
              onSuccess: () => {
                notify(simple.kind === 'DISMISS' ? 'Report dismissed' : 'Report escalated');
                setSimple(null);
              },
              onError: (err) => setSimpleError(errorMessage(err)),
            },
          );
        }}
      />
    </Box>
  );
}
