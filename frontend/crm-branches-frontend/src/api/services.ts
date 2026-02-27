import { apiRequest } from './client';
import type { Service } from '../types/crm';

export async function getServices(branchId?: string): Promise<{ success: boolean; services?: Service[]; message?: string }> {
  const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  const r = await apiRequest<{ services: Service[] }>(`/services${q}`);
  if (r.success && 'services' in r) return { success: true, services: (r as { services: Service[] }).services };
  return { success: false, message: (r as { message?: string }).message };
}

export async function createService(data: {
  name: string;
  category?: string;
  branchId?: string;
  durationMinutes?: number;
  price?: number;
}): Promise<{ success: boolean; service?: Service; message?: string }> {
  const r = await apiRequest<{ service: Service }>('/services', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (r.success && 'service' in r) return { success: true, service: (r as { service: Service }).service };
  return { success: false, message: (r as { message?: string }).message };
}

export async function updateService(
  id: string,
  data: { name?: string; category?: string; branchId?: string; durationMinutes?: number; price?: number }
): Promise<{ success: boolean; service?: Service; message?: string }> {
  const r = await apiRequest<{ service: Service }>(`/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (r.success && 'service' in r) return { success: true, service: (r as { service: Service }).service };
  return { success: false, message: (r as { message?: string }).message };
}

export async function deleteService(id: string): Promise<{ success: boolean; message?: string }> {
  const r = await apiRequest(`/services/${id}`, { method: 'DELETE' });
  return { success: !!r.success, message: (r as { message?: string }).message };
}
