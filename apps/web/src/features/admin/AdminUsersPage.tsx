import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { BadgeCheck, LogOut, MoreVertical, Search, Shield, ShieldOff, UserCheck, UserX, Users } from 'lucide-react';
import type { AdminUser } from '@referloop/shared';
import { errorMessage } from '@/api/client';
import { useAdminUsers, useRevokeUserSessions, useSetUserRole, useSetUserStatus } from '@/api/admin';
import { useAuth } from '@/auth/useAuth';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useNotify } from '@/components/notify';
import { PaginationBar } from '@/components/PaginationBar';
import { formatDate, fromNow } from '@/lib/dates';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

type ActionKind = 'suspend' | 'reinstate' | 'promote' | 'demote' | 'revoke';

const PAGE_SIZE = 20;

function StatusBadge({ user }: { user: AdminUser }) {
  return user.accountStatus === 'SUSPENDED' ? (
    <Chip size="small" label="Suspended" sx={{ bgcolor: '#fee2e2', color: '#991b1b' }} />
  ) : (
    <Chip size="small" label="Active" sx={{ bgcolor: '#dcfce7', color: '#166534' }} />
  );
}

function RoleBadge({ user }: { user: AdminUser }) {
  return user.role === 'ADMIN' ? (
    <Chip size="small" icon={<Shield size={13} />} label="Admin" color="primary" variant="outlined" />
  ) : (
    <Chip size="small" label="Member" variant="outlined" />
  );
}

function Verified({ user }: { user: AdminUser }) {
  return user.emailVerified ? (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'success.main' }}>
      <BadgeCheck size={16} />
      <Typography variant="body2">Verified</Typography>
    </Stack>
  ) : (
    <Typography variant="body2" color="warning.main">
      Unverified
    </Typography>
  );
}

function RowActions({
  user,
  disabled,
  onAction,
}: {
  user: AdminUser;
  disabled: boolean;
  onAction: (kind: ActionKind, user: AdminUser) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pick = (kind: ActionKind) => {
    setAnchor(null);
    onAction(kind, user);
  };
  return (
    <>
      <Tooltip title={disabled ? 'You cannot change your own account here' : 'Actions'}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label={`Actions for ${user.name}`}
            aria-haspopup="menu"
          >
            <MoreVertical size={18} />
          </IconButton>
        </span>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {user.accountStatus === 'ACTIVE' ? (
          <MenuItem onClick={() => pick('suspend')} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'inherit' }}>
              <UserX size={18} />
            </ListItemIcon>
            Suspend account
          </MenuItem>
        ) : (
          <MenuItem onClick={() => pick('reinstate')}>
            <ListItemIcon>
              <UserCheck size={18} />
            </ListItemIcon>
            Reinstate account
          </MenuItem>
        )}
        {user.role === 'MEMBER' ? (
          <MenuItem onClick={() => pick('promote')} disabled={!user.emailVerified || user.accountStatus !== 'ACTIVE'}>
            <ListItemIcon>
              <Shield size={18} />
            </ListItemIcon>
            Make administrator
          </MenuItem>
        ) : (
          <MenuItem onClick={() => pick('demote')}>
            <ListItemIcon>
              <ShieldOff size={18} />
            </ListItemIcon>
            Remove administrator
          </MenuItem>
        )}
        <MenuItem onClick={() => pick('revoke')} disabled={user.activeSessions === 0}>
          <ListItemIcon>
            <LogOut size={18} />
          </ListItemIcon>
          Revoke sessions
        </MenuItem>
      </Menu>
    </>
  );
}

const DIALOG_COPY: Record<
  ActionKind,
  { title: string; confirm: string; color: 'primary' | 'error' | 'warning'; describe: (u: AdminUser) => string }
> = {
  suspend: {
    title: 'Suspend account',
    confirm: 'Suspend',
    color: 'error',
    describe: (u) => `${u.name} will be signed out everywhere and will not be able to sign in or change job records until reinstated.`,
  },
  reinstate: {
    title: 'Reinstate account',
    confirm: 'Reinstate',
    color: 'primary',
    describe: (u) => `${u.name} will be able to sign in again.`,
  },
  promote: {
    title: 'Make administrator',
    confirm: 'Grant admin access',
    color: 'warning',
    describe: (u) =>
      `${u.name} will get full access to the Admin Console. Their existing sessions are signed out so the change takes effect immediately.`,
  },
  demote: {
    title: 'Remove administrator access',
    confirm: 'Remove access',
    color: 'warning',
    describe: (u) => `${u.name} will become a standard member and be signed out of existing sessions.`,
  },
  revoke: {
    title: 'Revoke sessions',
    confirm: 'Revoke sessions',
    color: 'warning',
    describe: (u) => `${u.name} will be signed out of all ${u.activeSessions} active session(s).`,
  },
};

