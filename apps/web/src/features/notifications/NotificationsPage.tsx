import { useSearchParams, useNavigate } from 'react-router';
import { Button, List, Paper, Skeleton, Stack } from '@mui/material';
import { BellOff } from 'lucide-react';
import type { NotificationItem } from '@referloop/shared';
import { useMarkNotificationsRead, useNotifications } from '@/api/queries';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { NotificationRow } from '@/components/layout/NotificationsMenu';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isLoading, error, refetch } = useNotifications(page);
  const markRead = useMarkNotificationsRead();
  const navigate = useNavigate();

  const open = (n: NotificationItem) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates about jobs you posted or saved, your reports and your account."
        actions={
          data && data.unreadCount > 0 ? (
            <Button variant="outlined" onClick={() => markRead.mutate(undefined)} disabled={markRead.isPending}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <Stack spacing={1}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={64} />
          ))}
        </Stack>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<BellOff size={40} />}
          title="No notifications yet"
          description="We will let you know when someone edits or closes a job you posted or saved."
        />
      ) : (
        <>
          <Paper variant="outlined">
            <List disablePadding>
              {data.items.map((n) => (
                <NotificationRow key={n.id} n={n} onOpen={open} />
              ))}
            </List>
          </Paper>
          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onChange={(p) => setParams({ page: String(p) })}
          />
        </>
      )}
    </>
  );
}
