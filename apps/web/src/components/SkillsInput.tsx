import { useState } from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';
import { MAX_SKILLS } from '@referloop/shared';
import { useSuggestions } from '@/api/queries';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

interface Props {
  label: string;
  value: string[];
  onChange: (skills: string[]) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  size?: 'small' | 'medium';
  max?: number;
}

/** Tag input with autocomplete from skills already used on ReferLoop. Enter or comma adds a skill. */
export function SkillsInput({ label, value, onChange, error, helperText, placeholder, required, size, max = MAX_SKILLS }: Props) {
  const [input, setInput] = useState('');
  const debounced = useDebouncedValue(input, 200);
  const { data: suggestions = [] } = useSuggestions('skills', debounced);

  const add = (raw: string[]) => {
    const seen = new Set<string>();
    const next = raw
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter((s) => s && s.length <= 40)
      .filter((s) => {
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, max);
    onChange(next);
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      size={size}
      options={suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))}
      value={value}
      inputValue={input}
      onInputChange={(_e, v, reason) => {
        if (reason === 'input' && v.endsWith(',')) {
          add([...value, v.slice(0, -1)]);
          setInput('');
        } else {
          setInput(v);
        }
      }}
      onChange={(_e, next) => add(next as string[])}
      onBlur={() => {
        if (input.trim()) {
          add([...value, input]);
          setInput('');
        }
      }}
      filterOptions={(opts) => opts}
      renderValue={(selected, getItemProps) =>
        selected.map((option, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return <Chip key={key} size="small" label={option} {...itemProps} />;
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          placeholder={value.length < max ? placeholder : undefined}
          error={Boolean(error)}
          helperText={error ?? helperText}
        />
      )}
    />
  );
}
