import { IconButton, Tooltip } from '@mui/material';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useToggleSave } from '@/api/queries';
import { errorMessage } from '@/api/client';
import { useNotify } from './notify';

export function SaveJobButton({ jobId, saved }: { jobId: string; saved: boolean }) {
  const toggle = useToggleSave();
  const notify = useNotify();
  const label = saved ? 'Remove from saved jobs' : 'Save job';
  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        aria-pressed={saved}
        color={saved ? 'primary' : 'default'}
        disabled={toggle.isPending}
        onClick={(e) => {
          e.stopPropagation();
          toggle.mutate(
            { id: jobId, save: !saved },
            {
              onSuccess: () => notify(saved ? 'Removed from saved jobs' : 'Saved — find it under Saved Jobs'),
              onError: (err) => notify(errorMessage(err), 'error'),
            },
          );
        }}
      >
        {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </IconButton>
    </Tooltip>
  );
}
