import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { BriefcaseBusiness, LogOut, Shield, UserRound } from 'lucide-react';
import { useLogout } from '@/api/queries';
import { useAuth } from '@/auth/useAuth';
import { initials } from '@/lib/initials';
import { useNotify } from '../notify';

export function AccountMenu() {
  const { user, isAdmin } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const logout = useLogout();
  const notify = useNotify();
  if (!user) return null;

  const go = (to: string) => {
    setAnchor(null);
    navigate(to);
  };

  return (
    <>
      <Tooltip title="Account">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Open account menu" aria-haspopup="menu" sx={{ p: 0.5 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14, fontWeight: 600 }}>{initials(user.name)}</Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 240, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography sx={{ fontWeight: 600 }}>{user.name}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {user.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => go('/profile')}>
          <ListItemIcon>
            <UserRound size={18} />
          </ListItemIcon>
          My profile
        </MenuItem>
        <MenuItem onClick={() => go('/my-jobs')}>
          <ListItemIcon>
            <BriefcaseBusiness size={18} />
          </ListItemIcon>
          My jobs
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={() => go('/admin')}>
            <ListItemIcon>
              <Shield size={18} />
            </ListItemIcon>
            Admin console
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          disabled={logout.isPending}
          onClick={() => {
            setAnchor(null);
            logout.mutate(
              {},
              {
                onSettled: () => {
                  notify('You have been signed out.');
                  navigate('/');
                },
              },
            );
          }}
        >
          <ListItemIcon>
            <LogOut size={18} />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
