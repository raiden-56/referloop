import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { Badge, Box, Button, Card, CardContent, Chip, Link, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import { Check, ExternalLink, Handshake, Inbox, Mail, Send, Undo2, X } from 'lucide-react';
import {
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABELS,
  REFERRAL_TRANSITIONS,
  type ReferralBox,
  type ReferralRequestItem,
  type ReferralResponse,
  type ReferralStatus,
} from '@referloop/shared';
import { errorMessage } from '@/api/client';
import { useReferrals, useRespondReferral, useWithdrawReferral } from '@/api/queries';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useNotify } from '@/components/notify';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { ReferralStatusChip } from '@/components/ReferralStatusChip';
import { formatDateTime, fromNow } from '@/lib/dates';

const RESPONSE_DIALOGS: Record<
  ReferralResponse,
  { title: string; description: string; confirm: string; color: 'primary' | 'success' | 'error'; done: string; placeholder: string }
> = {
  ACCEPTED: {
    title: 'Accept this request?',
    description: 'Let them know you will refer them. You can mark them as referred once you have submitted the referral.',
    confirm: 'Accept',
    color: 'primary',
    done: 'Request accepted',
    placeholder: 'e.g. Please email me your latest resume',
  },
  REFERRED: {
    title: 'Mark as referred?',
    description: 'Confirm you have submitted the referral through your company’s referral system.',
    confirm: 'Mark as referred',
    color: 'success',
    done: 'Marked as referred — thank you for helping!',
    placeholder: 'e.g. Submitted today; the recruiter usually replies within a week',
  },
  DECLINED: {
    title: 'Decline this request?',
    description: 'They will be notified. A short, kind reason helps them improve their next application.',
    confirm: 'Decline',
    color: 'error',
    done: 'Request declined',
    placeholder: 'e.g. The role needs more backend experience',
  },
};

