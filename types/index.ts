import { Timestamp } from "firebase/firestore";

// ==================== User & Auth ====================

export interface User {
  uid: string;
  email: string;
  name: string;
  companyId?: string; // Optional until admin assigns
  companyCode?: string;
  companyName?: string;
  branchId?: string; // Optional until admin assigns
  branchCode?: string;
  branchName?: string;
  role?: UserRole; // Optional until admin assigns
  supervisorId?: string; // ID of supervisor (for employees)
  supervisorName?: string; // Name of supervisor
  photoURL?: string; // Profile picture URL from Firebase Auth
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type UserRole = "super_admin" | "admin" | "supervisor" | "employee";

export type UserStatus = "active" | "inactive" | "suspended";

// ==================== Notification ====================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  read: boolean;
  createdAt: Timestamp;
  readAt?: Timestamp;
}

export type NotificationType =
  | "company_invite" // คำเชิญเข้าบริษัท
  | "branch_transfer" // แจ้งย้ายสาขา
  | "role_change" // เปลี่ยน role
  | "access_approved" // อนุมัติการเข้าถึง
  | "access_rejected" // ปฏิเสธการเข้าถึง
  | "system"; // แจ้งเตือนจากระบบ

export interface NotificationData {
  companyId?: string;
  companyName?: string;
  branchId?: string;
  branchName?: string;
  fromBranchId?: string;
  fromBranchName?: string;
  toBranchId?: string;
  toBranchName?: string;
  newRole?: UserRole | string;
  role?: string;
  actionRequired?: boolean;
  actionType?: "accept" | "reject" | "accept_reject";
  status?: "accepted" | "rejected" | "pending";
  invitationId?: string;
}

// ==================== Company ====================

export interface Company {
  id: string;
  name: string;
  code: string;
  logoUrl?: string;
  status: CompanyStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type CompanyStatus = "active" | "inactive" | "suspended";

// ==================== Branch ====================

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ==================== Product ====================

export interface Product {
  id: string;
  companyId: string;
  branchId?: string;
  sku: string;
  name: string;
  description?: string;
  barcode: string;
  category?: string;
  series?: string; // Series ของสินค้า
  imageUrl?: string;

  // Employee-added product tracking
  status?: ProductStatus; // สถานะสินค้า
  isUserCreated?: boolean; // พนักงานเพิ่มหรือไม่
  createdBy?: string; // userId ที่เพิ่ม
  createdByName?: string; // ชื่อผู้เพิ่ม
  verifiedBy?: string; // userId ที่ยืนยัน
  verifiedByName?: string; // ชื่อผู้ยืนยัน
  verifiedAt?: Timestamp; // เวลาที่ยืนยัน
  rejectionReason?: string; // เหตุผลที่ปฏิเสธ (ถ้ามี)

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type ProductStatus =
  | "active" // สินค้าปกติ (จาก admin หรือยืนยันแล้ว)
  | "pending_verification" // รอตรวจสอบจากคลัง
  | "verified" // ยืนยันแล้ว - พบในคลัง
  | "rejected"; // ปฏิเสธ - ไม่พบในคลัง

// ==================== Skipped Product ====================

export interface SkippedProduct {
  id: string;
  userId: string;
  productId: string;
  reason: string;
  skippedAt: Timestamp;
}

// ==================== User Assignment ====================

export interface UserAssignment {
  id: string;
  userId: string;
  companyId: string;
  branchId: string;
  productId: string;

  // Monthly target
  assignedDate: Timestamp;
  dueDate: Timestamp;

  // Previous count
  beforeCountQty: number;

  // Status tracking
  status: AssignmentStatus;
  countedAt?: Timestamp | null;

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type AssignmentStatus = "pending" | "in_progress" | "completed";

// ==================== Counting Session ====================

export type CountingSessionStatus =
  | "pending"
  | "analyzed"
  | "mismatch"
  | "completed"
  | "pending-review"
  | "approved"
  | "rejected";

export interface CountingSession {
  id: string;
  assignmentId: string;
  userId: string;
  productId: string;
  companyId: string;
  branchId: string;

  // Product info
  productName?: string;
  productSKU?: string;
  branchName?: string;

