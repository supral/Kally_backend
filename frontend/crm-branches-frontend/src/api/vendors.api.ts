import { http } from './http';
import type { VendorListItem } from '../auth/auth.types';

export async function getVendors(status?: 'pending' | 'approved' | 'rejected'): Promise<{ success: boolean; vendors?: VendorListItem[]; message?: string }> {
  const query = status ? `?status=${status}` : '';
  const r = await http<{ vendors: VendorListItem[] }>(`/vendors${query}`);
  if (r.success && 'vendors' in r) return { success: true, vendors: r.vendors as VendorListItem[] };
  return { success: false, message: r.message };
}

export async function approveVendor(id: string): Promise<{ success: boolean; vendor?: VendorListItem; message?: string }> {
  const r = await http<{ vendor: VendorListItem }>(`/vendors/${id}/approve`, { method: 'PATCH' });
  if (r.success && 'vendor' in r) return { success: true, vendor: r.vendor as VendorListItem };
  return { success: false, message: r.message };
}

export async function rejectVendor(id: string): Promise<{ success: boolean; vendor?: VendorListItem; message?: string }> {
  const r = await http<{ vendor: VendorListItem }>(`/vendors/${id}/reject`, { method: 'PATCH' });
  if (r.success && 'vendor' in r) return { success: true, vendor: r.vendor as VendorListItem };
  return { success: false, message: r.message };
}

export async function updateVendorBranch(id: string, branchId: string | null) {
  return http<{ vendor: VendorListItem }>(`/vendors/${id}`, { method: 'PATCH', body: JSON.stringify({ branchId }) });
}
