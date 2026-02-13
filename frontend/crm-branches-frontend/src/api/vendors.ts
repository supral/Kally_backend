import { apiRequest } from './client';
import type { VendorListItem } from '../types/auth';

interface VendorsResponse {
  success: boolean;
  vendors?: VendorListItem[];
  message?: string;
}

interface ApproveRejectResponse {
  success: boolean;
  message?: string;
  vendor?: VendorListItem;
}

export async function createVendor(data: {
  name: string;
  email: string;
  password: string;
  branchId?: string | null;
  vendorName?: string;
}): Promise<{ success: boolean; vendor?: VendorListItem; message?: string }> {
  const result = await apiRequest<{ vendor: VendorListItem }>('/vendors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (result.success && 'vendor' in result) {
    return { success: true, vendor: (result as { vendor: VendorListItem }).vendor };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function getVendors(status?: 'pending' | 'approved' | 'rejected'): Promise<VendorsResponse> {
  const query = status ? `?status=${status}` : '';
  const result = await apiRequest<{ vendors: VendorListItem[] }>(`/vendors${query}`);
  if (result.success && 'vendors' in result) {
    return { success: true, vendors: (result as { vendors: VendorListItem[] }).vendors };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function approveVendor(id: string): Promise<ApproveRejectResponse> {
  const result = await apiRequest<{ vendor: VendorListItem }>(`/vendors/${id}/approve`, {
    method: 'PATCH',
  });
  if (result.success && 'vendor' in result) {
    return { success: true, vendor: (result as { vendor: VendorListItem }).vendor };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function rejectVendor(id: string): Promise<ApproveRejectResponse> {
  const result = await apiRequest<{ vendor: VendorListItem }>(`/vendors/${id}/reject`, {
    method: 'PATCH',
  });
  if (result.success && 'vendor' in result) {
    return { success: true, vendor: (result as { vendor: VendorListItem }).vendor };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function getVendor(id: string): Promise<{ success: boolean; vendor?: VendorListItem; message?: string }> {
  const result = await apiRequest<{ vendor: VendorListItem }>(`/vendors/${id}`);
  if (result.success && 'vendor' in result) {
    return { success: true, vendor: (result as { vendor: VendorListItem }).vendor };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function updateVendor(
  id: string,
  data: { name?: string; email?: string; vendorName?: string; branchId?: string | null }
): Promise<ApproveRejectResponse> {
  const result = await apiRequest<{ vendor: VendorListItem }>(`/vendors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (result.success && 'vendor' in result) {
    return { success: true, vendor: (result as { vendor: VendorListItem }).vendor };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function blockVendor(id: string): Promise<ApproveRejectResponse> {
  const result = await apiRequest<{ vendor: VendorListItem }>(`/vendors/${id}/block`, { method: 'PATCH' });
  if (result.success && 'vendor' in result) {
    return { success: true, vendor: (result as { vendor: VendorListItem }).vendor };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function setVendorActive(id: string): Promise<ApproveRejectResponse> {
  const result = await apiRequest<{ vendor: VendorListItem }>(`/vendors/${id}/active`, { method: 'PATCH' });
  if (result.success && 'vendor' in result) {
    return { success: true, vendor: (result as { vendor: VendorListItem }).vendor };
  }
  return { success: false, message: (result as { message?: string }).message };
}
