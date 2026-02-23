// User Types
export interface User {
  id: string;
  uid: string;
  email: string;
  name?: string;
  displayName?: string;
  role:
    | "super_admin"
    | "admin"
    | "supervisor"
    | "employee"
    | "manager"
    | "staff";
  companyId?: string;
  companyCode?: string;
  companyName?: string;
  branchId?: string;
  branchCode?: string;
  branchName?: string;
  managedBranchIds?: string[]; // For managers who control multiple branches
  supervisorId?: string; // ID of supervisor (for employees)
  supervisorName?: string; // Name of supervisor
  moduleAccess?: string[]; // Module IDs this user can access (must be ⊆ company.enabledModules)
  phoneNumber?: string;
  photoURL?: string;
  status?: "pending" | "active" | "inactive" | "suspended";
  createdAt?: Date;
  updatedAt?: Date;
}

// Login Log
export interface LoginLog {
  id: string;
  userId: string;
  email?: string;
  name?: string;
  loginAt: Date;
  deviceInfo?: {
    brand: string;
    deviceName: string;
    deviceType: number;
    isDevice: boolean;
    manufacturer: string;
    modelName: string;
    osName: string;
    osVersion: string;
  };
  ipAddress?: string;
}

// Company
export interface Company {
  id: string;
  name: string;
  code: string;
  address?: string;
  email?: string;
  phone?: string;
  logoURL?: string;
  enabledModules?: string[]; // Module IDs enabled for this company
  moduleWhitelist?: Record<string, string[]>; // { moduleId: [email1, email2] }
  status: "active" | "inactive" | "suspended";
  createdAt?: Date;
  updatedAt?: Date;
}

// Branch
export interface Branch {
  id: string;
  companyId: string;
  companyName?: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Product
export interface Product {
  id: string;
  productId: string; // เช่น SK-C-250 (ไม่ใช่ sku)
  companyId: string;
  branchId?: string;
  name: string;
  sku?: string; // For backward compatibility
  description?: string;
  barcode: string;
  sellerCode?: string | null;
  category?: string;
  series?: string;
  beforeCount?: number;
  imageUrl?: string;

  // Employee-added product tracking
  status?: ProductStatus;
  isUserCreated?: boolean;
  createdBy?: string;
  createdByName?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: Date;
  rejectionReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type ProductStatus =
  | "active"
  | "pending_verification"
  | "verified"
  | "rejected";

// Assignment (งานที่มอบหมายให้พนักงานนับ)
export interface Assignment {
  id: string;
  assignmentId: string;
  userId: string;
  companyId: string;
  branchId: string;
  productIds: string[]; // Array ของ productId (เช่น SK-C-250)
  month: number;
  year: number;
  status: "pending" | "in_progress" | "completed";
  createdAt?: Date;
  updatedAt?: Date;
}

// Counting Session
export interface CountingSession {
  id: string;
  assignmentId?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  productId: string;
  productName?: string;
  productSKU?: string;
  imageUrl?: string;

  // Count data
  beforeCountQty?: number;
  currentCountQty?: number;
  manualAdjustedQty?: number;
  variance?: number;

  // Legacy fields (for backward compatibility)
  aiCount?: number;
  manualCount?: number;
  finalCount?: number;
  standardCount?: number;
  discrepancy?: number;

  // AI
  aiConfidence?: number;
  aiModel?: string;
  processingTime?: number;

  status:
    | "completed"
    | "pending-review"
    | "approved"
    | "rejected"
    | "pending"
    | "in_progress"
    | "analyzed"
    | "mismatch";
  remarks?: string;
  adminRemarks?: string;
  errorRemark?: string;
  userReportedCount?: number;

  // Metadata
  deviceInfo?: string;
  appVersion?: string;
  hasBarcodeScan?: boolean;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };

  createdAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  updatedAt?: Date;
}

// Invitation
export interface Invitation {
  id: string;
  email: string;
  companyId: string;
  companyName?: string;
  role: "manager" | "staff" | "supervisor" | "employee";
  branchId?: string;
  branchName?: string;
  managedBranchIds?: string[]; // For supervisor/manager (multiple branches)
  invitedBy: string;
  invitedByName?: string;
  status: "pending" | "accepted" | "expired";
  createdAt?: Date;
  expiresAt?: Date;
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

// Commission Settings - สามารถกำหนดได้ตามบริษัท, สาขา หรือรายบุคคล
export interface CommissionSettings {
  id: string;
  companyId: string;
  branchId?: string; // ถ้าไม่ระบุ = ใช้กับทุกสาขา
  userId?: string; // ถ้าไม่ระบุ = ใช้กับทุกคนในสาขา/บริษัท
  commissionRate: number; // % commission (default: 5)
  deductionRate: number; // % หักจากสินค้าหาย (default: 50)
  estimatedPricePerItem: number; // ราคาเฉลี่ยต่อชิ้น (default: 500)
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ==================== Check-in / Attendance ====================

export type CheckInType = "check-in" | "check-out";

export interface CheckIn {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  companyId: string;
  companyName?: string;
  branchId: string;
  branchName?: string;

  type: CheckInType;

  // รูปภาพ + Watermark
  imageUrl: string;
  watermarkData: {
    timestamp: string;
    location: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    employeeName: string;
    employeeId: string;
    deviceModel?: string;
    deviceName?: string;
  };

  // ข้อมูลเวลา
  isLate?: boolean;
  lateMinutes?: number;
  remarks?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface AttendanceSettings {
  id: string;
  companyId: string;
  branchId?: string; // ถ้าไม่มี = ใช้ทั้งบริษัท
  workStartTime: string; // "10:00"
  workEndTime?: string; // "18:00"
  lateThresholdMinutes?: number; // default 0
  requirePhoto: boolean;
  requireLocation: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AttendanceSummary {
  date: string; // "2026-01-22"
  companyId: string;
  branchId?: string;
  totalEmployees: number;
  checkedIn: number;
  notCheckedIn: number;
  lateCount: number;
  onTimeCount: number;
}

// ==================== Delivery Types ====================

export type ShipmentStatus =
  | "pending"
  | "in_transit"
  | "delivered"
  | "received"
  | "cancelled";

export interface ShipmentProduct {
  productId: string;
  productName: string;
  productSKU?: string;
  quantity: number;
  unit: string;
}

export interface Shipment {
  id?: string;
  trackingNumber: string;
  companyId: string;
  branchId: string;
  branchName: string;
  products: ShipmentProduct[];
  totalItems: number;
  deliveryPersonName?: string;
  deliveryCompany?: string;
  deliveryPhone?: string;
  status: ShipmentStatus;
  estimatedDelivery?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type DeliveryReceiveStatus = "received" | "verified" | "issue";

export interface DeliveryReceive {
  id?: string;
  shipmentId: string;
  trackingNumber: string;
  branchId: string;
  branchName: string;
  products: ShipmentProduct[];
  totalItems: number;
  receivedBy: string;
  receivedByName: string;
  receivedAt: string;
  imageUrl: string;
  watermarkData?: {
    timestamp?: string;
    location?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    employeeName?: string;
    employeeId?: string;
    deviceModel?: string;
    deviceName?: string;
  };
  notes?: string;
  status: DeliveryReceiveStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
