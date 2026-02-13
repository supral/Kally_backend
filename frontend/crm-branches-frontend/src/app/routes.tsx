import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../auth/RequireAuth';
import { GuestOnly } from '../auth/GuestOnly';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { VendorApprovalGuard } from '../auth/components/VendorApprovalGuard';
import { AuthLayout } from '../auth/components/AuthLayout';
import { PageLoader } from '../components/ui/PageLoader';
import { ROUTES } from '../config/constants';

// Auth pages – lazy loaded
const LoginPage = lazy(() => import('../auth/pages/LoginPage').then((m) => ({ default: m.default })));
const ForgotPasswordPage = lazy(() => import('../auth/pages/ForgotPasswordPage').then((m) => ({ default: m.default })));

// Admin pages – lazy loaded
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.default })));
const OwnerOverviewPage = lazy(() => import('../pages/admin/OwnerOverviewPage').then((m) => ({ default: m.default })));
const AdminVendorsPage = lazy(() => import('../pages/admin/VendorsPage').then((m) => ({ default: m.default })));
const AdminCreateVendorPage = lazy(() => import('../pages/admin/CreateVendorPage').then((m) => ({ default: m.default })));
const AdminBranchesPage = lazy(() => import('../pages/admin/BranchesPage').then((m) => ({ default: m.default })));
const AdminSalesPage = lazy(() => import('../pages/admin/SalesPage').then((m) => ({ default: m.default })));
const AdminMembershipsPage = lazy(() => import('../pages/admin/MembershipsPage').then((m) => ({ default: m.default })));
const AdminMembershipDetailPage = lazy(() => import('../pages/admin/MembershipDetailPage').then((m) => ({ default: m.default })));
const AdminCustomersPage = lazy(() => import('../pages/admin/CustomersPage').then((m) => ({ default: m.default })));
const CustomerDetailPage = lazy(() => import('../features/customers/pages/CustomerDetailPage').then((m) => ({ default: m.default })));
const CustomerMembershipsPage = lazy(() => import('../features/customers/pages/CustomerMembershipsPage').then((m) => ({ default: m.default })));
const CustomerAppointmentsPage = lazy(() => import('../features/customers/pages/CustomerAppointmentsPage').then((m) => ({ default: m.default })));
const AdminPackagesPage = lazy(() => import('../pages/admin/PackagesPage').then((m) => ({ default: m.default })));
const AdminSearchPage = lazy(() => import('../pages/admin/SearchPage').then((m) => ({ default: m.default })));
const AdminLeadsPage = lazy(() => import('../pages/admin/LeadsPage').then((m) => ({ default: m.default })));
const AdminLeadDetailPage = lazy(() => import('../pages/admin/LeadDetailPage').then((m) => ({ default: m.default })));
const AdminAppointmentsPage = lazy(() => import('../pages/admin/AppointmentsPage').then((m) => ({ default: m.default })));
const AdminSettlementsPage = lazy(() => import('../pages/admin/SettlementsPage').then((m) => ({ default: m.default })));
const AdminLoyaltyPage = lazy(() => import('../pages/admin/LoyaltyPage').then((m) => ({ default: m.default })));
const AdminSettingsPage = lazy(() => import('../pages/admin/SettingsPage').then((m) => ({ default: m.default })));
const AdminProfilePage = lazy(() => import('../pages/admin/ProfilePage').then((m) => ({ default: m.default })));

