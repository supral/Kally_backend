import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import VendorPendingPage from '../pages/VendorPendingPage';

export function VendorApprovalGuard() {
  const { user } = useAuth();

  if (user?.role === 'vendor' && user?.approvalStatus !== 'approved') {
    return <VendorPendingPage />;
  }
  return <Outlet />;
}