export default function AdminUsersPage() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const { user: me } = useAuth();
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debounced = useDebouncedValue(search, 350);

  const update = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced.trim()) update({ q: debounced.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = {
    q: params.get('q') ?? undefined,
    role: params.get('role') ?? undefined,
    status: params.get('status') ?? undefined,
    verified: params.get('verified') ?? undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, error, refetch } = useAdminUsers(query);

  const [action, setAction] = useState<{ kind: ActionKind; user: AdminUser } | null>(null);
  const setStatus = useSetUserStatus();
  const setRole = useSetUserRole();
  const revoke = useRevokeUserSessions();
  const pending = setStatus.isPending || setRole.isPending || revoke.isPending;

  const runAction = (reason: string) => {
    if (!action) return;
    const { kind, user } = action;
    const done = (message: string) => {
      notify(message);
      setAction(null);
    };
    const fail = (err: unknown) => notify(errorMessage(err), 'error');
    if (kind === 'suspend' || kind === 'reinstate') {
      setStatus.mutate(
        { id: user.id, status: kind === 'suspend' ? 'SUSPENDED' : 'ACTIVE', reason },
        {
          onSuccess: () => done(kind === 'suspend' ? `${user.name} has been suspended` : `${user.name} has been reinstated`),
          onError: fail,
        },
      );
    } else if (kind === 'promote' || kind === 'demote') {
      setRole.mutate(
        { id: user.id, role: kind === 'promote' ? 'ADMIN' : 'MEMBER' },
        {
          onSuccess: () => done(kind === 'promote' ? `${user.name} is now an administrator` : `${user.name} is now a member`),
          onError: fail,
        },
      );
    } else {
      revoke.mutate(user.id, { onSuccess: (r) => done(`Revoked ${r.revoked} session(s) for ${user.name}`), onError: fail });
    }
  };

  const filters = (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
      <TextField
        size="small"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email"
        slotProps={{
          htmlInput: { 'aria-label': 'Search users', maxLength: 120 },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ flex: 2 }}
      />
      <TextField
        select
        size="small"
        label="Role"
        value={params.get('role') ?? ''}
        onChange={(e) => update({ role: e.target.value || undefined })}
        sx={{ flex: 1, minWidth: 130 }}
      >
        <MenuItem value="">All roles</MenuItem>
        <MenuItem value="MEMBER">Members</MenuItem>
        <MenuItem value="ADMIN">Administrators</MenuItem>
      </TextField>
      <TextField
        select
        size="small"
        label="Status"
        value={params.get('status') ?? ''}
        onChange={(e) => update({ status: e.target.value || undefined })}
        sx={{ flex: 1, minWidth: 130 }}
      >
        <MenuItem value="">All statuses</MenuItem>
        <MenuItem value="ACTIVE">Active</MenuItem>
        <MenuItem value="SUSPENDED">Suspended</MenuItem>
      </TextField>
      <TextField
        select
        size="small"
        label="Email"
        value={params.get('verified') ?? ''}
        onChange={(e) => update({ verified: e.target.value || undefined })}
        sx={{ flex: 1, minWidth: 130 }}
      >
        <MenuItem value="">Any</MenuItem>
        <MenuItem value="yes">Verified</MenuItem>
        <MenuItem value="no">Unverified</MenuItem>
      </TextField>
    </Stack>
  );

  let body;
  if (error) {
    body = <ErrorState error={error} onRetry={() => void refetch()} />;
  } else if (isLoading || !data) {
    body = (
      <Stack spacing={1}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  } else if (data.items.length === 0) {
    body = <EmptyState icon={<Users size={40} />} title="No users match" description="Try a different search or clear the filters." />;
  } else if (desktop) {
    body = (
      <TableContainer component={Paper} variant="outlined" sx={{ opacity: isFetching ? 0.7 : 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="right">Jobs</TableCell>
              <TableCell align="right">Sessions</TableCell>
              <TableCell>Last sign-in</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell sx={{ maxWidth: 260 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {u.name}
                    {u.id === me?.id ? ' (you)' : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {u.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  <RoleBadge user={u} />
                </TableCell>
                <TableCell>
                  <StatusBadge user={u} />
                </TableCell>
                <TableCell>
                  <Verified user={u} />
                </TableCell>
                <TableCell align="right">{u.jobsPosted}</TableCell>
                <TableCell align="right">{u.activeSessions}</TableCell>
                <TableCell>
                  <Typography variant="body2">{u.lastLoginAt ? fromNow(u.lastLoginAt) : 'Never'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatDate(u.createdAt)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <RowActions user={u} disabled={u.id === me?.id} onAction={(kind, user) => setAction({ kind, user })} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  } else {
    body = (
      <Stack spacing={1.5} sx={{ opacity: isFetching ? 0.7 : 1 }}>
        {data.items.map((u) => (
          <Card key={u.id}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {u.name}
                    {u.id === me?.id ? ' (you)' : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {u.email}
                  </Typography>
                </Box>
                <RowActions user={u} disabled={u.id === me?.id} onAction={(kind, user) => setAction({ kind, user })} />
              </Stack>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, my: 1 }}>
                <RoleBadge user={u} />
                <StatusBadge user={u} />
              </Stack>
              <Verified user={u} />
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                {u.jobsPosted} jobs · {u.activeSessions} active sessions · last sign-in {u.lastLoginAt ? fromNow(u.lastLoginAt) : 'never'} ·
                joined {formatDate(u.createdAt)}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  const copy = action ? DIALOG_COPY[action.kind] : null;

  return (
    <Box>
      {filters}
      {body}
      {data && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onChange={(p) => update({ page: String(p) })}
        />
      )}
      <ConfirmDialog
        open={Boolean(action)}
        title={copy?.title ?? ''}
        description={action && copy ? copy.describe(action.user) : undefined}
        confirmLabel={copy?.confirm ?? 'Confirm'}
        confirmColor={copy?.color}
        reason={
          action?.kind === 'suspend'
            ? { label: 'Reason (shared with the member by email)' }
            : action?.kind === 'reinstate'
              ? { label: 'Note' }
              : undefined
        }
        pending={pending}
        onConfirm={runAction}
        onClose={() => setAction(null)}
      />
    </Box>
  );
}
