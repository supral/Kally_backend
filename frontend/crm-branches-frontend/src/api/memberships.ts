import { apiRequest } from './client';
import type { Membership, MembershipUsage } from '../types/crm';
import type { MembershipType } from '../types/crm';

export async function getMembershipTypes(): Promise<{ success: boolean; membershipTypes?: MembershipType[]; message?: string }> {
  const r = await apiRequest<{ membershipTypes: MembershipType[] }>('/membership-types');
  if (r.success && 'membershipTypes' in r) return { success: true, membershipTypes: (r as { membershipTypes: MembershipType[] }).membershipTypes };
  return { success: false, message: (r as { message?: string }).message };
}

export async function getMemberships(params?: { branchId?: string; customerId?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.customerId) q.set('customerId', params.customerId);
  if (params?.status) q.set('status', params.status);
  const query = q.toString();
  return apiRequest<{ memberships: Membership[] }>(`/memberships${query ? `?${query}` : ''}`);
}

export async function getMembership(id: string): Promise<{ success: boolean; membership?: Membership; usageHistory?: MembershipUsage[]; message?: string }> {
  const r = await apiRequest<{ membership: Membership; usageHistory: MembershipUsage[] }>(`/memberships/${id}`);
  if (r.success && 'membership' in r && 'usageHistory' in r) {
    const d = r as unknown as { membership: Membership; usageHistory: MembershipUsage[] };
    return { success: true, membership: d.membership, usageHistory: d.usageHistory };
  }
  return { success: false, message: (r as { message?: string }).message };
}

export async function createMembership(data: {
  customerId: string;
  membershipTypeId?: string;
  totalCredits: number;
  soldAtBranchId?: string;
  expiryDate?: string;
  customerPackage?: string;
  customerPackagePrice?: number;
  customerPackageExpiry?: string;
  discountAmount?: number;
}) {
  return apiRequest<{ membership: Membership }>('/memberships', { method: 'POST', body: JSON.stringify(data) });
}

export type ImportRow = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  totalCredits: number;
  soldAtBranch: string;
  purchaseDate?: string;
  expiryDate?: string;
  packagePrice?: number;
  discountAmount?: number;
  customerPackage?: string;
};

export async function importMemberships(rows: ImportRow[]): Promise<{
  success: boolean;
  imported?: number;
  createdCustomers?: number;
  errors?: { row: number; message: string }[];
  message?: string;
}> {
  const r = await apiRequest<{ imported: number; createdCustomers: number; errors: { row: number; message: string }[] }>('/memberships/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
  if (r.success && 'imported' in r) {
    const d = r as unknown as { imported: number; createdCustomers: number; errors: { row: number; message: string }[] };
    return { success: true, imported: d.imported, createdCustomers: d.createdCustomers, errors: d.errors };
  }
  return { success: false, message: (r as { message?: string }).message };
}

export async function recordMembershipUsage(membershipId: string, data: { creditsUsed?: number; notes?: string; serviceDetails?: string; usedAtBranchId?: string }) {
  return apiRequest<{ usage: MembershipUsage }>(`/memberships/${membershipId}/use`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateMembership(id: string, data: { usedCredits?: number; status?: string; expiryDate?: string }) {
  return apiRequest<{ membership: Membership }>(`/memberships/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

/** Renew an expired or fully used membership. Creates a new membership; packagePrice is included in total sales. */
export async function renewMembership(
  id: string,
  data: { packagePrice: number; totalCredits?: number; expiryDate?: string }
): Promise<{ success: boolean; membership?: Membership; message?: string }> {
  const r = await apiRequest<{ membership: Membership }>(`/memberships/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (r.success && 'membership' in r) return { success: true, membership: (r as { membership: Membership }).membership };
  return { success: false, message: (r as { message?: string }).message };
}
