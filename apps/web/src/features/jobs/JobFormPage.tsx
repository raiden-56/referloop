import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useBlocker, useNavigate, useParams } from 'react-router';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowLeft, Eye, Save } from 'lucide-react';
import {
  CURRENCIES,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
  jobInputSchema,
  jobUpdateSchema,
  type DuplicateCandidate,
  type JobDetail,
  type JobInputParsed,
  type JobUpdateParsed,
} from '@referloop/shared';
import { ApiError, errorMessage } from '@/api/client';
import { useConfig, useCreateJob, useDuplicateCheck, useJob, useUpdateJob } from '@/api/queries';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { useNotify } from '@/components/notify';
import { PageHeader } from '@/components/PageHeader';
import { SkillsInput } from '@/components/SkillsInput';
import { StatusChip } from '@/components/StatusChip';
import { formatDate, fromNow } from '@/lib/dates';
import { applyServerErrors, toNumberOrNull } from '@/lib/forms';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { emptyJobForm, jobToFormValues, newIdempotencyKey, type JobFormValues } from './jobFormValues';
import { JobPreviewDialog } from './JobPreviewDialog';

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card component="section">
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="h4" component="h2">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
        <Box sx={{ mt: 2.5 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

export default function JobFormPage() {
  const { slug } = useParams();
  const isEdit = Boolean(slug);
  const { data: job, isLoading, error, refetch } = useJob(slug);

  if (!isEdit) return <JobForm />;
  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton width={240} height={48} />
        <Skeleton variant="rounded" height={300} />
        <Skeleton variant="rounded" height={300} />
      </Stack>
    );
  }
  if (error || !job) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (job.archivedAt) return <ErrorState error={new ApiError(404, { code: 'NOT_FOUND', message: 'Archived jobs cannot be edited.' })} />;
  return <JobForm job={job} onReload={() => refetch()} />;
}

