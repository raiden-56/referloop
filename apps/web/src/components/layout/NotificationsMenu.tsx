import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Bell } from 'lucide-react';
import type { NotificationItem } from '@referloop/shared';
import { useMarkNotificationsRead, useNotifications } from '@/api/queries';
import { fromNow } from '@/lib/dates';

export function NotificationRow({ n, onOpen }: { n: NotificationItem; onOpen: (n: NotificationItem) => void }) {
  return (
    <ListItemButton onClick={() => onOpen(n)} sx={{ alignItems: 'flex-start', gap: 1.5, bgcolor: n.readAt ? undefined : '#f5f7ff' }}>
      <Box sx={{ width: 8, height: 8, mt: 1, borderRadius: '50%', flexShrink: 0, bgcolor: n.readAt ? 'transparent' : 'primary.main' }} />
      <ListItemText
        primary={n.title}
        secondary={
          <>
            <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
              {n.body}
            </Typography>
            <Typography component="span" variant="caption" color="text.secondary">
              {fromNow(n.createdAt)}
            </Typography>
          </>
        }
        slotProps={{ primary: { sx: { fontWeight: n.readAt ? 500 : 650, fontSize: '0.9rem' } } }}
      />
    </ListItemButton>
  );
}

export function NotificationsMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { data } = useNotifications(1, { poll: true });
  const markRead = useMarkNotificationsRead();
  const navigate = useNavigate();
  const unread = data?.unreadCount ?? 0;

  const open = (n: NotificationItem) => {
    if (!n.readAt) markRead.mutate(n.id);
    setAnchor(null);
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Badge badgeContent={unread} color="error" max={99}>
            <Bell size={20} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 24px)', mt: 1 } } }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25 }}>
          <Typography variant="h6">Notifications</Typography>
          {unread > 0 && (
            <Button size="small" onClick={() => markRead.mutate(undefined)} disabled={markRead.isPending}>
              Mark all read
            </Button>
          )}
        </Stack>
        <Divider />
        {data && data.items.length === 0 ? (
          <Typography color="text.secondary" variant="body2" sx={{ p: 3, textAlign: 'center' }}>
            You are all caught up.
          </Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {data?.items.map((n) => (
              <NotificationRow key={n.id} n={n} onOpen={open} />
            ))}
          </List>
        )}
        <Divider />
        <Button component={RouterLink} to="/notifications" fullWidth onClick={() => setAnchor(null)} sx={{ borderRadius: 0, py: 1 }}>
          View all notifications
        </Button>
      </Popover>
    </>
  );
}
