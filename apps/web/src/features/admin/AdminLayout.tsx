import { Link as RouterLink, Outlet, useLocation } from 'react-router';
import { Badge, Box, Tab, Tabs } from '@mui/material';
import { useAdminDashboard } from '@/api/admin';
import { PageHeader } from '@/components/PageHeader';

const TABS = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/audit-log', label: 'Audit log' },
  { to: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { data } = useAdminDashboard();
  const pending = data?.totals.pendingReports ?? 0;
  const current = [...TABS].reverse().find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))?.to ?? '/admin';

  return (
    <Box>
      <PageHeader title="Admin Console" subtitle="Manage members, listings, moderation and application settings." />
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={current} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Admin sections">
          {TABS.map((t) => (
            <Tab
              key={t.to}
              value={t.to}
              component={RouterLink}
              to={t.to}
              label={
                t.to === '/admin/reports' && pending > 0 ? (
                  <Badge badgeContent={pending} color="error" sx={{ '& .MuiBadge-badge': { right: -12 } }}>
                    {t.label}
                  </Badge>
                ) : (
                  t.label
                )
              }
              sx={{ minHeight: 48, pr: t.to === '/admin/reports' && pending > 0 ? 3.5 : undefined }}
            />
          ))}
        </Tabs>
      </Box>
      <Outlet />
    </Box>
  );
}
