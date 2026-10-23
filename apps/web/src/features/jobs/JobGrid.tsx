import type { ReactNode } from 'react';
import { Grid } from '@mui/material';
import type { JobSummary, Paginated } from '@referloop/shared';
import { ErrorState } from '@/components/ErrorState';
import { JobCard, JobCardSkeleton } from '@/components/JobCard';
import { PaginationBar } from '@/components/PaginationBar';

interface Props {
  data: Paginated<JobSummary> | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onPageChange?: (page: number) => void;
  empty: ReactNode;
  skeletons?: number;
}

/** Shared loading / error / empty / results rendering for job lists. */
export function JobGrid({ data, isLoading, error, onRetry, onPageChange, empty, skeletons = 4 }: Props) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading || !data) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: skeletons }, (_, i) => (
          <Grid key={i} size={{ xs: 12, md: 6 }}>
            <JobCardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }
  if (data.items.length === 0) return <>{empty}</>;
  return (
    <>
      <Grid container spacing={2}>
        {data.items.map((job) => (
          <Grid key={job.id} size={{ xs: 12, md: 6 }}>
            <JobCard job={job} />
          </Grid>
        ))}
      </Grid>
      {onPageChange && (
        <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onChange={onPageChange} />
      )}
    </>
  );
}
