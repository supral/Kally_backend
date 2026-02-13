export const env = {
  apiUrl: (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, ''),
} as const;

export const API_BASE = env.apiUrl + '/api';
