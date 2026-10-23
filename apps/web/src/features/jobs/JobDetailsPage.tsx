import { useState, type ReactNode } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CircleSlash,
  Clock,
  ExternalLink,
  Flag,
  Handshake,
  History,
  MapPin,
  MoreVertical,
  Pencil,
  RotateCcw,
  Users,
  Wallet,
} from 'lucide-react';
import {
  EMPLOYMENT_TYPE_LABELS,
  WORK_MODE_LABELS,
  formatExperience,
  formatLocation,
  formatSalary,
  type JobDetail,
} from '@referloop/shared';
import { ApiError, errorMessage } from '@/api/client';
import { useConfig, useJob, useJobHistory, useJobStatusAction, type StatusAction } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { useNotify } from '@/components/notify';
import { SaveJobButton } from '@/components/SaveJobButton';
import { ShareMenu } from '@/components/ShareMenu';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, formatDateOnly, formatDateTime, fromNow } from '@/lib/dates';
import { ReferralStatusChip } from '@/components/ReferralStatusChip';
import { RequestReferralDialog } from '@/features/referrals/RequestReferralDialog';
import { JobHistoryTimeline } from './JobHistoryTimeline';
import { ReportJobDialog } from './ReportJobDialog';

const STATUS_DIALOGS: Record<
  StatusAction,
  { title: string; description: string; confirm: string; color: 'error' | 'success' | 'primary'; done: string }
> = {
  close: {
    title: 'Mark this job as closed?',
    description:
      'Closed jobs are hidden from the default job search but stay visible on their page and in history. Any verified member can reopen it later.',
    confirm: 'Mark as closed',
    color: 'error',
    done: 'Job marked as closed',
  },
  reopen: {
    title: 'Reopen this job?',
    description: 'Only reopen the job if you have confirmed the position is accepting applications again.',
    confirm: 'Reopen job',
    color: 'success',
    done: 'Job reopened',
  },
  'confirm-active': {
    title: 'Confirm this job is still open?',
    description:
      'Only confirm if you have checked with the employer or the official careers page that the role is still accepting applications.',
    confirm: 'Yes, still open',
    color: 'primary',
    done: 'Thanks for confirming — the listing is marked as fresh',
  },
};

const externalLinkProps = { target: '_blank', rel: 'noopener noreferrer nofollow' } as const;

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ color: 'primary.main', mt: '2px', display: 'flex' }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {children}
        </Typography>
      </Box>
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 3.5 }}>
      <Typography variant="h4" component="h2" sx={{ mb: 1.25 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

const Prose = ({ children }: { children: string }) => (
  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'text.primary', lineHeight: 1.7 }}>
    {children}
  </Typography>
);

function StatusNotices({ job, canEdit, onAction }: { job: JobDetail; canEdit: boolean; onAction: (a: StatusAction) => void }) {
  if (job.archivedAt) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        <AlertTitle>Archived listing</AlertTitle>
        This job was archived by an administrator on {formatDate(job.archivedAt)} and is hidden from members.
      </Alert>
    );
  }
  if (job.status === 'CLOSED') {
    return (
      <Alert
        severity="info"
        icon={<CircleSlash size={20} />}
        sx={{ mb: 2 }}
        action={
          canEdit ? (
            <Button color="inherit" size="small" onClick={() => onAction('reopen')}>
              Reopen
            </Button>
          ) : undefined
        }
      >
        <AlertTitle>This position is closed</AlertTitle>
        It was marked as closed {fromNow(job.statusChangedAt)} and is no longer accepting applications through ReferLoop.
      </Alert>
    );
  }
  if (job.freshness.deadlinePassed || job.freshness.stale) {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        action={
          canEdit ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ whiteSpace: 'nowrap' }}>
              <Button color="inherit" size="small" onClick={() => onAction('confirm-active')}>
                Still open
              </Button>
              <Button color="inherit" size="small" onClick={() => onAction('close')}>
                Mark closed
              </Button>
            </Stack>
          ) : undefined
        }
      >
        <AlertTitle>{job.freshness.deadlinePassed ? 'The application deadline has passed' : 'This listing may be out of date'}</AlertTitle>
        {job.freshness.deadlinePassed
          ? `The listed deadline was ${formatDateOnly(job.applicationDeadline!)}. That does not always mean hiring has closed — `
          : `Nobody has updated or confirmed this job since ${formatDate(job.statusConfirmedAt ?? job.updatedAt)}. `}
        {canEdit ? 'if you know the current status, please confirm it.' : 'check the official application page for the current status.'}
      </Alert>
    );
  }
  return null;
}

