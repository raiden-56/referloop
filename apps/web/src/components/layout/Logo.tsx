import { Box, Typography } from '@mui/material';

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box component="img" src="/favicon.svg" alt="" sx={{ width: size, height: size, borderRadius: 2, display: 'block' }} />
      <Typography sx={{ fontWeight: 750, fontSize: size * 0.62, letterSpacing: '-0.02em', color: 'text.primary' }}>
        Refer
        <Box component="span" sx={{ color: 'primary.main' }}>
          Loop
        </Box>
      </Typography>
    </Box>
  );
}
