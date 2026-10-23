import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: Props) {
  return (
    <Paper variant="outlined" sx={{ py: compact ? 4 : 7, px: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', maxWidth: 460, mx: 'auto' }}>
        {icon && <Box sx={{ color: 'primary.main', opacity: 0.85 }}>{icon}</Box>}
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" variant="body2">
            {description}
          </Typography>
        )}
        {action && <Box sx={{ pt: 1 }}>{action}</Box>}
      </Stack>
    </Paper>
  );
}
