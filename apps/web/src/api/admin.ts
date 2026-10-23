import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AdminCategory,
  AdminDashboard,
  AdminJob,
  AdminReport,
  AdminUser,
  AppSettings,
  AppSettingsInput,
  AuditLogEntry,
  CategoryInput,
  CurrentUser,
  JobDetail,
  Paginated,
  ReportResolutionInput,
  Role,
} from '@referloop/shared';
import { api, type QueryValue } from './client';
import { keys } from './queries';

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: ['admin', 'dashboard'] as const,
  users: (params: Record<string, QueryValue>) => ['admin', 'users', params] as const,
  jobs: (params: Record<string, QueryValue>) => ['admin', 'jobs', params] as const,
  reports: (params: Record<string, QueryValue>) => ['admin', 'reports', params] as const,
  auditLogs: (params: Record<string, QueryValue>) => ['admin', 'audit-logs', params] as const,
  settings: ['admin', 'settings'] as const,
  categories: ['admin', 'categories'] as const,
};

const invalidate = (qc: QueryClient, ...prefixes: (readonly unknown[])[]) =>
  Promise.all(prefixes.map((queryKey) => qc.invalidateQueries({ queryKey })));

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const useAdminDashboard = () => useQuery({ queryKey: adminKeys.dashboard, queryFn: () => api<AdminDashboard>('/admin/dashboard') });

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const useAdminUsers = (params: Record<string, QueryValue>) =>
  useQuery({
    queryKey: adminKeys.users(params),
    queryFn: ({ signal }) => api<Paginated<AdminUser>>('/admin/users', { query: params, signal }),
    placeholderData: keepPreviousData,
  });

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'ACTIVE' | 'SUSPENDED'; reason?: string }) =>
      api<{ user: CurrentUser }>(`/admin/users/${id}/status`, { method: 'PATCH', body: { status, reason: reason ?? '' } }),
    onSuccess: () => invalidate(qc, ['admin', 'users'], adminKeys.dashboard, ['admin', 'audit-logs']),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      api<{ user: CurrentUser }>(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => invalidate(qc, ['admin', 'users'], ['admin', 'audit-logs']),
  });
}

export function useRevokeUserSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ revoked: number }>(`/admin/users/${id}/revoke-sessions`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, ['admin', 'users'], ['admin', 'audit-logs']),
  });
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const useAdminJobs = (params: Record<string, QueryValue>) =>
  useQuery({
    queryKey: adminKeys.jobs(params),
    queryFn: ({ signal }) => api<Paginated<AdminJob>>('/admin/jobs', { query: params, signal }),
    placeholderData: keepPreviousData,
  });

function useJobMutation<TVars>(fn: (vars: TVars) => Promise<{ job: JobDetail }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate(qc, ['admin', 'jobs'], adminKeys.dashboard, ['admin', 'reports'], ['admin', 'audit-logs'], keys.jobs),
  });
}

export const useArchiveJob = () =>
  useJobMutation(({ id, reason }: { id: string; reason: string }) =>
    api<{ job: JobDetail }>(`/admin/jobs/${id}/archive`, { method: 'PATCH', body: { reason } }),
  );

export const useRestoreJob = () =>
  useJobMutation(({ id, reason }: { id: string; reason?: string }) =>
    api<{ job: JobDetail }>(`/admin/jobs/${id}/restore`, { method: 'POST', body: { reason: reason ?? '' } }),
  );

export const useRevertJob = () =>
  useJobMutation(({ id, historyId, version, reason }: { id: string; historyId: string; version: number; reason: string }) =>
    api<{ job: JobDetail }>(`/admin/jobs/${id}/revert`, { method: 'POST', body: { historyId, version, reason } }),
  );

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const useAdminReports = (params: Record<string, QueryValue>) =>
  useQuery({
    queryKey: adminKeys.reports(params),
    queryFn: ({ signal }) => api<Paginated<AdminReport>>('/admin/reports', { query: params, signal }),
    placeholderData: keepPreviousData,
  });

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReportResolutionInput }) =>
      api<{ report: AdminReport }>(`/admin/reports/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (_data, { input }) =>
      invalidate(
        qc,
        ['admin', 'reports'],
        adminKeys.dashboard,
        ['admin', 'audit-logs'],
        ...(input.jobAction && input.jobAction !== 'NONE' ? [['admin', 'jobs'], keys.jobs] : []),
      ),
  });
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const useAuditLogs = (params: Record<string, QueryValue>) =>
  useQuery({
    queryKey: adminKeys.auditLogs(params),
    queryFn: ({ signal }) => api<Paginated<AuditLogEntry>>('/admin/audit-logs', { query: params, signal }),
    placeholderData: keepPreviousData,
  });

// ---------------------------------------------------------------------------
// Settings and categories
// ---------------------------------------------------------------------------

export const useAdminSettings = () =>
  useQuery({ queryKey: adminKeys.settings, queryFn: () => api<{ settings: AppSettings }>('/admin/settings').then((r) => r.settings) });

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AppSettingsInput) => api<{ settings: AppSettings }>('/admin/settings', { method: 'PUT', body: input }),
    onSuccess: ({ settings }) => {
      qc.setQueryData(adminKeys.settings, settings);
      return invalidate(qc, keys.config, ['admin', 'audit-logs']);
    },
  });
}

export const useAdminCategories = () =>
  useQuery({ queryKey: adminKeys.categories, queryFn: () => api<{ items: AdminCategory[] }>('/admin/categories').then((r) => r.items) });

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CategoryInput }) =>
      id
        ? api<{ category: AdminCategory }>(`/admin/categories/${id}`, { method: 'PATCH', body: input })
        : api<{ category: AdminCategory }>('/admin/categories', { method: 'POST', body: input }),
    onSuccess: () => invalidate(qc, adminKeys.categories, keys.config, ['admin', 'audit-logs']),
  });
}
