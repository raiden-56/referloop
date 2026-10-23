import { Button } from '@mui/material';
import { CloudOff, SearchX } from 'lucide-react';
import { ApiError, errorMessage } from '@/api/client';
import { EmptyState } from './EmptyState';

interface Props {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ error, onRetry, title }: Props) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <EmptyState
      icon={notFound ? <SearchX size={40} /> : <CloudOff size={40} />}
      title={title ?? (notFound ? 'Not found' : 'Something went wrong')}
      description={notFound ? 'It may have been removed, or the link is incorrect.' : errorMessage(error)}
      action={
        onRetry && !notFound ? (
          <Button variant="outlined" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}