/** "Ask for a referral" for jobs whose poster offered to refer, or the state of the viewer's earlier request. */
function ReferralRequestAction({ job, onRequest }: { job: JobDetail; onRequest: () => void }) {
  const { user, isVerified } = useAuth();
  const location = useLocation();
  if (!job.referralAvailable || !job.posterCanRefer || job.archivedAt) return null;

  const request = job.viewerReferral && job.viewerReferral.status !== 'WITHDRAWN' ? job.viewerReferral : null;
  if (request) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Typography variant="body2">Your request:</Typography>
        <ReferralStatusChip status={request.status} />
        <Link component={RouterLink} to="/referrals?box=sent" variant="body2">
          View
        </Link>
      </Stack>
    );
  }
  if (job.status === 'CLOSED') return null;
  if (user?.id === job.createdBy.id) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Members can ask you for a referral from this page. Requests appear under{' '}
        <Link component={RouterLink} to="/referrals">
          Referrals
        </Link>
        .
      </Typography>
    );
  }
  if (!user) {
    return (
      <Button
        component={RouterLink}
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        variant="outlined"
        fullWidth
        startIcon={<Handshake size={16} />}
        sx={{ mb: 2 }}
      >
        Sign in to ask for a referral
      </Button>
    );
  }
  return (
    <Box sx={{ mb: 2 }}>
      <Button variant="contained" fullWidth startIcon={<Handshake size={16} />} onClick={onRequest} disabled={!isVerified}>
        Ask {job.createdBy.name} for a referral
      </Button>
      {!isVerified && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Verify your email address to request referrals.
        </Typography>
      )}
    </Box>
  );
}

