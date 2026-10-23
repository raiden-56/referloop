import { useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
  type PostedWithin,
  type StatusFilter,
} from '@referloop/shared';
import { useConfig, useSuggestions } from '@/api/queries';
import { DebouncedTextField } from '@/components/DebouncedTextField';
import { SkillsInput } from '@/components/SkillsInput';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import type { JobFilters } from './useJobFilters';

interface Props {
  filters: JobFilters;
  update: (patch: Partial<JobFilters>) => void;
  clear: () => void;
  activeCount: number;
}

const POSTED_OPTIONS: { value: PostedWithin | ''; label: string }[] = [
  { value: '', label: 'Any time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CompanyFilter({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [input, setInput] = useState(value);
  const debounced = useDebouncedValue(input, 200);
  const { data: options = [] } = useSuggestions('companies', debounced);
  return (
    <Autocomplete
      freeSolo
      size="small"
      options={options}
      value={value || null}
      inputValue={input}
      onInputChange={(_e, v) => setInput(v)}
      onChange={(_e, v) => onCommit((v ?? '').trim())}
      onBlur={() => input.trim() !== value && onCommit(input.trim())}
      renderInput={(params) => <TextField {...params} label="Company" placeholder="Any company" />}
    />
  );
}

export function JobFiltersPanel({ filters, update, clear, activeCount }: Props) {
  const { data: config } = useConfig();

  return (
    <Stack spacing={2.5} component="section" aria-label="Job filters">
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" component="h2">
          Filters
        </Typography>
        <Button size="small" onClick={clear} disabled={activeCount === 0 && !filters.q}>
          Clear all
        </Button>
      </Stack>

      <Box>
        <FormLabel component="legend" sx={{ fontSize: 13, mb: 0.75, display: 'block' }}>
          Status
        </FormLabel>
        <ToggleButtonGroup
          size="small"
          exclusive
          fullWidth
          value={filters.status}
          onChange={(_e, v: StatusFilter | null) => v && update({ status: v })}
          aria-label="Job status"
        >
          <ToggleButton value="active">Active</ToggleButton>
          <ToggleButton value="closed">Closed</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <FormControl size="small" fullWidth>
        <InputLabel id="filter-category">Category</InputLabel>
        <Select labelId="filter-category" label="Category" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
          <MenuItem value="">All categories</MenuItem>
          {config?.categories.map((c) => (
            <MenuItem key={c.id} value={c.slug}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <CompanyFilter key={filters.company} value={filters.company} onCommit={(company) => update({ company })} />

      <DebouncedTextField
        size="small"
        label="Location"
        placeholder="City or region"
        value={filters.location}
        onCommit={(location) => update({ location })}
      />

      <SkillsInput
        size="small"
        label="Skills"
        placeholder="e.g. React"
        value={filters.skills}
        onChange={(skills) => update({ skills })}
        max={10}
        helperText="Jobs must list every selected skill"
      />

      <Box>
        <FormLabel component="legend" sx={{ fontSize: 13, mb: 0.75, display: 'block' }}>
          Experience (years)
        </FormLabel>
        <Stack direction="row" spacing={1}>
          <DebouncedTextField
            size="small"
            label="Min"
            type="number"
            value={filters.expMin}
            onCommit={(expMin) => update({ expMin })}
            slotProps={{ htmlInput: { min: 0, max: 50, inputMode: 'numeric' } }}
          />
          <DebouncedTextField
            size="small"
            label="Max"
            type="number"
            value={filters.expMax}
            onCommit={(expMax) => update({ expMax })}
            slotProps={{ htmlInput: { min: 0, max: 50, inputMode: 'numeric' } }}
          />
        </Stack>
      </Box>

      <Divider />

      <FormControlLabel
        control={<Checkbox size="small" checked={filters.referral} onChange={(e) => update({ referral: e.target.checked })} />}
        label="Referral available"
      />

      <FormControl component="fieldset">
        <FormLabel component="legend" sx={{ fontSize: 13 }}>
          Work mode
        </FormLabel>
        <FormGroup>
          {WORK_MODES.map((m) => (
            <FormControlLabel
              key={m}
              control={
                <Checkbox
                  size="small"
                  checked={filters.workMode.includes(m)}
                  onChange={() => update({ workMode: toggle(filters.workMode, m) })}
                />
              }
              label={WORK_MODE_LABELS[m]}
            />
          ))}
        </FormGroup>
      </FormControl>

      <FormControl component="fieldset">
        <FormLabel component="legend" sx={{ fontSize: 13 }}>
          Employment type
        </FormLabel>
        <FormGroup>
          {EMPLOYMENT_TYPES.map((t) => (
            <FormControlLabel
              key={t}
              control={
                <Checkbox
                  size="small"
                  checked={filters.employmentType.includes(t)}
                  onChange={() => update({ employmentType: toggle(filters.employmentType, t) })}
                />
              }
              label={EMPLOYMENT_TYPE_LABELS[t]}
            />
          ))}
        </FormGroup>
      </FormControl>

      <FormControl size="small" fullWidth>
        <InputLabel id="filter-posted">Date posted</InputLabel>
        <Select
          labelId="filter-posted"
          label="Date posted"
          value={filters.postedWithin}
          onChange={(e) => update({ postedWithin: e.target.value as PostedWithin | '' })}
        >
          {POSTED_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
