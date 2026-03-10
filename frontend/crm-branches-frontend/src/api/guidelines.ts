import { apiRequest } from './client';

export async function getGuidelines(): Promise<{
  success: boolean;
  content?: string;
  message?: string;
}> {
  const r = await apiRequest<{ content: string }>('/guidelines');
  if (r.success && 'content' in r) return { success: true, content: (r as { content: string }).content };
  return { success: false, message: (r as { message?: string }).message };
}

export async function updateGuidelines(content: string): Promise<{
  success: boolean;
  content?: string;
  message?: string;
}> {
  const r = await apiRequest<{ content: string }>('/guidelines', {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  if (r.success && 'content' in r) return { success: true, content: (r as { content: string }).content };
  return { success: false, message: (r as { message?: string }).message };
}
