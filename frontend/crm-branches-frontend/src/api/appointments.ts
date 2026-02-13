import { apiRequest } from './client';
import type { Appointment } from '../types/crm';

export async function getAppointments(params?: { branchId?: string; customerId?: string; date?: string; from?: string; to?: string }): Promise<{ success: boolean; appointments?: Appointment[]; message?: string }> {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.customerId) q.set('customerId', params.customerId);
  if (params?.date) q.set('date', params.date);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const query = q.toString();
  const r = await apiRequest<{ appointments: Appointment[] }>(`/appointments${query ? `?${query}` : ''}`);
  if (r.success && 'appointments' in r) return { success: true, appointments: (r as { appointments: Appointment[] }).appointments };
  return { success: false, message: (r as { message?: string }).message };
}

export async function createAppointment(data: { customerId: string; branchId?: string; staffUserId?: string; serviceId?: string; scheduledAt: string; status?: string; notes?: string }) {
  return apiRequest<{ appointment: Appointment }>('/appointments', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAppointment(id: string, data: { scheduledAt?: string; status?: string; notes?: string }) {
  return apiRequest<{ appointment: Appointment }>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
