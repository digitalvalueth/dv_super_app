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
  photoURL?: string;
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
  sellerCode: string;
  category?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
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

export interface CountingSession {
  id: string;
  assignmentId: string;
  userId: string;
  productId: string;
  companyId: string;
  branchId: string;

  // Count data
  beforeCountQty: number;
  currentCountQty: number;
  manualAdjustedQty?: number;
  variance: number; // beforeCountQty - currentCountQty

  // Photo & AI
  imageUrl: string;
  aiConfidence?: number;
  aiModel?: string;
  processingTime?: number; // milliseconds

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

export interface ProductWithAssignment extends Product {
  productId?: string; // SK-C-250 (field in Firestore document)
  assignment?: UserAssignment;
  status: AssignmentStatus;
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
