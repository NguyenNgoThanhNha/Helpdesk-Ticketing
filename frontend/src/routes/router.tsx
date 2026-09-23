import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { TicketListPage } from '@/features/tickets/TicketListPage';
import { TicketDetailPage } from '@/features/tickets/TicketDetailPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { PermissionRoute } from './PermissionRoute';
import { SETTINGS_PERMISSIONS } from '@/stores/authStore';
import { HomeRedirect } from './HomeRedirect';

function NotFound() {
  return (
    <Result
      status="404"
      title="404"
      subTitle="Trang không tồn tại."
      extra={
        <Link to="/">
          <Button type="primary">Về trang chủ</Button>
        </Link>
      }
    />
  );
}

export const routes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
            element: <PermissionRoute anyOf={[['REPORT', 'R']]} />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/reports', element: <DashboardPage title="Reports" /> },
            ],
          },
          {
            element: <PermissionRoute anyOf={[['TICKET_ASSIGN', 'R']]} />,
            children: [{ path: '/my-queue', element: <TicketListPage key="queue" mode="queue" /> }],
          },
          {
            element: <PermissionRoute anyOf={SETTINGS_PERMISSIONS} />,
            children: [{ path: '/settings', element: <SettingsPage /> }],
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