  // User info
  userName?: string;
  userEmail?: string;

  // Count data
  beforeCountQty: number;
  currentCountQty: number;
  manualAdjustedQty?: number;
  variance: number; // beforeCountQty - currentCountQty
  manualCount?: number;
  finalCount?: number;
  standardCount?: number;
  discrepancy?: number;

  // Photo & AI
  imageUrl: string;
  imageURL?: string; // Backward compatibility
  aiCount?: number;
  aiConfidence?: number;
  aiModel?: string;
  processingTime?: number; // milliseconds

  // Status
  status: CountingSessionStatus;

  // Location
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };

  // Counted by
  countedBy?: {
    id: string;
    name: string;
    email?: string;
  };

  // Optional fields
  remarks?: string;
  hasBarcodeScan?: boolean;

  // Metadata
  deviceInfo?: string;
  appVersion?: string;

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ==================== Counting History (for UI list) ====================

export interface CountingHistory {
  sessionId: string;
  productName: string;
  productSKU: string;
  productImage?: string;
  currentCountQty: number;
  beforeCountQty: number;
  variance: number;
  countedAt: Timestamp;
}

// ==================== UI Types ====================

export interface ProductWithAssignment extends Omit<Product, "status"> {
  productId?: string; // SK-C-250 (field in Firestore document)
  assignment?: UserAssignment;
  assignmentStatus: AssignmentStatus; // Renamed to avoid conflict with Product.status
  status?: AssignmentStatus; // Keep for backward compatibility
  beforeCountQty?: number;
  currentCountQty?: number;
  variance?: number;
  lastCountedAt?: Timestamp | null;
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GeminiCountResult {
  count: number;
  confidence: number;
  processingTime: number;
}

// ==================== Form Types ====================

export interface CountingFormData {
  productId: string;
  imageUri: string;
  currentCountQty: number;
  remarks?: string;
  hasBarcodeScan: boolean;
}

// ==================== Navigation Types ====================

export type RootStackParamList = {
  "(login)": undefined;
  "(app)": undefined;
};

export type AuthStackParamList = {
  login: undefined;
};

export type AppStackParamList = {
  "(home)": undefined;
  "(counting)": undefined;
  "(history)": undefined;
  "(profile)": undefined;
};

export type HomeStackParamList = {
  index: undefined;
  "[productId]": { productId: string };
};

export type CountingStackParamList = {
  camera: { productId: string; productName: string };
  preview: { productId: string; imageUri: string };
  result: { sessionId: string };
};

export type HistoryStackParamList = {
  index: undefined;
  "[sessionId]": { sessionId: string };
};

export type ProfileStackParamList = {
  index: undefined;
};

// ==================== Check-in Types ====================

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

  createdAt: Timestamp;
  updatedAt?: Timestamp;
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
  createdAt: Timestamp;
  updatedAt?: Timestamp;
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

// ==================== Delivery / Shipment Types ====================

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
  unit?: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  companyId: string;

  // ปลายทาง
  branchId: string;
  branchName?: string;

  // สินค้า
  products: ShipmentProduct[];
  totalItems: number;

  // พนักงานส่ง
  deliveryPersonName?: string;
  deliveryCompany?: string;
  deliveryPhone?: string;

  // สถานะ
  status: ShipmentStatus;
  estimatedDelivery?: Timestamp;

  // Metadata
  notes?: string;
  remarks?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type DeliveryReceiveStatus = "received" | "verified" | "issue";

// WatermarkData stored in Firestore (timestamp as string for serialization)
export interface WatermarkDataStored {
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
}

export interface DeliveryReceive {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  companyId: string;
  branchId: string;
  branchName?: string;

  // สินค้าที่รับ
  products: ShipmentProduct[];
  totalItems: number;

  // พนักงานส่ง
  deliveryPersonName?: string;
  deliveryCompany?: string;

  // พนักงานรับ
  receivedBy: string;
  receivedByName: string;
  receivedByEmail?: string;
  receivedAt: Timestamp;

  // รูปภาพ + Watermark
  imageUrl: string;
  watermarkData?: WatermarkDataStored;

  // สถานะ
  status: DeliveryReceiveStatus;
  notes?: string;
  remarks?: string;

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
