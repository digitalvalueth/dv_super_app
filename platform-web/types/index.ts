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
  companyIds?: string[]; // All company IDs this user belongs to (multi-company support)
  branchId?: string;
  branchCode?: string;
  branchName?: string;
  branchIds?: string[]; // All branch IDs this user belongs to (multi-branch support)
  branchNames?: Record<string, string>; // Map of branchId to branchName
  managedBranchIds?: string[]; // For managers who control multiple branches
  managedSupervisorIds?: string[]; // For managers: supervisor UIDs they manage
  supervisorId?: string; // ID of supervisor (for employees)
  supervisorName?: string; // Name of supervisor
  // Phithan fields
  baCode?: string; // รหัส BA / Employee ID
  fullName?: string; // ชื่อ-นามสกุล (TH)
  seller?: string; // ยี่ห้อ/seller ที่รับผิดชอบ
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
  // Geofence (สำหรับตรวจ check-in / รูปถ่ายว่าอยู่ในพื้นที่สาขาจริงหรือไม่)
  latitude?: number;
  longitude?: number;
  radiusMeters?: number; // รัศมีที่ยอมให้เช็คอินได้ (default 200m)
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

  // Unit of Measure (UOM)
  unitType?: "piece" | "box"; // ชิ้น หรือ กล่อง (default: piece)
  unitsPerBox?: number; // จำนวนชิ้นต่อกล่อง (เฉพาะ unitType=box)
  linkedProductId?: string; // productId ของสินค้าชิ้นที่กล่องนี้บรรจุ (เฉพาะ unitType=box)

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
  half: 1 | 2; // รอบที่ 1 (2–15) หรือ รอบที่ 2 (17–สิ้นเดือน)
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
  periodId?: string; // e.g. 2026-03-H2
  periodMonth?: string; // e.g. 2026-03
  periodHalf?: 1 | 2;
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
  isLate?: boolean; // ส่งในช่วง grace period (ลับ)
  isSupplemental?: boolean; // รูปเพิ่มเติม ไม่นับรวมกับจำนวนหลัก

  // Metadata
  deviceInfo?: string;
  appVersion?: string;
  hasBarcodeScan?: boolean;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };

  // Supervisor override
  finalCountSource?: "ai" | "employee" | "custom";
  approvalStatus?: "pending" | "approved" | "rejected";
  supervisorOverride?: {
    overriddenBy: string;
    overriddenByName?: string;
    overriddenAt: Date;
    aiCount: number;
    employeeCount: number;
    selectedCount: number;
    source: "ai" | "employee" | "custom";
    customCount?: number;
    reason?: string;
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
  // Phithan fields (ฟอร์มเชิญต้องใส่)
  baCode?: string; // รหัส BA / Employee ID
  fullName?: string; // ชื่อ-นามสกุล (TH)
  seller?: string; // Seller / ยี่ห้อที่รับผิดชอบ
  supervisorId?: string; // supervisor ที่ดูแล (สำหรับ employee)
  supervisorName?: string;
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

  // ช่วงเวลา/กะที่เลือก
  selectedShift?: string; // "10:00"

  // ข้อมูลเวลา
  isLate?: boolean;
  isSupplemental?: boolean; // รูปเพิ่มเติม ไม่นับรวมกับจำนวนหลัก
  lateMinutes?: number;
  isEarly?: boolean;
  earlyMinutes?: number;
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
  workShifts?: string[]; // ["10:00", "11:00", "12:00"] หลายกะ
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

// ==================== Shop Count Confirmed (PAShopCount ITP) ====================

export type FinalCountSource = "ai" | "employee" | "custom";

export interface ShopCountConfirmed {
  id: string; // docId = {branchId}_{productId}_{periodId}

  // Period
  periodId: string; // e.g. "2026-03-H1"
  periodHalf: 1 | 2;
  periodMonth: string; // e.g. "2026-03"

  // PAShopCount fields
  submissionId: string; // reference to countingSessions doc
  locationId: string; // branchId
  counterId: string; // userId
  counterName: string;
  countDate: Date;
  item: string; // productId e.g. "SK-C-250"
  barcode: string;
  paTotalQty: number;
  paSellQty: null;
  paTestQty: null;

  // Metadata
  confirmedBy: string;
  confirmedAt: Date;
  source: FinalCountSource;
  originalSessionId: string;
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
