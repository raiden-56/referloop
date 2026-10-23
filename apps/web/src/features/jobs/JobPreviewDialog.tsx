import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';
import { ExternalLink, Handshake } from 'lucide-react';
import {
  EMPLOYMENT_TYPE_LABELS,
  WORK_MODE_LABELS,
  formatExperience,
  formatLocation,
  formatSalary,
  type JobCategory,
  type JobInputParsed,
} from '@referloop/shared';
import { formatDateOnly } from '@/lib/dates';

interface Props {
  open: boolean;
  job: JobInputParsed | null;
  categories: JobCategory[];
  pending: boolean;
  onClose: () => void;
  onPublish: () => void;
}

const Block = ({ title, text }: { title: string; text: string | null }) =>
  text ? (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {text}
      </Typography>
    </Box>
  ) : null;

/** Shows the job exactly as validated, so the poster can check it before publishing. */
export function JobPreviewDialog({ open, job, categories, pending, onClose, onPublish }: Props) {
  if (!job) return null;
  const category = categories.find((c) => c.id === job.categoryId);
  const experience = formatExperience(job.experienceMin, job.experienceMax);
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>Preview your job post</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
          <Chip size="small" label="Active" sx={{ bgcolor: '#dcfce7', color: '#166534' }} />
          {category && <Chip size="small" variant="outlined" label={category.name} />}
          {job.referralAvailable && (
            <Chip size="small" color="primary" variant="outlined" icon={<Handshake size={14} />} label="Referral available" />
          )}
        </Stack>
        <Typography variant="h3" component="p">
          {job.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
          {job.companyName}
          {job.department ? ` · ${job.department}` : ''}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {formatLocation(job.location, job.workMode)} · {WORK_MODE_LABELS[job.workMode]} · {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
          {experience ? ` · ${experience}` : ''}
          {salary ? ` · ${salary}` : ''}
          {job.numberOfOpenings ? ` · ${job.numberOfOpenings} opening${job.numberOfOpenings > 1 ? 's' : ''}` : ''}
          {job.applicationDeadline ? ` · Apply by ${formatDateOnly(job.applicationDeadline)}` : ''}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Block title="Summary" text={job.summary} />
        <Block title="Description" text={job.description} />
        <Block title="Responsibilities" text={job.responsibilities} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Required skills
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {job.requiredSkills.map((s) => (
              <Chip key={s} size="small" label={s} />
            ))}
          </Stack>
        </Box>
        {job.preferredSkills.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Preferred skills
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {job.preferredSkills.map((s) => (
                <Chip key={s} size="small" variant="outlined" label={s} />
              ))}
            </Stack>
          </Box>
        )}
        <Block title="Eligibility" text={job.eligibility} />
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          Referral
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {job.referralAvailable
            ? job.posterCanRefer
              ? 'Referral available — you confirmed you can personally refer applicants.'
              : 'Referral available (not personally by you).'
            : 'No referral offered.'}
        </Typography>
        <Block title="Referral instructions" text={job.referralInstructions} />
        <Block title="Notes for applicants" text={job.applicantNotes} />
        {job.applicationUrl ? (
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, wordBreak: 'break-all' }}>
            <ExternalLink size={14} /> {job.applicationUrl}
          </Typography>
        ) : (
          <Alert severity="warning">
            No official application link. Adding one helps applicants and makes the listing more trustworthy.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={pending} color="inherit">
          Keep editing
        </Button>
        <Button onClick={onPublish} variant="contained" disabled={pending}>
          {pending ? 'Publishing…' : 'Publish job'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
