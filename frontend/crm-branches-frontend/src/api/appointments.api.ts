import { http } from './http';
import type { Appointment } from '../types/common';

export async function getAppointments(params?: {
  branchId?: string;
  date?: string;
  from?: string;
  to?: string;
}): Promise<{ success: boolean; appointments?: Appointment[]; message?: string }> {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.date) q.set('date', params.date);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const query = q.toString();
  const r = await http<{ appointments: Appointment[] }>(`/appointments${query ? `?${query}` : ''}`);
  if (r.success && 'appointments' in r) return { success: true, appointments: r.appointments as Appointment[] };
  return { success: false, message: r.message };
}

export async function createAppointment(data: {
  customerId: string;
  branchId?: string;
  staffUserId?: string;
  serviceId?: string;
  scheduledAt: string;
  status?: string;
  notes?: string;
}) {
  return http<{ appointment: Appointment }>('/appointments', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAppointment(id: string, data: { scheduledAt?: string; status?: string; notes?: string }) {
  return http<{ appointment: Appointment }>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
