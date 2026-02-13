import { useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../auth/auth.store';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ProfileMenu } from './components/ProfileMenu';
import { PageLoader } from '../components/ui/PageLoader';
import { ROUTES } from '../config/constants';

interface NavItem {
  to: string;
  label: string;
  icon?: string;
}

const ownerNav: NavItem[] = [
  { to: ROUTES.admin.root, label: 'Dashboard', icon: '📊' },
  { to: ROUTES.admin.overview, label: 'All branches overview', icon: '👁' },
  { to: ROUTES.admin.vendors, label: 'Staff (assign branch)', icon: '👤' },
  { to: ROUTES.admin.createVendor, label: 'Add new staff', icon: '➕' },
  { to: ROUTES.admin.branches, label: 'Branches', icon: '📍' },
  { to: ROUTES.admin.sales, label: 'Sales', icon: '💰' },
  { to: ROUTES.admin.memberships, label: 'Memberships', icon: '🎫' },
  { to: ROUTES.admin.customers, label: 'Customers', icon: '👥' },
  { to: ROUTES.admin.packages, label: 'Packages', icon: '📦' },
  { to: ROUTES.admin.leads, label: 'Leads inbox', icon: '📥' },
  { to: ROUTES.admin.appointments, label: 'Appointments', icon: '📅' },
  { to: ROUTES.admin.settlements, label: 'Settlements', icon: '📋' },
  { to: ROUTES.admin.loyalty, label: 'Loyalty', icon: '⭐' },
  { to: ROUTES.admin.settings, label: 'Settings', icon: '⚙️' },
  { to: ROUTES.admin.profile, label: 'My profile', icon: '👤' },
];

const branchNav: NavItem[] = [
  { to: ROUTES.vendor.root, label: 'Dashboard', icon: '📊' },
  { to: ROUTES.vendor.sales, label: 'Sales', icon: '💰' },
  { to: ROUTES.vendor.memberships, label: 'Memberships', icon: '🎫' },
  { to: ROUTES.vendor.customers, label: 'Customers', icon: '👥' },
  { to: ROUTES.vendor.leads, label: 'Leads inbox', icon: '📥' },
  { to: ROUTES.vendor.appointments, label: 'Appointments', icon: '📅' },
  { to: ROUTES.vendor.settlements, label: 'Settlements', icon: '📋' },
  { to: ROUTES.vendor.loyalty, label: 'Loyalty', icon: '⭐' },
  { to: ROUTES.vendor.profile, label: 'My profile', icon: '👤' },
];

interface DashboardLayoutProps {
  title: string;
  navItems?: NavItem[];
}

export function DashboardLayout({ title, navItems: navItemsProp }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuthStore();
  const navItems = navItemsProp ?? (user?.role === 'admin' ? ownerNav : branchNav);
  const displayTitle = title || (user?.role === 'admin' ? 'Owner Dashboard' : 'Branch Dashboard');

  return (
    <div className={`dashboard ${sidebarOpen ? 'dashboard-sidebar-open' : ''}`}>
      <Topbar title={displayTitle} onMenuClick={() => setSidebarOpen((o) => !o)}>
        <ProfileMenu />
      </Topbar>
      <Sidebar title={displayTitle} navItems={navItems} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="dashboard-main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
