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
  profilePhoto?: string | null;
}

export interface VendorListItem {
  id: string;
  name: string;
  email: string;
  vendorName?: string;
  approvalStatus: ApprovalStatus;
  branchId?: string;
  branchName?: string;
  createdAt: string;
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
