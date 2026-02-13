import { apiRequest } from './client';

export interface LoyaltyData {
  points: number;
  transactions: { id: string; points: number; type: string; reason?: string; branchName?: string; createdAt: string }[];
}

export interface RepeatedCustomer {
  customerId: string;
  customerName: string;
  phone: string;
  visitCount: number;
  lastVisitAt: string;
}

export interface MembershipUpgrader {
  customerId: string;
  customerName: string;
  phone: string;
  membershipCount: number;
  lastPurchaseAt: string;
}

export async function getLoyaltyInsights(): Promise<{
  success: boolean;
  repeatedCustomers?: RepeatedCustomer[];
  membershipUpgraders?: MembershipUpgrader[];
  message?: string;
}> {
  const r = await apiRequest<{ repeatedCustomers: RepeatedCustomer[]; membershipUpgraders: MembershipUpgrader[] }>('/loyalty/insights');
  if (r.success && 'repeatedCustomers' in r) {
    const d = r as unknown as { repeatedCustomers: RepeatedCustomer[]; membershipUpgraders: MembershipUpgrader[] };
    return { success: true, repeatedCustomers: d.repeatedCustomers, membershipUpgraders: d.membershipUpgraders };
  }
  return { success: false, message: (r as { message?: string }).message };
}

export async function getLoyalty(customerId: string): Promise<{ success: boolean; points?: number; transactions?: LoyaltyData['transactions']; message?: string }> {
  const r = await apiRequest<LoyaltyData>(`/loyalty/${customerId}`);
  if (r.success && 'points' in r) {
    const d = r as unknown as LoyaltyData;
    return { success: true, points: d.points, transactions: d.transactions };
  }
  return { success: false, message: (r as { message?: string }).message };
}

export async function earnLoyaltyPoints(customerId: string, points: number, reason?: string): Promise<{ success: boolean; points?: number; message?: string }> {
  const r = await apiRequest<{ points: number }>(`/loyalty/${customerId}/earn`, { method: 'POST', body: JSON.stringify({ points, reason }) });
  if (r.success && 'points' in r) return { success: true, points: (r as { points: number }).points };
  return { success: false, message: (r as { message?: string }).message };
}

export async function redeemLoyaltyPoints(customerId: string, points: number, reason?: string): Promise<{ success: boolean; points?: number; message?: string }> {
  const r = await apiRequest<{ points: number }>(`/loyalty/${customerId}/redeem`, { method: 'POST', body: JSON.stringify({ points, reason }) });
  if (r.success && 'points' in r) return { success: true, points: (r as { points: number }).points };
  return { success: false, message: (r as { message?: string }).message };
}
