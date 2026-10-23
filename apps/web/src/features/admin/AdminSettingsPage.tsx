import { useEffect, useState, type FormEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Pencil, Plus, Tags } from 'lucide-react';
import { appSettingsSchema, type AdminCategory, type AppSettings, type AppSettingsInput } from '@referloop/shared';
import { ApiError, errorMessage } from '@/api/client';
import { useAdminCategories, useAdminSettings, useSaveCategory, useUpdateSettings } from '@/api/admin';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useNotify } from '@/components/notify';

// ---------------------------------------------------------------------------
// Application settings
// ---------------------------------------------------------------------------

function SettingSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <FormControlLabel
      sx={{ alignItems: 'flex-start', m: 0, gap: 1.5 }}
      control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} sx={{ mt: -0.5 }} />}
      label={
        <Box>
          <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      }
    />
  );
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings();
  const notify = useNotify();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<AppSettingsInput, unknown, AppSettings>({ resolver: zodResolver(appSettingsSchema), defaultValues: settings });

  useEffect(() => reset(settings), [settings, reset]);

  const onSubmit = handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: ({ settings: saved }) => {
        reset(saved);
        notify('Settings saved');
      },
      onError: (err) => {
        if (err instanceof ApiError && err.fields) {
          for (const [field, message] of Object.entries(err.fields)) {
            setError(field.split('.')[0] as keyof AppSettingsInput, { message });
          }
        }
        notify(errorMessage(err), 'error');
      },
    }),
  );

  const domainError = errors.allowedEmailDomains;
  const domainMessage = domainError?.message ?? (Array.isArray(domainError) ? domainError.find(Boolean)?.message : undefined);

  return (
    <Card component="form" onSubmit={onSubmit} noValidate>
      <CardContent>
        <Typography variant="h4" component="h2">
          Application settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Changes apply immediately to all members and are recorded in the audit log.
        </Typography>

        <Stack spacing={2.5}>
          <Typography variant="overline" color="text.secondary">
            Access policy
          </Typography>
          <Controller
            name="publicBrowsingEnabled"
            control={control}
            render={({ field }) => (
              <SettingSwitch
                checked={field.value}
                onChange={field.onChange}
                label="Public browsing"
                description="Allow signed-out visitors to search and view job listings. When off, members must sign in to browse."
              />
            )}
          />
          <Controller
            name="registrationEnabled"
            control={control}
            render={({ field }) => (
              <SettingSwitch
                checked={field.value}
                onChange={field.onChange}
                label="Open registration"
                description="Allow new people to create accounts."
              />
            )}
          />
          <Controller
            name="allowedEmailDomains"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={field.value}
                onChange={(_e, value) =>
                  field.onChange([...new Set((value as string[]).map((v) => v.trim().toLowerCase().replace(/^@/, '')).filter(Boolean))])
                }
                renderValue={(selected, getItemProps) =>
                  selected.map((option, index) => {
                    const { key, ...itemProps } = getItemProps({ index });
                    return <Chip key={key} size="small" label={option} {...itemProps} />;
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Allowed email domains"
                    placeholder={field.value.length ? undefined : 'e.g. example.com — press Enter to add'}
                    error={Boolean(domainMessage)}
                    helperText={domainMessage ?? 'Leave empty to allow any email address. Subdomains of listed domains are allowed too.'}
                  />
                )}
              />
            )}
          />

          <Divider />
          <Typography variant="overline" color="text.secondary">
            Job freshness
          </Typography>
          <Controller
            name="staleAfterDays"
            control={control}
            render={({ field }) => (
              <TextField
                type="number"
                label="Flag listings as possibly outdated after (days)"
                value={Number.isNaN(field.value) ? '' : field.value}
                onChange={(e) => field.onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                onBlur={field.onBlur}
                error={Boolean(errors.staleAfterDays)}
                helperText={
                  errors.staleAfterDays?.message ??
                  'Active jobs not updated or confirmed within this window show a reminder asking members to confirm the status.'
                }
                slotProps={{ htmlInput: { min: 7, max: 365 } }}
                sx={{ maxWidth: 420 }}
              />
            )}
          />

          <Divider />
          <Typography variant="overline" color="text.secondary">
            Notifications
          </Typography>
          <Controller
            name="notifyCreatorOnEdit"
            control={control}
            render={({ field }) => (
              <SettingSwitch
                checked={field.value}
                onChange={field.onChange}
                label="Notify posters about edits"
                description="Tell the original poster when another member edits their job."
              />
            )}
          />
          <Controller
            name="notifySaversOnStatusChange"
            control={control}
            render={({ field }) => (
              <SettingSwitch
                checked={field.value}
                onChange={field.onChange}
                label="Notify members who saved a job"
                description="Tell members when a job they saved is closed or reopened."
              />
            )}
          />
          <Controller
            name="notifyReporterOnResolution"
            control={control}
            render={({ field }) => (
              <SettingSwitch
                checked={field.value}
                onChange={field.onChange}
                label="Notify reporters"
                description="Tell members when their report has been reviewed."
              />
            )}
          />
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button color="inherit" disabled={!isDirty || update.isPending} onClick={() => reset(settings)}>
            Discard changes
          </Button>
          <Button type="submit" variant="contained" disabled={!isDirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function CategoryDialog({ category, onClose }: { category: AdminCategory | null; onClose: () => void }) {
  const save = useSaveCategory();
  const notify = useNotify();
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setSortOrder(String(category.sortOrder));
      setIsActive(category.isActive);
      setError(null);
    }
  }, [category]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!category) return;
    save.mutate(
      { id: category.id, input: { name: name.trim(), isActive, sortOrder: Number(sortOrder) || 0 } },
      {
        onSuccess: () => {
          notify('Category updated');
          onClose();
        },
        onError: (err) => setError(err instanceof ApiError && err.fields?.name ? err.fields.name : errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={Boolean(category)} onClose={save.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Edit category</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              required
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={Boolean(error)}
              helperText={error ?? undefined}
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            <TextField
              type="number"
              label="Sort order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              slotProps={{ htmlInput: { min: 0, max: 1000 } }}
              helperText="Lower numbers appear first."
            />
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
              label="Available when posting jobs"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={save.isPending || name.trim().length < 2}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function CategoriesCard() {
  const { data, isLoading, error, refetch } = useAdminCategories();
  const save = useSaveCategory();
  const notify = useNotify();
  const [name, setName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCategory | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setAddError('Use at least 2 characters');
      return;
    }
    const nextOrder = data && data.length ? Math.max(...data.map((c) => c.sortOrder)) + 10 : 0;
    save.mutate(
      { input: { name: trimmed, isActive: true, sortOrder: Math.min(nextOrder, 1000) } },
      {
        onSuccess: () => {
          setName('');
          setAddError(null);
          notify(`Category "${trimmed}" added`);
        },
        onError: (err) => setAddError(err instanceof ApiError && err.fields?.name ? err.fields.name : errorMessage(err)),
      },
    );
  };

  const toggle = (c: AdminCategory) =>
    save.mutate(
      { id: c.id, input: { name: c.name, isActive: !c.isActive, sortOrder: c.sortOrder } },
      {
        onSuccess: () => notify(c.isActive ? `"${c.name}" hidden from the posting form` : `"${c.name}" is available again`),
        onError: (err) => notify(errorMessage(err), 'error'),
      },
    );

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2">
          Job categories
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Categories help members filter the job board. Inactive categories stay on existing jobs but cannot be chosen for new ones.
        </Typography>

        <Stack
          component="form"
          onSubmit={add}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ mb: 2, alignItems: { sm: 'flex-start' } }}
        >
          <TextField
            size="small"
            label="New category"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setAddError(null);
            }}
            error={Boolean(addError)}
            helperText={addError ?? undefined}
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
          <Button
            type="submit"
            variant="outlined"
            startIcon={<Plus size={16} />}
            disabled={save.isPending}
            sx={{ flexShrink: 0, height: 40 }}
          >
            Add category
          </Button>
        </Stack>

        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading || !data ? (
          <Stack spacing={1}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </Stack>
        ) : data.length === 0 ? (
          <EmptyState compact icon={<Tags size={32} />} title="No categories yet" description="Add the first category above." />
        ) : (
          <List disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
            {data.map((c, i) => (
              <ListItem key={c.id} divider={i < data.length - 1} sx={{ gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flexGrow: 1, minWidth: 160 }}>
                  <Typography sx={{ fontWeight: 600, color: c.isActive ? 'text.primary' : 'text.secondary' }}>{c.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    /{c.slug} · order {c.sortOrder} · {c.jobCount} job{c.jobCount === 1 ? '' : 's'}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={<Switch size="small" checked={c.isActive} onChange={() => toggle(c)} disabled={save.isPending} />}
                  label={<Typography variant="body2">{c.isActive ? 'Active' : 'Inactive'}</Typography>}
                />
                <Tooltip title="Edit category">
                  <IconButton size="small" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                    <Pencil size={16} />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
      <CategoryDialog category={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

export default function AdminSettingsPage() {
  const { data, isLoading, error, refetch } = useAdminSettings();
  return (
    <Stack spacing={3}>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <Skeleton variant="rounded" height={520} />
      ) : (
        <SettingsForm settings={data} />
      )}
      <CategoriesCard />
    </Stack>
  );
}
