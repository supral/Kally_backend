import { useAuth } from '../auth/hooks/useAuth';

export function useBranch() {
  const { user } = useAuth();
  return {
    branchId: user?.branchId ?? null,
    branchName: user?.branchName ?? null,
    isAdmin: user?.role === 'admin',
  };
}
