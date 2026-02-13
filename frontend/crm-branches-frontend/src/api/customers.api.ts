import { http } from './http';
import type { Customer } from '../types/common';

export async function getCustomers(): Promise<{ success: boolean; customers?: Customer[]; message?: string }> {
  const r = await http<{ customers: Customer[] }>('/customers');
  if (r.success && 'customers' in r) return { success: true, customers: r.customers as Customer[] };
  return { success: false, message: r.message };
}

export async function getCustomer(id: string) {
  return http<{ customer: Customer }>(`/customers/${id}`);
}

export async function createCustomer(data: {
  name: string;
  phone: string;
  email?: string;
  membershipCardId?: string;
  primaryBranchId?: string;
  notes?: string;
}) {
  return http<{ customer: Customer }>('/customers', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  return http<{ customer: Customer }>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
