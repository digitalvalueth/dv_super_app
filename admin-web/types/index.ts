// User Types
export interface User {
  id: string;
  uid: string;
  email: string;
  name: string; // เปลี่ยนจาก displayName
  role: "admin" | "manager" | "staff";
  companyId: string;
  companyCode: string;
  companyName: string;
  branchId?: string;
  branchCode?: string;
  branchName?: string;
  photoURL?: string;
  status: "pending" | "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

// Login Log
export interface LoginLog {
  id: string;
  userId: string;
  email: string;
  name: string;
  loginAt: Date;
  deviceInfo?: string;
  ipAddress?: string;
}

// Company & Branch
export interface Company {
  id: string;
  name: string;
  logoURL?: string;
  createdAt: Date;
}

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  address?: string;
  createdAt: Date;
}

// Product
export interface Product {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  imageURL?: string;
  standardCount?: number;
  createdAt: Date;
}

// Counting Session
export interface CountingSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  productSKU: string;
  imageURL: string;
  aiCount: number;
  manualCount?: number;
  finalCount: number;
  standardCount?: number;
  discrepancy: number;
  status: "completed" | "pending-review" | "approved" | "rejected";
  remarks?: string;
  adminRemarks?: string;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

// Invitation
export interface Invitation {
  id: string;
  email: string;
  companyId: string;
  companyName: string;
  role: "manager" | "staff";
  branchId?: string;
  invitedBy: string;
  invitedByName: string;
  status: "pending" | "accepted" | "expired";
  createdAt: Date;
  expiresAt: Date;
}

// Report Types
export interface DiscrepancyReport {
  totalSessions: number;
  totalDiscrepancy: number;
  averageDiscrepancy: number;
  topDiscrepancyUsers: Array<{
    userId: string;
    userName: string;
    totalDiscrepancy: number;
    sessionCount: number;
  }>;
  topDiscrepancyBranches: Array<{
    branchId: string;
    branchName: string;
    totalDiscrepancy: number;
    sessionCount: number;
  }>;
  topDiscrepancyProducts: Array<{
    productId: string;
    productName: string;
    productSKU: string;
    totalDiscrepancy: number;
    sessionCount: number;
  }>;
}

export interface DashboardStats {
  totalUsers: number;
  totalBranches: number;
  totalProducts: number;
  totalSessions: number;
  pendingSessions: number;
  totalDiscrepancy: number;
  recentSessions: CountingSession[];
}
