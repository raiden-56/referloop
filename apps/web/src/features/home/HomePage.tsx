import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Box, Button, Card, CardContent, Grid, InputAdornment, Link, Stack, TextField, Typography } from '@mui/material';
import { ArrowRight, Handshake, MessageCircle, PencilLine, PlusCircle, Search } from 'lucide-react';
import { ApiError } from '@/api/client';
import { useJobs } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';
import { EmptyState } from '@/components/EmptyState';
import { JobGrid } from '@/features/jobs/JobGrid';

const STEPS = [
  {
    icon: <PlusCircle size={22} />,
    title: 'Share openings',
    text: 'Post roles from your company or network, with honest referral details.',
  },
  {
    icon: <PencilLine size={22} />,
    title: 'Keep them accurate',
    text: 'Any verified member can update or close a listing. Every edit is tracked.',
  },
  { icon: <MessageCircle size={22} />, title: 'Spread the word', text: 'Send openings to colleagues and groups on WhatsApp in one tap.' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { user, isVerified } = useAuth();
  const latest = useJobs({ sort: 'newest', pageSize: 6, page: 1 });
  const loginRequired = latest.error instanceof ApiError && latest.error.status === 401;

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/jobs?q=${encodeURIComponent(q.trim())}` : '/jobs');
  };

  return (
    <>
      <Box
        sx={{
          borderRadius: 4,
          p: { xs: 3, md: 6 },
          mb: 5,
          background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #ecfeff 100%)',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h1" sx={{ fontSize: { xs: '1.9rem', md: '2.6rem' }, maxWidth: 720 }}>
          {user ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Find your next role through people who work there.'}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5, mb: 3, maxWidth: 640, fontSize: '1.05rem' }}>
          ReferLoop is a community job board where employees share openings from their companies, keep listings accurate together, and offer
          referrals when they can.
        </Typography>
        <Stack
          component="form"
          role="search"
          onSubmit={search}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ maxWidth: 640 }}
        >
          <TextField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Job title, company, skill or city"
            slotProps={{
              htmlInput: { 'aria-label': 'Search jobs', maxLength: 100 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
                sx: { bgcolor: 'background.paper' },
              },
            }}
          />
          <Button type="submit" variant="contained" size="large" sx={{ px: 4, flexShrink: 0 }}>
            Search jobs
          </Button>
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5, flexWrap: 'wrap', rowGap: 1 }}>
          {isVerified ? (
            <Button component={RouterLink} to="/jobs/new" startIcon={<PlusCircle size={18} />}>
              Post a job
            </Button>
          ) : !user ? (
            <Button component={RouterLink} to="/register" startIcon={<Handshake size={18} />}>
              Join to post and refer
            </Button>
          ) : null}
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 5 }}>
        {STEPS.map((s) => (
          <Grid key={s.title} size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ color: 'primary.main', mb: 1 }}>{s.icon}</Box>
                <Typography variant="h5" component="h2">
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {s.text}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h3" component="h2">
          Latest openings
        </Typography>
        <Link component={RouterLink} to="/jobs" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
          View all <ArrowRight size={16} />
        </Link>
      </Stack>
      {loginRequired ? (
        <EmptyState
          title="Sign in to browse openings"
          description="Job listings on this ReferLoop community are visible to members only."
          action={
            <Button component={RouterLink} to="/login?next=%2Fjobs" variant="contained">
              Sign in
            </Button>
          }
        />
      ) : (
        <JobGrid
          data={latest.data}
          isLoading={latest.isLoading}
          error={latest.error}
          onRetry={() => void latest.refetch()}
          skeletons={4}
          empty={
            <EmptyState
              title="No openings yet"
              description="Be the first to share a job with the community."
              action={
                isVerified ? (
                  <Button component={RouterLink} to="/jobs/new" variant="contained">
                    Post a job
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}
    </>
  );
}
