import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ChevronDown, ChevronRight, ScrollText, Search } from 'lucide-react';
import type { AuditLogEntry } from '@referloop/shared';
import { useAuditLogs } from '@/api/admin';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PaginationBar } from '@/components/PaginationBar';
import { formatDateTime } from '@/lib/dates';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

const PAGE_SIZE = 30;
const TARGET_TYPES = ['User', 'Job', 'JobReport', 'JobCategory', 'AppSetting'];

const ActionChip = ({ action }: { action: string }) => (
  <Chip
    size="small"
    label={action}
    sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12, bgcolor: '#f3f4f6' }}
  />
);

function Metadata({ entry }: { entry: AuditLogEntry }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        bgcolor: '#f9fafb',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        fontSize: 12,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 320,
        overflow: 'auto',
      }}
    >
      {JSON.stringify(entry.metadata, null, 2)}
    </Box>
  );
}

function DesktopRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasMeta = entry.metadata !== null && Object.keys(entry.metadata).length > 0;
  return (
    <Fragment>
      <TableRow hover sx={{ '& > td': { borderBottom: open ? 'none' : undefined } }}>
        <TableCell padding="checkbox">
          {hasMeta && (
            <IconButton
              size="small"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Hide details' : 'Show details'}
              aria-expanded={open}
            >
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </IconButton>
          )}
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.createdAt)}</TableCell>
        <TableCell>
          {entry.actor?.name ?? (
            <Typography variant="body2" color="text.secondary">
              System
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <ActionChip action={entry.action} />
        </TableCell>
        <TableCell>
          <Typography variant="body2">{entry.targetType}</Typography>
          {entry.targetId && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {entry.targetId}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{entry.ipAddress ?? '—'}</TableCell>
      </TableRow>
      {hasMeta && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: open ? 1.5 : 0 }}>
            <Collapse in={open} unmountOnExit>
              <Metadata entry={entry} />
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

function MobileCard({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasMeta = entry.metadata !== null && Object.keys(entry.metadata).length > 0;
  return (
    <Card>
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <ActionChip action={entry.action} />
          {hasMeta && (
            <IconButton
              size="small"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Hide details' : 'Show details'}
              aria-expanded={open}
            >
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </IconButton>
          )}
        </Stack>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {entry.actor?.name ?? 'System'} · {entry.targetType}
        </Typography>
        {entry.targetId && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {entry.targetId}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(entry.createdAt)}
          {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
        </Typography>
        <Collapse in={open} unmountOnExit>
          <Box sx={{ mt: 1 }}>
            <Metadata entry={entry} />
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function AdminAuditLogPage() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [params, setParams] = useSearchParams();
  const [action, setAction] = useState(params.get('action') ?? '');
  const debounced = useDebouncedValue(action, 350);

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
    if ((params.get('action') ?? '') !== debounced.trim()) update({ action: debounced.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const page = Math.max(1, Number(params.get('page')) || 1);
  const targetType = params.get('targetType') ?? '';
  const { data, isLoading, isFetching, error, refetch } = useAuditLogs({
    action: params.get('action') ?? undefined,
    targetType: targetType || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  let body;
  if (error) {
    body = <ErrorState error={error} onRetry={() => void refetch()} />;
  } else if (isLoading || !data) {
    body = (
      <Stack spacing={1}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={44} />
        ))}
      </Stack>
    );
  } else if (data.items.length === 0) {
    body = (
      <EmptyState icon={<ScrollText size={40} />} title="No audit entries" description="No recorded operations match these filters." />
    );
  } else if (desktop) {
    body = (
      <TableContainer component={Paper} variant="outlined" sx={{ opacity: isFetching ? 0.7 : 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Time</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>IP address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((e) => (
              <DesktopRow key={e.id} entry={e} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  } else {
    body = (
      <Stack spacing={1.5} sx={{ opacity: isFetching ? 0.7 : 1 }}>
        {data.items.map((e) => (
          <MobileCard key={e.id} entry={e} />
        ))}
      </Stack>
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter by action, e.g. JOB_ARCHIVED or LOGIN"
          slotProps={{
            htmlInput: { 'aria-label': 'Filter by action', maxLength: 120 },
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
          label="Target type"
          value={targetType}
          onChange={(e) => update({ targetType: e.target.value || undefined })}
          sx={{ flex: 1, minWidth: 170 }}
        >
          <MenuItem value="">All targets</MenuItem>
          {TARGET_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
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
    </Box>
  );
}
