import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  ChangePasswordInput,
  CurrentUser,
  DuplicateCandidate,
  ForgotPasswordInput,
  JobDetail,
  JobHistoryResponse,
  JobInput,
  JobSummary,
  JobUpdateInput,
  LoginInput,
  NotificationList,
  Paginated,
  ProfileUpdateInput,
  ReferralBox,
  ReferralList,
  ReferralRequestCreateInput,
  ReferralRequestItem,
  ReferralRespondInput,
  ReferralStatus,
  PublicConfig,
  RegisterInput,
  ReportCreateInput,
  ResetPasswordInput,
} from '@referloop/shared';
import { api, ApiError, type QueryValue } from './client';

export const keys = {
  me: ['me'] as const,
  config: ['config'] as const,
  jobs: ['jobs'] as const,
  jobList: (params: Record<string, QueryValue>) => ['jobs', 'list', params] as const,
  job: (slug: string) => ['jobs', 'detail', slug] as const,
  jobHistory: (id: string) => ['jobs', 'history', id] as const,
  myJobs: (scope: string, page: number) => ['jobs', 'mine', scope, page] as const,
  saved: (page: number) => ['jobs', 'saved', page] as const,
  notifications: ['notifications'] as const,
  sessions: ['sessions'] as const,
  referrals: ['referrals'] as const,
  referralList: (box: string, status: string, page: number) => ['referrals', box, status, page] as const,
};

// ---------------------------------------------------------------------------
// Session and configuration
// ---------------------------------------------------------------------------

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return (await api<{ user: CurrentUser }>('/auth/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useConfig() {
  return useQuery({ queryKey: keys.config, queryFn: () => api<PublicConfig>('/config'), staleTime: 5 * 60_000 });
}

/** Clears all cached data that may be user-specific (after login, logout or role changes). */
export function resetUserData(qc: QueryClient, user: CurrentUser | null) {
  qc.setQueryData(keys.me, user);
  qc.removeQueries({ queryKey: keys.jobs });
  qc.removeQueries({ queryKey: keys.notifications });
  qc.removeQueries({ queryKey: keys.referrals });
  qc.removeQueries({ queryKey: ['admin'] });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<{ user: CurrentUser }>('/auth/login', { method: 'POST', body: input }),
    onSuccess: ({ user }) => resetUserData(qc, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { everywhere?: boolean } = {}) =>
      api<void>(opts.everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }),
    onSettled: () => resetUserData(qc, null),
  });
}

export const useRegister = () =>
  useMutation({ mutationFn: (input: RegisterInput) => api<{ message: string }>('/auth/register', { method: 'POST', body: input }) });

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api<{ message: string }>('/auth/verify-email', { method: 'POST', body: { token } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export const useResendVerification = () =>
  useMutation({
    mutationFn: (email?: string) => api<{ message: string }>('/auth/resend-verification', { method: 'POST', body: email ? { email } : {} }),
  });

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (input: ForgotPasswordInput) => api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: input }),
  });

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => api<{ message: string }>('/auth/reset-password', { method: 'POST', body: input }),
    onSuccess: () => resetUserData(qc, null),
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileUpdateInput) => api<{ user: CurrentUser }>('/users/me', { method: 'PATCH', body: input }),
    onSuccess: ({ user }) => qc.setQueryData(keys.me, user),
  });
}

export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: ChangePasswordInput) => api<{ message: string }>('/users/me/password', { method: 'POST', body: input }),
  });

export interface SessionInfo {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
}

export const useSessions = () =>
  useQuery({ queryKey: keys.sessions, queryFn: () => api<{ items: SessionInfo[] }>('/users/me/sessions').then((r) => r.items) });

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export function useJobs(params: Record<string, QueryValue>, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.jobList(params),
    queryFn: ({ signal }) => api<Paginated<JobSummary>>('/jobs', { query: params, signal }),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

export function useJob(slug: string | undefined) {
  return useQuery({
    queryKey: keys.job(slug ?? ''),
    queryFn: () => api<{ job: JobDetail }>(`/jobs/${encodeURIComponent(slug!)}`).then((r) => r.job),
    enabled: Boolean(slug),
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });
}

export function useJobHistory(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.jobHistory(id ?? ''),
    queryFn: () => api<JobHistoryResponse>(`/jobs/${id}/history`),
    enabled: Boolean(id) && enabled,
  });
}

export function useMyJobs(scope: 'posted' | 'edited', page: number) {
  return useQuery({
    queryKey: keys.myJobs(scope, page),
    queryFn: () => api<Paginated<JobSummary>>('/users/me/jobs', { query: { scope, page, pageSize: 12 } }),
    placeholderData: keepPreviousData,
  });
}

