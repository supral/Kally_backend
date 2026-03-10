import { useState, Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../auth/auth.store';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ProfileMenu } from './components/ProfileMenu';
import { NotificationBell } from './components/NotificationBell';
import { PageLoader } from '../components/ui/PageLoader';
import { ROUTES } from '../config/constants';
import { getTicketCount } from '../api/tickets';
import { getSettings } from '../api/settings';

interface NavItem {
  to: string;
  label: string;
  icon?: string;
}

const ownerNav: NavItem[] = [
  { to: ROUTES.admin.root, label: 'Dashboard', icon: '📊' },
  { to: ROUTES.admin.sales, label: 'Sales dashboard', icon: '💰' },
  { to: ROUTES.admin.vendors, label: 'Staff (assign branch)', icon: '👤' },
  { to: ROUTES.admin.createVendor, label: 'Add new staff', icon: '➕' },
  { to: ROUTES.admin.branches, label: 'Branches', icon: '📍' },
  { to: ROUTES.admin.salesImages, label: 'Sales Data', icon: '🖼️' },
  { to: ROUTES.admin.memberships, label: 'Memberships', icon: '🎫' },
  { to: ROUTES.admin.customers, label: 'Customers', icon: '👥' },
  { to: ROUTES.admin.packages, label: 'Packages', icon: '📦' },
  { to: ROUTES.admin.leads, label: 'Leads inbox', icon: '📥' },
  { to: ROUTES.admin.appointments, label: 'Appointments', icon: '📅' },
  { to: ROUTES.admin.settlements, label: 'Settlements', icon: '📋' },
  { to: ROUTES.admin.loyalty, label: 'Loyalty', icon: '⭐' },
  { to: ROUTES.admin.profile, label: 'My profile', icon: '👤' },
  { to: ROUTES.admin.tickets, label: 'Tickets', icon: '🎫' },
  { to: ROUTES.admin.guidelines, label: 'Guidelines', icon: '📄' },
  { to: ROUTES.admin.settings, label: 'Settings', icon: '⚙️' },
];

const branchNav: NavItem[] = [
  { to: ROUTES.vendor.root, label: 'Dashboard', icon: '📊' },
  { to: ROUTES.vendor.sales, label: 'Sales', icon: '💰' },
  { to: ROUTES.vendor.salesImages, label: 'Sales Data', icon: '🖼️' },
  { to: ROUTES.vendor.memberships, label: 'Memberships', icon: '🎫' },
  { to: ROUTES.vendor.customers, label: 'Customers', icon: '👥' },
  { to: ROUTES.vendor.packages, label: 'Packages', icon: '📦' },
  { to: ROUTES.vendor.leads, label: 'Leads inbox', icon: '📥' },
  { to: ROUTES.vendor.appointments, label: 'Appointments', icon: '📅' },
  { to: ROUTES.vendor.settlements, label: 'Settlements', icon: '📋' },
  { to: ROUTES.vendor.loyalty, label: 'Loyalty', icon: '⭐' },
  { to: ROUTES.vendor.profile, label: 'My profile', icon: '👤' },
  { to: ROUTES.vendor.guidelines, label: 'Guidelines', icon: '📄' },
  { to: ROUTES.vendor.tickets, label: 'Tickets', icon: '🎫' },
];

interface DashboardLayoutProps {
  title: string;
  navItems?: NavItem[];
}

export function DashboardLayout({ title, navItems: navItemsProp }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);
  const [showGuidelinesInVendor, setShowGuidelinesInVendor] = useState<boolean>(true);
  const [showNotificationBellToVendors, setShowNotificationBellToVendors] = useState<boolean>(true);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === 'admin') return;
    getSettings().then((r) => {
      if (r.success && r.settings) {
        if (typeof r.settings.showGuidelinesInVendorDashboard === 'boolean') {
          setShowGuidelinesInVendor(r.settings.showGuidelinesInVendorDashboard);
        }
        if (typeof r.settings.showNotificationBellToVendors === 'boolean') {
          setShowNotificationBellToVendors(r.settings.showNotificationBellToVendors);
        }
      }
    });
  }, [user?.role]);

  const vendorNavItems =
    showGuidelinesInVendor
      ? branchNav
      : branchNav.filter((item) => item.to !== ROUTES.vendor.guidelines);
  const navItems = navItemsProp ?? (user?.role === 'admin' ? ownerNav : vendorNavItems);
  const displayTitle = title || (user?.role === 'admin' ? 'Owner Dashboard' : 'Branch Dashboard');
  const ticketsRoute = user?.role === 'admin' ? ROUTES.admin.tickets : ROUTES.vendor.tickets;

  useEffect(() => {
    getTicketCount().then((r) => {
      if (r.success && r.openCount != null) setTicketCount(r.openCount);
    });
    const interval = setInterval(() => {
      getTicketCount().then((r) => {
        if (r.success && r.openCount != null) setTicketCount(r.openCount);
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`dashboard ${sidebarOpen ? 'dashboard-sidebar-open' : ''}`}>
      <Topbar title={displayTitle} onMenuClick={() => setSidebarOpen((o) => !o)}>
        {user?.role === 'vendor' && showNotificationBellToVendors && <NotificationBell />}
        <ProfileMenu />
      </Topbar>
      <Sidebar
        title={displayTitle}
        navItems={navItems}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ticketCount={ticketCount}
        ticketsRoute={ticketsRoute}
      />
      <main className="dashboard-main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
