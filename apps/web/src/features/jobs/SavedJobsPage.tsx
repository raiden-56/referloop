import { Link as RouterLink, useSearchParams } from 'react-router';
import { Alert, Button } from '@mui/material';
import { Bookmark } from 'lucide-react';
import { useSavedJobs } from '@/api/queries';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { JobGrid } from './JobGrid';

export default function SavedJobsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isLoading, error, refetch } = useSavedJobs(page);
  const closedCount = data?.items.filter((j) => j.status === 'CLOSED').length ?? 0;

  return (
    <>
      <PageHeader title="Saved jobs" subtitle="Openings you bookmarked. You are notified when one of them closes or reopens." />
      {closedCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {closedCount === 1 ? '1 saved job has' : `${closedCount} saved jobs have`} been closed and {closedCount === 1 ? 'is' : 'are'} no
          longer accepting applications.
        </Alert>
      )}
      <JobGrid
        data={data}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        onPageChange={(p) => setParams({ page: String(p) })}
        empty={
          <EmptyState
            icon={<Bookmark size={40} />}
            title="No saved jobs yet"
            description="Use the bookmark icon on any job to keep it here for later."
            action={
              <Button component={RouterLink} to="/jobs" variant="contained">
                Explore jobs
              </Button>
            }
          />
        }
      />
    </>
  );
}
