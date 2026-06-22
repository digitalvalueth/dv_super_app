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
  branchIds?: string[]; // Multiple branches support
  branchNames?: Record<string, string>; // branchId → branchName map
  role?: UserRole; // Optional until admin assigns
  supervisorId?: string; // ID of supervisor (for employees)
  supervisorName?: string; // Name of supervisor
  photoURL?: string; // Profile picture URL from Firebase Auth
  status?: UserStatus; // active | inactive | suspended
  // Phithan fields
  baCode?: string; // รหัส BA / Employee ID
  fullName?: string; // ชื่อ-นามสกุล (TH)
  seller?: string; // ยี่ห้อ/seller ที่รับผิดชอบ
  sellerCategory?: string; // Alias used by web dashboard imports
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
  branchCode?: string;
  branchIds?: string[];
  branchNames?: Record<string, string>;
  managedBranchIds?: string[];
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
  baCode?: string;
  fullName?: string;
  seller?: string;
  sellerCategory?: string;
  supervisorId?: string;
  supervisorName?: string;
  supervisorEmail?: string;
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
  // Geofence — สำหรับเช็คอิน / รูปถ่าย ว่าอยู่ในพื้นที่สาขาจริง
  latitude?: number;
  longitude?: number;
  radiusMeters?: number; // default 200m
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

  // Unit of Measure (UOM)
  unitType?: "piece" | "box"; // ชิ้น หรือ กล่อง (default: piece)
  unitsPerBox?: number; // จำนวนชิ้นต่อกล่อง (เฉพาะ unitType=box)
  linkedProductId?: string; // productId ของสินค้าชิ้นที่กล่องนี้บรรจุ (เฉพาะ unitType=box)

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

export type AssignmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "not_available"; // ไม่มีสินค้านี้ในสาขา

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

  // Counting period attribution
  periodId?: string; // e.g. 2026-03-H2
  periodMonth?: string; // e.g. 2026-03
  periodHalf?: CountingPeriodHalf;

  // Product info
  productName?: string;
  productSKU?: string;
  barcode?: string;
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
  isLate?: boolean; // ส่งในช่วง grace period (ลับ)
  isSupplemental?: boolean; // รูปเพิ่มเติม ไม่นับรวมกับจำนวนหลัก

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
  assignmentBranchId?: string; // Which branch this assignment belongs to
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

  // ช่วงเวลา/กะที่เลือก
  selectedShift?: string; // "10:00"

  // ข้อมูลเวลา
  isLate?: boolean;
  lateMinutes?: number;
  isEarly?: boolean;
  earlyMinutes?: number;
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
  workShifts?: string[]; // ["10:00", "11:00", "12:00"] หลายกะ
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

// ==================== Daily Sale ====================
export type SaleType = "normal" | "promotion";

export interface DailySaleItem {
  barcode: string;
  productDescription: string;
  productImageUrl?: string;
  price: number;
  quantity: number;
  revenue: number; // price * quantity
  saleType: SaleType;
  hasFreebie: boolean;
  freebieBarcode?: string;
  freebieDescription?: string;
  promotionRemark?: string; // promo remark from Watson promotion master (e.g. "Buy 1", "SAVE")
}

