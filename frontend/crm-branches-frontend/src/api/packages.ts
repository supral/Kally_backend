import { apiRequest } from './client';

export interface PackageItem {
  id: string;
  name: string;
  price: number;
  isActive?: boolean;
}

export async function getPackages(includeInactive = false): Promise<{ success: boolean; packages?: PackageItem[]; message?: string }> {
  const q = includeInactive ? '?all=true' : '';
  const r = await apiRequest<{ packages: PackageItem[] }>(`/packages${q}`);
  if (r.success && 'packages' in r) return { success: true, packages: (r as { packages: PackageItem[] }).packages };
  return { success: false, message: (r as { message?: string }).message };
}

export async function createPackage(data: { name: string; price: number }) {
  return apiRequest<{ package: PackageItem }>('/packages', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePackage(id: string, data: { name?: string; price?: number; isActive?: boolean }) {
  return apiRequest<{ package: PackageItem }>(`/packages/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deletePackage(id: string) {
  return apiRequest<{ message?: string }>(`/packages/${id}`, { method: 'DELETE' });
}
