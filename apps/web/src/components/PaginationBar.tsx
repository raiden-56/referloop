import { Pagination, Stack, Typography } from '@mui/material';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function PaginationBar({ page, totalPages, total, pageSize, onChange }: Props) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 3 }}>
      <Typography variant="body2" color="text.secondary">
        Showing {from}–{to} of {total}
      </Typography>
      {totalPages > 1 && (
        <Pagination page={page} count={totalPages} onChange={(_e, p) => onChange(p)} color="primary" shape="rounded" siblingCount={1} />
      )}
    </Stack>
  );
}