export function useSavedJobs(page: number) {
  return useQuery({
    queryKey: keys.saved(page),
    queryFn: () => api<Paginated<JobSummary>>('/users/me/saved-jobs', { query: { page, pageSize: 12 } }),
    placeholderData: keepPreviousData,
  });
}

/** Stores a fresh job in the detail cache and invalidates every list that might contain it. */
function syncJob(qc: QueryClient, job: JobDetail) {
  qc.setQueryData(keys.job(job.slug), job);
  void qc.invalidateQueries({ queryKey: keys.jobs, predicate: (q) => q.queryKey[1] !== 'detail' || q.queryKey[2] !== job.slug });
  void qc.invalidateQueries({ queryKey: keys.notifications });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: JobInput; idempotencyKey: string }) =>
      api<{ job: JobDetail; created: boolean }>('/jobs', { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey } }),
    onSuccess: ({ job }) => syncJob(qc, job),
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: JobUpdateInput }) =>
      api<{ job: JobDetail; changed: boolean }>(`/jobs/${id}`, { method: 'PATCH', body: input }),
    onSuccess: ({ job }) => syncJob(qc, job),
  });
}

export type StatusAction = 'close' | 'reopen' | 'confirm-active';

export function useJobStatusAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: StatusAction; reason?: string }) =>
      api<{ job: JobDetail }>(`/jobs/${id}/${action}`, { method: 'POST', body: { reason: reason ?? '' } }),
    onSuccess: ({ job }) => syncJob(qc, job),
  });
}

export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, save }: { id: string; save: boolean }) =>
      api<{ saved: boolean }>(`/jobs/${id}/save`, { method: save ? 'PUT' : 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.jobs }),
  });
}

export const useReportJob = () =>
  useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReportCreateInput }) =>
      api<{ report: { id: string } }>(`/jobs/${id}/report`, { method: 'POST', body: input }),
  });

export const useDuplicateCheck = () =>
  useMutation({
    mutationFn: (input: { title: string; companyName: string; excludeJobId?: string }) =>
      api<{ items: DuplicateCandidate[] }>('/jobs/duplicates', { method: 'POST', body: input }).then((r) => r.items),
  });

export function useSuggestions(kind: 'skills' | 'companies', q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['suggestions', kind, term.toLowerCase()],
    queryFn: ({ signal }) => api<{ items: string[] }>(`/jobs/suggestions/${kind}`, { query: { q: term }, signal }).then((r) => r.items),
    enabled: term.length >= 1,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function useNotifications(page = 1, opts: { enabled?: boolean; poll?: boolean } = {}) {
  return useQuery({
    queryKey: [...keys.notifications, page],
    queryFn: () => api<NotificationList>('/notifications', { query: { page, pageSize: page === 1 && opts.poll ? 8 : 20 } }),
    enabled: opts.enabled ?? true,
    refetchInterval: opts.poll ? 60_000 : false,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => api<void>(id ? `/notifications/${id}/read` : '/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

// ---------------------------------------------------------------------------
// Referral requests
// ---------------------------------------------------------------------------

export function useReferrals(box: ReferralBox, status: ReferralStatus | undefined, page: number, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.referralList(box, status ?? 'all', page),
    queryFn: () => api<ReferralList>('/referrals', { query: { box, status, page, pageSize: 10 } }),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

/** Number of requests waiting for the viewer's response, for the navigation badge. */
export function usePendingReferralCount(enabled: boolean) {
  return useQuery({
    queryKey: keys.referralList('received', 'PENDING', 1),
    queryFn: () => api<ReferralList>('/referrals', { query: { box: 'received', status: 'PENDING', page: 1, pageSize: 10 } }),
    enabled,
    refetchInterval: 60_000,
    select: (r) => r.pendingReceived,
  });
}

/** A referral change affects both inboxes, the job page's request state and notifications. */
function syncReferral(qc: QueryClient, referral: ReferralRequestItem) {
  void qc.invalidateQueries({ queryKey: keys.referrals });
  void qc.invalidateQueries({ queryKey: keys.job(referral.job.slug) });
  void qc.invalidateQueries({ queryKey: keys.notifications });
}

export function useRequestReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, input }: { jobId: string; input: ReferralRequestCreateInput }) =>
      api<{ referral: ReferralRequestItem }>(`/jobs/${jobId}/referral-requests`, { method: 'POST', body: input }),
    onSuccess: ({ referral }) => syncReferral(qc, referral),
  });
}

export function useRespondReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReferralRespondInput }) =>
      api<{ referral: ReferralRequestItem }>(`/referrals/${id}/respond`, { method: 'POST', body: input }),
    onSuccess: ({ referral }) => syncReferral(qc, referral),
  });
}

export function useWithdrawReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ referral: ReferralRequestItem }>(`/referrals/${id}/withdraw`, { method: 'POST' }),
    onSuccess: ({ referral }) => syncReferral(qc, referral),
  });
}
