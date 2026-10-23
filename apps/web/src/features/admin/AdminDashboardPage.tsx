import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, Card, CardContent, Grid, Link, List, ListItem, Skeleton, Stack, Typography } from '@mui/material';
import { Archive, BadgeCheck, BriefcaseBusiness, CircleSlash, Flag, Handshake, UserX, Users } from 'lucide-react';
import { JOB_HISTORY_ACTION_LABELS } from '@referloop/shared';
import { useAdminDashboard } from '@/api/admin';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { StatusChip } from '@/components/StatusChip';
import { fromNow } from '@/lib/dates';

function MetricTile({
  label,
  value,
  icon,
  to,
  highlight,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  to?: string;
  highlight?: boolean;
}) {
  const content = (
    <Card sx={{ height: '100%', borderColor: highlight ? 'error.light' : undefined }}>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: '1.9rem', fontWeight: 700, mt: 0.5, color: highlight ? 'error.main' : 'text.primary' }}>
              {value.toLocaleString()}
            </Typography>
          </Box>
          <Box
            sx={{
              color: highlight ? 'error.main' : 'primary.main',
              bgcolor: highlight ? '#fef2f2' : '#eef2ff',
              p: 1,
              borderRadius: 2,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link component={RouterLink} to={to} underline="none" sx={{ display: 'block', height: '100%' }}>
      {content}
    </Link>
  ) : (
    content
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading, error, refetch } = useAdminDashboard();

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const t = data?.totals;
  const tiles = t
    ? [
        { label: 'Total users', value: t.users, icon: <Users size={20} />, to: '/admin/users' },
        { label: 'Verified members', value: t.verifiedMembers, icon: <BadgeCheck size={20} />, to: '/admin/users?verified=yes' },
        { label: 'Suspended users', value: t.suspendedUsers, icon: <UserX size={20} />, to: '/admin/users?status=SUSPENDED' },
        {
          label: 'Active jobs',
          value: t.activeJobs,
          icon: <BriefcaseBusiness size={20} />,
          to: '/admin/jobs?status=active&archived=exclude',
        },
        { label: 'Closed jobs', value: t.closedJobs, icon: <CircleSlash size={20} />, to: '/admin/jobs?status=closed&archived=exclude' },
        { label: 'Archived jobs', value: t.archivedJobs, icon: <Archive size={20} />, to: '/admin/jobs?archived=only' },
        {
          label: 'Pending reports',
          value: t.pendingReports,
          icon: <Flag size={20} />,
          to: '/admin/reports',
          highlight: t.pendingReports > 0,
        },
        { label: 'Referrals made', value: t.referralsMade, icon: <Handshake size={20} /> },
      ]
    : [];

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {isLoading
          ? Array.from({ length: 8 }, (_, i) => (
              <Grid key={i} size={{ xs: 6, sm: 4, lg: 3 }}>
                <Skeleton variant="rounded" height={104} />
              </Grid>
            ))
          : tiles.map((tile) => (
              <Grid key={tile.label} size={{ xs: 6, sm: 4, lg: 3 }}>
                <MetricTile {...tile} />
              </Grid>
            ))}
      </Grid>

      <Card>
        <CardContent sx={{ pb: 1 }}>
          <Typography variant="h4" component="h2">
            Recently created or edited jobs
          </Typography>
        </CardContent>
        {isLoading ? (
          <Box sx={{ px: 2, pb: 2 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={52} />
            ))}
          </Box>
        ) : !data || data.recentJobs.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <EmptyState compact title="No jobs yet" description="Jobs will appear here as members post and edit them." />
          </Box>
        ) : (
          <List disablePadding>
            {data.recentJobs.map((job) => (
              <ListItem key={job.id} divider sx={{ py: 1.5, px: 2, display: 'block' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Link component={RouterLink} to={`/jobs/${job.slug}`} sx={{ fontWeight: 600 }}>
                      {job.title}
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                      {job.companyName} · {job.lastAction ? JOB_HISTORY_ACTION_LABELS[job.lastAction] : 'Updated'}
                      {job.lastEditedBy ? ` by ${job.lastEditedBy.name}` : ` by ${job.createdBy.name}`} · {fromNow(job.updatedAt)}
                    </Typography>
                  </Box>
                  <Box sx={{ flexShrink: 0 }}>
                    <StatusChip status={job.status} archived={Boolean(job.archivedAt)} />
                  </Box>
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </Card>
    </Stack>
  );
}