export interface DailySale {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  employeeId: string; // uid
  baCode?: string; // รหัส BA
  employeeName: string;
  supervisorId?: string;
  supervisorName?: string;
  seller?: string; // ยี่ห้อ/Seller ที่รับผิดชอบ
  saleDate: string; // "YYYY-MM-DD"
  saleType?: SaleType; // kept for legacy; per-item saleType is in items[]
  workDescription?: string;
  imageUrl?: string;
  items: DailySaleItem[];
  totalItems: number;
  totalRevenue: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ==================== Counting Period ====================
export type CountingPeriodStatus = "active" | "locked" | "grace" | "closed";
export type CountingPeriodHalf = 1 | 2;

export interface CountingPeriod {
  id: string;
  companyId: string;
  year: number;
  month: number; // 1-12
  half: CountingPeriodHalf; // 1 = วันที่ 1-15, 2 = วันที่ 16-สิ้นเดือน
  startDate: Timestamp; // วันเปิดให้ถ่าย (เช่น 2 มี.ค.)
  endDate: Timestamp; // วันสุดท้ายของรอบ (เช่น 15 มี.ค.)
  lockDates: Timestamp[]; // วันที่ห้าม upload ทั้งวัน (1, 16)
  graceEndDate: Timestamp; // endDate + 5 วัน (ลับ)
  supervisorGraceEndDate?: Timestamp; // Supervisor ขยายเวลา grace (ลับ)
  status: CountingPeriodStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type UploadStatus = "open" | "locked" | "grace" | "closed";

// ==================== Supervisor Override ====================
export type FinalCountSource = "ai" | "employee" | "custom";

export interface SupervisorOverride {
  overriddenBy: string;
  overriddenByName?: string;
  overriddenAt: Timestamp;
  aiCount: number;
  employeeCount: number;
  selectedCount: number;
  source: FinalCountSource;
  customCount?: number;
  reason?: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

// ==================== Supplement Session ====================
export type SupplementStatus = "pending" | "approved" | "rejected";

export interface SupplementSession {
  id: string;
  originalSessionId: string;
  userId: string;
  userName?: string;
  productId: string;
  productName?: string;
  companyId: string;
  branchId: string;
  additionalCount: number;
  imageUrl: string;
  aiCount: number;
  reason: string;
  status: SupplementStatus;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ==================== Shop Count Confirmed (PAShopCount ITP) ====================

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
  countDate: Timestamp;
  item: string; // productId e.g. "SK-C-250"
  barcode: string;
  paTotalQty: number;
  paSellQty: null;
  paTestQty: null;

  // Metadata
  confirmedBy: string;
  confirmedAt: Timestamp;
  source: FinalCountSource;
  originalSessionId: string;
}

// ==================== Prompt Management ====================
export type PromptCategory = "counting" | "barcode" | "product_detection";
export type PromptPlatform = "mobile" | "web" | "all";

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  modelId: string;
  version: number;
  isActive: boolean;
  platform: PromptPlatform;
  category: PromptCategory;
  variables: string[];
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PromptUsageLog {
  id: string;
  promptId: string;
  promptName?: string;
  version: number;
  userId: string;
  result: "success" | "failure";
  responseTime: number;
  errorMessage?: string;
  createdAt: Timestamp;
}

// ==================== Missing Check-in Alert ====================
export type AlertStatus = "new" | "tracking" | "resolved";

export interface MissingCheckInAlert {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  supervisorId?: string;
  supervisorName?: string;
  missedDays: number;
  lastCheckInDate?: Timestamp;
  status: AlertStatus;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  resolvedNote?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ==================== SHOP STOCK RECEIVE ====================

export interface ShopStockReceiveItem {
  productId: string;
  barcode: string;        // ค่าที่สแกนได้ (อาจตรงกับ sku)
  sku?: string;
  productName: string;
  salesQty: number;
  testQty: number;
  mktQty: number;
}

export type ShopStockReceiveSyncStatus = "pending" | "synced";

export interface ShopStockReceive {
  id: string;
  transferNumber: string;   // "SR-20260617-7"
  branchCode: string;       // "BL 41060" (ตามที่อยู่ใน QR)
  companyId: string;
  branchId: string;
  branchName?: string;
  items: ShopStockReceiveItem[];
  totalItems: number;
  receivedBy: string;       // userId (uid)
  receivedByName: string;
  receivedByEmail?: string;
  receivedAt: Timestamp;
  imageUrl: string;         // รูปยืนยันการรับ (Storage download URL)
  watermarkData?: WatermarkDataStored;
  notes?: string;
  syncStatus: ShopStockReceiveSyncStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
