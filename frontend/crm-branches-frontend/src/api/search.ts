import { apiRequest } from './client';
import type { Customer } from '../types/crm';
import type { Membership } from '../types/crm';

interface SearchResult {
  customers: (Customer & { id: string })[];
  memberships: (Membership & { id: string; customerId: string; typeName?: string; soldAtBranch?: string; remainingCredits?: number })[];
}

export async function searchCustomersAndMemberships(q: string): Promise<{ success: boolean; customers?: SearchResult['customers']; memberships?: SearchResult['memberships']; message?: string }> {
  const r = await apiRequest<SearchResult>(`/search/customers-memberships?q=${encodeURIComponent(q)}`);
  if (r.success && 'customers' in r && 'memberships' in r) {
    const d = r as unknown as SearchResult;
    return { success: true, customers: d.customers, memberships: d.memberships };
  }
  return { success: false, message: (r as { message?: string }).message };
}