export default function JobDetailsPage() {
  const { slug } = useParams();
  const { data: job, isLoading, error, refetch } = useJob(slug);
  const { isAuthenticated, isVerified } = useAuth();
  const { data: config } = useConfig();
  const history = useJobHistory(job?.id, isVerified);
  const statusAction = useJobStatusAction();
  const notify = useNotify();
  const [dialog, setDialog] = useState<StatusAction | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton width={120} />
        <Skeleton variant="rounded" height={220} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  }
  if (error || !job) return <ErrorState error={error} onRetry={() => void refetch()} title={undefined} />;

  const canEdit = isVerified && !job.archivedAt;
  const experience = formatExperience(job.experienceMin, job.experienceMax);
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const closed = job.status === 'CLOSED';
  const statusDialog = dialog ? STATUS_DIALOGS[dialog] : null;

  const runStatusAction = (reason: string) => {
    if (!dialog) return;
    const done = STATUS_DIALOGS[dialog].done;
    statusAction.mutate(
      { id: job.id, action: dialog, reason },
      {
        onSuccess: () => {
          notify(done);
          setDialog(null);
          void history.refetch();
        },
        onError: (err) => {
          notify(errorMessage(err), 'error');
          // Someone else changed the job first (e.g. already closed it): show its real state.
          if (err instanceof ApiError && err.status === 409) {
            setDialog(null);
            void refetch();
            void history.refetch();
          }
        },
      },
    );
  };

  return (
    <>
      <Button component={RouterLink} to="/jobs" startIcon={<ArrowLeft size={16} />} sx={{ mb: 2, ml: -1 }} color="inherit">
        All jobs
      </Button>

      <StatusNotices job={job} canEdit={canEdit} onAction={setDialog} />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
                <StatusChip status={job.status} archived={Boolean(job.archivedAt)} size="medium" />
                {job.category && <Chip label={job.category.name} variant="outlined" />}
                {job.referralAvailable && (
                  <Chip color="primary" variant="outlined" icon={<Handshake size={15} />} label="Referral available" />
                )}
              </Stack>
              <Typography variant="h1" sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, wordBreak: 'break-word' }}>
                {job.title}
              </Typography>
              <Typography variant="h4" component="p" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                {job.companyName}
                {job.department ? ` · ${job.department}` : ''}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexShrink: 0, flexWrap: 'wrap', rowGap: 1 }}>
              {job.applicationUrl && !closed && (
                <Button variant="contained" endIcon={<ExternalLink size={16} />} href={job.applicationUrl} {...externalLinkProps}>
                  Apply on official site
                </Button>
              )}
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <ShareMenu job={job} />
                {isAuthenticated && <SaveJobButton jobId={job.id} saved={job.isSaved} />}
                {isVerified && (
                  <>
                    <Tooltip title="More actions">
                      <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="More actions" aria-haspopup="menu">
                        <MoreVertical size={20} />
                      </IconButton>
                    </Tooltip>
                    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                      {canEdit && (
                        <MenuItem component={RouterLink} to={`/jobs/${job.slug}/edit`}>
                          <ListItemIcon>
                            <Pencil size={17} />
                          </ListItemIcon>
                          Edit job
                        </MenuItem>
                      )}
                      {canEdit && (
                        <MenuItem
                          onClick={() => {
                            setMenuAnchor(null);
                            setDialog(closed ? 'reopen' : 'close');
                          }}
                        >
                          <ListItemIcon>{closed ? <RotateCcw size={17} /> : <CircleSlash size={17} />}</ListItemIcon>
                          {closed ? 'Reopen job' : 'Mark as closed'}
                        </MenuItem>
                      )}
                      {canEdit && !closed && (
                        <MenuItem
                          onClick={() => {
                            setMenuAnchor(null);
                            setDialog('confirm-active');
                          }}
                        >
                          <ListItemIcon>
                            <BadgeCheck size={17} />
                          </ListItemIcon>
                          Confirm still open
                        </MenuItem>
                      )}
                      <MenuItem
                        onClick={() => {
                          setMenuAnchor(null);
                          document.getElementById('job-history')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        <ListItemIcon>
                          <History size={17} />
                        </ListItemIcon>
                        View edit history
                      </MenuItem>
                      {!job.archivedAt && (
                        <MenuItem
                          onClick={() => {
                            setMenuAnchor(null);
                            setReportOpen(true);
                          }}
                        >
                          <ListItemIcon>
                            <Flag size={17} />
                          </ListItemIcon>
                          Report listing
                        </MenuItem>
                      )}
                    </Menu>
                  </>
                )}
              </Stack>
            </Stack>
          </Stack>

          {canEdit && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button component={RouterLink} to={`/jobs/${job.slug}/edit`} variant="outlined" startIcon={<Pencil size={16} />} size="small">
                Edit
              </Button>
              <Button
                variant="outlined"
                size="small"
                color={closed ? 'success' : 'inherit'}
                sx={closed ? undefined : { borderColor: 'divider', color: 'text.secondary' }}
                startIcon={closed ? <RotateCcw size={16} /> : <CircleSlash size={16} />}
                onClick={() => setDialog(closed ? 'reopen' : 'close')}
              >
                {closed ? 'Reopen' : 'Mark as closed'}
              </Button>
            </Stack>
          )}

          <Divider sx={{ my: 2.5 }} />

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fact icon={<MapPin size={18} />} label="Location">
                {job.location ? `${job.location} · ${WORK_MODE_LABELS[job.workMode]}` : formatLocation(job.location, job.workMode)}
              </Fact>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fact icon={<BriefcaseBusiness size={18} />} label="Employment">
                {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
                {experience ? ` · ${experience}` : ''}
              </Fact>
            </Grid>
            {salary && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Fact icon={<Wallet size={18} />} label="Salary (annual)">
                  {salary}
                </Fact>
              </Grid>
            )}
            {job.numberOfOpenings && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Fact icon={<Users size={18} />} label="Openings">
                  {job.numberOfOpenings}
                </Fact>
              </Grid>
            )}
            {job.applicationDeadline && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Fact icon={<CalendarClock size={18} />} label="Application deadline">
                  {formatDateOnly(job.applicationDeadline)}
                </Fact>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fact icon={<Clock size={18} />} label="Posted">
                <span title={formatDateTime(job.createdAt)}>{formatDate(job.createdAt)}</span> by {job.createdBy.name}
              </Fact>
            </Grid>
            {job.lastEditedBy && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Fact icon={<Pencil size={18} />} label="Last updated">
                  <span title={formatDateTime(job.updatedAt)}>{fromNow(job.updatedAt)}</span> by {job.lastEditedBy.name}
                </Fact>
              </Grid>
            )}
            {job.editorCount > 1 && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Fact icon={<Users size={18} />} label="Community">
                  {job.editorCount} members have contributed
                </Fact>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Section title="Summary">
                <Prose>{job.summary}</Prose>
              </Section>
              <Section title="About the role">
                <Prose>{job.description}</Prose>
              </Section>
              {job.responsibilities && (
                <Section title="Responsibilities">
                  <Prose>{job.responsibilities}</Prose>
                </Section>
              )}
              <Section title="Required skills">
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {job.requiredSkills.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      component={RouterLink}
                      to={`/jobs?skills=${encodeURIComponent(s)}`}
                      clickable
                      sx={{ bgcolor: '#eef2ff', color: '#3730a3' }}
                    />
                  ))}
                </Stack>
              </Section>
              {job.preferredSkills.length > 0 && (
                <Section title="Preferred skills">
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {job.preferredSkills.map((s) => (
                      <Chip key={s} label={s} variant="outlined" />
                    ))}
                  </Stack>
                </Section>
              )}
              {job.eligibility && (
                <Section title="Eligibility">
                  <Prose>{job.eligibility}</Prose>
                </Section>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" component="h2" sx={{ mb: 1.5 }}>
                  Referral & application
                </Typography>
                {job.referralAvailable ? (
                  <Alert severity="success" icon={<Handshake size={20} />} sx={{ mb: 2 }}>
                    {job.posterCanRefer
                      ? `${job.createdBy.name} confirmed they can personally refer applicants.`
                      : 'A referral is available for this role. See the instructions below.'}
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No referral has been offered for this role. Apply through the official link.
                  </Alert>
                )}
                <ReferralRequestAction job={job} onRequest={() => setReferralOpen(true)} />
                {job.referralInstructions && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Referral instructions</Typography>
                    <Prose>{job.referralInstructions}</Prose>
                  </Box>
                )}
                {job.applicantNotes && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Notes for applicants</Typography>
                    <Prose>{job.applicantNotes}</Prose>
                  </Box>
                )}
                <Stack spacing={1}>
                  {job.applicationUrl ? (
                    <Link
                      href={job.applicationUrl}
                      {...externalLinkProps}
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, wordBreak: 'break-all' }}
                    >
                      Official application page <ExternalLink size={14} />
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No official application link has been added yet.
                    </Typography>
                  )}
                  {job.recruiterUrl && (
                    <Link href={job.recruiterUrl} {...externalLinkProps} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      Recruiter / careers page <ExternalLink size={14} />
                    </Link>
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                  Listings are shared by community members. Always verify details on the employer’s official site, and never pay to apply.
                </Typography>
              </CardContent>
            </Card>

            <Card id="job-history">
              <CardContent>
                <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
                  Edit history
                </Typography>
                {!isVerified ? (
                  <Typography variant="body2" color="text.secondary">
                    {isAuthenticated
                      ? 'Verify your email to view who changed what.'
                      : 'Sign in as a verified member to see who edited this job and what changed.'}
                  </Typography>
                ) : history.isLoading ? (
                  <Stack spacing={1}>
                    <Skeleton />
                    <Skeleton />
                    <Skeleton width="60%" />
                  </Stack>
                ) : history.isError ? (
                  <Alert severity="error" action={<Button onClick={() => void history.refetch()}>Retry</Button>}>
                    {errorMessage(history.error)}
                  </Alert>
                ) : (
                  <JobHistoryTimeline entries={history.data?.edits ?? []} categories={config?.categories ?? []} />
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {statusDialog && (
        <ConfirmDialog
          open
          title={statusDialog.title}
          description={statusDialog.description}
          confirmLabel={statusDialog.confirm}
          confirmColor={statusDialog.color}
          reason={{ label: 'Reason', placeholder: dialog === 'close' ? 'e.g. Position filled' : 'e.g. Recruiter confirmed on LinkedIn' }}
          pending={statusAction.isPending}
          onConfirm={runStatusAction}
          onClose={() => setDialog(null)}
        />
      )}
      <ReportJobDialog jobId={job.id} jobTitle={job.title} open={reportOpen} onClose={() => setReportOpen(false)} />
      <RequestReferralDialog
        jobId={job.id}
        jobTitle={job.title}
        referrerName={job.createdBy.name}
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
      />
    </>
  );
}
