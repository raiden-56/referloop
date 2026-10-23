import { Link as RouterLink, useSearchParams } from 'react-router';
import { Button, Tab, Tabs } from '@mui/material';
import { BriefcaseBusiness, PencilLine, PlusCircle } from 'lucide-react';
import { useMyJobs } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { JobGrid } from './JobGrid';

export default function MyJobsPage() {
  const [params, setParams] = useSearchParams();
  const scope = params.get('tab') === 'edited' ? 'edited' : 'posted';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { isVerified } = useAuth();
  const { data, isLoading, error, refetch } = useMyJobs(scope, page);

  return (
    <>
      <PageHeader
        title="My jobs"
        subtitle="Openings you posted and listings you helped improve."
        actions={
          isVerified ? (
            <Button component={RouterLink} to="/jobs/new" variant="contained" startIcon={<PlusCircle size={18} />}>
              Post a job
            </Button>
          ) : undefined
        }
      />
      <Tabs
        value={scope}
        onChange={(_e, v: string) => setParams(v === 'edited' ? { tab: 'edited' } : {})}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="posted" label="Posted by me" icon={<BriefcaseBusiness size={16} />} iconPosition="start" />
        <Tab value="edited" label="Edited by me" icon={<PencilLine size={16} />} iconPosition="start" />
      </Tabs>
      <JobGrid
        data={data}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        onPageChange={(p) => setParams({ ...(scope === 'edited' ? { tab: 'edited' } : {}), page: String(p) })}
        empty={
          scope === 'posted' ? (
            <EmptyState
              icon={<BriefcaseBusiness size={40} />}
              title="You have not posted any jobs yet"
              description="Know of an opening at your company? Share it and help someone land their next role."
              action={
                isVerified ? (
                  <Button component={RouterLink} to="/jobs/new" variant="contained">
                    Post a job
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              icon={<PencilLine size={40} />}
              title="No edits yet"
              description="When you update or close someone else's listing it will appear here."
              action={
                <Button component={RouterLink} to="/jobs" variant="outlined">
                  Explore jobs
                </Button>
              }
            />
          )
        }
      />
    </>
  );
}
