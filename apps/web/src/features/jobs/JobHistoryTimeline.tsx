import { useState } from 'react';
import { Avatar, Box, Button, Collapse, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  CURRENCIES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_FIELD_LABELS,
  JOB_HISTORY_ACTION_LABELS,
  JOB_STATUS_LABELS,
  WORK_MODE_LABELS,
  type JobCategory,
  type JobHistoryEntry,
} from '@referloop/shared';
import { initials } from '@/lib/initials';
import { formatDateOnly, formatDateTime, fromNow } from '@/lib/dates';

const LONG_TEXT = 160;

function formatHistoryValue(field: string, value: unknown, categories: JobCategory[] = []): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field === 'workMode') return WORK_MODE_LABELS[value as keyof typeof WORK_MODE_LABELS] ?? String(value);
  if (field === 'employmentType') return EMPLOYMENT_TYPE_LABELS[value as keyof typeof EMPLOYMENT_TYPE_LABELS] ?? String(value);
  if (field === 'status') return JOB_STATUS_LABELS[value as keyof typeof JOB_STATUS_LABELS] ?? String(value);
  if (field === 'categoryId') return categories.find((c) => c.id === value)?.name ?? 'Unlisted category';
  if (field === 'applicationDeadline' && typeof value === 'string') return formatDateOnly(value);
  if (field === 'salaryCurrency' && (CURRENCIES as readonly string[]).includes(String(value))) return String(value);
  return String(value);
}

const fieldLabel = (f: string) => (JOB_FIELD_LABELS as Record<string, string>)[f] ?? (f === 'archived' ? 'Archived' : f);

function ValueCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > LONG_TEXT;
  return (
    <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', verticalAlign: 'top', fontSize: 13 }}>
      {long && !expanded ? `${text.slice(0, LONG_TEXT)}…` : text}
      {long && (
        <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ display: 'block', p: 0, minWidth: 0, mt: 0.5 }}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </TableCell>
  );
}

interface EntryProps {
  entry: JobHistoryEntry;
  categories: JobCategory[];
  action?: React.ReactNode;
}

function HistoryEntry({ entry, categories, action }: EntryProps) {
  const [open, setOpen] = useState(false);
  const hasDiff = entry.action !== 'CREATED' && entry.changedFields.length > 0 && entry.previousValues && entry.newValues;
  const summary =
    entry.action === 'UPDATED' || entry.action === 'REVERTED'
      ? `Changed ${entry.changedFields.map(fieldLabel).join(', ')}`
      : entry.action === 'CREATED'
        ? 'Original post'
        : null;

  return (
    <Stack direction="row" spacing={1.5} component="li" sx={{ position: 'relative', pb: 2.5, '&:last-of-type': { pb: 0 } }}>
      <Avatar
        sx={{
          width: 32,
          height: 32,
          fontSize: 13,
          bgcolor: entry.action === 'CREATED' ? 'primary.main' : '#e0e7ff',
          color: entry.action === 'CREATED' ? '#fff' : 'primary.dark',
          zIndex: 1,
        }}
      >
        {initials(entry.actor.name)}
      </Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body2">
          <strong>{entry.actor.name}</strong> {JOB_HISTORY_ACTION_LABELS[entry.action].toLowerCase()}
        </Typography>
        <Typography variant="caption" color="text.secondary" title={formatDateTime(entry.createdAt)}>
          {fromNow(entry.createdAt)} · version {entry.version}
        </Typography>
        {summary && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {summary}
          </Typography>
        )}
        {entry.reason && (
          <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
            “{entry.reason}”
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          {hasDiff && (
            <Button
              size="small"
              onClick={() => setOpen((v) => !v)}
              endIcon={open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              sx={{ px: 0.5 }}
            >
              {open ? 'Hide changes' : 'View changes'}
            </Button>
          )}
          {action}
        </Stack>
        {hasDiff && (
          <Collapse in={open} unmountOnExit>
            <Box sx={{ overflowX: 'auto', mt: 1, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Table size="small" aria-label="Changed fields">
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Before</TableCell>
                    <TableCell>After</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entry.changedFields.map((f) => (
                    <TableRow key={f}>
                      <TableCell sx={{ fontWeight: 500, verticalAlign: 'top', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {fieldLabel(f)}
                      </TableCell>
                      <ValueCell text={formatHistoryValue(f, entry.previousValues?.[f], categories)} />
                      <ValueCell text={formatHistoryValue(f, entry.newValues?.[f], categories)} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        )}
      </Box>
    </Stack>
  );
}

interface Props {
  entries: JobHistoryEntry[];
  categories: JobCategory[];
  /** Optional extra action per entry (used by administrators to restore values). */
  renderAction?: (entry: JobHistoryEntry) => React.ReactNode;
}

export function JobHistoryTimeline({ entries, categories, renderAction }: Props) {
  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No history recorded yet.
      </Typography>
    );
  }
  return (
    <Box
      component="ol"
      sx={{
        listStyle: 'none',
        p: 0,
        m: 0,
        position: 'relative',
        '&::before': { content: '""', position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, bgcolor: 'divider' },
      }}
    >
      {entries.map((e) => (
        <HistoryEntry key={e.id} entry={e} categories={categories} action={renderAction?.(e)} />
      ))}
    </Box>
  );
}
