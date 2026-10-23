import { Chip, type ChipProps } from '@mui/material';
import { Archive, CheckCircle2, CircleSlash } from 'lucide-react';
import { JOB_STATUS_LABELS, type JobStatus } from '@referloop/shared';

export function StatusChip({ status, archived, size = 'small' }: { status: JobStatus; archived?: boolean; size?: ChipProps['size'] }) {
  if (archived) {
    return <Chip size={size} icon={<Archive size={14} />} label="Archived" sx={{ bgcolor: '#f3f4f6', color: '#374151' }} />;
  }
  const active = status === 'ACTIVE';
  return (
    <Chip
      size={size}
      icon={active ? <CheckCircle2 size={14} /> : <CircleSlash size={14} />}
      label={JOB_STATUS_LABELS[status]}
      sx={{
        bgcolor: active ? '#dcfce7' : '#f3f4f6',
        color: active ? '#166534' : '#4b5563',
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  );
}
