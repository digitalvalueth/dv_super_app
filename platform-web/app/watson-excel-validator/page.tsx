"use client";

import { UndoRedoControls } from "@/components/watson/editor/UndoRedoControls";
import {
  ExportStatusFull,
  ExportSuccessModal,
} from "@/components/watson/export/ExportSuccessModal";
import { ActivityLogsSidebar } from "@/components/watson/logs/ActivityLogsSidebar";
import { OfflinePage } from "@/components/watson/OfflinePage";
import {
  BulkFixAction,
  BulkFixSuggestionPanel,
} from "@/components/watson/pricelist/BulkFixSuggestionPanel";
import { CalculationLogModal } from "@/components/watson/pricelist/CalculationLogModal";
import {
  IssueCategory,
  PriceIssueBreakdown,
  PriceIssuePanel,
} from "@/components/watson/pricelist/PriceIssuePanel";
import { PriceListSidebar } from "@/components/watson/pricelist/PriceListSidebar";
import {
  QtyEditModal,
  QtyEditModalData,
} from "@/components/watson/pricelist/QtyEditModal";
import { FixSuggestionModal } from "@/components/watson/suggestions/FixSuggestionModal";
import { DataTable } from "@/components/watson/table/DataTable";
import { Alert, AlertDescription } from "@/components/watson/ui/alert";
import { Badge } from "@/components/watson/ui/badge";
import { Button } from "@/components/watson/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/watson/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/watson/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/watson/ui/dropdown-menu";
import { LoadingOverlay } from "@/components/watson/ui/loading-overlay";
import { Skeleton } from "@/components/watson/ui/skeleton";
import { toast } from "@/components/watson/ui/toast-provider";
import { DuplicateFileDialog } from "@/components/watson/upload/DuplicateFileDialog";
import { FileUploader } from "@/components/watson/upload/FileUploader";
import { ErrorDetails } from "@/components/watson/validation/ErrorDetails";
import { ValidationSummary } from "@/components/watson/validation/ValidationSummary";
import { useActivityLogs } from "@/hooks/watson/useActivityLogs";
import { useDataEditor } from "@/hooks/watson/useDataEditor";
import { useExcelUpload } from "@/hooks/watson/useExcelUpload";
import { useInvoiceUploadHistory } from "@/hooks/watson/useInvoiceUploadHistory";
import { useOnlineStatus } from "@/hooks/watson/useOnlineStatus";
import { usePriceImportHistory } from "@/hooks/watson/usePriceImportHistory";
import { usePriceListData } from "@/hooks/watson/usePriceListData";
import type { WorkflowStatus } from "@/lib/watson-firebase";
import {
  exportToExcel,
  exportToJson,
  exportValidationReport,
  getExportHeaders,
  saveExportToCloud,
} from "@/lib/watson/excel-exporter";
import {
  applySuggestions,
  FixSuggestion,
  FixSuggestionGroup,
  getAllSuggestions,
} from "@/lib/watson/fix-suggestions";
import { validateData } from "@/lib/watson/validators";
import { useAuthStore } from "@/stores/auth.store";
import { ValidationResult } from "@/types/watson/invoice";
import {
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  FileJson,
  FileSpreadsheet,
  Home,
  Library,
  Loader2,
  RotateCcw,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Helper function to get status badge display
function getStatusBadge(status?: WorkflowStatus) {
  switch (status) {
    case "cancelled":
      return (
        <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-4">
          ยกเลิกแล้ว
        </Badge>
      );
    case "confirmed":
      return (
        <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 h-4">
          ยืนยันแล้ว
        </Badge>
      );
    case "exported":
      return (
        <Badge className="bg-purple-500 text-white text-[10px] px-1.5 py-0 h-4">
          Export แล้ว
        </Badge>
      );
    case "calculated":
      return (
        <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 h-4">
          เทียบราคาแล้ว
        </Badge>
      );
    case "validated":
      return (
        <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0 h-4">
          ตรวจแล้ว
        </Badge>
      );
    case "uploaded":
    default:
      return (
        <Badge
          variant="outline"
          className="text-gray-500 text-[10px] px-1.5 py-0 h-4 border-gray-300"
        >
          อัปโหลด
        </Badge>
      );
  }
}

/** คำนวณด้วย 4dp ก่อน (ตัด floating-point noise) แล้ว format เป็น 2dp */
const fmt2 = (n: number) => (Math.round(n * 10000) / 10000).toFixed(2);

export default function WatsonExcelValidatorPage() {
  const {
    isLoading,
    error,
    parsedData,
    uploadFile,
    reset,
    fileName,
    setFileName,
    reportMeta,
    setReportMeta,
  } = useExcelUpload();
  const {
    data,
    setData,
    updateCell,
    deleteRow,
    shiftRowLeft,
    shiftRowRight,
    shiftColumnLeft,
    shiftColumnRight,
    clearCell,
    canUndo,
    canRedo,
    undo,
    redo,
    historyLength,
  } = useDataEditor();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { userData } = useAuthStore();

  // Price List data hook
  const {
    priceHistory: itemPriceHistory, // Renamed from priceHistory to avoid conflict
    priceListRaw, // Get raw list for search
    summary: priceListSummary,
    importPriceList,
    addOrUpdatePriceList,
    clearPriceList,
    enrichDataWithPriceMatch,
  } = usePriceListData();

  // Price Import History hook
  const {
    history: priceImportHistory,
    addRecord: addHistoryRecord,
    addRecordFromServer,
    removeRecord: removeHistoryRecord,
    clearHistory: clearImportHistory,
    loadRecordData: loadPriceHistoryData,
  } = usePriceImportHistory();

  // Invoice Upload History hook
  const {
    history: invoiceUploadHistory,
    isLoading: isLoadingHistory,
    addRecord: saveInvoiceUpload,
    loadRecord: loadInvoiceUpload,
    updateRecord: updateInvoiceUpload,
    updateStatus: updateInvoiceStatus,
    removeRecord: removeInvoiceUpload,
    refetchHistory: refetchInvoiceHistory,
  } = useInvoiceUploadHistory();

  // Track current loaded record ID for auto-save
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

  // Global loading state for full-screen overlay
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  // Wrap loadPriceHistoryData to show overlay
  const handleLoadPriceHistoryData = useCallback(
    async (record: any) => {
      setIsGlobalLoading(true);
      try {
        // Add artificial delay for better UX if too fast
        const [data] = await Promise.all([
          loadPriceHistoryData(record),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
        return data;
      } finally {
        setIsGlobalLoading(false);
      }
    },
    [loadPriceHistoryData],
  );

  // Track confirmed file state - if set, file is locked and shows export ID
  const [confirmedExportId, setConfirmedExportId] = useState<string | null>(
    null,
  );

  // Confirmed exports shown on home page
  const [confirmedExports, setConfirmedExports] = useState<
    {
      id: string;
      supplierCode: string;
      fileName?: string;
      rowCount: number;
      confirmedAt: string | null;
      confirmedBy: string | null;
      exportedAt: string;
      status?: "confirmed" | "cancelled";
    }[]
  >([]);
  const [confirmedExportsTotal, setConfirmedExportsTotal] = useState(0);
  const [confirmedExportsPage, setConfirmedExportsPage] = useState(0);
  const CONFIRMED_PAGE_SIZE = 8;
  const [isLoadingConfirmedExports, setIsLoadingConfirmedExports] =
    useState(false);

  const fetchConfirmedExports = useCallback(
    (page: number) => {
      setIsLoadingConfirmedExports(true);
      const offset = page * CONFIRMED_PAGE_SIZE;
      const params = new URLSearchParams({
        status: "confirmed,cancelled",
        limit: String(CONFIRMED_PAGE_SIZE),
        offset: String(offset),
      });
      if (userData?.companyId) params.set("companyId", userData.companyId);
      fetch(`/api/exports?${params.toString()}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            setConfirmedExports(res.data || []);
            setConfirmedExportsTotal(res.meta?.total ?? 0);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingConfirmedExports(false));
    },
    [userData?.companyId],
  );

  useEffect(() => {
    if (data.length > 0) return;
    fetchConfirmedExports(0);
  }, [data.length, fetchConfirmedExports]);

  // User overrides for Std Qty / Promo Qty / QtyBuy1 / QtyPro / Price columns (rowIndex -> overrides)
  const [qtyOverrides, setQtyOverrides] = useState<
    Map<
      number,
      {
        stdQty?: string;
        promoQty?: string;
        qtyBuy1?: string;
        qtyPro?: string;
        priceBuy1Invoice?: string;
        priceBuy1Com?: string;
        priceProInvoice?: string;
        priceProCom?: string;
      }
    >
  >(new Map());

  // Activity Logs hook
  const {
    logs: activityLogs,
    summary: logsSummary,
    clearLogs,
    logImportExcel,
    logImportPriceList,
    logEditCell,
    logDeleteRow,
    logShiftRowLeft,
    logShiftRowRight,
    logShiftColumnLeft,
    logShiftColumnRight,
    logClearCell,
    logAutoFix,
    logValidate,
    logExportExcel,
    logSaveCloud,
    logExportReport,
    logUndo,
    logRedo,
  } = useActivityLogs();

  // Online status detection
  const { isOnline, isFirebaseConnected, lastChecked, checkConnection } =
    useOnlineStatus();

  const [headers, setHeaders] = useState<string[]>([]);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [highlightRowIndex, setHighlightRowIndex] = useState<
    number | undefined
  >(undefined);
  const [goToPage, setGoToPage] = useState<number | undefined>(undefined);
  const [showPriceColumns, setShowPriceColumns] = useState(false);
  const [showPricePanel, setShowPricePanel] = useState(false);

  // Invoice history period filter (default: last 2 months only)
  const [historyShowAll, setHistoryShowAll] = useState(false);

  // Column visibility — columns hidden by default in the data table
  const DEFAULT_HIDDEN_COLUMNS = new Set([
    "Currency",
    "VAT %",
    "Column 18",
    "Column 19",
    "Contact Name",
    "Contact Phone/Fax",
    // Price calculation columns (shown on demand via column picker)
    "Expected Price",
    "Price Match",
    "Period Start",
    "Matched Period",
    "Std Qty",
    "Promo Qty",
    "Calc Amt",
    "Diff",
    "Confidence",
    "PL Name",
    "PL Remark",
    "PL Full Price",
    "PL Comm Price",
    "PL Invoice62 IncV",
    "Total Comm",
    "Log",
  ]);
  const HIDDEN_COLS_STORAGE_KEY = "watson_hidden_columns";
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    // Restore from localStorage; fall back to defaults
    try {
      const saved = localStorage.getItem(HIDDEN_COLS_STORAGE_KEY);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        return new Set(parsed);
      }
    } catch {}
    return new Set(DEFAULT_HIDDEN_COLUMNS);
  });
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [priceRecalcTrigger, setPriceRecalcTrigger] = useState(0);
  const [calcStatus, setCalcStatus] = useState<
    "idle" | "calculating" | "completed"
  >("idle");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.9); // 90% default
  const [showOnlyLowConfidence, setShowOnlyLowConfidence] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionGroups, setSuggestionGroups] = useState<
    FixSuggestionGroup[]
  >([]);
  const [showIssuePanel, setShowIssuePanel] = useState(false);
  const [showBulkFixPanel, setShowBulkFixPanel] = useState(false);
  const [bulkAcceptedItemCodes, setBulkAcceptedItemCodes] = useState<
    Set<string>
  >(new Set());
  const [priceFilterCategory, setPriceFilterCategory] =
    useState<IssueCategory | null>(null);

  // Calc Log modal state
  const [calcLogOpen, setCalcLogOpen] = useState(false);
  const [calcLogText, setCalcLogText] = useState("");

  // Qty Edit modal state
  const [qtyEditOpen, setQtyEditOpen] = useState(false);
  const [qtyEditData, setQtyEditData] = useState<QtyEditModalData | null>(null);
  const [qtyEditMaxQty, setQtyEditMaxQty] = useState(0);
  const [calcLogItemCode, setCalcLogItemCode] = useState("");

  // Duplicate file dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingParsedData, setPendingParsedData] = useState<
    typeof parsedData | null
  >(null);
  const [existingRecordForDuplicate, setExistingRecordForDuplicate] = useState<{
    id: string;
    uploadedAt: string;
    rowCount: number;
  } | null>(null);

  // Confirm-save modal
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  // --- Session Persistence (lightweight, keyed by recordId) ---
  // Stores ONLY: validationResult, showPriceColumns, confirmedExportId, qtyOverrides
  // Does NOT store data (too large → quota exceeded / corrupted JSON)
  const SESSION_PREFIX = "watson_session_";

  const saveSession = useCallback(
    (recordId: string) => {
      try {
        sessionStorage.setItem(
          SESSION_PREFIX + recordId,
          JSON.stringify({
            validationResult,
            showPriceColumns,
            qtyOverrides: Array.from(qtyOverrides.entries()),
          }),
        );
      } catch {
        // Quota exceeded or unavailable — ignore
      }
    },
    [validationResult, showPriceColumns, qtyOverrides],
  );

  useEffect(() => {
    if (!currentRecordId) return;
    saveSession(currentRecordId);
  }, [currentRecordId, saveSession]);

  const restoreSession = useCallback(
    (recordId: string) => {
      try {
        const raw = sessionStorage.getItem(SESSION_PREFIX + recordId);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed.validationResult)
          setValidationResult(parsed.validationResult);
        if (parsed.showPriceColumns) setShowPriceColumns(true);
        if (parsed.qtyOverrides) setQtyOverrides(new Map(parsed.qtyOverrides));
        return true;
      } catch {
        // Corrupted — clear it
        try {
          sessionStorage.removeItem(SESSION_PREFIX + recordId);
        } catch {}
        return false;
      }
    },

    [],
  );

  // Derived display data - computed from source data
  // priceRecalcTrigger forces recalculation when user clicks "Recalculate"
  const {
    displayData,
    displayHeaders,
    lowConfidenceCount,
    passedCount,
    priceIssueBreakdown,
  } = useMemo(() => {
    if (showPriceColumns) {
      const { enrichedData, enrichedHeaders } = enrichDataWithPriceMatch(
        data,
        headers,
        confidenceThreshold,
        reportMeta?.reportRunDateTime,
      );

      // Add original row index to each row for tracking after filtering
      const dataWithOriginalIdx = enrichedData.map((row, idx) => ({
        ...row,
        _originalIdx: idx,
      }));

      // Find Item Code header
      const itemCodeHeader = headers.find(
        (h) =>
          h.toLowerCase().includes("item code") ||
          h.toLowerCase() === "itemcode",
      );

      // Find which rows are acceptable based on Confidence >= threshold
      const acceptable = new Set<number>();
      const thresholdPercent = confidenceThreshold * 100;

      // Issue tracking maps: itemCode -> { rowIndices, itemName, category, ... }
      const passedMap = new Map<
        string,
        { rowIndices: number[]; itemName: string; confidence: string }
      >();
      const notFoundMap = new Map<
        string,
        { rowIndices: number[]; itemName: string }
      >();
      const noPeriodMap = new Map<
        string,
        { rowIndices: number[]; itemName: string }
      >();
      const lowMatchMap = new Map<
        string,
        {
          rowIndices: number[];
          itemName: string;
          confidence: string;
          diff: string;
        }
      >();

      enrichedData.forEach((row, idx) => {
        const confidenceValue = String(row["Confidence"] || "");
        const diffValue = String(row["Diff"] || "");
        const priceMatch = String(row["Price Match"] || "");
        const itemCode = itemCodeHeader
          ? String(row[itemCodeHeader] || "").trim()
          : "";
        const itemDesc = String(
          row["Item Description"] || row["PL Name"] || "",
        ).trim();

        // Parse confidence percentage
        const confMatch = confidenceValue.match(/(\d+)/);
        const confidencePercent = confMatch ? parseInt(confMatch[1], 10) : 0;

        // Check if this item was bulk-accepted
        const isBulkAccepted = bulkAcceptedItemCodes.has(itemCode);

        if (confidenceValue !== "-" && diffValue !== "-") {
          if (confidencePercent >= thresholdPercent || isBulkAccepted) {
            acceptable.add(idx);
            // Track passed items
            const existing = passedMap.get(itemCode);
            if (existing) {
              existing.rowIndices.push(idx);
            } else {
              passedMap.set(itemCode, {
                rowIndices: [idx],
                itemName: itemDesc,
                confidence:
                  isBulkAccepted && confidencePercent < thresholdPercent
                    ? `${confidenceValue} ✓` // Mark as bulk-accepted
                    : confidenceValue,
              });
            }
          } else {
            // Low match
            const existing = lowMatchMap.get(itemCode);
            if (existing) {
              existing.rowIndices.push(idx);
            } else {
              lowMatchMap.set(itemCode, {
                rowIndices: [idx],
                itemName: itemDesc,
                confidence: confidenceValue,
                diff: diffValue,
              });
            }
          }
        } else if (priceMatch.includes("คืนสินค้า")) {
          // Returns are acceptable (no calculation needed, not an issue)
          acceptable.add(idx);
          const existing = passedMap.get(itemCode);
          if (existing) {
            existing.rowIndices.push(idx);
          } else {
            passedMap.set(itemCode, {
              rowIndices: [idx],
              itemName: itemDesc,
              confidence: "คืน",
            });
          }
        } else if (
          priceMatch.includes("Qty=1") &&
          !priceMatch.includes("No period")
        ) {
          // Single item purchases WITH a matching period are acceptable
          acceptable.add(idx);
          const existing = passedMap.get(itemCode);
          if (existing) {
            existing.rowIndices.push(idx);
          } else {
            passedMap.set(itemCode, {
              rowIndices: [idx],
              itemName: itemDesc,
              confidence: "Qty=1",
            });
          }
        } else if (priceMatch.includes("No period")) {
          const existing = noPeriodMap.get(itemCode);
          if (existing) {
            existing.rowIndices.push(idx);
          } else {
            noPeriodMap.set(itemCode, {
              rowIndices: [idx],
              itemName: itemDesc,
            });
          }
        } else {
          // Not found or other
          const existing = notFoundMap.get(itemCode);
          if (existing) {
            existing.rowIndices.push(idx);
          } else {
            notFoundMap.set(itemCode, {
              rowIndices: [idx],
              itemName: itemDesc,
            });
          }
        }
      });

      // Build breakdown
      const passedItems = Array.from(passedMap.entries())
        .map(([itemCode, v]) => ({
          itemCode,
          itemName: v.itemName,
          category: "passed" as const,
          rowCount: v.rowIndices.length,
          rowIndices: v.rowIndices,
          sampleConfidence: v.confidence,
        }))
        .sort((a, b) => b.rowCount - a.rowCount);

      const notFoundItems = Array.from(notFoundMap.entries())
        .map(([itemCode, v]) => ({
          itemCode,
          itemName: v.itemName,
          category: "not-found" as const,
          rowCount: v.rowIndices.length,
          rowIndices: v.rowIndices,
        }))
        .sort((a, b) => b.rowCount - a.rowCount);

      const noPeriodItems = Array.from(noPeriodMap.entries())
        .map(([itemCode, v]) => ({
          itemCode,
          itemName: v.itemName,
          category: "no-period" as const,
          rowCount: v.rowIndices.length,
          rowIndices: v.rowIndices,
        }))
        .sort((a, b) => b.rowCount - a.rowCount);

      const lowMatchItems = Array.from(lowMatchMap.entries())
        .map(([itemCode, v]) => ({
          itemCode,
          itemName: v.itemName,
          category: "low-match" as const,
          rowCount: v.rowIndices.length,
          rowIndices: v.rowIndices,
          sampleConfidence: v.confidence,
          sampleDiff: v.diff,
        }))
        .sort((a, b) => b.rowCount - a.rowCount);

      const breakdown: PriceIssueBreakdown = {
        passedItems,
        notFoundItems,
        noPeriodItems,
        lowMatchItems,
        passedRows: passedItems.reduce((s, i) => s + i.rowCount, 0),
        notFoundRows: notFoundItems.reduce((s, i) => s + i.rowCount, 0),
        noPeriodRows: noPeriodItems.reduce((s, i) => s + i.rowCount, 0),
        lowMatchRows: lowMatchItems.reduce((s, i) => s + i.rowCount, 0),
      };

      // Collect row indices for each category for category filtering
      const passedRowSet = new Set<number>(acceptable);
      const notFoundRowSet = new Set<number>();
      notFoundMap.forEach((v) =>
        v.rowIndices.forEach((i) => notFoundRowSet.add(i)),
      );
      const noPeriodRowSet = new Set<number>();
      noPeriodMap.forEach((v) =>
        v.rowIndices.forEach((i) => noPeriodRowSet.add(i)),
      );
      const lowMatchRowSet = new Set<number>();
      lowMatchMap.forEach((v) =>
        v.rowIndices.forEach((i) => lowMatchRowSet.add(i)),
      );

      // Apply user overrides for Std Qty / Promo Qty / QtyBuy1 / QtyPro using _originalIdx
      const dataWithOverrides = dataWithOriginalIdx.map((row) => {
        const originalIdx = row._originalIdx as number;
        const override = qtyOverrides.get(originalIdx);
        if (!override) return row;

        const rowAny = row as Record<string, unknown>;
        const updated: typeof row & Record<string, unknown> = { ...row };

        // Apply Std Qty / Promo Qty display overrides
        if (override.stdQty !== undefined) {
          updated["Std Qty"] = override.stdQty;
        }
        if (override.promoQty !== undefined) {
          updated["Promo Qty"] = override.promoQty;
        }

        // Apply QtyBuy1 / QtyPro overrides with price recalculation
        if (override.qtyBuy1 !== undefined || override.qtyPro !== undefined) {
          const newQtyBuy1 =
            override.qtyBuy1 !== undefined
              ? parseInt(override.qtyBuy1) || 0
              : parseInt(String(rowAny["QtyBuy1"])) || 0;
          const newQtyPro =
            override.qtyPro !== undefined
              ? parseInt(override.qtyPro) || 0
              : parseInt(String(rowAny["QtyPro"])) || 0;

          // Get per-unit prices from hidden metadata
          const stdPriceExtVat = Number(rowAny["_stdPriceExtVat"]) || 0;
          const stdPriceIncVat = Number(rowAny["_stdPriceIncVat"]) || 0;
          const stdInvoice62IncV = Number(rowAny["_stdInvoice62IncV"]) || 0;
          let proPriceExtVat = Number(rowAny["_proPriceExtVat"]) || 0;
          let proPriceIncVat = Number(rowAny["_proPriceIncVat"]) || 0;
          let proInvoice62IncV = Number(rowAny["_proInvoice62IncV"]) || 0;
          // Fallback: if no promo price stored, use std price
          if (proPriceExtVat === 0 && stdPriceExtVat > 0) {
            proPriceExtVat = stdPriceExtVat;
            proPriceIncVat = stdPriceIncVat;
            proInvoice62IncV = stdInvoice62IncV;
          }

          // Recalculate totals (for Calc Amt / Total Comm — unchanged logic)
          const newPriceBuy1Invoice = newQtyBuy1 * stdPriceExtVat;
          const newPriceBuy1Com = newQtyBuy1 * stdPriceIncVat;
          const newPriceProInvoice = newQtyPro * proPriceExtVat;
          const newPriceProCom = newQtyPro * proPriceIncVat;

          updated["QtyBuy1"] = newQtyBuy1 > 0 ? newQtyBuy1 : "";
          updated["QtyPro"] = newQtyPro > 0 ? newQtyPro : "";

          // Display fields show PER-UNIT prices (same as initial enrichment):
          //   Invoice Formula = invoice 62% IncV per unit, fallback to ExtVat per unit
          //   Com Calculate   = Comm price IncV per unit
          // NOTE: newPriceBuy1Invoice / newPriceProInvoice are TOTALS — only used for
          //       Calc Amt; never shown directly in the Formula/Calculate columns.
          // Fallback chain for std: 62%IncV → ExtVat → proPriceExtVat
          // (when knapsack originally allocated all qty to promo, _stdPrice* = 0,
          //  so we fall back to the pro per-unit price for user-edited QtyBuy1)
          const effStdInvoice62 = stdInvoice62IncV || proInvoice62IncV;
          const effStdExtVat = stdPriceExtVat || proPriceExtVat;
          const effStdIncVat = stdPriceIncVat || proPriceIncVat;
          updated["PriceBuy1_Invoice_Formula"] =
            newQtyBuy1 > 0
              ? effStdInvoice62 > 0
                ? fmt2(effStdInvoice62)
                : effStdExtVat > 0
                  ? fmt2(effStdExtVat)
                  : ""
              : "";
          updated["PriceBuy1_Com_Calculate"] =
            newQtyBuy1 > 0 && effStdIncVat > 0 ? fmt2(effStdIncVat) : "";
          updated["PricePro_Invoice_Formula"] =
            newQtyPro > 0
              ? proInvoice62IncV > 0
                ? fmt2(proInvoice62IncV)
                : proPriceExtVat > 0
                  ? fmt2(proPriceExtVat)
                  : ""
              : "";
          updated["PricePro_Com_Calculate"] =
            newQtyPro > 0 && proPriceIncVat > 0 ? fmt2(proPriceIncVat) : "";

          // Recalculate Calc Amt, Diff, Confidence
          const calcAmt = newPriceBuy1Invoice + newPriceProInvoice;
          const rawAmtHeader = headers.find(
            (h) =>
              h.toLowerCase().includes("total cost") &&
              h.toLowerCase().includes("exclusive"),
          );
          const rawAmt = rawAmtHeader
            ? Math.abs(Number(rowAny[rawAmtHeader]) || 0)
            : 0;

          if (calcAmt > 0 && rawAmt > 0) {
            const diff = calcAmt - rawAmt;
            const confidence =
              rawAmt > 0 ? Math.max(0, (1 - Math.abs(diff) / rawAmt) * 100) : 0;
            const thresholdPercent = confidenceThreshold * 100;
            const isOk = confidence >= thresholdPercent;

            updated["Calc Amt"] = fmt2(calcAmt);
            updated["Diff"] = isOk ? `✓ ${fmt2(diff)}` : `⚠ ${fmt2(diff)}`;
            updated["Confidence"] = `${confidence.toFixed(0)}%`;
            updated["Price Match"] = isOk
              ? "✅ OK"
              : diff > 0
                ? `⬆️ +${fmt2(diff)}`
                : `⬇️ ${fmt2(diff)}`;

            // Update Std Qty / Promo Qty display to match
            updated["Std Qty"] = String(newQtyBuy1);
            updated["Promo Qty"] = newQtyPro > 0 ? String(newQtyPro) : "0";

            // Recalculate Total Comm
            const totalComm = newPriceBuy1Com + newPriceProCom;
            if (totalComm > 0) {
              updated["Total Comm"] = `฿${fmt2(totalComm)}`;
            }
          }
        }

        return updated;
      });

      // Apply direct price column overrides (user manually edited formula/calculate cells)
      const dataWithPriceOverrides = dataWithOverrides.map((row) => {
        const originalIdx = row._originalIdx as number;
        const override = qtyOverrides.get(originalIdx);
        if (
          !override ||
          (override.priceBuy1Invoice === undefined &&
            override.priceBuy1Com === undefined &&
            override.priceProInvoice === undefined &&
            override.priceProCom === undefined)
        ) {
          return row;
        }

        const updated: typeof row & Record<string, unknown> = { ...row };
        if (override.priceBuy1Invoice !== undefined) {
          updated["PriceBuy1_Invoice_Formula"] = override.priceBuy1Invoice;
        }
        if (override.priceBuy1Com !== undefined) {
          updated["PriceBuy1_Com_Calculate"] = override.priceBuy1Com;
        }
        if (override.priceProInvoice !== undefined) {
          updated["PricePro_Invoice_Formula"] = override.priceProInvoice;
        }
        if (override.priceProCom !== undefined) {
          updated["PricePro_Com_Calculate"] = override.priceProCom;
        }

        // Recalculate Calc Amt / Diff / Confidence based on overridden per-unit prices
        const qtyBuy1 = parseInt(String(updated["QtyBuy1"])) || 0;
        const qtyPro = parseInt(String(updated["QtyPro"])) || 0;
        const buy1Ext =
          override.priceBuy1Invoice !== undefined
            ? parseFloat(override.priceBuy1Invoice) || 0
            : Number(updated["_stdPriceExtVat"]) || 0;
        const proExt =
          override.priceProInvoice !== undefined
            ? parseFloat(override.priceProInvoice) || 0
            : Number(updated["_proPriceExtVat"]) || 0;

        const calcAmt = qtyBuy1 * buy1Ext + qtyPro * proExt;
        const rawAmtHeader = headers.find(
          (h) =>
            h.toLowerCase().includes("total cost") &&
            h.toLowerCase().includes("exclusive"),
        );
        const rawAmt = rawAmtHeader
          ? Math.abs(Number(updated[rawAmtHeader]) || 0)
          : 0;

        if (calcAmt > 0 && rawAmt > 0) {
          const diff = calcAmt - rawAmt;
          const confidence =
            rawAmt > 0 ? Math.max(0, (1 - Math.abs(diff) / rawAmt) * 100) : 0;
          const thresholdPercent = confidenceThreshold * 100;
          const isOk = confidence >= thresholdPercent;
          updated["Calc Amt"] = fmt2(calcAmt);
          updated["Diff"] = isOk ? `✓ ${fmt2(diff)}` : `⚠ ${fmt2(diff)}`;
          updated["Confidence"] = `${confidence.toFixed(0)}%`;
          updated["Price Match"] = isOk
            ? "✅ OK"
            : diff > 0
              ? `⬆️ +${fmt2(diff)}`
              : `⬇️ ${fmt2(diff)}`;
        }

        // Recalculate Total Comm if price overrides provided
        const buy1Com =
          override.priceBuy1Com !== undefined
            ? parseFloat(override.priceBuy1Com) || 0
            : Number(updated["_stdPriceIncVat"]) || 0;
        const proCom =
          override.priceProCom !== undefined
            ? parseFloat(override.priceProCom) || 0
            : Number(updated["_proPriceIncVat"]) || 0;
        const totalComm = qtyBuy1 * buy1Com + qtyPro * proCom;
        if (totalComm > 0) {
          updated["Total Comm"] = `฿${fmt2(totalComm)}`;
        }

        return updated;
      });

      // Filter if showOnlyLowConfidence is enabled
      let filteredData = dataWithPriceOverrides;
      if (showOnlyLowConfidence || priceFilterCategory) {
        const categoryRowSet = priceFilterCategory
          ? priceFilterCategory === "passed"
            ? passedRowSet
            : priceFilterCategory === "not-found"
              ? notFoundRowSet
              : priceFilterCategory === "no-period"
                ? noPeriodRowSet
                : lowMatchRowSet
          : null;

        filteredData = dataWithPriceOverrides.filter((row) => {
          const idx = row._originalIdx as number;
          // When filtering by 'passed', show only acceptable rows
          if (priceFilterCategory === "passed") {
            return acceptable.has(idx);
          }
          const isLow = !acceptable.has(idx);
          if (showOnlyLowConfidence && categoryRowSet) {
            return isLow && categoryRowSet.has(idx);
          }
          if (showOnlyLowConfidence) {
            return isLow;
          }
          // only category filter
          return categoryRowSet!.has(idx);
        });
      }

      const lowConfidenceTotal =
        breakdown.notFoundRows +
        breakdown.noPeriodRows +
        breakdown.lowMatchRows;

      return {
        displayData: filteredData,
        displayHeaders: enrichedHeaders,
        lowConfidenceCount: lowConfidenceTotal,
        passedCount: acceptable.size,
        priceIssueBreakdown: breakdown,
      };
    }
    // Add _originalIdx for non-enriched data as well
    return {
      displayData: data.map((row, idx) => ({ ...row, _originalIdx: idx })),
      displayHeaders: headers,
      lowConfidenceCount: 0,
      passedCount: 0,
      priceIssueBreakdown: null as PriceIssueBreakdown | null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    headers,
    showPriceColumns,
    enrichDataWithPriceMatch,
    priceRecalcTrigger,
    confidenceThreshold,
    showOnlyLowConfidence,
    priceFilterCategory,
    bulkAcceptedItemCodes,
    qtyOverrides,
    reportMeta,
  ]);

  // Persist hidden columns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        HIDDEN_COLS_STORAGE_KEY,
        JSON.stringify(Array.from(hiddenColumns)),
      );
    } catch {}
  }, [hiddenColumns]);

  // Filter invoice history to last 2 months (unless historyShowAll is true)
  const filteredInvoiceHistory = useMemo(() => {
    if (historyShowAll) return invoiceUploadHistory.slice(0, 20);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 2);
    return invoiceUploadHistory
      .filter((r) => new Date(r.uploadedAt) >= cutoff)
      .slice(0, 20);
  }, [invoiceUploadHistory, historyShowAll]);

  // Derive visible headers by removing hidden columns
  const visibleHeaders = useMemo(
    () => displayHeaders.filter((h) => !hiddenColumns.has(h)),
    [displayHeaders, hiddenColumns],
  );

  // All toggleable columns (from current display headers, excluding internal _ columns)
  const toggleableColumns = useMemo(
    () => displayHeaders.filter((h) => !h.startsWith("_")),
    [displayHeaders],
  );

  // When file is parsed, check for duplicates first
  // This is intentional - we need to sync external parsed data to internal state
  const lastProcessedParsedDataRef = useRef<typeof parsedData>(null);
  useEffect(() => {
    if (parsedData && fileName) {
      // Skip if we already processed this exact parsedData object
      if (lastProcessedParsedDataRef.current === parsedData) return;
      lastProcessedParsedDataRef.current = parsedData;

      // Check if file with same name exists in history
      const existingRecord = invoiceUploadHistory.find(
        (r) => r.fileName === fileName,
      );

      if (existingRecord) {
        // Show dialog to ask user what to do
        setPendingParsedData(parsedData);
        setExistingRecordForDuplicate({
          id: existingRecord.id,
          uploadedAt: existingRecord.uploadedAt,
          rowCount: existingRecord.rowCount,
        });
        setDuplicateDialogOpen(true);
        return;
      }

      // No duplicate - proceed with normal flow
      setData(parsedData.data);
      setHeaders(parsedData.headers);
      setCurrentRecordId(null);
      setValidationResult(null);
      setShowPriceColumns(false);
      setQtyOverrides(new Map());
      logImportExcel(fileName, parsedData.data.length);

      // Save to upload history and capture the real ID for auto-save
      saveInvoiceUpload(fileName, parsedData.headers, parsedData.data, {
        supplierCode: reportMeta?.reportParameters || undefined,
        reportDate: reportMeta?.reportRunDateTime || undefined,
        uploader: userData
          ? {
              id: userData.id,
              name: userData.name || userData.email || "Unknown",
              email: userData.email,
              role: userData.role,
            }
          : undefined,
      }).then((newId) => {
        setCurrentRecordId(newId);
        // Update URL without reload
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("id", newId);
        window.history.pushState({}, "", newUrl);
      });
    }
  }, [
    parsedData,
    setData,
    fileName,
    logImportExcel,
    saveInvoiceUpload,
    reportMeta,
    invoiceUploadHistory,
    userData,
  ]);

  // Load from history
  const handleLoadFromHistory = useCallback(
    async (recordId: string) => {
      setIsGlobalLoading(true);
      try {
        // Add artificial delay
        const [record] = await Promise.all([
          loadInvoiceUpload(recordId),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);

        if (record) {
          setData(record.data || []);
          setHeaders(record.headers || []);
          setFileName(record.fileName);
          setCurrentRecordId(recordId);
          setValidationResult(null);
          setShowPriceColumns(false);
          // Restore qtyOverrides from saved data
          if (
            record.qtyOverrides &&
            Object.keys(record.qtyOverrides).length > 0
          ) {
            const restoredMap = new Map<
              number,
              {
                stdQty?: string;
                promoQty?: string;
                qtyBuy1?: string;
                qtyPro?: string;
              }
            >();
            Object.entries(record.qtyOverrides).forEach(([key, val]) => {
              restoredMap.set(Number(key), val);
            });
            setQtyOverrides(restoredMap);
          } else {
            setQtyOverrides(new Map());
          }
          // Restore bulkAcceptedItemCodes from saved data
          setBulkAcceptedItemCodes(new Set(record.bulkAcceptedItemCodes || []));
          // Restore reportMeta from history record
          setReportMeta({
            reportName: null,
            reportRunDateTime: record.reportDate || null,
            reportParameters: record.supplierCode || null,
          });
          // Check if file is confirmed/cancelled and reconcile with
          // the actual export status in case it was changed externally.
          if (record.status === "confirmed" || record.status === "cancelled") {
            if (record.lastExportId && record.status === "confirmed") {
              // Verify against the actual export's status
              try {
                const expRes = await fetch(
                  `/api/internal/exports/${record.lastExportId}/status`,
                );
                if (expRes.ok) {
                  const expJson = await expRes.json();
                  const realStatus = expJson?.data?.status;
                  if (realStatus === "cancelled" || realStatus === "draft") {
                    // Export was cancelled/reverted externally — unlock
                    setConfirmedExportId(null);
                    // Sync the invoice record
                    const syncStatus =
                      realStatus === "cancelled" ? "cancelled" : "exported";
                    updateInvoiceStatus(recordId, syncStatus as WorkflowStatus);
                  } else {
                    setConfirmedExportId(record.lastExportId || "confirmed");
                    setShowPriceColumns(true);
                  }
                } else {
                  // API failed — trust local status
                  setConfirmedExportId(record.lastExportId || "confirmed");
                  setShowPriceColumns(true);
                }
              } catch {
                // Network error — trust local status
                setConfirmedExportId(record.lastExportId || "confirmed");
                setShowPriceColumns(true);
              }
            } else if (record.status === "confirmed") {
              // No lastExportId — try to find the linked export by invoiceUploadId
              try {
                const searchRes = await fetch(
                  `/api/exports?invoiceUploadId=${recordId}&limit=1`,
                );
                if (searchRes.ok) {
                  const searchJson = await searchRes.json();
                  const linkedExport = searchJson?.data?.[0];
                  if (linkedExport) {
                    // Found the linked export — reconcile status
                    const realStatus = linkedExport.status;
                    if (realStatus === "cancelled" || realStatus === "draft") {
                      setConfirmedExportId(null);
                      const syncStatus =
                        realStatus === "cancelled" ? "cancelled" : "exported";
                      updateInvoiceStatus(
                        recordId,
                        syncStatus as WorkflowStatus,
                        {
                          lastExportId: linkedExport.id,
                        },
                      );
                    } else {
                      // Still confirmed — persist the link
                      setConfirmedExportId(linkedExport.id);
                      setShowPriceColumns(true);
                      updateInvoiceStatus(recordId, "confirmed", {
                        lastExportId: linkedExport.id,
                      });
                    }
                  } else {
                    // No linked export found — might have been deleted; unlock
                    setConfirmedExportId(null);
                    updateInvoiceStatus(recordId, "exported" as WorkflowStatus);
                  }
                } else {
                  setConfirmedExportId("confirmed");
                  setShowPriceColumns(true);
                }
              } catch {
                setConfirmedExportId("confirmed");
                setShowPriceColumns(true);
              }
            } else {
              // status === "cancelled"
              setConfirmedExportId(null);
            }
          } else {
            setConfirmedExportId(null);
          }
          // Restore lightweight session state (overrides the resets above)
          restoreSession(recordId);
          // Don't log - this is loading existing data, not a new import
        }
      } catch (error) {
        console.error("Error loading invoice history:", error);
        toast.error("โหลดข้อมูลไม่สำเร็จ", "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setIsGlobalLoading(false);
      }
    },
    [
      loadInvoiceUpload,
      setData,
      setFileName,
      setReportMeta,
      restoreSession,
      updateInvoiceStatus,
    ],
  );

  // Helper to update URL
  const updateUrlId = useCallback((id: string) => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("id", id);
    window.history.pushState({}, "", newUrl);
  }, []);

  // Update handleLoadFromHistory to use updateUrlId
  const handleLoadFromHistoryWithUrl = useCallback(
    (id: string) => {
      handleLoadFromHistory(id);
      updateUrlId(id);
    },
    [handleLoadFromHistory, updateUrlId],
  );

  // Effect: Load record from URL query param on mount
  const isResettingRef = useRef(false);
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && !currentRecordId && !isGlobalLoading && !isResettingRef.current) {
      // Only load if we haven't loaded anything yet
      handleLoadFromHistoryWithUrl(id);
    }
  }, [
    searchParams,
    handleLoadFromHistoryWithUrl,
    currentRecordId,
    isGlobalLoading,
  ]);

  // Handle duplicate file dialog: Load existing record
  const handleDuplicateLoadExisting = useCallback(async () => {
    if (!existingRecordForDuplicate) return;

    // Clear pending data and reset hook FIRST to prevent useEffect re-trigger
    setPendingParsedData(null);
    setExistingRecordForDuplicate(null);
    reset();

    // Load the existing record
    const record = await loadInvoiceUpload(existingRecordForDuplicate.id);
    if (record) {
      setData(record.data || []);
      setHeaders(record.headers || []);
      setFileName(record.fileName);
      setCurrentRecordId(existingRecordForDuplicate.id);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("id", existingRecordForDuplicate.id);
      window.history.pushState({}, "", newUrl);
      setValidationResult(null);
      setShowPriceColumns(false);
      // Restore qtyOverrides from saved data
      if (record.qtyOverrides && Object.keys(record.qtyOverrides).length > 0) {
        const restoredMap = new Map<
          number,
          {
            stdQty?: string;
            promoQty?: string;
            qtyBuy1?: string;
            qtyPro?: string;
          }
        >();
        Object.entries(record.qtyOverrides).forEach(([key, val]) => {
          restoredMap.set(Number(key), val);
        });
        setQtyOverrides(restoredMap);
      } else {
        setQtyOverrides(new Map());
      }
      // Restore bulkAcceptedItemCodes
      setBulkAcceptedItemCodes(new Set(record.bulkAcceptedItemCodes || []));
      // Restore reportMeta
      setReportMeta({
        reportName: null,
        reportRunDateTime: record.reportDate || null,
        reportParameters: record.supplierCode || null,
      });
      // Check if file is confirmed/cancelled
      if (record.status === "confirmed") {
        if (record.lastExportId) {
          // Verify against actual export status
          try {
            const expRes = await fetch(
              `/api/internal/exports/${record.lastExportId}/status`,
            );
            if (expRes.ok) {
              const expJson = await expRes.json();
              const realStatus = expJson?.data?.status;
              if (realStatus === "cancelled" || realStatus === "draft") {
                setConfirmedExportId(null);
                const syncStatus =
                  realStatus === "cancelled" ? "cancelled" : "exported";
                updateInvoiceStatus(
                  existingRecordForDuplicate.id,
                  syncStatus as WorkflowStatus,
                );
              } else {
                setConfirmedExportId(record.lastExportId || "confirmed");
                setShowPriceColumns(true);
              }
            } else {
              setConfirmedExportId(record.lastExportId || "confirmed");
              setShowPriceColumns(true);
            }
          } catch {
            setConfirmedExportId(record.lastExportId || "confirmed");
            setShowPriceColumns(true);
          }
        } else {
          // No lastExportId — try to find the linked export
          try {
            const searchRes = await fetch(
              `/api/exports?invoiceUploadId=${existingRecordForDuplicate.id}&limit=1`,
            );
            if (searchRes.ok) {
              const searchJson = await searchRes.json();
              const linkedExport = searchJson?.data?.[0];
              if (linkedExport) {
                const realStatus = linkedExport.status;
                if (realStatus === "cancelled" || realStatus === "draft") {
                  setConfirmedExportId(null);
                  const syncStatus =
                    realStatus === "cancelled" ? "cancelled" : "exported";
                  updateInvoiceStatus(
                    existingRecordForDuplicate.id,
                    syncStatus as WorkflowStatus,
                    { lastExportId: linkedExport.id },
                  );
                } else {
                  setConfirmedExportId(linkedExport.id);
                  setShowPriceColumns(true);
                  updateInvoiceStatus(
                    existingRecordForDuplicate.id,
                    "confirmed",
                    { lastExportId: linkedExport.id },
                  );
                }
              } else {
                setConfirmedExportId(null);
                updateInvoiceStatus(
                  existingRecordForDuplicate.id,
                  "exported" as WorkflowStatus,
                );
              }
            } else {
              setConfirmedExportId("confirmed");
              setShowPriceColumns(true);
            }
          } catch {
            setConfirmedExportId("confirmed");
            setShowPriceColumns(true);
          }
        }
      } else if (record.status === "cancelled") {
        setConfirmedExportId(null);
      } else {
        setConfirmedExportId(null);
      }
    }
  }, [
    existingRecordForDuplicate,
    loadInvoiceUpload,
    setData,
    setFileName,
    setReportMeta,
    reset,
    updateInvoiceStatus,
  ]);

  // Handle duplicate file dialog: Overwrite with new data
  const handleDuplicateOverwrite = useCallback(() => {
    if (!pendingParsedData || !fileName) return;

    // Store values before reset
    const currentFileName = fileName;
    const currentReportMeta = reportMeta;
    const parsedDataToUse = pendingParsedData;

    // Clear pending data and reset hook FIRST to prevent useEffect re-trigger
    setPendingParsedData(null);
    setExistingRecordForDuplicate(null);
    reset();

    // Restore fileName and reportMeta
    setFileName(currentFileName);
    setReportMeta(currentReportMeta);

    // Proceed with normal upload flow
    setData(parsedDataToUse.data);
    setHeaders(parsedDataToUse.headers);
    setCurrentRecordId(null);
    setValidationResult(null);
    setShowPriceColumns(false);
    setQtyOverrides(new Map());
    logImportExcel(currentFileName, parsedDataToUse.data.length);

    // Save to upload history
    saveInvoiceUpload(
      currentFileName,
      parsedDataToUse.headers,
      parsedDataToUse.data,
      {
        supplierCode: currentReportMeta?.reportParameters || undefined,
        reportDate: currentReportMeta?.reportRunDateTime || undefined,
      },
    ).then((newId) => {
      setCurrentRecordId(newId);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("id", newId);
      window.history.pushState({}, "", newUrl);
    });
  }, [
    pendingParsedData,
    fileName,
    setData,
    logImportExcel,
    saveInvoiceUpload,
    reportMeta,
    reset,
    setFileName,
    setReportMeta,
  ]);

  // Auto-save when data changes for an existing record (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");

  useEffect(() => {
    if (!currentRecordId || data.length === 0 || headers.length === 0) {
      return;
    }

    // Create a simple hash of the data to detect changes
    const qtyOverridesObj = Object.fromEntries(qtyOverrides);
    const dataHash = JSON.stringify({
      rowCount: data.length,
      firstRow: data[0],
      bulkAccepted: Array.from(bulkAcceptedItemCodes).sort(),
      qtyOverrides: qtyOverridesObj,
    });

    // Skip if data hasn't changed
    if (dataHash === lastSavedDataRef.current) {
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Convert Map to plain object for Firebase storage
    const qtyOverridesForStorage: Record<
      string,
      {
        stdQty?: string;
        promoQty?: string;
        qtyBuy1?: string;
        qtyPro?: string;
        priceBuy1Invoice?: string;
        priceBuy1Com?: string;
        priceProInvoice?: string;
        priceProCom?: string;
      }
    > = {};
    qtyOverrides.forEach((val, key) => {
      qtyOverridesForStorage[String(key)] = val;
    });

    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(() => {
      updateInvoiceUpload(
        currentRecordId,
        headers,
        data,
        Array.from(bulkAcceptedItemCodes),
        qtyOverridesForStorage,
      );
      lastSavedDataRef.current = dataHash;
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    currentRecordId,
    data,
    headers,
    bulkAcceptedItemCodes,
    qtyOverrides,
    updateInvoiceUpload,
  ]);

  // Toggle price columns
  const handleTogglePriceColumns = useCallback(async () => {
    setIsGlobalLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      setShowPriceColumns((prev) => {
        const newValue = !prev;
        // Update status to "calculated" when enabling price comparison
        if (newValue && currentRecordId) {
          updateInvoiceStatus(currentRecordId, "calculated");
        }
        return newValue;
      });
    } finally {
      setIsGlobalLoading(false);
    }
  }, [currentRecordId, updateInvoiceStatus]);

  // Handle bulk fix actions
  const handleBulkFix = useCallback((action: BulkFixAction) => {
    setBulkAcceptedItemCodes((prev) => {
      const next = new Set(prev);
      if (action.action === "accept") {
        next.add(action.itemCode);
      } else if (action.action === "skip") {
        // Skip just removes from accepted (if previously accepted)
        next.delete(action.itemCode);
      }
      return next;
    });
  }, []);

  const handleValidate = useCallback(async () => {
    setIsGlobalLoading(true);
    try {
      // Small delay to let UI render
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = validateData(data, headers);
      setValidationResult(result);
      const errorCount = result.errors.filter(
        (e) => e.severity === "error",
      ).length;
      const warningCount = result.errors.filter(
        (e) => e.severity === "warning",
      ).length;
      logValidate(errorCount, warningCount);

      // Update workflow status to "validated"
      if (currentRecordId) {
        updateInvoiceStatus(currentRecordId, "validated");
      }
    } finally {
      setIsGlobalLoading(false);
    }
  }, [data, headers, logValidate, currentRecordId, updateInvoiceStatus]);

  const handleCellUpdate = useCallback(
    (rowIndex: number, columnName: string, value: string) => {
      // Handle QtyBuy1 / QtyPro edits — recalculate prices
      if (columnName === "QtyBuy1" || columnName === "QtyPro") {
        // Get the original QTY from data
        const qtyHeader = headers.find((h) => h.toLowerCase() === "qty");
        const originalQty = qtyHeader
          ? Math.abs(Number(data[rowIndex]?.[qtyHeader]) || 0)
          : 0;

        // Parse the new value
        const newQty = parseInt(value) || 0;

        // Get current override
        const currentOverride = qtyOverrides.get(rowIndex) || {};

        // Find the row in displayData by _originalIdx
        const displayRow = displayData.find(
          (r) => r._originalIdx === rowIndex,
        ) as Record<string, unknown> | undefined;

        // Get current QtyBuy1 and QtyPro values
        const currentQtyBuy1 =
          columnName === "QtyBuy1"
            ? newQty
            : parseInt(
                String(
                  currentOverride.qtyBuy1 ?? displayRow?.["QtyBuy1"] ?? "0",
                ),
              ) || 0;
        const currentQtyPro =
          columnName === "QtyPro"
            ? newQty
            : parseInt(
                String(currentOverride.qtyPro ?? displayRow?.["QtyPro"] ?? "0"),
              ) || 0;

        // Validate: QtyBuy1 + QtyPro must not exceed Qty
        const totalQty = currentQtyBuy1 + currentQtyPro;
        if (totalQty > originalQty) {
          // Open modal instead of alert
          setQtyEditData({
            rowIndex,
            editField: columnName as "QtyBuy1" | "QtyPro",
            attemptedValue: newQty,
            row: (displayRow ?? {}) as Record<string, unknown>,
          });
          setQtyEditMaxQty(originalQty);
          setQtyEditOpen(true);
          return;
        }

        // Save to qtyOverrides
        const oldValue =
          currentOverride[columnName === "QtyBuy1" ? "qtyBuy1" : "qtyPro"] ||
          String(displayRow?.[columnName] ?? "-");

        setQtyOverrides((prev) => {
          const newMap = new Map(prev);
          newMap.set(rowIndex, {
            ...currentOverride,
            [columnName === "QtyBuy1" ? "qtyBuy1" : "qtyPro"]: String(newQty),
          });
          return newMap;
        });

        logEditCell(rowIndex, columnName, oldValue, value);
        return;
      }

      // Handle Std Qty / Promo Qty edits specially
      if (columnName === "Std Qty" || columnName === "Promo Qty") {
        // Get the original QTY from data
        const qtyHeader = headers.find((h) => h.toLowerCase() === "qty");
        const originalQty = qtyHeader
          ? Math.abs(Number(data[rowIndex]?.[qtyHeader]) || 0)
          : 0;

        // Parse the new value
        const newQty = parseInt(value) || 0;

        // Get current override
        const currentOverride = qtyOverrides.get(rowIndex) || {};

        // Find the row in displayData by _originalIdx
        const displayRow = displayData.find(
          (r) => r._originalIdx === rowIndex,
        ) as Record<string, unknown> | undefined;

        // Get current values (from override or displayData)
        const currentStdQty =
          columnName === "Std Qty"
            ? newQty
            : parseInt(
                String(
                  currentOverride.stdQty || displayRow?.["Std Qty"] || "0",
                ),
              ) || 0;
        const currentPromoQty =
          columnName === "Promo Qty"
            ? newQty
            : parseInt(
                String(
                  currentOverride.promoQty || displayRow?.["Promo Qty"] || "0",
                ).replace(/[^0-9]/g, ""),
              ) || 0;

        // Validate: Std Qty + Promo Qty should not exceed original QTY
        const totalQty = currentStdQty + currentPromoQty;
        if (totalQty > originalQty) {
          // Open modal for Std Qty / Promo Qty as well
          setQtyEditData({
            rowIndex,
            editField: columnName === "Std Qty" ? "QtyBuy1" : "QtyPro",
            attemptedValue: newQty,
            row: (displayRow ?? {}) as Record<string, unknown>,
          });
          setQtyEditMaxQty(originalQty);
          setQtyEditOpen(true);
          return;
        }

        // Save to qtyOverrides
        setQtyOverrides((prev) => {
          const newMap = new Map(prev);
          newMap.set(rowIndex, {
            ...currentOverride,
            [columnName === "Std Qty" ? "stdQty" : "promoQty"]: String(newQty),
          });
          return newMap;
        });

        logEditCell(
          rowIndex,
          columnName,
          String(
            currentOverride[columnName === "Std Qty" ? "stdQty" : "promoQty"] ||
              "-",
          ),
          value,
        );
        return;
      }

      // Handle Price Formula / Com Calculate direct edits
      // These columns are computed by enrichment, so we store overrides
      // the same way as qty overrides — applied after enrichment in useMemo.
      const PRICE_OVERRIDE_COLS: Record<string, string> = {
        PriceBuy1_Invoice_Formula: "priceBuy1Invoice",
        PriceBuy1_Com_Calculate: "priceBuy1Com",
        PricePro_Invoice_Formula: "priceProInvoice",
        PricePro_Com_Calculate: "priceProCom",
      };
      if (PRICE_OVERRIDE_COLS[columnName]) {
        const overrideKey = PRICE_OVERRIDE_COLS[columnName];
        const displayRow = displayData.find(
          (r) => r._originalIdx === rowIndex,
        ) as Record<string, unknown> | undefined;
        const oldValue = String(displayRow?.[columnName] ?? "-");

        setQtyOverrides((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(rowIndex) || {};
          newMap.set(rowIndex, {
            ...existing,
            [overrideKey]: value,
          });
          return newMap;
        });

        logEditCell(rowIndex, columnName, oldValue, value);
        return;
      }

      const oldValue = data[rowIndex]?.[columnName] ?? null;
      updateCell(rowIndex, columnName, value);
      logEditCell(rowIndex, columnName, oldValue, value);
      setValidationResult(null);
    },
    [updateCell, data, headers, logEditCell, qtyOverrides, displayData],
  );

  // Handler for QtyEditModal save
  const handleQtyEditModalSave = useCallback(
    (rowIndex: number, newQtyBuy1: number, newQtyPro: number) => {
      setQtyOverrides((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(rowIndex) || {};
        newMap.set(rowIndex, {
          ...existing,
          qtyBuy1: String(newQtyBuy1),
          qtyPro: String(newQtyPro),
        });
        return newMap;
      });
      logEditCell(rowIndex, "QtyBuy1", "-", String(newQtyBuy1));
      logEditCell(rowIndex, "QtyPro", "-", String(newQtyPro));
      setQtyEditOpen(false);
    },
    [logEditCell],
  );

  const handleShiftLeft = useCallback(
    (rowIndex: number, colIndex: number) => {
      shiftRowLeft(rowIndex, colIndex, headers);
      logShiftRowLeft(rowIndex, colIndex);
      setValidationResult(null);
    },
    [shiftRowLeft, headers, logShiftRowLeft],
  );

  const handleShiftRight = useCallback(
    (rowIndex: number, colIndex: number) => {
      shiftRowRight(rowIndex, colIndex, headers);
      logShiftRowRight(rowIndex, colIndex);
      setValidationResult(null);
    },
    [shiftRowRight, headers, logShiftRowRight],
  );

  const handleShiftColumnLeft = useCallback(
    (colIndex: number) => {
      shiftColumnLeft(colIndex, headers);
      logShiftColumnLeft(colIndex, headers[colIndex] || "", data.length);
      setValidationResult(null);
    },
    [shiftColumnLeft, headers, data.length, logShiftColumnLeft],
  );

  const handleShiftColumnRight = useCallback(
    (colIndex: number) => {
      shiftColumnRight(colIndex, headers);
      logShiftColumnRight(colIndex, headers[colIndex] || "", data.length);
      setValidationResult(null);
    },
    [shiftColumnRight, headers, data.length, logShiftColumnRight],
  );

  const handleClearCell = useCallback(
    (rowIndex: number, columnName: string) => {
      const oldValue = data[rowIndex]?.[columnName] ?? null;
      clearCell(rowIndex, columnName);
      logClearCell(rowIndex, columnName, oldValue);
      setValidationResult(null);
    },
    [clearCell, data, logClearCell],
  );

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      deleteRow(rowIndex);
      logDeleteRow(rowIndex);
      setValidationResult(null);
    },
    [deleteRow, logDeleteRow],
  );

  const handleAutoFix = useCallback(async () => {
    setIsGlobalLoading(true);
    try {
      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get all suggestions based on current data and validation errors
      const groups = getAllSuggestions(
        data,
        headers,
        validationResult?.errors || [],
      );
      setSuggestionGroups(groups);
      setShowSuggestions(true);
    } finally {
      setIsGlobalLoading(false);
    }
  }, [data, headers, validationResult]);

  // Handle applying a single suggestion
  const handleApplySingleSuggestion = useCallback(
    async (suggestion: FixSuggestion) => {
      setIsGlobalLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const { data: newData, appliedCount } = applySuggestions(
          data,
          headers,
          [suggestion],
        );
        if (appliedCount > 0) {
          setData(newData);
          logAutoFix(appliedCount);
          setValidationResult(null);
        }
      } finally {
        setIsGlobalLoading(false);
      }
    },
    [data, headers, setData, logAutoFix],
  );

  // Handle applying multiple suggestions
  const handleApplyMultipleSuggestions = useCallback(
    async (suggestions: FixSuggestion[]) => {
      setIsGlobalLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const { data: newData, appliedCount } = applySuggestions(
          data,
          headers,
          suggestions,
        );
        if (appliedCount > 0) {
          setData(newData);
          logAutoFix(appliedCount);
          setValidationResult(null);
        }
      } finally {
        setIsGlobalLoading(false);
      }
    },
    [data, headers, setData, logAutoFix],
  );

  const handleExportFixed = useCallback(() => {
    const exportFileName = `fixed_${fileName || "data.xlsx"}`;
    const exportHeaders = getExportHeaders(displayHeaders);
    exportToExcel(displayData, exportHeaders, exportFileName);
    logExportExcel(exportFileName);
  }, [displayData, displayHeaders, fileName, logExportExcel]);

  const handleExportJson = useCallback(() => {
    const baseName = (fileName || "data.xlsx").replace(/\.[^.]+$/, "");
    const exportFileName = `${baseName}.json`;
    const exportHeaders = getExportHeaders(displayHeaders);
    exportToJson(displayData, exportHeaders, exportFileName);
    logExportExcel(exportFileName);
  }, [displayData, displayHeaders, fileName, logExportExcel]);

  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [exportSuccessModal, setExportSuccessModal] = useState<{
    open: boolean;
    exportId: string;
    supplierCode: string;
    rowCount: number;
    reportDate: string;
    initialStatus: ExportStatusFull;
  }>({
    open: false,
    exportId: "",
    supplierCode: "",
    rowCount: 0,
    reportDate: "",
    initialStatus: "draft",
  });

  const handleSaveToCloud = useCallback(async () => {
    // Use fallback values if reportMeta is not available
    const supplierCode =
      reportMeta?.reportParameters ||
      fileName?.replace(/\.[^.]+$/, "") ||
      "UNKNOWN";
    const reportDate =
      reportMeta?.reportRunDateTime || new Date().toISOString();

    setIsGlobalLoading(true);
    setIsSavingToCloud(true);
    toast.info(
      "กำลังบันทึก...",
      `กำลังอัปโหลดข้อมูล ${displayData.length} แถว`,
    );
    try {
      const exportHeaders = getExportHeaders(displayHeaders);
      // Convert RawRow[] to array[][] format for API
      const dataArray: (string | number | null)[][] = displayData.map((row) =>
        exportHeaders.map((h) => {
          const val = (row as Record<string, unknown>)[h];
          if (val === undefined || val === null) return null;
          if (typeof val === "string" || typeof val === "number") return val;
          return String(val);
        }),
      );

      const exportId = await saveExportToCloud({
        supplierCode,
        supplierName: supplierCode,
        reportDate,
        fileName: fileName || undefined,
        headers: exportHeaders,
        data: dataArray,
        summary: priceIssueBreakdown
          ? {
              passedItems: priceIssueBreakdown.passedItems?.length || 0,
              lowMatchItems: priceIssueBreakdown.lowMatchItems?.length || 0,
              notFoundItems: priceIssueBreakdown.notFoundItems?.length || 0,
            }
          : {},
        passedCount,
        lowConfidenceCount,
        companyId: userData?.companyId || null,
        companyName: userData?.companyName || null,
        invoiceUploadId: currentRecordId || null,
      });

      // Auto-confirm the export immediately
      try {
        await fetch(`/api/internal/exports/${exportId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            confirmedBy:
              userData?.name ||
              userData?.displayName ||
              userData?.email ||
              "admin",
          }),
        });
      } catch (confirmErr) {
        console.warn("Auto-confirm failed (non-fatal):", confirmErr);
      }

      // Lock editing immediately
      setConfirmedExportId(exportId);

      // Show success modal already confirmed
      setExportSuccessModal({
        open: true,
        exportId,
        supplierCode,
        rowCount: dataArray.length,
        reportDate,
        initialStatus: "confirmed",
      });
      logSaveCloud(exportId);
      toast.success(
        "บันทึกสำเร็จ!",
        `Export ID: ${exportId.substring(0, 8)}...`,
      );

      // Update workflow status to "confirmed"
      if (currentRecordId) {
        updateInvoiceStatus(currentRecordId, "confirmed", {
          lastExportId: exportId,
        });
      }
    } catch (err) {
      console.error("Error saving to cloud:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      toast.error("เกิดข้อผิดพลาด", errMsg);
      alert(`เกิดข้อผิดพลาด: ${errMsg}`);
    } finally {
      setIsSavingToCloud(false);
      setIsGlobalLoading(false);
    }
  }, [
    displayData,
    displayHeaders,
    reportMeta,
    fileName,
    priceIssueBreakdown,
    passedCount,
    lowConfidenceCount,
    logSaveCloud,
    currentRecordId,
    updateInvoiceStatus,
    userData,
  ]);

  const handleExportReport = useCallback(() => {
    if (validationResult) {
      const reportFileName = "validation_report.xlsx";
      exportValidationReport(
        data,
        headers,
        validationResult.errors,
        reportFileName,
      );
      logExportReport(reportFileName);
    }
  }, [data, headers, validationResult, logExportReport]);

  const handleUndo = useCallback(() => {
    undo();
    logUndo();
  }, [undo, logUndo]);

  const handleRedo = useCallback(() => {
    redo();
    logRedo();
  }, [redo, logRedo]);

  const handleRowClick = useCallback((rowIndex: number) => {
    setHighlightRowIndex(rowIndex);
    // Calculate which page the row is on (20 rows per page)
    const PAGE_SIZE = 20;
    const targetPage = Math.floor(rowIndex / PAGE_SIZE);
    setGoToPage(targetPage);
  }, []);

  const handleReset = useCallback(() => {
    isResettingRef.current = true;
    router.replace("/watson-excel-validator");
    reset();
    lastProcessedParsedDataRef.current = null;
    setData([]);
    setHeaders([]);
    setValidationResult(null);
    setHighlightRowIndex(undefined);
    setCurrentRecordId(null);
    setConfirmedExportId(null);
    setShowPriceColumns(false);
    setQtyOverrides(new Map());
    setBulkAcceptedItemCodes(new Set());
    try {
      sessionStorage.removeItem("watson_validator_session");
    } catch {}
    if (currentRecordId) {
      try {
        sessionStorage.removeItem("watson_session_" + currentRecordId);
      } catch {}
    }
    // Reset guard after a tick to allow URL change to settle
    setTimeout(() => {
      isResettingRef.current = false;
    }, 500);
  }, [reset, setData, currentRecordId, router]);

  // Handle Calc Log click from DataTable
  const handleCalcLogClick = useCallback(
    (rowIndex: number, logText: string) => {
      // Find row by original index
      const row = displayData.find((r) => r._originalIdx === rowIndex) as
        | Record<string, unknown>
        | undefined;
      const itemCodeHeader = displayHeaders.find(
        (h) =>
          h.toLowerCase().includes("item code") ||
          h.toLowerCase().includes("itemcode") ||
          h.toLowerCase().includes("รหัสสินค้า"),
      );
      const itemCode = itemCodeHeader
        ? String(row?.[itemCodeHeader] || "")
        : "";
      setCalcLogItemCode(itemCode);
      setCalcLogText(logText);
      setCalcLogOpen(true);
    },
    [displayData, displayHeaders],
  );

  // Handle import price list with logging
  const handleImportPriceList = useCallback(
    (priceData: unknown[]) => {
      importPriceList(priceData as never);
      logImportPriceList("PriceList.json", priceData.length);
    },
    [importPriceList, logImportPriceList],
  );

  // Show offline page when not connected
  if (!isOnline || !isFirebaseConnected) {
    return (
      <OfflinePage
        isOnline={isOnline}
        isFirebaseConnected={isFirebaseConnected}
        lastChecked={lastChecked}
        onRetry={checkConnection}
      />
    );
  }

  return (
    <div>
      {/* Undo/Redo Controls */}
      {data.length > 0 && !confirmedExportId && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <UndoRedoControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            historyLength={historyLength}
          />
        </div>
      )}

      <div>
        {/* Upload Section */}
        {data.length === 0 && (
          <div className="w-full h-full">
            <div className="grid grid-cols-12 gap-6 h-full">
              {/* Left: File Uploader */}
              <div className="col-span-12 lg:col-span-8 space-y-4">
                <FileUploader
                  onFileSelect={uploadFile}
                  isLoading={isLoading}
                  fileName={fileName}
                  onReset={handleReset}
                />
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Right: Recent Files */}
              <div className="col-span-12 lg:col-span-4 h-full">
                <Card className="border-gray-200 h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        ไฟล์ล่าสุด
                        {!historyShowAll && (
                          <span className="text-[10px] font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            2 เดือน
                          </span>
                        )}
                      </span>
                      <button
                        className="text-[11px] text-indigo-500 hover:text-indigo-700 font-normal"
                        onClick={() => setHistoryShowAll((v) => !v)}
                      >
                        {historyShowAll ? "แสดงแค่ 2 เดือน" : "ดูทั้งหมด"}
                      </button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {isLoadingHistory ? (
                      // Skeleton loading
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-3 p-2">
                            <Skeleton className="h-4 w-4 shrink-0" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                            <Skeleton className="h-3 w-16" />
                          </div>
                        ))}
                      </div>
                    ) : filteredInvoiceHistory.length > 0 ? (
                      <div className="space-y-2">
                        {filteredInvoiceHistory.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer group border border-transparent hover:border-gray-200 transition-colors"
                            onClick={() =>
                              handleLoadFromHistoryWithUrl(record.id)
                            }
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileSpreadsheet className="h-4 w-4 text-gray-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-700 truncate">
                                    {record.fileName}
                                  </p>
                                  {getStatusBadge(record.status)}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{record.rowCount} แถว</span>
                                  {record.supplierName && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">
                                        {record.supplierName}
                                      </span>
                                    </>
                                  )}
                                  {record.uploader && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                          {record.uploader.name.charAt(0)}
                                        </span>
                                        {record.uploader.name}
                                      </span>
                                    </>
                                  )}
                                  {record.reportDate && (
                                    <>
                                      <span>•</span>
                                      <span>{record.reportDate}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                {new Date(record.uploadedAt).toLocaleDateString(
                                  "th-TH",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                              {/* Confirm button - only show for exported status */}
                              {record.status === "exported" &&
                                record.lastExportId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 h-6 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        // Confirm the export via internal API
                                        const res = await fetch(
                                          `/api/internal/exports/${record.lastExportId}/confirm`,
                                          {
                                            method: "POST",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              action: "confirm",
                                              confirmedBy:
                                                userData?.name ||
                                                userData?.displayName ||
                                                userData?.email ||
                                                "admin",
                                            }),
                                          },
                                        );
                                        if (!res.ok)
                                          throw new Error(
                                            "Failed to confirm export",
                                          );
                                        // Update invoice status
                                        updateInvoiceStatus(
                                          record.id,
                                          "confirmed",
                                        );
                                        toast.success(
                                          "ยืนยันสำเร็จ!",
                                          "พร้อมให้ระบบอื่นใช้งาน",
                                        );
                                      } catch (err) {
                                        console.error("Error confirming:", err);
                                        toast.error(
                                          "เกิดข้อผิดพลาด",
                                          "ไม่สามารถยืนยันได้",
                                        );
                                      }
                                    }}
                                    title="ยืนยันข้อมูล"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeInvoiceUpload(record.id);
                                }}
                                title="ลบ"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        {!historyShowAll && invoiceUploadHistory.length > 0 ? (
                          <>
                            <p className="text-sm">ไม่มีไฟล์ใน 2 เดือนล่าสุด</p>
                            <button
                              className="mt-2 text-xs text-indigo-500 hover:text-indigo-700"
                              onClick={() => setHistoryShowAll(true)}
                            >
                              ดูทั้งหมด
                            </button>
                          </>
                        ) : (
                          <p className="text-sm">ยังไม่มีไฟล์ล่าสุด</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Confirmed Exports Section */}
            {(isLoadingConfirmedExports ||
              confirmedExports.length > 0 ||
              confirmedExportsTotal > 0) && (
              <div className="mt-6">
                <Card className="border-green-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Export ทั้งหมด
                        {confirmedExportsTotal > 0 && (
                          <span className="text-xs font-normal text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            {confirmedExportsTotal} รายการ
                          </span>
                        )}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-0">
                    {isLoadingConfirmedExports ? (
                      <div className="px-6 space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex gap-4 py-2">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-4 w-1/6" />
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-1/6" />
                            <Skeleton className="h-4 w-1/5" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Table header */}
                        <div className="grid grid-cols-[2fr_1.2fr_3rem_1.2fr_1.4fr_1fr] gap-x-4 px-6 py-2 bg-gray-50 border-y border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          <span>ชื่อไฟล์</span>
                          <span>Supplier</span>
                          <span className="text-right">แถว</span>
                          <span>ยืนยันโดย</span>
                          <span>วันที่ยืนยัน</span>
                          <span>Export ID</span>
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-gray-50">
                          {confirmedExports.map((exp) => (
                            <div
                              key={exp.id}
                              className={`grid grid-cols-[2fr_1.2fr_3rem_1.2fr_1.4fr_1fr] gap-x-4 px-6 py-2.5 transition-colors cursor-pointer ${
                                exp.status === "cancelled"
                                  ? "bg-red-50 hover:bg-red-100 opacity-75"
                                  : "hover:bg-green-50"
                              }`}
                              onClick={() =>
                                setExportSuccessModal({
                                  open: true,
                                  exportId: exp.id,
                                  supplierCode: exp.supplierCode,
                                  rowCount: exp.rowCount,
                                  reportDate: exp.exportedAt,
                                  initialStatus:
                                    exp.status === "cancelled"
                                      ? "cancelled"
                                      : "confirmed",
                                })
                              }
                            >
                              <span
                                className="text-sm text-gray-800 truncate font-medium flex items-center gap-1.5"
                                title={exp.fileName || exp.id}
                              >
                                {exp.fileName || (
                                  <span className="text-gray-400 italic">
                                    (ไม่ระบุ)
                                  </span>
                                )}
                                {exp.status === "cancelled" && (
                                  <span className="text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                                    ยกเลิกแล้ว
                                  </span>
                                )}
                              </span>
                              <span className="text-sm text-gray-600 truncate">
                                {exp.supplierCode}
                              </span>
                              <span className="text-sm text-gray-600 text-right">
                                {exp.rowCount.toLocaleString()}
                              </span>
                              <span className="text-sm text-gray-600 truncate">
                                {exp.confirmedBy || (
                                  <span className="text-gray-400">—</span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500">
                                {exp.confirmedAt
                                  ? new Date(
                                      exp.confirmedAt,
                                    ).toLocaleDateString("th-TH", {
                                      day: "numeric",
                                      month: "short",
                                      year: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </span>
                              <span
                                className={`font-mono text-[10px] px-1.5 py-0.5 rounded self-center truncate ${
                                  exp.status === "cancelled"
                                    ? "text-red-700 bg-red-50 border border-red-200"
                                    : "text-green-700 bg-green-50 border border-green-100"
                                }`}
                              >
                                {exp.id.substring(0, 8)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Pagination */}
                        {confirmedExportsTotal > CONFIRMED_PAGE_SIZE && (
                          <div className="flex items-center justify-between px-6 pt-3 pb-1 border-t border-gray-100">
                            <span className="text-xs text-gray-500">
                              {confirmedExportsPage * CONFIRMED_PAGE_SIZE + 1}–
                              {Math.min(
                                (confirmedExportsPage + 1) *
                                  CONFIRMED_PAGE_SIZE,
                                confirmedExportsTotal,
                              )}{" "}
                              จาก {confirmedExportsTotal} รายการ
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={confirmedExportsPage === 0}
                                onClick={() => {
                                  const p = confirmedExportsPage - 1;
                                  setConfirmedExportsPage(p);
                                  fetchConfirmedExports(p);
                                }}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={
                                  (confirmedExportsPage + 1) *
                                    CONFIRMED_PAGE_SIZE >=
                                  confirmedExportsTotal
                                }
                                onClick={() => {
                                  const p = confirmedExportsPage + 1;
                                  setConfirmedExportsPage(p);
                                  fetchConfirmedExports(p);
                                }}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Data Section */}
        {data.length > 0 && (
          <div className="space-y-6">
            {/* Action Bar with Steps */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">{fileName}</span>
                    <span className="text-sm text-gray-500">
                      ({data.length} แถว, {headers.length} คอลัมน์)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleReset} variant="ghost" size="sm">
                      <Home className="h-4 w-4 mr-2" />
                      กลับหน้า Home
                    </Button>
                    <Button onClick={handleReset} variant="ghost" size="sm">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      เริ่มใหม่
                    </Button>
                  </div>
                </div>

                {/* Confirmed file banner */}
                {confirmedExportId && (
                  <div className="flex items-center gap-3 p-3 mb-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-800">
                        ไฟล์นี้ยืนยันแล้ว
                      </p>
                      <p className="text-sm text-green-600">
                        Export ID:{" "}
                        <code className="bg-green-100 px-2 py-0.5 rounded font-mono">
                          {confirmedExportId}
                        </code>
                      </p>
                    </div>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                      Read-only
                    </span>
                  </div>
                )}

                {/* Step-based workflow */}
                <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
                  {/* Step 1: Validate */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        validationResult
                          ? validationResult.isValid
                            ? "bg-green-500 text-white"
                            : "bg-yellow-500 text-white"
                          : "bg-blue-500 text-white"
                      }`}
                    >
                      1
                    </span>
                    <Button
                      onClick={handleValidate}
                      variant={validationResult ? "outline" : "default"}
                      size="sm"
                      disabled={!!confirmedExportId}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {confirmedExportId
                        ? "✓ ยืนยันแล้ว"
                        : validationResult
                          ? validationResult.isValid
                            ? "✓ ผ่าน"
                            : "Validate ใหม่"
                          : "Validate"}
                    </Button>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-gray-400" />

                  {/* Step 2: Fix (if needed) */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        validationResult?.isValid
                          ? "bg-green-500 text-white"
                          : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      2
                    </span>
                    <Button
                      onClick={handleAutoFix}
                      variant="outline"
                      size="sm"
                      disabled={
                        !!confirmedExportId ||
                        !validationResult ||
                        validationResult.isValid
                      }
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Auto-fix
                    </Button>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-gray-400" />

                  {/* Step 3: Price Comparison */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        showPriceColumns
                          ? "bg-indigo-500 text-white"
                          : validationResult?.isValid
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      3
                    </span>
                    <Button
                      onClick={() => setShowPricePanel(!showPricePanel)}
                      variant={showPricePanel ? "default" : "outline"}
                      size="sm"
                      className={
                        showPricePanel
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : ""
                      }
                      disabled={!validationResult?.isValid}
                      title={
                        !validationResult?.isValid ? "Validate ให้ผ่านก่อน" : ""
                      }
                    >
                      <Library className="h-4 w-4 mr-2" />
                      เทียบราคา
                      {priceListSummary.totalItems > 0 && (
                        <span className="ml-1 text-xs">
                          ({priceListSummary.totalItems})
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-gray-400" />

                  {/* Step 4: Export */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        confirmedExportId
                          ? "bg-green-600 text-white"
                          : validationResult?.isValid
                            ? "bg-green-500 text-white"
                            : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      4
                    </span>
                    {confirmedExportId ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-md border border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          ยืนยันแล้ว
                        </span>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleExportFixed}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Export Excel (.xlsx)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportJson}>
                            <FileJson className="h-4 w-4 mr-2" />
                            Export JSON (.json)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleSaveToCloud}
                            disabled={isSavingToCloud}
                          >
                            {isSavingToCloud ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Cloud className="h-4 w-4 mr-2" />
                            )}
                            Save to Cloud (API)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {validationResult &&
                      !validationResult.isValid &&
                      !confirmedExportId && (
                        <Button
                          onClick={handleExportReport}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Report
                        </Button>
                      )}
                  </div>

                  {/* Separator + Confirm & Save to Cloud button */}
                  {validationResult?.isValid &&
                    showPriceColumns &&
                    !confirmedExportId && (
                      <>
                        <div className="h-6 w-px bg-gray-300 mx-1" />
                        <Button
                          onClick={() => setConfirmSaveOpen(true)}
                          disabled={isSavingToCloud}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <UploadCloud className="h-4 w-4 mr-2" />
                          ยืนยันและบันทึก
                        </Button>
                      </>
                    )}
                </div>
              </CardContent>
            </Card>

            {/* Fix Suggestion Modal */}
            <FixSuggestionModal
              open={showSuggestions}
              groups={suggestionGroups}
              onApplySingle={handleApplySingleSuggestion}
              onApplyGroup={handleApplyMultipleSuggestions}
              onApplyAll={handleApplyMultipleSuggestions}
              onClose={() => setShowSuggestions(false)}
              onHighlightRow={(rowIndex) => {
                setHighlightRowIndex(rowIndex);
                setGoToPage(Math.floor(rowIndex / 20) + 1);
              }}
            />

            {/* Price Panel - Step 3 */}
            {showPricePanel && (
              <Card className="border-indigo-200 bg-indigo-50/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
                      <Library className="h-5 w-5" />
                      Price List
                    </CardTitle>
                    {priceListSummary.totalItems > 0 && (
                      <Button
                        onClick={handleTogglePriceColumns}
                        variant={showPriceColumns ? "default" : "outline"}
                        size="sm"
                        className={
                          showPriceColumns
                            ? "bg-green-600 hover:bg-green-700"
                            : "border-indigo-300 text-indigo-600 hover:bg-indigo-100"
                        }
                      >
                        {showPriceColumns
                          ? "✅ กำลังวิเคราะห์ราคา"
                          : "📊 วิเคราะห์ราคา"}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-indigo-600">
                    Import ไฟล์ Price List แล้วกด &quot;วิเคราะห์ราคา&quot;
                    เพื่อเทียบกับ Invoice
                  </p>
                </CardHeader>
                <CardContent>
                  <PriceListSidebar
                    priceHistory={itemPriceHistory}
                    priceListRaw={priceListRaw}
                    summary={priceListSummary}
                    onImport={handleImportPriceList}
                    onMerge={addOrUpdatePriceList}
                    onClear={clearPriceList}
                    isInline={true}
                    importHistory={priceImportHistory}
                    onSaveHistory={addHistoryRecord}
                    onHistoryAdd={addRecordFromServer}
                    onRemoveHistory={removeHistoryRecord}
                    onClearHistory={clearImportHistory}
                    onLoadHistoryData={handleLoadPriceHistoryData}
                    currentUser={userData}
                  />
                </CardContent>
              </Card>
            )}

            {/* Main Content - Full Width Table */}
            <div className="space-y-6">
              {/* Validation Summary - Top */}
              <ValidationSummary result={validationResult} />

              <div className="w-full">
                {/* Price Analysis Bar */}
                {showPriceColumns && (
                  <div className="mb-4 border border-indigo-200 rounded-lg overflow-hidden">
                    <div className="p-3 bg-indigo-50">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Stats — pass/fail */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span className="text-sm text-gray-700">
                            <span className="font-semibold text-green-700">
                              {passedCount}
                            </span>{" "}
                            ผ่าน
                          </span>
                        </div>

                        {/* Breakdown badges */}
                        {priceIssueBreakdown && (
                          <>
                            {priceIssueBreakdown.notFoundRows > 0 && (
                              <button
                                onClick={() => {
                                  setShowIssuePanel(true);
                                  setPriceFilterCategory("not-found");
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-red-100 border border-red-200 rounded-full text-xs text-red-700 hover:bg-red-200 transition-colors"
                              >
                                ❌ ไม่พบรหัส{" "}
                                <span className="font-semibold">
                                  {priceIssueBreakdown.notFoundItems.length}
                                </span>{" "}
                                สินค้า ({priceIssueBreakdown.notFoundRows} แถว)
                              </button>
                            )}
                            {priceIssueBreakdown.noPeriodRows > 0 && (
                              <button
                                onClick={() => {
                                  setShowIssuePanel(true);
                                  setPriceFilterCategory("no-period");
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 border border-yellow-200 rounded-full text-xs text-yellow-700 hover:bg-yellow-200 transition-colors"
                              >
                                ❓ ไม่มีช่วงราคา{" "}
                                <span className="font-semibold">
                                  {priceIssueBreakdown.noPeriodItems.length}
                                </span>{" "}
                                สินค้า ({priceIssueBreakdown.noPeriodRows} แถว)
                              </button>
                            )}
                            {priceIssueBreakdown.lowMatchRows > 0 && (
                              <button
                                onClick={() => {
                                  setShowIssuePanel(true);
                                  setPriceFilterCategory("low-match");
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 border border-orange-200 rounded-full text-xs text-orange-700 hover:bg-orange-200 transition-colors"
                              >
                                ⚠ ราคาไม่ตรง{" "}
                                <span className="font-semibold">
                                  {priceIssueBreakdown.lowMatchItems.length}
                                </span>{" "}
                                สินค้า ({priceIssueBreakdown.lowMatchRows} แถว)
                              </button>
                            )}
                          </>
                        )}

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Confidence input */}
                        <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md border border-indigo-200">
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            ความเชื่อมั่น:
                          </span>
                          <input
                            type="number"
                            min="80"
                            max="100"
                            step="1"
                            defaultValue={Math.round(confidenceThreshold * 100)}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (val >= 80 && val <= 100) {
                                setConfidenceThreshold(val / 100);
                              } else {
                                e.target.value = String(
                                  Math.round(confidenceThreshold * 100),
                                );
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseInt(
                                  (e.target as HTMLInputElement).value,
                                  10,
                                );
                                if (val >= 80 && val <= 100) {
                                  setConfidenceThreshold(val / 100);
                                }
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-14 h-6 text-center text-xs font-bold text-indigo-600 border border-gray-300 rounded px-1"
                            title="กรอกค่า 80-100 แล้วกด Enter"
                          />
                          <span className="text-xs text-gray-600">%</span>
                        </div>

                        {/* Show only low */}
                        <Button
                          onClick={() =>
                            setShowOnlyLowConfidence(!showOnlyLowConfidence)
                          }
                          variant={
                            showOnlyLowConfidence ? "default" : "outline"
                          }
                          size="sm"
                          className={
                            showOnlyLowConfidence
                              ? "bg-orange-500 hover:bg-orange-600 text-white"
                              : "border-orange-300 text-orange-600 hover:bg-orange-50"
                          }
                          title="แสดงเฉพาะแถวที่ไม่ผ่านเกณฑ์"
                        >
                          {showOnlyLowConfidence ? (
                            <>⚠ เฉพาะ Low ({lowConfidenceCount})</>
                          ) : (
                            <>👁 เฉพาะ Low ({lowConfidenceCount})</>
                          )}
                        </Button>

                        {/* Issue Panel Toggle */}
                        {lowConfidenceCount > 0 && (
                          <Button
                            onClick={() => setShowIssuePanel(!showIssuePanel)}
                            variant={showIssuePanel ? "default" : "outline"}
                            size="sm"
                            className={
                              showIssuePanel
                                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                : "border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                            }
                          >
                            🔍 วิเคราะห์ปัญหา
                          </Button>
                        )}

                        {/* Bulk Fix Toggle */}
                        {lowConfidenceCount > 0 && (
                          <Button
                            onClick={() =>
                              setShowBulkFixPanel(!showBulkFixPanel)
                            }
                            variant={showBulkFixPanel ? "default" : "outline"}
                            size="sm"
                            className={
                              showBulkFixPanel
                                ? "bg-amber-500 hover:bg-amber-600 text-white"
                                : "border-amber-300 text-amber-600 hover:bg-amber-50"
                            }
                          >
                            <Wand2 className="h-3.5 w-3.5 mr-1" />
                            Bulk Fix
                            {bulkAcceptedItemCodes.size > 0 && (
                              <span className="ml-1 bg-white/30 px-1.5 py-0.5 rounded text-xs">
                                {bulkAcceptedItemCodes.size}
                              </span>
                            )}
                          </Button>
                        )}

                        {/* Recalculate */}
                        <Button
                          onClick={() => {
                            setCalcStatus("calculating");
                            setTimeout(() => {
                              setPriceRecalcTrigger((t) => t + 1);
                              setCalcStatus("completed");
                              setTimeout(() => setCalcStatus("idle"), 3000);
                            }, 100);
                          }}
                          variant={
                            calcStatus === "completed" ? "default" : "outline"
                          }
                          size="sm"
                          disabled={calcStatus === "calculating"}
                          className={
                            calcStatus === "completed"
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                          }
                          title="คำนวณราคาใหม่หลังจาก Import โปรโมชั่นเพิ่ม"
                        >
                          {calcStatus === "calculating" ? (
                            <>⏳ กำลังคำนวณ...</>
                          ) : calcStatus === "completed" ? (
                            <>✓ คำนวณเสร็จแล้ว</>
                          ) : (
                            <>🔄 คำนวณใหม่</>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Issue Panel & Bulk Fix Panel (side by side when both open) */}
                    {(showIssuePanel || showBulkFixPanel) && (
                      <div
                        className={`grid gap-3 border-t border-gray-200 ${
                          showIssuePanel && showBulkFixPanel
                            ? "grid-cols-2"
                            : "grid-cols-1"
                        }`}
                      >
                        {/* Issue Panel (expandable) */}
                        {showIssuePanel && priceIssueBreakdown && (
                          <div className="p-3 bg-white border-r border-indigo-100 max-h-125 overflow-y-auto">
                            <PriceIssuePanel
                              breakdown={priceIssueBreakdown}
                              activeFilter={priceFilterCategory}
                              onFilterByItemCode={(itemCode, category) => {
                                // For passed items, filter to show only passed rows
                                // For issue items, filter to show only low-confidence rows
                                if (category === "passed") {
                                  setShowOnlyLowConfidence(false);
                                  setPriceFilterCategory("passed");
                                } else {
                                  setShowOnlyLowConfidence(true);
                                  setPriceFilterCategory(category);
                                }
                                // Trigger search in DataTable by setting the search externally
                                // For now, we use the existing filter mechanism
                                const el =
                                  document.querySelector<HTMLInputElement>(
                                    '[placeholder="ค้นหาข้อมูล..."]',
                                  );
                                if (el) {
                                  const nativeInputValueSetter =
                                    Object.getOwnPropertyDescriptor(
                                      window.HTMLInputElement.prototype,
                                      "value",
                                    )?.set;
                                  nativeInputValueSetter?.call(el, itemCode);
                                  el.dispatchEvent(
                                    new Event("input", { bubbles: true }),
                                  );
                                  el.dispatchEvent(
                                    new Event("change", { bubbles: true }),
                                  );
                                }
                              }}
                              onFilterByCategory={(category) => {
                                setPriceFilterCategory(category);
                                if (category && category !== "passed") {
                                  setShowOnlyLowConfidence(true);
                                } else if (category === "passed") {
                                  setShowOnlyLowConfidence(false);
                                } else {
                                  // null = clear filter, reset showOnlyLowConfidence
                                  setShowOnlyLowConfidence(false);
                                }
                              }}
                            />
                          </div>
                        )}

                        {/* Bulk Fix Panel (expandable) */}
                        {showBulkFixPanel && displayData.length > 0 && (
                          <div className="p-3 bg-white max-h-125 overflow-y-auto">
                            <BulkFixSuggestionPanel
                              enrichedData={displayData}
                              headers={displayHeaders}
                              confidenceThreshold={confidenceThreshold}
                              acceptedItemCodes={bulkAcceptedItemCodes}
                              onBulkFix={handleBulkFix}
                              onClose={() => setShowBulkFixPanel(false)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      ข้อมูล
                      {showPriceColumns && (
                        <span className="text-sm font-normal text-purple-600 bg-purple-50 px-2 py-1 rounded">
                          + STD/Pro Price
                        </span>
                      )}
                    </CardTitle>
                    {reportMeta &&
                      (reportMeta.reportRunDateTime ||
                        reportMeta.reportParameters) && (
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {reportMeta.reportRunDateTime && (
                            <span className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                              <Calendar className="h-3.5 w-3.5 text-gray-500" />
                              Report: {reportMeta.reportRunDateTime}
                            </span>
                          )}
                          {reportMeta.reportParameters && (
                            <span className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                              <Building2 className="h-3.5 w-3.5 text-gray-500" />
                              Supplier: {reportMeta.reportParameters}
                            </span>
                          )}
                        </div>
                      )}
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        ดับเบิลคลิกที่ cell เพื่อแก้ไข | คลิกที่หัว Column เพื่อ
                        Shift ทั้ง Column
                      </p>
                      {/* Column visibility picker */}
                      {toggleableColumns.length > 0 && (
                        <DropdownMenu
                          open={colPickerOpen}
                          onOpenChange={setColPickerOpen}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                            >
                              <ChevronDown className="h-3 w-3" />
                              คอลัมน์
                              {hiddenColumns.size > 0 && (
                                <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 text-[10px] font-medium">
                                  ซ่อน {hiddenColumns.size}
                                </span>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="max-h-80 overflow-y-auto w-56"
                          >
                            {toggleableColumns.map((col) => (
                              <DropdownMenuCheckboxItem
                                key={col}
                                checked={!hiddenColumns.has(col)}
                                // prevent dropdown from closing on each check
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={(checked) => {
                                  setHiddenColumns((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.delete(col);
                                    else next.add(col);
                                    return next;
                                  });
                                }}
                              >
                                {col}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      data={displayData}
                      headers={visibleHeaders}
                      errors={validationResult?.errors || []}
                      onCellUpdate={handleCellUpdate}
                      onShiftLeft={handleShiftLeft}
                      onShiftRight={handleShiftRight}
                      onShiftColumnLeft={handleShiftColumnLeft}
                      onShiftColumnRight={handleShiftColumnRight}
                      onClearCell={handleClearCell}
                      onDeleteRow={handleDeleteRow}
                      highlightRowIndex={highlightRowIndex}
                      goToPage={goToPage}
                      onPageChanged={() => setGoToPage(undefined)}
                      confidenceThreshold={
                        showPriceColumns ? confidenceThreshold : undefined
                      }
                      bulkAcceptedItemCodes={
                        showPriceColumns ? bulkAcceptedItemCodes : undefined
                      }
                      onCalcLogClick={
                        showPriceColumns ? handleCalcLogClick : undefined
                      }
                      readOnly={!!confirmedExportId}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Error Details */}
              {validationResult && !validationResult.isValid && (
                <ErrorDetails
                  errors={validationResult.errors}
                  onRowClick={handleRowClick}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Calculation Log Modal */}
      <CalculationLogModal
        open={calcLogOpen}
        onOpenChange={setCalcLogOpen}
        logText={calcLogText}
        itemCode={calcLogItemCode}
      />

      {/* Export Success Modal */}
      <ExportSuccessModal
        open={exportSuccessModal.open}
        onOpenChange={(open) => {
          if (!open) {
            // When modal closes, sync read-only lock from modal's final status
            setExportSuccessModal((prev) => {
              if (prev.initialStatus === "confirmed") {
                setConfirmedExportId(prev.exportId);
              } else {
                setConfirmedExportId(null);
              }
              return { ...prev, open: false };
            });
            // Refetch from cloud to reflect latest state
            fetchConfirmedExports(confirmedExportsPage);
          } else {
            setExportSuccessModal((prev) => ({ ...prev, open: true }));
          }
        }}
        exportId={exportSuccessModal.exportId}
        supplierCode={exportSuccessModal.supplierCode}
        rowCount={exportSuccessModal.rowCount}
        reportDate={exportSuccessModal.reportDate}
        initialStatus={exportSuccessModal.initialStatus}
        onStatusChange={(status) => {
          const isConfirmed = status === "confirmed";
          const isCancelled = status === "cancelled";
          // Lock/unlock read-only immediately
          if (isConfirmed) {
            setConfirmedExportId(exportSuccessModal.exportId);
          } else {
            setConfirmedExportId(null);
          }
          // Keep modal initialStatus in sync
          setExportSuccessModal((prev) => ({
            ...prev,
            initialStatus: status,
          }));
          // Refetch from cloud so table reflects real Firestore state
          fetchConfirmedExports(confirmedExportsPage);
          // The confirm API already synced the invoice record server-side.
          // Update local state: find by currentRecordId OR by lastExportId
          const targetRecordId =
            currentRecordId ||
            invoiceUploadHistory.find(
              (r) => r.lastExportId === exportSuccessModal.exportId,
            )?.id;
          const newInvoiceStatus = isConfirmed
            ? "confirmed"
            : isCancelled
              ? "cancelled"
              : "exported";
          if (targetRecordId) {
            updateInvoiceStatus(
              targetRecordId,
              newInvoiceStatus as WorkflowStatus,
              isConfirmed
                ? { lastExportId: exportSuccessModal.exportId }
                : undefined,
            );
          }
          // Always refetch invoice history to pick up server-side sync
          // (handles the case where targetRecordId is null, e.g. home page)
          refetchInvoiceHistory();
        }}
      />

      {/* Qty Edit Modal */}
      <QtyEditModal
        open={qtyEditOpen}
        onOpenChange={setQtyEditOpen}
        data={qtyEditData}
        maxQty={qtyEditMaxQty}
        onSave={handleQtyEditModalSave}
      />

      {/* Confirm Save Modal */}
      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <UploadCloud className="h-5 w-5" />
              ยืนยันการบันทึกข้อมูล
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ไฟล์:</span>
                <span className="font-medium truncate max-w-50">
                  {fileName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Supplier:</span>
                <span className="font-mono">
                  {reportMeta?.reportParameters || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">จำนวนแถว:</span>
                <span className="font-mono">{displayData.length} แถว</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ผ่านการตรวจ:</span>
                <span className="font-mono text-green-700">
                  {passedCount} / {displayData.length}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              ข้อมูลนี้จะถูกบันทึกไปยัง Cloud และสามารถเรียกดูผ่าน API ได้
              เมื่อยืนยันแล้วจะ<strong>ล็อคไฟล์</strong>ไม่สามารถแก้ไขได้อีก
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setConfirmSaveOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                setConfirmSaveOpen(false);
                handleSaveToCloud();
              }}
              disabled={isSavingToCloud}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSavingToCloud ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4 mr-2" />
              )}
              ยืนยันและบันทึก
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate File Dialog */}
      <DuplicateFileDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        fileName={fileName || ""}
        existingRecordDate={
          existingRecordForDuplicate
            ? new Date(existingRecordForDuplicate.uploadedAt).toLocaleString(
                "th-TH",
                {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )
            : ""
        }
        existingRecordRows={existingRecordForDuplicate?.rowCount || 0}
        onLoadExisting={handleDuplicateLoadExisting}
        onOverwrite={handleDuplicateOverwrite}
      />
      <LoadingOverlay
        isLoading={isGlobalLoading}
        message="กำลังโหลดข้อมูล..."
      />

      {/* Floating Activity Log Chat Head */}
      <ActivityLogsSidebar
        logs={activityLogs}
        summary={logsSummary}
        onClearLogs={clearLogs}
      />
    </div>
  );
}
