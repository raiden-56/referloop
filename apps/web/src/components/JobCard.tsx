import { Link as RouterLink } from 'react-router';
import { Box, Button, Card, CardActions, CardContent, Chip, Link, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { BriefcaseBusiness, Clock, Handshake, MapPin, Pencil, TriangleAlert, UserRound } from 'lucide-react';
import { EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS, formatExperience, formatLocation, type JobSummary } from '@referloop/shared';
import { useAuth } from '@/auth/useAuth';
import { fromNow } from '@/lib/dates';
import { SaveJobButton } from './SaveJobButton';
import { ShareMenu } from './ShareMenu';
import { StatusChip } from './StatusChip';

const MAX_SKILLS = 5;

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary', minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexShrink: 0 }}>{icon}</Box>
      <Typography variant="body2" noWrap>
        {children}
      </Typography>
    </Stack>
  );
}

export function JobCard({ job }: { job: JobSummary }) {
  const { isAuthenticated, isVerified } = useAuth();
  const experience = formatExperience(job.experienceMin, job.experienceMax);
  const extraSkills = job.requiredSkills.length - MAX_SKILLS;
  const edited = job.lastEditedBy && job.updatedAt !== job.createdAt;
  const closed = job.status === 'CLOSED';

  return (
    <Card
      component="article"
      aria-label={`${job.title} at ${job.companyName}`}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color .15s, box-shadow .15s',
        opacity: closed ? 0.85 : 1,
        '&:hover': { borderColor: 'primary.light', boxShadow: '0 4px 14px rgba(17,24,39,0.06)' },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Link
              component={RouterLink}
              to={`/jobs/${job.slug}`}
              color="text.primary"
              sx={{ fontWeight: 650, fontSize: '1.05rem', lineHeight: 1.35, display: 'block' }}
            >
              {job.title}
            </Link>
            <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 500 }}>
              {job.companyName}
              {job.category ? ` · ${job.category.name}` : ''}
            </Typography>
          </Box>
          <StatusChip status={job.status} archived={Boolean(job.archivedAt)} />
        </Stack>

        <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, my: 1.5 }}>
          <Meta icon={<MapPin size={15} />}>
            {formatLocation(job.location, job.workMode)}
            {job.location || job.workMode !== 'REMOTE' ? ` · ${WORK_MODE_LABELS[job.workMode]}` : ''}
          </Meta>
          <Meta icon={<BriefcaseBusiness size={15} />}>
            {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
            {experience ? ` · ${experience}` : ''}
          </Meta>
        </Stack>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1.5 }}
        >
          {job.summary}
        </Typography>

        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {job.referralAvailable && (
            <Chip size="small" color="primary" variant="outlined" icon={<Handshake size={14} />} label="Referral available" />
          )}
          {job.requiredSkills.slice(0, MAX_SKILLS).map((s) => (
            <Chip key={s} size="small" label={s} sx={{ bgcolor: '#eef2ff', color: '#3730a3' }} />
          ))}
          {extraSkills > 0 && <Chip size="small" label={`+${extraSkills}`} variant="outlined" />}
        </Stack>

        {!closed && (job.freshness.deadlinePassed || job.freshness.stale) && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 1.5, color: 'warning.main' }}>
            <TriangleAlert size={15} />
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {job.freshness.deadlinePassed
                ? 'Deadline passed — status needs confirmation'
                : 'Not updated recently — status may be outdated'}
            </Typography>
          </Stack>
        )}
      </CardContent>

      <Box sx={{ px: 2, pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
          <Tooltip title={`Posted by ${job.createdBy.name}`}>
            <span>
              <Meta icon={<UserRound size={14} />}>
                <Typography component="span" variant="caption">
                  {job.createdBy.name} · {fromNow(job.createdAt)}
                </Typography>
              </Meta>
            </span>
          </Tooltip>
          {edited && (
            <Meta icon={<Clock size={14} />}>
              <Typography component="span" variant="caption">
                Updated {fromNow(job.updatedAt)} by {job.lastEditedBy!.name}
              </Typography>
            </Meta>
          )}
        </Stack>
      </Box>

      <CardActions sx={{ px: 2, pb: 2, pt: 1, gap: 0.5 }}>
        <Button component={RouterLink} to={`/jobs/${job.slug}`} variant="contained" size="small">
          View details
        </Button>
        {isVerified && !job.archivedAt && (
          <Button component={RouterLink} to={`/jobs/${job.slug}/edit`} size="small" startIcon={<Pencil size={14} />}>
            Edit
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <ShareMenu job={job} variant="icon" />
        {isAuthenticated && <SaveJobButton jobId={job.id} saved={job.isSaved} />}
      </CardActions>
    </Card>
  );
}

export function JobCardSkeleton() {
  return (
    <Card sx={{ height: '100%' }} aria-hidden>
      <CardContent>
        <Skeleton width="70%" height={28} />
        <Skeleton width="40%" />
        <Skeleton width="85%" sx={{ mt: 1.5 }} />
        <Skeleton width="100%" />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={80} height={24} />
          <Skeleton variant="rounded" width={50} height={24} />
        </Stack>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2 }}>
        <Skeleton variant="rounded" width={110} height={30} />
      </CardActions>
    </Card>
  );
}
