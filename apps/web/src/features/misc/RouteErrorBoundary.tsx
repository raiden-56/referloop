import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Box, Button, Typography } from '@mui/material';

/** Last-resort error screen for render errors (e.g. a failed lazy chunk after a deploy). */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : 'An unexpected error occurred.';
  return (
    <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center', p: 3, textAlign: 'center' }}>
      <Box>
        <Typography variant="h2" component="h1" gutterBottom>
          Something went wrong
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {message} Reloading the page usually fixes this.
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <Button sx={{ ml: 1 }} href="/">
          Go home
        </Button>
      </Box>
    </Box>
  );
}
