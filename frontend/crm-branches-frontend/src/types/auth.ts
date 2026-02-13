export type Role = 'admin' | 'vendor';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  vendorName?: string;
  approvalStatus?: ApprovalStatus;
  branchId?: string | null;
  branchName?: string | null;
}

export interface VendorListItem {
  id: string;
  name: string;
  email: string;
  vendorName?: string;
  approvalStatus: ApprovalStatus;
  branchId?: string | null;
  branchName?: string | null;
  isActive?: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: Role;
  vendorName?: string;
}
