"use client";

import { Badge } from "@/components/watson/ui/badge";
import { Button } from "@/components/watson/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/watson/ui/card";
import { Input } from "@/components/watson/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/watson/ui/table";
import { toast } from "@/components/watson/ui/toast-provider";
import { PriceImportRecord } from "@/hooks/watson/usePriceImportHistory";
import {
  ItemPriceHistory,
  PriceListItem,
  PriceListSummary,
} from "@/types/watson/pricelist";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileSpreadsheet,
  Library,
  Loader2,
  Package,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Fragment, useCallback, useRef, useState } from "react";
import { ImportResultModal } from "./ImportResultModal";
import { SheetSelectorDialog } from "./SheetSelectorDialog";

interface SheetInfo {
  name: string;
  rowCount: number;
  headers: string[];
}

interface MergeResult {
  added: number;
  updated: number;
  addedItems: PriceListItem[];
  updatedItems: PriceListItem[];
}

interface PriceListSidebarProps {
  priceHistory: ItemPriceHistory[];
  summary: PriceListSummary;
  onImport: (data: PriceListItem[]) => void;
  onMerge?: (data: PriceListItem[]) => MergeResult;
  onClear: () => void;
  isInline?: boolean;
  // Import history
  importHistory?: PriceImportRecord[];
  onSaveHistory?: (
    fileName: string,
    source: "excel" | "json",
    data: PriceListItem[],
  ) => void;
  /** Called after a server-side upload that already saved to Firestore.
   *  Receives the real Firestore document ID. */
  onHistoryAdd?: (
    id: string,
    fileName: string,
    source: "excel" | "json",
    data: PriceListItem[],
  ) => void;
  onReimportFromHistory?: (record: PriceImportRecord) => void;
  onRemoveHistory?: (id: string) => void;
  onClearHistory?: () => void;
  onLoadHistoryData?: (record: PriceImportRecord) => Promise<PriceListItem[]>;
  // Raw price list for search display
  priceListRaw?: PriceListItem[];
  // Current user for uploader tracking
  currentUser?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

export function PriceListSidebar({
  priceHistory,
  summary,
  onImport,
  onMerge,
  onClear,
  isInline = false,
  importHistory = [],
  onSaveHistory,
  onHistoryAdd,
  onReimportFromHistory,
  onRemoveHistory,
  onClearHistory,
  onLoadHistoryData,
  priceListRaw = [],
  currentUser,
}: PriceListSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Sheet selector state
  const [showSheetSelector, setShowSheetSelector] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);
  const [pendingExcelBuffer, setPendingExcelBuffer] =
    useState<ArrayBuffer | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("");

