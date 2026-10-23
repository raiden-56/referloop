import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { FullPageSpinner, RedirectIfAuthenticated, RequireAdmin, RequireAuth, RequireVerified } from '@/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { RouteErrorBoundary } from '@/features/misc/RouteErrorBoundary';

const page = (Component: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={<FullPageSpinner />}>
    <Component />
  </Suspense>
);

const HomePage = lazy(() => import('@/features/home/HomePage'));
const ExploreJobsPage = lazy(() => import('@/features/jobs/ExploreJobsPage'));
const JobDetailsPage = lazy(() => import('@/features/jobs/JobDetailsPage'));
const JobFormPage = lazy(() => import('@/features/jobs/JobFormPage'));
const MyJobsPage = lazy(() => import('@/features/jobs/MyJobsPage'));
const SavedJobsPage = lazy(() => import('@/features/jobs/SavedJobsPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const ReferralsPage = lazy(() => import('@/features/referrals/ReferralsPage'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));
const TermsPage = lazy(() => import('@/features/misc/TermsPage'));
const NotFoundPage = lazy(() => import('@/features/misc/NotFoundPage'));

const AdminLayout = lazy(() => import('@/features/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('@/features/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('@/features/admin/AdminUsersPage'));
const AdminJobsPage = lazy(() => import('@/features/admin/AdminJobsPage'));
const AdminReportsPage = lazy(() => import('@/features/admin/AdminReportsPage'));
const AdminAuditLogPage = lazy(() => import('@/features/admin/AdminAuditLogPage'));
const AdminSettingsPage = lazy(() => import('@/features/admin/AdminSettingsPage'));

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: page(HomePage) },
      { path: 'jobs', element: page(ExploreJobsPage) },
      { path: 'jobs/new', element: <RequireVerified>{page(JobFormPage)}</RequireVerified> },
      { path: 'jobs/:slug', element: page(JobDetailsPage) },
      { path: 'jobs/:slug/edit', element: <RequireVerified>{page(JobFormPage)}</RequireVerified> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'my-jobs', element: page(MyJobsPage) },
          { path: 'saved', element: page(SavedJobsPage) },
          { path: 'profile', element: page(ProfilePage) },
          { path: 'notifications', element: page(NotificationsPage) },
          { path: 'referrals', element: page(ReferralsPage) },
        ],
      },
      {
        path: 'admin',
        element: <RequireAdmin>{page(AdminLayout)}</RequireAdmin>,
        children: [
          { index: true, element: page(AdminDashboardPage) },
          { path: 'users', element: page(AdminUsersPage) },
          { path: 'jobs', element: page(AdminJobsPage) },
          { path: 'reports', element: page(AdminReportsPage) },
          { path: 'audit-log', element: page(AdminAuditLogPage) },
          { path: 'settings', element: page(AdminSettingsPage) },
        ],
      },
      { path: 'terms', element: page(TermsPage) },
      { path: 'privacy', element: <Navigate to="/terms#privacy" replace /> },
      { path: '*', element: page(NotFoundPage) },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'login', element: <RedirectIfAuthenticated>{page(LoginPage)}</RedirectIfAuthenticated> },
      { path: 'register', element: <RedirectIfAuthenticated>{page(RegisterPage)}</RedirectIfAuthenticated> },
      { path: 'verify-email', element: page(VerifyEmailPage) },
      { path: 'forgot-password', element: page(ForgotPasswordPage) },
      { path: 'reset-password', element: page(ResetPasswordPage) },
    ],
  },
]);
