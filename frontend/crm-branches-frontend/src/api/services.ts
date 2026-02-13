import { apiRequest } from './client';
import type { Service } from '../types/crm';

export async function getServices(branchId?: string): Promise<{ success: boolean; services?: Service[]; message?: string }> {
  const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  const r = await apiRequest<{ services: Service[] }>(`/services${q}`);
  if (r.success && 'services' in r) return { success: true, services: (r as { services: Service[] }).services };
  return { success: false, message: (r as { message?: string }).message };
}