  // Import result modal state
  const [showImportResult, setShowImportResult] = useState(false);
  const [importResultData, setImportResultData] = useState<{
    fileName: string;
    addedItems: PriceListItem[];
    updatedItems: PriceListItem[];
    source: "excel" | "json";
  } | null>(null);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Filter items by search (item code, prod code, prod name, remark)
  const filteredItems = priceHistory.filter((item) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    // Search in basic fields
    if (item.itemCode.toLowerCase().includes(term)) return true;
    if (item.prodCode.toLowerCase().includes(term)) return true;
    if (item.prodName.toLowerCase().includes(term)) return true;
    // Search in period remarks
    if (
      item.periods.some(
        (p) => p.remark && p.remark.toLowerCase().includes(term),
      )
    )
      return true;
    // Search in raw items for more fields
    const rawItems = priceListRaw.filter((r) => r.itemCode === item.itemCode);
    if (
      rawItems.some(
        (r) =>
          r.remarki1?.toLowerCase().includes(term) ||
          r.prodName?.toLowerCase().includes(term),
      )
    )
      return true;
    return false;
  });

  // Helper: parse Excel date (serial number or string)
  const parseExcelDate = useCallback((dateVal: unknown): string => {
    if (typeof dateVal === "number") {
      // Excel serial date
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateVal * 86400000);
      return date.toISOString();
    } else if (typeof dateVal === "string" && dateVal.trim()) {
      // Try parsing various date formats (DD/MM/YYYY, YYYY-MM-DD, etc.)
      const trimmed = dateVal.trim();
      // Check if DD/MM/YYYY format
      const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        return new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
        ).toISOString();
      }
      // Try standard parsing
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    return "";
  }, []);

  // Get sheet info from workbook
  const getSheetInfo = useCallback(
    async (buffer: ArrayBuffer): Promise<SheetInfo[]> => {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "array" });

      return workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const rawData =
          XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const headers =
          rawData.length > 0
            ? Object.keys(rawData[0]).map((h) =>
                h.trim().replace(/\u00a0/g, " "),
              )
            : [];
        return {
          name,
          rowCount: rawData.length,
          headers,
        };
      });
    },
    [],
  );

  // Parse Excel buffer to PriceListItem[] with specific sheet
  const parseExcelBuffer = useCallback(
    async (
      buffer: ArrayBuffer,
      sheetName?: string,
    ): Promise<PriceListItem[]> => {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "array" });
      const targetSheet = sheetName || workbook.SheetNames[0];
      const sheet = workbook.Sheets[targetSheet];
      const rawJsonData =
        XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      // Normalize row keys: trim whitespace & non-breaking spaces from all keys
      // Watson Excel files often have leading/trailing spaces in column headers
      const rawData = rawJsonData.map((row) => {
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          normalized[key.trim().replace(/\u00a0/g, " ")] = value;
        }
        return normalized;
      });

      // Helper: find a value by trying multiple header name variants
      // Uses normalized (trimmed) keys, so leading/trailing spaces are handled
      const findVal = (
        row: Record<string, unknown>,
        ...variants: string[]
      ): unknown => {
        for (const v of variants) {
          if (row[v] !== undefined && row[v] !== null) return row[v];
        }
        // Fuzzy match: normalize both sides (lowercase, collapse spaces)
        const normalize = (s: string) =>
          s.toLowerCase().replace(/\s+/g, "").replace(/%/g, "pct");
        const rowKeys = Object.keys(row);
        for (const v of variants) {
          const nv = normalize(v);
          for (const k of rowKeys) {
            if (normalize(k) === nv) return row[k];
          }
        }
        return undefined;
      };

      // Helper: safely parse number, handling currency symbols (฿) and commas
      const safeNumber = (val: unknown): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const cleaned = val.replace(/[฿$,\s]/g, "").trim();
          const num = Number(cleaned);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };

      const priceListItems: PriceListItem[] = rawData.map((row) => {
        // Parse Start date - new column mapping
        const startDateVal = findVal(
          row,
          "Start",
          "start",
          "priceStartDate",
          "Price Start Date",
          "date",
          "Date",
        );
        const priceStartDate = parseExcelDate(startDateVal);

        // Parse End date (optional)
        const endDateVal = findVal(row, "End", "end");
        const priceEndDate = parseExcelDate(endDateVal);

        // Get item code - support WatsonCode as primary
        const itemCode = String(
          findVal(
            row,
            "WatsonCode",
            "watsonCode",
            "Watson Code",
            "itemCode",
            "Item Code",
            "ItemCode",
          ) ?? "",
        );

        // Get product code (Barcode)
        const prodCode = String(
          findVal(
            row,
            "Barcode",
            "barcode",
            "prodCode",
            "Prod Code",
            "ProdCode",
          ) ?? "",
        );

        // Get product name
        const prodName = String(
          findVal(
            row,
            "ItemName",
            "itemName",
            "Item Name",
            "prodName",
            "Prod Name",
            "ProdName",
          ) ?? "",
        );

        // Get Standard Price IncV
        const standardPriceIncV = safeNumber(
          findVal(
            row,
            "Standard Price IncV",
            "StandardPriceIncV",
            "Standard Price",
            "price",
            "Price",
          ),
        );

        // Get Comm Price IncV (promotional/commission price)
        // Watson files have typos & trailing spaces: "Comm Price IncV "
        const commPriceIncV = safeNumber(
          findVal(
            row,
            "Comm Price IncV",
            "CommPriceIncV",
            "Comm Price",
            "priceIncVat",
            "Price Inc VAT",
          ),
        );

        // Get Invoice 62% IncV
        // Watson files have typos: "Invoce62% IncV" (missing 'i' and no space)
        const invoice62IncV = safeNumber(
          findVal(
            row,
            "Invoice 62%  IncV",
            "Invoice 62% IncV",
            "Invoice62IncV",
            "Invoce62% IncV",
            "Invoice62% IncV",
          ),
        );

        // Get Invoice 62% ExcV
        // Watson files have typos: "Incoice 62% ExV" (typo + ExV not ExcV)
        const invoice62ExcV = safeNumber(
          findVal(
            row,
            "Invoice 62%  ExcV",
            "Invoice 62% ExcV",
            "Invoice62ExcV",
            "Incoice 62% ExV",
            "Invoice 62% ExV",
          ),
        );

        // Get Remark
        const remark = String(
          findVal(row, "Remark", "remark", "remarki1", "Remark1") ?? "",
        );

        return {
          itemCode,
          prodCode,
          prodName,
          priceStartDate,
          priceEndDate,
          qty: safeNumber(findVal(row, "qty", "Qty", "QTY")) || 1,
          price: standardPriceIncV,
          discamti: safeNumber(
            findVal(row, "discamti", "Discount", "Discamti"),
          ),
          priceIncVat: commPriceIncV || standardPriceIncV,
          priceExtVat:
            invoice62ExcV || (commPriceIncV || standardPriceIncV) / 1.07,
          priceExtVatSt: safeNumber(findVal(row, "priceExtVatSt")),
          remarki1: remark,
          remarki2: String(findVal(row, "remarki2", "Remark2") ?? ""),
          // Store extra fields for reference
          standardPriceIncV,
          commPriceIncV,
          invoice62IncV,
          invoice62ExcV,
        } as PriceListItem;
      });

      return priceListItems.filter(
        (item) =>
          item.itemCode && (item.priceExtVat > 0 || item.priceIncVat > 0),
      );
    },
    [parseExcelDate],
  );

  // Process valid items (merge or replace) and save history
  const processImportedItems = useCallback(
    (
      validItems: PriceListItem[],
      fileName: string,
      source: "excel" | "json",
    ) => {
      if (validItems.length === 0) {
        toast.error(
          "ไม่พบข้อมูลที่ถูกต้อง",
          "กรุณาตรวจสอบ column headers ในไฟล์",
        );
        return;
      }

      // Store items for modal before any state changes
      let resultAddedItems: PriceListItem[] = [];
      let resultUpdatedItems: PriceListItem[] = [];

      // Process import
      if (onMerge && source === "excel") {
        const { addedItems, updatedItems } = onMerge(validItems);
        resultAddedItems = addedItems || [];
        resultUpdatedItems = updatedItems || [];
      } else {
        onImport(validItems);
        resultAddedItems = validItems;
        resultUpdatedItems = [];
      }

      // Save to history
      onSaveHistory?.(fileName, source, validItems);

      // Show modal after all state changes with slight delay to ensure render
      setTimeout(() => {
        setImportResultData({
          fileName,
          addedItems: resultAddedItems,
          updatedItems: resultUpdatedItems,
          source,
        });
        setShowImportResult(true);
      }, 100);
    },
    [onMerge, onImport, onSaveHistory],
  );

  // Handle Excel file upload (merge/add)
  const handleExcelUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      toast.info("กำลังอัปโหลดและประมวลผลไฟล์...", file.name);

      const formData = new FormData();
      formData.append("file", file);

      // Attach user info from prop
      if (currentUser) {
        formData.append(
          "uploader",
          JSON.stringify({
            id: currentUser.id,
            name: currentUser.name || currentUser.email || "Unknown",
            email: currentUser.email,
            role: currentUser.role,
          }),
        );
      }

      const response = await fetch("/api/watson/price-import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      const validItems = result.data as PriceListItem[];
      const fileName = file.name;

      toast.success("อัปโหลดสำเร็จ", `พบข้อมูล ${validItems.length} รายการ`);

      if (validItems.length === 0) {
        toast.error("ไม่พบข้อมูลที่ถูกต้องในไฟล์");
        return;
      }

      // Update import history with the real Firestore document ID
      onHistoryAdd?.(result.id, fileName, "excel", validItems);

      let resultAddedItems: PriceListItem[] = [];
      let resultUpdatedItems: PriceListItem[] = [];

      if (onMerge) {
        const mergeResult = onMerge(validItems);
        resultAddedItems = mergeResult.addedItems;
        resultUpdatedItems = mergeResult.updatedItems;
      } else {
        onImport(validItems);
        resultAddedItems = validItems;
        resultUpdatedItems = [];
      }

      setTimeout(() => {
        setImportResultData({
          fileName,
          addedItems: resultAddedItems,
          updatedItems: resultUpdatedItems,
          source: "excel",
        });
        setShowImportResult(true);
      }, 100);
    } catch (error) {
      console.error("Excel import error:", error);
      toast.error(
        "เกิดข้อผิดพลาดในการอ่านไฟล์",
        error instanceof Error
          ? error.message
          : "โปรดตรวจสอบรูปแบบไฟล์ (.xlsx, .xls)",
      );
    }

    // Reset input
    event.target.value = "";
  };

  // Process an Excel file (used by both input and drag-drop)
  const processExcelFile = useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        const sheets = await getSheetInfo(buffer);

        // If multiple sheets, show selector dialog
        if (sheets.length > 1) {
          setPendingExcelBuffer(buffer);
          setPendingFileName(file.name);
          setAvailableSheets(sheets);
          setShowSheetSelector(true);
        } else {
          // Single sheet - process directly
          const validItems = await parseExcelBuffer(buffer);
          processImportedItems(validItems, file.name, "excel");
        }
      } catch (error) {
        console.error("Excel parse error:", error);
        toast.error("อ่านไฟล์ไม่สำเร็จ", "ไม่สามารถอ่านไฟล์ Excel ได้");
      }
    },
    [getSheetInfo, parseExcelBuffer, processImportedItems],
  );

  // Handle sheet selection from dialog
  const handleSheetSelect = useCallback(
    async (sheetName: string) => {
      if (!pendingExcelBuffer) return;

      try {
        const validItems = await parseExcelBuffer(
          pendingExcelBuffer,
          sheetName,
        );
        processImportedItems(
          validItems,
          `${pendingFileName} [${sheetName}]`,
          "excel",
        );
      } catch (error) {
        console.error("Excel parse error:", error);
        toast.error(
          "อ่าน Sheet ไม่สำเร็จ",
          "ไม่สามารถอ่านข้อมูลจาก Sheet นี้ได้",
        );
      } finally {
        setPendingExcelBuffer(null);
        setPendingFileName("");
        setAvailableSheets([]);
      }
    },
    [
      pendingExcelBuffer,
      pendingFileName,
      parseExcelBuffer,
      processImportedItems,
    ],
  );

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const excelFile = files.find((f) => /\.(xlsx|xls)$/i.test(f.name));

      if (excelFile) {
        await processExcelFile(excelFile);
      } else {
        toast.warning(
          "ไฟล์ไม่ถูกต้อง",
          "กรุณาลากไฟล์ .xls หรือ .xlsx เท่านั้น",
        );
      }
    },
    [processExcelFile],
  );

  // Handle re-import from history
  const handleReimport = useCallback(
    async (record: PriceImportRecord) => {
      // If data is not loaded yet, try to load it
      let dataToImport = record.data;

      if (!dataToImport && onLoadHistoryData) {
        try {
          dataToImport = await onLoadHistoryData(record);
        } catch {
          toast.error(
            "ไม่สามารถโหลดข้อมูลได้",
            "เกิดข้อผิดพลาดในการโหลดข้อมูลประวัติ",
          );
          return;
        }
      }

      if (!dataToImport) {
        toast.error("ไม่พบข้อมูล", "ข้อมูลประวัติอาจถูกลบไปแล้ว");
        return;
      }

      if (onReimportFromHistory) {
        onReimportFromHistory({ ...record, data: dataToImport });
      } else {
        // Default: just import the data and show modal
        if (onMerge && record.source === "excel") {
          const { addedItems, updatedItems } = onMerge(dataToImport);
          // Show modal with details
          setImportResultData({
            fileName: `${record.fileName} (Re-import)`,
            addedItems: addedItems || [],
            updatedItems: updatedItems || [],
            source: record.source,
          });
          setShowImportResult(true);
        } else {
          onImport(dataToImport);
          // For JSON replace all, show all items as added
          setImportResultData({
            fileName: `${record.fileName} (Re-import)`,
            addedItems: dataToImport,
            updatedItems: [],
            source: record.source,
          });
          setShowImportResult(true);
        }
      }
    },
    [onReimportFromHistory, onMerge, onImport, onLoadHistoryData],
  );

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "เมื่อกี้";
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  // Format date
  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  // Inline mode - simpler layout without Card wrapper
  if (isInline) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Upload & Summary */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50">
              {summary.totalItems} สินค้า
            </Badge>
            <Badge variant="outline" className="bg-blue-50">
              {summary.totalPeriods} ช่วงราคา
            </Badge>
            {summary.dateRange.earliest && summary.dateRange.latest && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(summary.dateRange.earliest)} -{" "}
                {formatDate(summary.dateRange.latest)}
              </span>
            )}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            className="hidden"
          />

          {/* Drag & Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => excelInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
              isDragOver
                ? "border-green-500 bg-green-50 scale-[1.02]"
                : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50"
            }`}
          >
            <FileSpreadsheet
              className={`h-8 w-8 mx-auto mb-2 transition-colors ${
                isDragOver ? "text-green-500" : "text-gray-400"
              }`}
            />
            <p className="text-sm font-medium text-gray-600">
              {isDragOver ? "วางไฟล์ที่นี่!" : "ลากไฟล์มาวางที่นี่"}
            </p>
            <p className="text-xs text-gray-400 mt-1">หรือคลิกเพื่อเลือกไฟล์</p>
            <p className="text-xs text-gray-400 mt-1">
              รองรับไฟล์ .xls และ .xlsx
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {summary.totalItems > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                title="Clear all price list"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>

          {/* Import History */}
          {importHistory.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-indigo-600 transition-colors w-full"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>ไฟล์ที่เคย Import ({importHistory.length})</span>
                {showHistory ? (
                  <ChevronUp className="h-3 w-3 ml-auto" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-auto" />
                )}
              </button>

              {showHistory && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {importHistory.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center gap-2 p-2 bg-white border rounded-lg hover:bg-gray-50 group text-xs"
                    >
                      {/* File icon or Loader */}
                      {record.isLoading ? (
                        <Loader2 className="h-4 w-4 text-indigo-600 animate-spin shrink-0" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                      )}

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium text-gray-700 truncate ${record.isLoading ? "opacity-50" : ""}`}
                        >
                          {record.fileName}
                        </p>
                        <p className="text-gray-400">
                          {record.itemCount} รายการ ·{" "}
                          {formatRelativeTime(record.importedAt)}
                          {record.uploader && (
                            <>
                              {" · "}
                              <span className="inline-flex items-center gap-1">
                                <span className="w-3.5 h-3.5 rounded-full bg-indigo-100 text-indigo-700 inline-flex items-center justify-center text-[9px] font-bold">
                                  {record.uploader.name.charAt(0)}
                                </span>
                                {record.uploader.name}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div
                        className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${record.isLoading ? "hidden" : ""}`}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReimport(record);
                          }}
                          title="Import อีกครั้ง"
                          className="h-6 w-6 p-0"
                        >
                          <RotateCcw className="h-3 w-3 text-indigo-600" />
                        </Button>
                        {onRemoveHistory && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveHistory(record.id);
                            }}
                            title="ลบออกจาก History"
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Clear History */}
                  {onClearHistory && importHistory.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onClearHistory}
                      className="w-full text-xs text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      ล้าง History ทั้งหมด
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {summary.totalItems === 0 && importHistory.length === 0 && (
            <div className="text-center py-2 text-gray-400">
              <p className="text-xs">ยังไม่มีข้อมูล Price List</p>
              <p className="text-xs mt-1">
                ลาก Excel มาวางหรือคลิกเพื่อเริ่มต้น
              </p>
            </div>
          )}
        </div>

        {/* Right: Items List */}
        {summary.totalItems > 0 && (
          <div className="lg:col-span-2 space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
              <Input
                placeholder="ค้นหา Item Code, ชื่อสินค้า, Remark..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm pl-8"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-2.5"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Result count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {searchTerm
                  ? `พบ ${filteredItems.length} จาก ${priceHistory.length} รายการ`
                  : `ทั้งหมด ${priceHistory.length} รายการ`}
              </p>
              <p className="text-xs text-gray-400">
                คลิกที่แถวเพื่อดูรายละเอียด
              </p>
            </div>

            {/* Items List */}
            <div className="max-h-100 overflow-y-auto border rounded-lg bg-white">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-100 z-10">
                  <TableRow>
                    <TableHead className="text-xs w-20">Item Code</TableHead>
                    <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                    <TableHead className="text-xs text-center w-16">
                      ราคา
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.slice(0, 100).map((item) => (
                    <Fragment key={item.itemCode}>
                      <TableRow
                        className={`cursor-pointer hover:bg-gray-50 ${
                          expandedItem === item.itemCode ? "bg-indigo-50" : ""
                        }`}
                        onClick={() =>
                          setExpandedItem(
                            expandedItem === item.itemCode
                              ? null
                              : item.itemCode,
                          )
                        }
                      >
                        <TableCell className="text-xs font-mono font-medium">
                          {item.itemCode}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <span className="text-gray-700 line-clamp-1">
                              {item.prodName || "-"}
                            </span>
                            <span className="text-gray-400 text-[10px] block">
                              {item.prodCode}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-indigo-50"
                          >
                            {item.periods.length} tiers
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Tier Details */}
                      {expandedItem === item.itemCode && (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="bg-indigo-50/50 p-3"
                          >
                            <div className="text-xs space-y-2">
                              {/* Product info header */}
                              <div className="flex items-start gap-2 mb-2">
                                <Package className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-medium text-indigo-700">
                                    {item.prodName || item.itemCode}
                                  </p>
                                  <p className="text-gray-400 text-[10px]">
                                    Barcode: {item.prodCode || "-"}
                                  </p>
                                </div>
                              </div>

                              {/* Price tiers */}
                              <div className="space-y-1.5">
                                {item.periods.map((period, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white p-2.5 rounded-lg border border-gray-200 hover:border-indigo-200 transition-colors"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <Calendar className="h-3 w-3 text-gray-400" />
                                          <span className="text-gray-600">
                                            {formatDate(period.startDate)}
                                            {period.endDate
                                              ? ` → ${formatDate(period.endDate)}`
                                              : " → ปัจจุบัน"}
                                          </span>
                                        </div>
                                        {period.remark && (
                                          <div className="flex items-center gap-1">
                                            <Tag className="h-3 w-3 text-blue-400" />
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                                            >
                                              {period.remark}
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="font-mono font-bold text-indigo-600">
                                          ฿{period.priceExtVat.toFixed(2)}
                                        </div>
                                        <div className="text-gray-400 text-[10px]">
                                          เต็ม ฿{period.price.toLocaleString()}{" "}
                                          | คอม ฿{period.priceIncVat.toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
              {filteredItems.length > 100 && (
                <p className="text-center text-xs text-gray-400 py-2">
                  แสดง 100 จาก {filteredItems.length} รายการ (ค้นหาเพื่อกรอง)
                </p>
              )}
              {filteredItems.length === 0 && searchTerm && (
                <div className="text-center py-8 text-gray-400">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">ไม่พบรายการที่ค้นหา</p>
                  <p className="text-xs mt-1">
                    ลอง: Item Code, ชื่อสินค้า, หรือ Remark
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sheet Selector Dialog for inline mode */}
        <SheetSelectorDialog
          open={showSheetSelector}
          onClose={() => {
            setShowSheetSelector(false);
            setPendingExcelBuffer(null);
            setPendingFileName("");
            setAvailableSheets([]);
          }}
          sheets={availableSheets}
          fileName={pendingFileName}
          onSelectSheet={handleSheetSelect}
        />

        {/* Import Result Modal for inline mode */}
        {importResultData && (
          <ImportResultModal
            open={showImportResult}
            onClose={() => {
              setShowImportResult(false);
              setImportResultData(null);
            }}
            fileName={importResultData.fileName}
            addedItems={importResultData.addedItems}
            updatedItems={importResultData.updatedItems}
            source={importResultData.source}
          />
        )}
      </div>
    );
  }

  // Default sidebar mode
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Library className="h-5 w-5 text-indigo-600" />
            Price List
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="bg-indigo-50">
            {summary.totalItems} สินค้า
          </Badge>
          <Badge variant="outline" className="bg-blue-50">
            {summary.totalPeriods} ช่วงราคา
          </Badge>
        </div>
        {summary.dateRange.earliest && summary.dateRange.latest && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(summary.dateRange.earliest)} -{" "}
            {formatDate(summary.dateRange.latest)}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Upload Excel */}
          <div className="flex gap-2">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => excelInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-1" />
              Import Excel
            </Button>
            {summary.totalItems > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                title="Clear all"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>

          {/* Empty State */}
          {summary.totalItems === 0 && (
            <div className="text-center py-8 text-gray-400">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">ยังไม่มีข้อมูล Price List</p>
              <p className="text-xs mt-1">Import ไฟล์ Excel เพื่อเริ่มต้น</p>
            </div>
          )}

          {/* Search */}
          {summary.totalItems > 0 && (
            <>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                <Input
                  placeholder="ค้นหา Item Code, ชื่อสินค้า, Remark..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-sm pl-8"
                />
              </div>

              {/* Items List */}
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-100 z-10">
                    <TableRow>
                      <TableHead className="text-xs w-20">Item Code</TableHead>
                      <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                      <TableHead className="text-xs text-center w-14">
                        ราคา
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.slice(0, 100).map((item) => (
                      <Fragment key={item.itemCode}>
                        <TableRow
                          className={`cursor-pointer hover:bg-gray-50 ${
                            expandedItem === item.itemCode ? "bg-indigo-50" : ""
                          }`}
                          onClick={() =>
                            setExpandedItem(
                              expandedItem === item.itemCode
                                ? null
                                : item.itemCode,
                            )
                          }
                        >
                          <TableCell className="text-xs font-mono font-medium">
                            {item.itemCode}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="text-gray-700 line-clamp-1">
                              {item.prodName || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-indigo-50"
                            >
                              {item.periods.length}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Tier Details */}
                        {expandedItem === item.itemCode && (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="bg-indigo-50/50 p-2"
                            >
                              <div className="text-xs space-y-1.5">
                                {item.periods.map((period, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white p-2 rounded-lg border border-gray-200"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="space-y-0.5">
                                        <span className="text-gray-600">
                                          {formatDate(period.startDate)}
                                          {period.endDate
                                            ? ` → ${formatDate(period.endDate)}`
                                            : " → ปัจจุบัน"}
                                        </span>
                                        {period.remark && (
                                          <div>
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                                            >
                                              {period.remark}
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="font-mono font-bold text-indigo-600">
                                          ฿{period.priceExtVat.toFixed(2)}
                                        </div>
                                        <div className="text-gray-400 text-[10px]">
                                          เต็ม ฿{period.price.toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
                {filteredItems.length > 100 && (
                  <p className="text-center text-xs text-gray-400 py-2">
                    แสดง 100 จาก {filteredItems.length} รายการ
                  </p>
                )}
              </div>

              {/* Legend */}
              <div className="text-xs text-gray-500 space-y-1">
                <p className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  คลิกที่แถวเพื่อดูช่วงราคาทั้งหมด
                </p>
              </div>
            </>
          )}
        </CardContent>
      )}

      {/* Sheet Selector Dialog */}
      <SheetSelectorDialog
        open={showSheetSelector}
        onClose={() => {
          setShowSheetSelector(false);
          setPendingExcelBuffer(null);
          setPendingFileName("");
          setAvailableSheets([]);
        }}
        sheets={availableSheets}
        fileName={pendingFileName}
        onSelectSheet={handleSheetSelect}
      />

      {/* Import Result Modal */}
      {importResultData && (
        <ImportResultModal
          open={showImportResult}
          onClose={() => {
            setShowImportResult(false);
            setImportResultData(null);
          }}
          fileName={importResultData.fileName}
          addedItems={importResultData.addedItems}
          updatedItems={importResultData.updatedItems}
          source={importResultData.source}
        />
      )}
    </Card>
  );
}
