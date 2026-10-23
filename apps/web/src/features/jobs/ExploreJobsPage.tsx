import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Badge,
  Box,
  Button,
  Chip,
  Drawer,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { PlusCircle, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { JOB_SORTS, JOB_SORT_LABELS, type JobSort } from '@referloop/shared';
import { useJobs } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';
import { DebouncedTextField } from '@/components/DebouncedTextField';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { JobCard, JobCardSkeleton } from '@/components/JobCard';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { JobFiltersPanel } from './JobFiltersPanel';
import { PAGE_SIZE, useJobFilters } from './useJobFilters';

export default function ExploreJobsPage() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isVerified } = useAuth();
  const { filters, update, clear, activeCount, apiParams } = useJobFilters();
  const { data, isLoading, isFetching, isError, error, refetch } = useJobs(apiParams);

  const panel = <JobFiltersPanel filters={filters} update={update} clear={clear} activeCount={activeCount} />;
  const statusLabel = filters.status === 'closed' ? 'closed' : filters.status === 'all' ? '' : 'active';

  return (
    <>
      <PageHeader
        title="Explore jobs"
        subtitle="Openings shared and kept up to date by the ReferLoop community."
        actions={
          isVerified ? (
            <Button component={RouterLink} to="/jobs/new" variant="contained" startIcon={<PlusCircle size={18} />}>
              Post a job
            </Button>
          ) : undefined
        }
      />

      <Grid container spacing={3}>
        {desktop && (
          <Grid size={{ md: 3 }}>
            <Paper variant="outlined" sx={{ p: 2.5, position: 'sticky', top: 88 }}>
              {panel}
            </Paper>
          </Grid>
        )}

        <Grid size={{ xs: 12, md: 9 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <DebouncedTextField
              value={filters.q}
              onCommit={(q) => update({ q })}
              placeholder="Search by title, company, skill, location or description"
              size="small"
              slotProps={{
                htmlInput: { 'aria-label': 'Search jobs', maxLength: 100 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={17} />
                    </InputAdornment>
                  ),
                  sx: { bgcolor: 'background.paper' },
                },
              }}
            />
            <Stack direction="row" spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 190, flexGrow: 1 }}>
                <InputLabel id="sort-label">Sort by</InputLabel>
                <Select
                  labelId="sort-label"
                  label="Sort by"
                  value={filters.sort}
                  onChange={(e) => update({ sort: e.target.value as JobSort })}
                  sx={{ bgcolor: 'background.paper' }}
                >
                  {JOB_SORTS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {JOB_SORT_LABELS[s]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {!desktop && (
                <Badge badgeContent={activeCount} color="primary">
                  <Button
                    variant="outlined"
                    startIcon={<SlidersHorizontal size={16} />}
                    onClick={() => setDrawerOpen(true)}
                    sx={{ bgcolor: 'background.paper', whiteSpace: 'nowrap' }}
                  >
                    Filters
                  </Button>
                </Badge>
              )}
            </Stack>
          </Stack>

          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, minHeight: 32, flexWrap: 'wrap', gap: 1 }}
          >
            <Typography variant="body2" color="text.secondary" aria-live="polite">
              {data ? (
                <>
                  <strong>{data.total}</strong> {statusLabel} {data.total === 1 ? 'job' : 'jobs'}
                  {filters.q && <> matching “{filters.q}”</>}
                </>
              ) : (
                ' '
              )}
            </Typography>
            {(activeCount > 0 || filters.q) && (
              <Chip size="small" label="Clear all filters" onDelete={clear} deleteIcon={<X size={14} />} variant="outlined" />
            )}
          </Stack>

          <Box sx={{ height: 4, mb: 1 }}>{isFetching && !isLoading && <LinearProgress sx={{ borderRadius: 2 }} />}</Box>

          {isError ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading || !data ? (
            <Grid container spacing={2}>
              {Array.from({ length: 6 }, (_, i) => (
                <Grid key={i} size={{ xs: 12, lg: 6 }}>
                  <JobCardSkeleton />
                </Grid>
              ))}
            </Grid>
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={<SearchX size={40} />}
              title="No jobs match your search"
              description={
                filters.status === 'active'
                  ? 'Try removing a filter or two. Closed positions are hidden by default — switch the status filter to include them.'
                  : 'Try removing a filter or two, or search for something broader.'
              }
              action={
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={clear}>
                    Clear all filters
                  </Button>
                  {filters.status === 'active' && <Button onClick={() => update({ status: 'all' })}>Include closed jobs</Button>}
                </Stack>
              }
            />
          ) : (
            <>
              <Grid container spacing={2} sx={{ opacity: isFetching ? 0.7 : 1, transition: 'opacity .2s' }}>
                {data.items.map((job) => (
                  <Grid key={job.id} size={{ xs: 12, lg: 6 }}>
                    <JobCard job={job} />
                  </Grid>
                ))}
              </Grid>
              <PaginationBar
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={PAGE_SIZE}
                onChange={(page) => {
                  update({ page });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </Grid>
      </Grid>

      {!desktop && (
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{ paper: { sx: { width: 'min(360px, 100vw)', p: 2.5 } } }}
        >
          {panel}
          <Button variant="contained" sx={{ mt: 3 }} onClick={() => setDrawerOpen(false)}>
            Show {data?.total ?? ''} results
          </Button>
        </Drawer>
      )}
    </>
  );
}
