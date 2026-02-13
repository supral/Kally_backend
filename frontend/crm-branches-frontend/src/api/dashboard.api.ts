import { apiRequest } from './client';

export interface MembershipExpiringItem {
  id: string;
  customerName: string;
  customerPhone?: string;
  expiryDate: string;
  packageName: string;
}

export interface BranchDashboardData {
  from: string;
  to: string;
  totalSales?: number;
  activeMembershipCount?: number;
  expiredMembershipCount?: number;
  usedMembershipCount?: number;
  customersCount?: number;
  membershipSalesCount: number;
  membershipSalesRevenue: number;
  todayAppointments: { id: string; customer?: { name: string; phone: string }; staff?: string; service?: string; scheduledAt: string; status: string }[];
  leadsToFollowUp: { id: string; name: string; phone?: string; status: string; updatedAt: string }[];
  servicesCompleted: number;
  membershipUsageInBranch: number;
  /** Count of active memberships expiring within 7 days (vendor notification) */
  membershipsExpiringIn7Days?: number;
  /** Count of active memberships expiring within 30 days */
  membershipsExpiringIn30Days?: number;
  /** List of memberships expiring in next 7 days for vendor alert */
  membershipsExpiringSoonList?: MembershipExpiringItem[];
}

export async function getBranchDashboard(params?: { from?: string; to?: string }): Promise<{ success: boolean; data?: BranchDashboardData; message?: string }> {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const query = q.toString();
  const r = await apiRequest<BranchDashboardData>(`/reports/branch-dashboard${query ? `?${query}` : ''}`);
  if (r.success && 'membershipSalesCount' in r) return { success: true, data: r as unknown as BranchDashboardData };
  return { success: false, message: (r as { message?: string }).message };
}
