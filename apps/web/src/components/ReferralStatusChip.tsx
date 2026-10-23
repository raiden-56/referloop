import { Chip } from '@mui/material';
import { REFERRAL_STATUS_LABELS, type ReferralStatus } from '@referloop/shared';

const STATUS_COLORS: Record<ReferralStatus, 'warning' | 'info' | 'success' | 'default'> = {
  PENDING: 'warning',
  ACCEPTED: 'info',
  REFERRED: 'success',
  DECLINED: 'default',
  WITHDRAWN: 'default',
};

export const ReferralStatusChip = ({ status }: { status: ReferralStatus }) => (
  <Chip
    size="small"
    color={STATUS_COLORS[status]}
    variant={status === 'PENDING' ? 'filled' : 'outlined'}
    label={REFERRAL_STATUS_LABELS[status]}
  />
);