function ReferralCard({
  item,
  box,
  onRespond,
  onWithdraw,
}: {
  item: ReferralRequestItem;
  box: ReferralBox;
  onRespond: (item: ReferralRequestItem, status: ReferralResponse) => void;
  onWithdraw: (item: ReferralRequestItem) => void;
}) {
  const received = box === 'received';
  const responses = received ? REFERRAL_TRANSITIONS[item.status] : [];
  const canWithdraw = !received && (item.status === 'PENDING' || item.status === 'ACCEPTED');

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            {item.job.archivedAt ? (
              <Typography variant="h5" component="h2">
                {item.job.title}
              </Typography>
            ) : (
              <Link component={RouterLink} to={`/jobs/${item.job.slug}`} variant="h5" underline="hover" sx={{ wordBreak: 'break-word' }}>
                {item.job.title}
              </Link>
            )}
            <Typography variant="body2" color="text.secondary">
              {item.job.companyName}
              {item.job.status === 'CLOSED' ? ' · Job closed' : ''}
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <ReferralStatusChip status={item.status} />
          </Box>
        </Stack>

        <Typography variant="body2" sx={{ mb: 1 }}>
          {received ? (
            <>
              From <strong>{item.requester.name}</strong>
              {item.requester.email && (
                <>
                  {' · '}
                  <Link href={`mailto:${item.requester.email}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <Mail size={14} /> {item.requester.email}
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              To <strong>{item.referrer.name}</strong>
            </>
          )}
          <Typography component="span" variant="caption" color="text.secondary" title={formatDateTime(item.createdAt)}>
            {' · '}
            {fromNow(item.createdAt)}
          </Typography>
        </Typography>

        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', bgcolor: '#f9fafb', p: 1.5, borderRadius: 2 }}>
          {item.message}
        </Typography>
        {item.profileUrl && (
          <Link
            href={item.profileUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            variant="body2"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, wordBreak: 'break-all' }}
          >
            Resume / profile <ExternalLink size={14} />
          </Link>
        )}
        {item.responseNote && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {received ? 'Your note' : `Note from ${item.referrer.name}`}
              {item.respondedAt ? ` · ${fromNow(item.respondedAt)}` : ''}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {item.responseNote}
            </Typography>
          </Box>
        )}

        {(responses.length > 0 || canWithdraw) && (
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
            {responses.includes('ACCEPTED') && (
              <Button size="small" variant="contained" startIcon={<Check size={16} />} onClick={() => onRespond(item, 'ACCEPTED')}>
                Accept
              </Button>
            )}
            {responses.includes('REFERRED') && (
              <Button
                size="small"
                variant={item.status === 'ACCEPTED' ? 'contained' : 'outlined'}
                color="success"
                startIcon={<Handshake size={16} />}
                onClick={() => onRespond(item, 'REFERRED')}
              >
                Mark as referred
              </Button>
            )}
            {responses.includes('DECLINED') && (
              <Button size="small" color="inherit" startIcon={<X size={16} />} onClick={() => onRespond(item, 'DECLINED')}>
                Decline
              </Button>
            )}
            {canWithdraw && (
              <Button size="small" color="inherit" startIcon={<Undo2 size={16} />} onClick={() => onWithdraw(item)}>
                Withdraw request
              </Button>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReferralsPage() {
  const [params, setParams] = useSearchParams();
  const box: ReferralBox = params.get('box') === 'sent' ? 'sent' : 'received';
  const statusParam = params.get('status');
  const status = REFERRAL_STATUSES.find((s) => s === statusParam);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isLoading, error, refetch } = useReferrals(box, status, page);
  const respond = useRespondReferral();
  const withdraw = useWithdrawReferral();
  const notify = useNotify();
  const [responding, setResponding] = useState<{ item: ReferralRequestItem; status: ReferralResponse } | null>(null);
  const [withdrawing, setWithdrawing] = useState<ReferralRequestItem | null>(null);

  const update = (next: { box?: ReferralBox; status?: ReferralStatus | null; page?: number }) => {
    const b = next.box ?? box;
    const s = next.status === null ? undefined : (next.status ?? (next.box ? undefined : status));
    setParams({ box: b, ...(s ? { status: s } : {}), ...(next.page && next.page > 1 ? { page: String(next.page) } : {}) });
  };

  const onFailure = (err: unknown) => {
    notify(errorMessage(err), 'error');
    // The request may have changed under us (e.g. withdrawn while we were responding): show its real state.
    void refetch();
  };

  const runRespond = (note: string) => {
    if (!responding) return;
    const dialog = RESPONSE_DIALOGS[responding.status];
    respond.mutate(
      { id: responding.item.id, input: { status: responding.status, note } },
      {
        onSuccess: () => notify(dialog.done),
        onError: onFailure,
        onSettled: () => setResponding(null),
      },
    );
  };

  const runWithdraw = () => {
    if (!withdrawing) return;
    withdraw.mutate(withdrawing.id, {
      onSuccess: () => notify('Request withdrawn'),
      onError: onFailure,
      onSettled: () => setWithdrawing(null),
    });
  };

  const dialog = responding ? RESPONSE_DIALOGS[responding.status] : null;
  const pending = data?.pendingReceived ?? 0;

  return (
    <>
      <PageHeader
        title="Referrals"
        subtitle="Requests members sent you for jobs you posted, and the referrals you asked for."
        actions={
          <Button component={RouterLink} to="/jobs?referral=true" variant="outlined" startIcon={<Handshake size={18} />}>
            Find jobs with referrals
          </Button>
        }
      />
      <Tabs value={box} onChange={(_e, v: ReferralBox) => update({ box: v })} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab
          value="received"
          iconPosition="start"
          icon={<Inbox size={16} />}
          label={
            <Badge color="error" badgeContent={pending} sx={{ '& .MuiBadge-badge': { right: -14 } }}>
              Received
            </Badge>
          }
        />
        <Tab value="sent" iconPosition="start" icon={<Send size={16} />} label="Sent" />
      </Tabs>

      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2.5 }} role="group" aria-label="Filter by status">
        <Chip
          label="All"
          color={status ? 'default' : 'primary'}
          variant={status ? 'outlined' : 'filled'}
          onClick={() => update({ status: null })}
        />
        {REFERRAL_STATUSES.map((s) => (
          <Chip
            key={s}
            label={REFERRAL_STATUS_LABELS[s]}
            color={status === s ? 'primary' : 'default'}
            variant={status === s ? 'filled' : 'outlined'}
            onClick={() => update({ status: s })}
          />
        ))}
      </Stack>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <Stack spacing={2}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={180} />
          ))}
        </Stack>
      ) : data.items.length === 0 ? (
        box === 'received' ? (
          <EmptyState
            icon={<Inbox size={40} />}
            title={status ? 'No requests with this status' : 'No referral requests yet'}
            description="When you post a job and confirm you can refer applicants, members can ask you for a referral here."
            action={
              <Button component={RouterLink} to="/jobs/new" variant="outlined">
                Post a job
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Send size={40} />}
            title={status ? 'No requests with this status' : 'You have not asked for a referral yet'}
            description="Open a job marked “Referral available” and use “Ask for a referral” to reach the member who posted it."
            action={
              <Button component={RouterLink} to="/jobs?referral=true" variant="contained">
                Browse jobs with referrals
              </Button>
            }
          />
        )
      ) : (
        <>
          <Stack spacing={2}>
            {data.items.map((item) => (
              <ReferralCard
                key={item.id}
                item={item}
                box={box}
                onRespond={(i, s) => setResponding({ item: i, status: s })}
                onWithdraw={setWithdrawing}
              />
            ))}
          </Stack>
          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onChange={(p) => update({ page: p })}
          />
        </>
      )}

      {dialog && responding && (
        <ConfirmDialog
          open
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirm}
          confirmColor={dialog.color}
          reason={{ label: `Note to ${responding.item.requester.name}`, placeholder: dialog.placeholder }}
          pending={respond.isPending}
          onConfirm={runRespond}
          onClose={() => setResponding(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(withdrawing)}
        title="Withdraw this request?"
        description={withdrawing ? `${withdrawing.referrer.name} will be notified that you no longer need a referral.` : undefined}
        confirmLabel="Withdraw"
        confirmColor="error"
        pending={withdraw.isPending}
        onConfirm={runWithdraw}
        onClose={() => setWithdrawing(null)}
      />
    </>
  );
}
