export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
}
