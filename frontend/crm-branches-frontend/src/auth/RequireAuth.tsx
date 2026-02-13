import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './auth.store';
import { ROUTES } from '../config/constants';
import type { Role } from './auth.types';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
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

  if (!isAuthenticated || !user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to={ROUTES.admin.root} replace />;
    return <Navigate to={ROUTES.vendor.root} replace />;
  }

  return <>{children}</>;
}
