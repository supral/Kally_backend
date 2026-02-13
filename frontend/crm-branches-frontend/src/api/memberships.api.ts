import { http } from './http';
import type { Membership, MembershipUsage, MembershipType } from '../types/common';

export async function getMembershipTypes(): Promise<{ success: boolean; membershipTypes?: MembershipType[]; message?: string }> {
  const r = await http<{ membershipTypes: MembershipType[] }>('/membership-types');
  if (r.success && 'membershipTypes' in r) return { success: true, membershipTypes: r.membershipTypes as MembershipType[] };
  return { success: false, message: r.message };
}

export async function getMemberships(params?: { branchId?: string; customerId?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.customerId) q.set('customerId', params.customerId);
  if (params?.status) q.set('status', params.status);
  const query = q.toString();
  return http<{ memberships: Membership[] }>(`/memberships${query ? `?${query}` : ''}`);
}

export async function getMembership(id: string): Promise<{
  success: boolean;
  membership?: Membership;
  usageHistory?: MembershipUsage[];
  message?: string;
}> {
  const r = await http<{ membership: Membership; usageHistory: MembershipUsage[] }>(`/memberships/${id}`);
  if (r.success && 'membership' in r)
    return { success: true, membership: r.membership as Membership, usageHistory: r.usageHistory as MembershipUsage[] };
  return { success: false, message: r.message };
}

export async function createMembership(data: {
  customerId: string;
  membershipTypeId: string;
  totalCredits: number;
  soldAtBranchId?: string;
}) {
  return http<{ membership: Membership }>('/memberships', { method: 'POST', body: JSON.stringify(data) });
}

export async function recordMembershipUsage(membershipId: string, data: { creditsUsed?: number; notes?: string }) {
  return http<{ usage: MembershipUsage }>(`/memberships/${membershipId}/use`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateMembership(id: string, data: { usedCredits?: number; status?: string; expiryDate?: string }) {
  return http<{ membership: Membership }>(`/memberships/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
