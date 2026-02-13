import { useAuthStore } from '../../auth/auth.store';

export function BranchSwitcher() {
  const { user } = useAuthStore();
  if (user?.role !== 'admin' || !user?.branchName) return null;
  return <span className="user-role">{user.branchName}</span>;
}
