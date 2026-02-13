import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from './auth.store';
import { ROUTES } from '../config/constants';

/**
 * Layout for auth-only routes (login, forgot password). Redirects authenticated users
 * to their dashboard so they cannot access these when already logged in.
 */
export function GuestOnly() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated && user) {
    const redirectTo = user.role === 'admin' ? ROUTES.admin.root : ROUTES.vendor.root;
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
    return <Navigate to={from || redirectTo} replace />;
  }

  return <Outlet />;
}
