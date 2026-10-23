import type { CurrentUser, PublicUser } from '@referloop/shared';
import type { User } from '../../generated/prisma/client.js';

export const toCurrentUser = (u: User): CurrentUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  accountStatus: u.accountStatus,
  emailVerified: u.emailVerifiedAt !== null,
  companyName: u.companyName,
  jobTitle: u.jobTitle,
  createdAt: u.createdAt.toISOString(),
});

/** Other members only ever see a name, never an email address or account details. */
export const toPublicUser = (u: { id: string; name: string }): PublicUser => ({ id: u.id, name: u.name });

export const publicUserSelect = { select: { id: true, name: true } } as const;
