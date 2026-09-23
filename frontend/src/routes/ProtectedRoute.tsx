import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '@/stores/authStore';

/** Requires an authenticated user; otherwise redirects to /login (remembering where to return). */
export function ProtectedRoute() {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** For login/register pages: an authenticated user is sent to the home page. */
export function PublicOnlyRoute() {
  const isAuthenticated = useIsAuthenticated();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}
