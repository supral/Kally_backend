import { apiRequest } from './client';

export interface SystemSettings {
  revenuePercentage?: number;
  settlementPercentage?: number;
  /** Membership renewal price (default $0). Used when renewing an expired membership. */
  membershipRenewalCost?: number;
}

export async function getSettings(): Promise<{
  success: boolean;
  settings?: SystemSettings;
  message?: string;
}> {
  const r = await apiRequest<{ settings: SystemSettings }>('/settings');
  if (r.success && 'settings' in r) return { success: true, settings: (r as { settings: SystemSettings }).settings };
  return { success: false, message: (r as { message?: string }).message };
}

export async function updateSettings(data: { revenuePercentage?: number; settlementPercentage?: number; membershipRenewalCost?: number }): Promise<{
  success: boolean;
  settings?: SystemSettings;
  message?: string;
}> {
  const r = await apiRequest<{ settings: SystemSettings }>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (r.success && 'settings' in r) return { success: true, settings: (r as { settings: SystemSettings }).settings };
  return { success: false, message: (r as { message?: string }).message };
}
