import { RawRow } from "@/types/watson/invoice";
import { PriceListItem } from "@/types/watson/pricelist";
import { PromotionItem } from "@/types/watson/promotion";
import { Timestamp } from "firebase/firestore";

// Collection Names
export const COLLECTIONS = {
  EXPORTS: "watson_exports",
  PRICE_LISTS: "watson_pricelists",
  ACTIVITY_LOGS: "watson_activity_logs",
  API_KEYS: "watson_api_keys",
  // New collections for data sync
  PRICE_IMPORT_HISTORY: "watson_price_import_history",
  INVOICE_UPLOADS: "watson_invoice_uploads",
  ACTIVITY_LOGS_FULL: "watson_activity_logs_full",
  PROMOTION_DATA: "watson_promotion_data",
  CURRENT_PRICE_LIST: "watson_current_pricelist",
} as const;

// Workflow Status
export type WorkflowStatus =
  | "uploaded"
  | "validated"
  | "calculated"
  | "exported"
  | "confirmed"
  | "cancelled";

export type ExportStatus = "draft" | "confirmed" | "cancelled";

// --- Document Interfaces ---

export interface ExportDocument {
  id: string;
  supplierCode: string;
  supplierName?: string;
  reportDate: string;
  exportedAt: Timestamp;
  confirmedAt?: Timestamp;
  confirmedBy?: string;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
  cancelReason?: string;
  status: ExportStatus;
  rowCount: number;
  passedCount: number;
  lowConfidenceCount: number;
  summary: {
    totalRows: number;
    passedRows: number;
    notFoundRows: number;
    noPeriodRows: number;
    lowMatchRows: number;
  };
  headers: string[];
  metadata?: Record<string, unknown>;
  storagePath?: string;
  storageUrl?: string;
  data?: Record<string, unknown>[];
}

export interface ExportStorageData {
  headers: string[];
  data: Record<string, unknown>[];
}

export interface PriceListDocument {
  id: string;
  name: string;
  importedAt: Timestamp;
  itemCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  items: Array<{
    itemCode: string;
    prodCode: string;
    prodName: string;
    priceStartDate: string;
    priceEndDate?: string;
    price: number;
    priceExtVat: number;
    priceIncVat: number;
    remark?: string;
  }>;
}

export interface ActivityLogDocument {
  id: string;
  action: string;
  timestamp: Timestamp;
  details: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

export interface PriceImportHistoryDocument {
  id: string;
  fileName: string;
  importedAt: Timestamp;
  itemCount: number;
  source: "excel" | "json";
  storagePath?: string;
  storageUrl?: string;
  uploader?: {
    id?: string;
    name: string;
    email?: string;
    role?: string;
  };
}

export interface InvoiceUploadDocument {
  id: string;
  fileName: string;
  uploadedAt: Timestamp;
  rowCount: number;
  supplierCode?: string;
  supplierName?: string;
  reportDate?: string;
  storagePath?: string;
  storageUrl?: string;
  status?: WorkflowStatus;
  lastExportId?: string;
  validatedAt?: Timestamp;
  calculatedAt?: Timestamp;
  exportedAt?: Timestamp;
  confirmedAt?: Timestamp;
  uploader?: {
    name: string;
    email?: string;
    id?: string;
  };
}

export interface InvoiceStorageData {
  headers: string[];
  data: RawRow[];
  bulkAcceptedItemCodes?: string[];
  qtyOverrides?: Record<
    string,
    {
      stdQty?: string;
      promoQty?: string;
      qtyBuy1?: string;
      qtyPro?: string;
    }
  >;
}

export interface PriceImportStorageData {
  data: PriceListItem[];
}

export interface ActivityLogFullDocument {
  id: string;
  timestamp: Timestamp;
  action: string;
  description: string;
  details: Record<string, unknown>;
  canUndo: boolean;
  undone: boolean;
  user?: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

export interface PromotionDataDocument {
  id: string;
  updatedAt: Timestamp;
  items: PromotionItem[];
}

export interface CurrentPriceListDocument {
  id: string;
  updatedAt: Timestamp;
  items: PriceListItem[];
}
