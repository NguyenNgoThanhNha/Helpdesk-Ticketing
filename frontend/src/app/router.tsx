import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/layouts/app-layout';
import { AuthLayout } from '@/layouts/auth-layout';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '@/features/auth';
import { TicketDetailPage, TicketListPage } from '@/features/tickets';
import { PERMISSIONS } from '@/lib/permissions';
import { HomeRedirect, NotFound, PermissionRoute, ProtectedRoute, PublicOnlyRoute } from './route-guards';

// Heavier, permission-gated pages are code-split (recharts, settings tables, API logs).
const DashboardPage = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import('@/features/settings').then((m) => ({ default: m.SettingsPage })));
const ApiLogsPage = lazy(() => import('@/features/api-logs').then((m) => ({ default: m.ApiLogsPage })));

export const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: '/tickets', element: <TicketListPage key="all" /> },
          { path: '/tickets/:id', element: <TicketDetailPage /> },
          {
            element: <PermissionRoute anyOf={PERMISSIONS.dashboard} />,
            children: [{ path: '/dashboard', element: <DashboardPage /> }],
          },
          // reports were merged into the dashboard; keep old links / bookmarks working
          { path: '/reports', element: <Navigate to="/dashboard" replace /> },
          {
            element: <PermissionRoute anyOf={PERMISSIONS.myQueue} />,
            children: [{ path: '/my-queue', element: <TicketListPage key="queue" mode="queue" /> }],
          },
          {
            element: <PermissionRoute anyOf={PERMISSIONS.settings} />,
            children: [{ path: '/settings', element: <SettingsPage /> }],
          },
          {
            element: <PermissionRoute anyOf={PERMISSIONS.apiLogs} />,
            children: [{ path: '/api-logs', element: <ApiLogsPage /> }],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
