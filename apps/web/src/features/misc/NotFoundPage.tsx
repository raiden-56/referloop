import { Link as RouterLink } from 'react-router';
import { Button } from '@mui/material';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass size={44} />}
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      action={
        <Button component={RouterLink} to="/jobs" variant="contained">
          Explore jobs
        </Button>
      }
    />
  );
}
