import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/hooks/useAuth';
import VendorPendingPage from '../auth/pages/VendorPendingPage';

/**
 * Renders vendor dashboard content only when approved.
 * When approvalStatus is not 'approved', shows the pending approval page.
 */
export function VendorApprovalGuard() {
  const { user } = useAuth();

  if (user?.role === 'vendor' && user?.approvalStatus !== 'approved') {
    return <VendorPendingPage />;
  }

  return <Outlet />;
}