// Vendor pages – lazy loaded
const VendorDashboardPage = lazy(() => import('../pages/vendor/VendorDashboardPage').then((m) => ({ default: m.default })));
const VendorBranchesPage = lazy(() => import('../pages/vendor/BranchesPage').then((m) => ({ default: m.default })));
const VendorSalesPage = lazy(() => import('../pages/vendor/SalesPage').then((m) => ({ default: m.default })));
const VendorMembershipsPage = lazy(() => import('../pages/vendor/MembershipsPage').then((m) => ({ default: m.default })));
const VendorMembershipDetailPage = lazy(() => import('../pages/vendor/MembershipDetailPage').then((m) => ({ default: m.default })));
const VendorCustomersPage = lazy(() => import('../pages/vendor/CustomersPage').then((m) => ({ default: m.default })));
const VendorSearchPage = lazy(() => import('../pages/vendor/SearchPage').then((m) => ({ default: m.default })));
const VendorLeadsPage = lazy(() => import('../pages/vendor/LeadsPage').then((m) => ({ default: m.default })));
const VendorLeadDetailPage = lazy(() => import('../pages/vendor/LeadDetailPage').then((m) => ({ default: m.default })));
const VendorAppointmentsPage = lazy(() => import('../pages/vendor/AppointmentsPage').then((m) => ({ default: m.default })));
const VendorSettlementsPage = lazy(() => import('../pages/vendor/SettlementsPage').then((m) => ({ default: m.default })));
const VendorLoyaltyPage = lazy(() => import('../pages/vendor/LoyaltyPage').then((m) => ({ default: m.default })));
const VendorProfilePage = lazy(() => import('../pages/vendor/VendorProfilePage').then((m) => ({ default: m.default })));

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth routes: only for guests */}
        <Route element={<GuestOnly />}>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<LoginPage />} />
            <Route path={ROUTES.login} element={<LoginPage />} />
            <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route
          path={ROUTES.admin.root}
          element={
            <RequireAuth allowedRoles={['admin']}>
              <DashboardLayout title="Owner Dashboard" />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="overview" element={<OwnerOverviewPage />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="create-vendor" element={<AdminCreateVendorPage />} />
          <Route path="branches" element={<AdminBranchesPage />} />
          <Route path="sales" element={<AdminSalesPage />} />
          <Route path="memberships" element={<AdminMembershipsPage />} />
          <Route path="memberships/:id" element={<AdminMembershipDetailPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="customers/:id/memberships" element={<CustomerMembershipsPage />} />
          <Route path="customers/:id/appointments" element={<CustomerAppointmentsPage />} />
          <Route path="packages" element={<AdminPackagesPage />} />
          <Route path="search" element={<AdminSearchPage />} />
          <Route path="leads" element={<AdminLeadsPage />} />
          <Route path="leads/:id" element={<AdminLeadDetailPage />} />
          <Route path="appointments" element={<AdminAppointmentsPage />} />
          <Route path="settlements" element={<AdminSettlementsPage />} />
          <Route path="loyalty" element={<AdminLoyaltyPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="profile" element={<AdminProfilePage />} />
        </Route>

        {/* Vendor routes */}
        <Route
          path={ROUTES.vendor.root}
          element={
            <RequireAuth allowedRoles={['vendor']}>
              <DashboardLayout title="Branch Dashboard" />
            </RequireAuth>
          }
        >
          <Route element={<VendorApprovalGuard />}>
            <Route index element={<VendorDashboardPage />} />
            <Route path="branches" element={<VendorBranchesPage />} />
            <Route path="sales" element={<VendorSalesPage />} />
            <Route path="memberships" element={<VendorMembershipsPage />} />
            <Route path="memberships/:id" element={<VendorMembershipDetailPage />} />
            <Route path="customers" element={<VendorCustomersPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="customers/:id/memberships" element={<CustomerMembershipsPage />} />
            <Route path="customers/:id/appointments" element={<CustomerAppointmentsPage />} />
            <Route path="search" element={<VendorSearchPage />} />
            <Route path="leads" element={<VendorLeadsPage />} />
            <Route path="leads/:id" element={<VendorLeadDetailPage />} />
            <Route path="appointments" element={<VendorAppointmentsPage />} />
            <Route path="settlements" element={<VendorSettlementsPage />} />
            <Route path="loyalty" element={<VendorLoyaltyPage />} />
            <Route path="profile" element={<VendorProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
