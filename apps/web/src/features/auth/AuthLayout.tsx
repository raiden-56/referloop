import { Link as RouterLink, Outlet } from 'react-router';
import { Box, Container, Link, Paper, Stack, Typography } from '@mui/material';
import { Logo } from '@/components/layout/Logo';

export function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(1200px 500px at 50% -10%, #e0e7ff 0%, transparent 60%), #f7f8fb',
      }}
    >
      <Container
        maxWidth="sm"
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: { xs: 3, sm: 6 }, px: 2 }}
      >
        <Box component={RouterLink} to="/" sx={{ alignSelf: 'center', mb: 3, textDecoration: 'none' }} aria-label="ReferLoop home">
          <Logo size={36} />
        </Box>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4.5 }, borderRadius: 3 }}>
          <Outlet />
        </Paper>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', mt: 3 }}>
          <Link component={RouterLink} to="/jobs" variant="body2" color="text.secondary">
            Browse jobs
          </Link>
          <Link component={RouterLink} to="/terms" variant="body2" color="text.secondary">
            Terms
          </Link>
          <Link component={RouterLink} to="/terms#privacy" variant="body2" color="text.secondary">
            Privacy
          </Link>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
          ReferLoop — a community job board built by employees, for employees.
        </Typography>
      </Container>
    </Box>
  );
}
