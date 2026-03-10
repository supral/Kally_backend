import { apiRequest } from './client';

export interface SystemSettings {
  revenuePercentage?: number;
  settlementPercentage?: number;
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

export async function updateSettings(data: { revenuePercentage?: number; settlementPercentage?: number }): Promise<{
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
