import { http } from './http';
import type { Customer, Membership } from '../types/common';

interface SearchResult {
  customers: (Customer & { id: string })[];
  memberships: (Membership & { id: string; customerId: string; typeName?: string; soldAtBranch?: string; remainingCredits?: number })[];
}

export async function searchCustomersAndMemberships(q: string): Promise<{ success: boolean; customers?: SearchResult['customers']; memberships?: SearchResult['memberships']; message?: string }> {
  const r = await http<SearchResult>(`/search/customers-memberships?q=${encodeURIComponent(q)}`);
  if (r.success && 'customers' in r && 'memberships' in r)
    return { success: true, customers: r.customers as SearchResult['customers'], memberships: r.memberships as SearchResult['memberships'] };
  return { success: false, message: r.message };
}
