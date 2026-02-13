import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../auth/auth.store';
import { ROUTES } from '../../config/constants';

export function GlobalSearch() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const basePath = user?.role === 'admin' ? ROUTES.admin.search : ROUTES.vendor.search;

  return (
    <button type="button" className="filter-btn" onClick={() => navigate(basePath)}>
      🔍 Search
    </button>
  );
}