function JobForm({ job, onReload }: { job?: JobDetail; onReload?: () => Promise<unknown> }) {
  const isEdit = Boolean(job);
  const navigate = useNavigate();
  const notify = useNotify();
  const { data: config } = useConfig();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const duplicateCheck = useDuplicateCheck();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [preview, setPreview] = useState<JobInputParsed | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<JobUpdateParsed | null>(null);
  const [conflict, setConflict] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const allowLeave = useRef(false);

  const resolver = (isEdit ? zodResolver(jobUpdateSchema) : zodResolver(jobInputSchema)) as unknown as Resolver<
    JobFormValues,
    unknown,
    JobUpdateParsed
  >;
  const {
    control,
    register,
    handleSubmit,
    setError,
    reset,
    setValue,
    getValues,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<JobFormValues, unknown, JobUpdateParsed>({
    resolver,
    defaultValues: job ? jobToFormValues(job) : emptyJobForm,
    mode: 'onTouched',
  });

  const [workMode, referralAvailable, title, companyName] = useWatch({
    control,
    name: ['workMode', 'referralAvailable', 'title', 'companyName'],
  });
  const debouncedTitle = useDebouncedValue(title.trim(), 600);
  const debouncedCompany = useDebouncedValue(companyName.trim(), 600);

  // Duplicate warning while composing a new job.
  const checkDuplicates = duplicateCheck.mutate;
  useEffect(() => {
    if (isEdit || debouncedTitle.length < 3 || debouncedCompany.length < 1) {
      setDuplicates([]);
      return;
    }
    checkDuplicates(
      { title: debouncedTitle, companyName: debouncedCompany },
      { onSuccess: setDuplicates, onError: () => setDuplicates([]) },
    );
  }, [isEdit, debouncedTitle, debouncedCompany, checkDuplicates]);

  useEffect(() => {
    if (!referralAvailable) setValue('posterCanRefer', false, { shouldDirty: true });
  }, [referralAvailable, setValue]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const handleError = (err: unknown) => {
    setPreview(null);
    setPendingUpdate(null);
    if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
      setConflict(true);
      return;
    }
    if (applyServerErrors(err, setError)) {
      notify('Please correct the highlighted fields.', 'error');
      return;
    }
    notify(errorMessage(err), 'error');
  };

  const publish = () => {
    if (!preview) return;
    createJob.mutate(
      { input: preview, idempotencyKey },
      {
        onSuccess: ({ job: created }) => {
          allowLeave.current = true;
          notify('Your job is live! Share it with your network.');
          navigate(`/jobs/${created.slug}`, { replace: true });
        },
        onError: handleError,
      },
    );
  };

  const saveEdit = (values: JobUpdateParsed) => {
    if (!job) return;
    updateJob.mutate(
      { id: job.id, input: { ...values, version: getValues('version') } },
      {
        onSuccess: ({ job: updated, changed }) => {
          setPendingUpdate(null);
          allowLeave.current = true;
          notify(
            changed ? 'Changes saved. Thanks for keeping this listing accurate!' : 'No changes to save.',
            changed ? 'success' : 'info',
          );
          navigate(`/jobs/${updated.slug}`);
        },
        onError: handleError,
      },
    );
  };

  const onValid = (values: JobUpdateParsed) => {
    if (!isEdit) {
      setPreview(values);
      return;
    }
    if (values.status && values.status !== job!.status) {
      setPendingUpdate(values);
      return;
    }
    saveEdit(values);
  };

  const onInvalid = () => {
    notify('Some fields need attention.', 'error');
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };

  const loadLatest = async (keepMine: boolean) => {
    const result = (await onReload?.()) as { data?: JobDetail } | undefined;
    const latest = result?.data;
    if (!latest) return;
    if (keepMine) {
      // Rebase: start from the newer version and re-apply only the fields this editor changed. Sending the
      // whole stale form would silently revert everything the other member changed in the meantime.
      const mine = getValues();
      const changed = (Object.keys(dirtyFields) as (keyof JobFormValues)[]).filter((f) => f !== 'version');
      reset(jobToFormValues(latest));
      for (const field of changed) setValue(field, mine[field] as never, { shouldDirty: true });
      notify('Updated to the latest version with your changes on top. Review and save again.', 'info');
    } else {
      allowLeave.current = false;
      reset(jobToFormValues(latest));
      notify('Loaded the latest version.', 'info');
    }
    setConflict(false);
  };

  const categories = config?.categories ?? [];
  const categoryMissing = job?.categoryId && !categories.some((c) => c.id === job.categoryId);
  const busy = isSubmitting || createJob.isPending || updateJob.isPending;
  const err = (name: keyof JobFormValues) => errors[name]?.message as string | undefined;

  const numberField = (
    name: 'experienceMin' | 'experienceMax' | 'salaryMin' | 'salaryMax' | 'numberOfOpenings',
    label: string,
    extra?: { min?: number; max?: number; helper?: string },
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          label={label}
          type="number"
          value={field.value ?? ''}
          onChange={(e) => field.onChange(toNumberOrNull(e.target.value))}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={Boolean(errors[name])}
          helperText={err(name) ?? extra?.helper}
          slotProps={{ htmlInput: { min: extra?.min ?? 0, max: extra?.max, inputMode: 'numeric' } }}
        />
      )}
    />
  );

  const statusField = useMemo(
    () =>
      isEdit ? (
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel id="status-label">Status</InputLabel>
              <Select labelId="status-label" label="Status" {...field} value={field.value ?? 'ACTIVE'}>
                <MenuItem value="ACTIVE">Active — accepting applications</MenuItem>
                <MenuItem value="CLOSED">Closed — no longer available</MenuItem>
              </Select>
              <FormHelperText>Changing the status asks for confirmation and is recorded in the status history.</FormHelperText>
            </FormControl>
          )}
        />
      ) : null,
    [isEdit, control],
  );

  return (
    <Box component="form" noValidate onSubmit={handleSubmit(onValid, onInvalid)}>
      <Button
        component={RouterLink}
        to={job ? `/jobs/${job.slug}` : '/jobs'}
        startIcon={<ArrowLeft size={16} />}
        sx={{ mb: 2, ml: -1 }}
        color="inherit"
      >
        {job ? 'Back to job' : 'All jobs'}
      </Button>
      <PageHeader
        title={isEdit ? 'Edit job' : 'Post a job'}
        subtitle={
          isEdit
            ? 'Any verified member can improve a listing. Every change is recorded with your name.'
            : 'Share an opening from your company or network. Fields marked * are required.'
        }
      />

      {job && (
        <Alert severity="info" icon={false} sx={{ mb: 3 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.5, sm: 2 }}
            sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap' }}
          >
            <StatusChip status={job.status} />
            <Typography variant="body2">
              Originally posted by <strong>{job.createdBy.name}</strong> on {formatDate(job.createdAt)}
            </Typography>
            {job.lastEditedBy && (
              <Typography variant="body2">
                Last updated by <strong>{job.lastEditedBy.name}</strong> {fromNow(job.updatedAt)}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Version {job.version}
            </Typography>
          </Stack>
        </Alert>
      )}

      {conflict && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Someone else updated this job while you were editing</AlertTitle>
          Your changes were not saved, and nothing was overwritten. Open the latest version in a new tab to compare, then choose how to
          continue.
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
            <Button size="small" variant="outlined" color="inherit" href={job ? `/jobs/${job.slug}` : '#'} target="_blank" rel="noopener">
              View latest version
            </Button>
            <Button size="small" variant="contained" color="warning" onClick={() => void loadLatest(false)}>
              Discard my edits and load latest
            </Button>
            <Button size="small" color="inherit" onClick={() => void loadLatest(true)}>
              Keep my edits on top of latest
            </Button>
          </Stack>
        </Alert>
      )}

      {duplicates.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>This job might already be on ReferLoop</AlertTitle>
          Please check these similar listings first — you can edit an existing post instead of creating a duplicate.
          <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/jobs/${d.slug}`} target="_blank" rel="noopener">
                  {d.title} — {d.companyName}
                  {d.location ? `, ${d.location}` : ''}
                </Link>{' '}
                <Typography component="span" variant="caption" color="text.secondary">
                  ({d.status === 'ACTIVE' ? 'active' : 'closed'}, posted {fromNow(d.createdAt)})
                </Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      <Stack spacing={3}>
        <FormSection title="Job information">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                label="Job title"
                required
                {...register('title')}
                error={Boolean(errors.title)}
                helperText={err('title')}
                slotProps={{ htmlInput: { maxLength: 150 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Company name"
                required
                {...register('companyName')}
                error={Boolean(errors.companyName)}
                helperText={err('companyName')}
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={Boolean(errors.categoryId)}>
                    <InputLabel id="category-label">Category</InputLabel>
                    <Select labelId="category-label" label="Category" {...field} value={field.value ?? ''}>
                      <MenuItem value="">No category</MenuItem>
                      {categoryMissing && (
                        <MenuItem value={job!.categoryId!}>{job!.category?.name ?? 'Current category'} (inactive)</MenuItem>
                      )}
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.categoryId && <FormHelperText>{err('categoryId')}</FormHelperText>}
                  </FormControl>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Department" {...register('department')} error={Boolean(errors.department)} helperText={err('department')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Controller
                name="workMode"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth required>
                    <InputLabel id="workmode-label">Work mode</InputLabel>
                    <Select labelId="workmode-label" label="Work mode" {...field}>
                      {WORK_MODES.map((m) => (
                        <MenuItem key={m} value={m}>
                          {WORK_MODE_LABELS[m]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="Location"
                required={workMode !== 'REMOTE'}
                placeholder={workMode === 'REMOTE' ? 'Optional, e.g. Remote — India' : 'e.g. Bengaluru'}
                {...register('location')}
                error={Boolean(errors.location)}
                helperText={err('location') ?? (workMode === 'REMOTE' ? 'Optional for fully remote roles' : undefined)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Controller
                name="employmentType"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth required>
                    <InputLabel id="type-label">Employment type</InputLabel>
                    <Select labelId="type-label" label="Employment type" {...field}>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <MenuItem key={t} value={t}>
                          {EMPLOYMENT_TYPE_LABELS[t]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>{numberField('experienceMin', 'Min. experience (years)', { max: 50 })}</Grid>
            <Grid size={{ xs: 6, md: 4 }}>{numberField('experienceMax', 'Max. experience (years)', { max: 50 })}</Grid>
            <Grid size={{ xs: 12, md: 4 }}>{numberField('numberOfOpenings', 'Number of openings', { min: 1, max: 1000 })}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller
                name="salaryCurrency"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={Boolean(errors.salaryCurrency)}>
                    <InputLabel id="currency-label">Salary currency</InputLabel>
                    <Select labelId="currency-label" label="Salary currency" {...field} value={field.value ?? ''}>
                      <MenuItem value="">Not specified</MenuItem>
                      {CURRENCIES.map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.salaryCurrency && <FormHelperText>{err('salaryCurrency')}</FormHelperText>}
                  </FormControl>
                )}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>{numberField('salaryMin', 'Min. annual salary', { helper: 'Optional' })}</Grid>
            <Grid size={{ xs: 6, sm: 4 }}>{numberField('salaryMax', 'Max. annual salary')}</Grid>
          </Grid>
        </FormSection>

        <FormSection title="Job description" description="Plain text only. Line breaks are kept.">
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                label="Short summary"
                required
                multiline
                minRows={2}
                {...register('summary')}
                error={Boolean(errors.summary)}
                helperText={err('summary') ?? 'One or two sentences shown on job cards and in shared messages (20–500 characters).'}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Full job description"
                required
                multiline
                minRows={7}
                {...register('description')}
                error={Boolean(errors.description)}
                helperText={err('description') ?? 'At least 50 characters.'}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Responsibilities"
                multiline
                minRows={3}
                {...register('responsibilities')}
                error={Boolean(errors.responsibilities)}
                helperText={err('responsibilities')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="requiredSkills"
                control={control}
                render={({ field }) => (
                  <SkillsInput
                    label="Required skills"
                    required
                    value={field.value ?? []}
                    onChange={field.onChange}
                    error={err('requiredSkills')}
                    placeholder="Type and press Enter"
                    helperText="Press Enter or comma to add each skill"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="preferredSkills"
                control={control}
                render={({ field }) => (
                  <SkillsInput
                    label="Preferred skills"
                    value={field.value ?? []}
                    onChange={field.onChange}
                    error={err('preferredSkills')}
                    placeholder="Nice to have"
                  />
                )}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Eligibility requirements"
                multiline
                minRows={2}
                {...register('eligibility')}
                error={Boolean(errors.eligibility)}
                helperText={err('eligibility') ?? 'e.g. work authorisation, graduation year, certifications'}
              />
            </Grid>
          </Grid>
        </FormSection>

        <FormSection
          title="Referral & application"
          description="Only offer a referral you can actually arrange. Never ask applicants for payment."
        >
          <Grid container spacing={2}>
            <Grid size={12}>
              <Controller
                name="referralAvailable"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />}
                    label="A referral is available for this role"
                  />
                )}
              />
              <Controller
                name="posterCanRefer"
                control={control}
                render={({ field }) => (
                  <Box>
                    <FormControlLabel
                      disabled={!referralAvailable}
                      control={<Checkbox checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />}
                      label="I confirm I can personally refer applicants"
                    />
                    {errors.posterCanRefer && <FormHelperText error>{err('posterCanRefer')}</FormHelperText>}
                  </Box>
                )}
              />
            </Grid>
            {referralAvailable && (
              <Grid size={12}>
                <TextField
                  label="Referral instructions"
                  multiline
                  minRows={2}
                  placeholder="How should applicants contact you or request the referral?"
                  {...register('referralInstructions')}
                  error={Boolean(errors.referralInstructions)}
                  helperText={err('referralInstructions')}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Official application URL"
                type="url"
                placeholder="https://careers.example.com/…"
                {...register('applicationUrl')}
                error={Boolean(errors.applicationUrl)}
                helperText={err('applicationUrl') ?? 'Recommended — the employer’s own job page'}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Recruiter or careers-page URL"
                type="url"
                {...register('recruiterUrl')}
                error={Boolean(errors.recruiterUrl)}
                helperText={err('recruiterUrl')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Application deadline"
                type="date"
                {...register('applicationDeadline')}
                error={Boolean(errors.applicationDeadline)}
                helperText={err('applicationDeadline') ?? 'Optional. A passed deadline does not close the job automatically.'}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Additional notes for applicants"
                multiline
                minRows={2}
                {...register('applicantNotes')}
                error={Boolean(errors.applicantNotes)}
                helperText={err('applicantNotes')}
              />
            </Grid>
          </Grid>
        </FormSection>

        {isEdit && (
          <FormSection title="Status & reason">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 5 }}>{statusField}</Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField
                  label="Reason for changes (optional)"
                  placeholder="e.g. Updated experience after talking to the recruiter"
                  {...register('reason')}
                  error={Boolean(errors.reason)}
                  helperText={err('reason') ?? 'Shown in the edit history'}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                />
              </Grid>
            </Grid>
          </FormSection>
        )}

        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'flex-end', pb: 4 }}>
          <Button component={RouterLink} to={job ? `/jobs/${job.slug}` : '/jobs'} color="inherit" disabled={busy}>
            Cancel
          </Button>
          {isEdit ? (
            <Button type="submit" variant="contained" size="large" startIcon={<Save size={18} />} disabled={busy || !isDirty || conflict}>
              {updateJob.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          ) : (
            <Button type="submit" variant="contained" size="large" startIcon={<Eye size={18} />} disabled={busy}>
              Preview & publish
            </Button>
          )}
        </Stack>
      </Stack>

      <JobPreviewDialog
        open={Boolean(preview)}
        job={preview}
        categories={categories}
        pending={createJob.isPending}
        onClose={() => setPreview(null)}
        onPublish={publish}
      />

      {pendingUpdate && job && (
        <ConfirmDialog
          open
          title={pendingUpdate.status === 'CLOSED' ? 'Close this job and save changes?' : 'Reopen this job and save changes?'}
          description={
            pendingUpdate.status === 'CLOSED'
              ? 'The job will be hidden from the default job search. It stays visible on its page and can be reopened later.'
              : 'Only reopen the job if the position is accepting applications again.'
          }
          confirmLabel="Save changes"
          confirmColor={pendingUpdate.status === 'CLOSED' ? 'error' : 'success'}
          pending={updateJob.isPending}
          onConfirm={() => saveEdit(pendingUpdate)}
          onClose={() => setPendingUpdate(null)}
        />
      )}

      {blocker.state === 'blocked' && (
        <ConfirmDialog
          open
          title="Discard unsaved changes?"
          description="You have changes that have not been saved. If you leave this page they will be lost."
          confirmLabel="Discard changes"
          confirmColor="error"
          onConfirm={() => blocker.proceed()}
          onClose={() => blocker.reset()}
        />
      )}
    </Box>
  );
}
