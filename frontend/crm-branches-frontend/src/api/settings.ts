import { apiRequest } from './client';

export interface SystemSettings {
  revenuePercentage?: number;
  settlementPercentage?: number;
  /** When true, vendors see the Guidelines link and can open the Guidelines page. */
  showGuidelinesInVendorDashboard?: boolean;
  /** When true, vendors see the notification bell in the top bar. */
  showNotificationBellToVendors?: boolean;
  /** Which categories to show in the vendor notification dropdown. */
  showNotificationAppointments?: boolean;
  showNotificationSettlements?: boolean;
  showNotificationTickets?: boolean;
  showNotificationComments?: boolean;
  showNotificationSalesData?: boolean;
  /** When true, Import buttons are visible on Branches, Packages, Customers, Memberships, Appointments. */
  showImportButton?: boolean;
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

export async function updateSettings(data: {
  revenuePercentage?: number;
  settlementPercentage?: number;
  showGuidelinesInVendorDashboard?: boolean;
  showNotificationBellToVendors?: boolean;
  showNotificationAppointments?: boolean;
  showNotificationSettlements?: boolean;
  showNotificationTickets?: boolean;
  showNotificationComments?: boolean;
  showNotificationSalesData?: boolean;
  showImportButton?: boolean;
}): Promise<{
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
