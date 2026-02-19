// Types for Watson Invoice Data

export interface InvoiceRow {
  rowIndex: number;
  supplier: string;
  supplierName: string;
  address1: string;
  address2: string;
  address3: string;
  contactName: string;
  contactPhoneFax: string;
  invoiceNo: string;
  currency: string;
  store: number | string;
  date: string;
  itemCode: number | string;
  itemDescription: string;
  qty: number | string;
  gpPercent: number | string;
  totalCostExclusive: number | string;
  vatPercent: number | string;
}

export interface RawRow {
  [key: string]: string | number | null | undefined;
}

export interface ValidationError {
  rowIndex: number;
  columnName: string;
  columnIndex: number;
  message: string;
  severity: "error" | "warning";
  currentValue: string | number | null;
  suggestedFix?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows?: number;
}

export interface CellPosition {
  rowIndex: number;
  columnIndex: number;
}

export interface EditHistoryItem {
  timestamp: number;
  rowIndex: number;
  columnIndex: number;
  oldValue: string | number | null;
  newValue: string | number | null;
  action: "edit" | "shift-left" | "shift-right" | "clear" | "auto-fix";
}

export interface DataState {
  data: RawRow[];
  headers: string[];
  editHistory: EditHistoryItem[];
  currentHistoryIndex: number;
}

export const COLUMN_CONFIG = [
  { key: "supplier", label: "Supplier", type: "text", required: true },
  { key: "supplierName", label: "Supplier Name", type: "text", required: true },
  { key: "address1", label: "Address 1", type: "text", required: false },
  { key: "address2", label: "Address 2", type: "text", required: false },
  { key: "address3", label: "Address 3", type: "text", required: false },
  { key: "contactName", label: "Contact Name", type: "text", required: false },
  {
    key: "contactPhoneFax",
    label: "Contact Phone/Fax",
    type: "text",
    required: false,
  },
  { key: "invoiceNo", label: "Invoice No.", type: "text", required: true },
  { key: "currency", label: "Currency", type: "text", required: true },
  { key: "store", label: "Store", type: "number", required: true },
  { key: "date", label: "Date", type: "date", required: true },
  { key: "itemCode", label: "Item Code", type: "number", required: true },
  {
    key: "itemDescription",
    label: "Item Description",
    type: "text",
    required: true,
  },
  { key: "qty", label: "Qty", type: "number", required: true },
  { key: "gpPercent", label: "GP%", type: "number", required: true },
  {
    key: "totalCostExclusive",
    label: "Total Cost Exclusive",
    type: "number",
    required: true,
  },
  { key: "vatPercent", label: "VAT %", type: "text", required: true },
] as const;

export type ColumnKey = (typeof COLUMN_CONFIG)[number]["key"];
