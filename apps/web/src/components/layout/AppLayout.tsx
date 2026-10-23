import { useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  AppBar,
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Compass,
  Handshake,
  Home,
  Menu as MenuIcon,
  PlusCircle,
  Search,
  Shield,
  UserRound,
} from 'lucide-react';
import { usePendingReferralCount } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';
import { VerifyEmailBanner } from '../VerifyEmailBanner';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';
import { NotificationsMenu } from './NotificationsMenu';

const DRAWER_WIDTH = 248;

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  auth?: boolean;
  admin?: boolean;
  badge?: 'pendingReferrals';
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: <Home size={19} />, end: true },
  { to: '/jobs', label: 'Explore Jobs', icon: <Compass size={19} />, end: true },
  { to: '/jobs/new', label: 'Post a Job', icon: <PlusCircle size={19} />, auth: true },
  { to: '/my-jobs', label: 'My Jobs', icon: <BriefcaseBusiness size={19} />, auth: true },
  { to: '/saved', label: 'Saved Jobs', icon: <Bookmark size={19} />, auth: true },
  { to: '/referrals', label: 'Referrals', icon: <Handshake size={19} />, auth: true, badge: 'pendingReferrals' },
  { to: '/notifications', label: 'Notifications', icon: <Bell size={19} />, auth: true },
  { to: '/profile', label: 'My Profile', icon: <UserRound size={19} />, auth: true },
];

function GlobalSearch({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const [value, setValue] = useState('');
  // Mirror the current search when on the job board.
  useEffect(() => {
    if (location.pathname === '/jobs') setValue(params.get('q') ?? '');
  }, [location.pathname, params]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/jobs?q=${encodeURIComponent(q)}` : '/jobs');
    onDone?.();
  };

  return (
    <Box component="form" role="search" onSubmit={submit} sx={{ width: '100%', maxWidth: 520 }}>
      <TextField
        size="small"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search jobs, companies, skills…"
        slotProps={{
          htmlInput: { 'aria-label': 'Search jobs', maxLength: 100 },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={17} />
              </InputAdornment>
            ),
            sx: { bgcolor: '#f3f4f6', borderRadius: 2, '& fieldset': { border: 'none' } },
          },
        }}
      />
    </Box>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const { data: pendingReferrals = 0 } = usePendingReferralCount(isAuthenticated);
  const items = NAV.filter((n) => !n.auth || isAuthenticated);
  const linkSx = {
    borderRadius: 2,
    mx: 1.5,
    my: 0.25,
    color: 'text.secondary',
    '& .MuiListItemIcon-root': { minWidth: 36, color: 'inherit' },
    '&.active': { bgcolor: 'primary.50', color: 'primary.main', fontWeight: 600, backgroundColor: '#eef2ff' },
  } as const;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <List component="nav" aria-label="Main navigation" sx={{ pt: 2 }}>
        {items.map((item) => (
          <ListItemButton key={item.to} component={NavLink} to={item.to} end={item.end} onClick={onNavigate} sx={linkSx}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontWeight: 'inherit', fontSize: '0.92rem' } } }} />
            {item.badge === 'pendingReferrals' && pendingReferrals > 0 && (
              <Badge
                color="error"
                badgeContent={pendingReferrals}
                sx={{ mr: 1 }}
                aria-label={`${pendingReferrals} pending referral requests`}
              />
            )}
          </ListItemButton>
        ))}
      </List>
      {isAdmin && (
        <List subheader={<ListSubheader sx={{ bgcolor: 'transparent', lineHeight: 2.5, fontSize: 12 }}>Administration</ListSubheader>}>
          <ListItemButton component={NavLink} to="/admin" onClick={onNavigate} sx={linkSx}>
            <ListItemIcon>
              <Shield size={19} />
            </ListItemIcon>
            <ListItemText primary="Admin Console" slotProps={{ primary: { sx: { fontWeight: 'inherit', fontSize: '0.92rem' } } }} />
          </ListItemButton>
        </List>
      )}
      <Box sx={{ flexGrow: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ p: 2.5 }}>
        Community-maintained listings. Always confirm details on the official application page.
      </Typography>
    </Box>
  );
}

export function AppLayout() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5 }}>
          {!desktop && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <MenuIcon size={22} />
            </IconButton>
          )}
          <Box
            component={RouterLink}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
              width: desktop ? DRAWER_WIDTH - 24 : 'auto',
              flexShrink: 0,
            }}
          >
            <Logo />
          </Box>
          {desktop ? <GlobalSearch /> : <Box sx={{ flexGrow: 1 }} />}
          <Box sx={{ flexGrow: desktop ? 1 : 0 }} />
          {!desktop && (
            <IconButton onClick={() => setSearchOpen((v) => !v)} aria-label="Search jobs">
              <Search size={20} />
            </IconButton>
          )}
          {user ? (
            <>
              <NotificationsMenu />
              <AccountMenu />
            </>
          ) : (
            <>
              <Button component={RouterLink} to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} color="inherit">
                Sign in
              </Button>
              {desktop && (
                <Button component={RouterLink} to="/register" variant="contained">
                  Join ReferLoop
                </Button>
              )}
            </>
          )}
        </Toolbar>
        {!desktop && searchOpen && (
          <Box sx={{ px: 2, pb: 1.5 }}>
            <GlobalSearch onDone={() => setSearchOpen(false)} />
          </Box>
        )}
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {desktop ? (
          <Drawer variant="permanent" open sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>
            <Toolbar />
            <SideNav />
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
          >
            <Toolbar>
              <Logo />
            </Toolbar>
            <SideNav onNavigate={() => setMobileOpen(false)} />
          </Drawer>
        )}
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        {!desktop && searchOpen && <Box sx={{ height: 56 }} />}
        <VerifyEmailBanner />
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 }, px: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
