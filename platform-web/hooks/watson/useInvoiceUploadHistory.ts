"use client";

import { useAuthStore } from "@/stores/auth.store";
import { RawRow } from "@/types/watson/invoice";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export type WorkflowStatus =
  | "uploaded"
  | "validated"
  | "calculated"
  | "exported"
  | "confirmed";

const MAX_HISTORY = 5;

export interface InvoiceUploadRecord {
  id: string;
  fileName: string;
  uploadedAt: string; // ISO date string
  rowCount: number;
  supplierCode?: string;
  supplierName?: string;
  reportDate?: string;
  uploader?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  headers?: string[]; // Lazy loaded
  data?: RawRow[]; // Lazy loaded
  bulkAcceptedItemCodes?: string[]; // Lazy loaded
  qtyOverrides?: Record<
    string,
    { stdQty?: string; promoQty?: string; qtyBuy1?: string; qtyPro?: string }
  >; // Lazy loaded
  storageUrl?: string; // Legacy/Reference
  status?: WorkflowStatus;
  lastExportId?: string;
  validatedAt?: string;
  calculatedAt?: string;
  exportedAt?: string;
  confirmedAt?: string;
  isLoading?: boolean; // UI state
}

export interface InvoiceUploadHistoryReturn {
  history: Omit<InvoiceUploadRecord, "data" | "headers">[];
  fullHistory: InvoiceUploadRecord[];
  isLoading: boolean;
  addRecord: (
    fileName: string,
    headers: string[],
    data: RawRow[],
    meta?: {
      supplierCode?: string;
      supplierName?: string;
      reportDate?: string;
      uploader?: {
        id: string;
        name: string;
        email: string;
        role: string;
      };
    },
  ) => Promise<string>;
  loadRecord: (id: string) => Promise<InvoiceUploadRecord | null>;
  loadRecordData: (record: InvoiceUploadRecord) => Promise<InvoiceUploadRecord>;
  updateRecord: (
    id: string,
    headers: string[],
    data: RawRow[],
    bulkAcceptedItemCodes?: string[],
    qtyOverrides?: Record<
      string,
      { stdQty?: string; promoQty?: string; qtyBuy1?: string; qtyPro?: string }
    >,
  ) => void;
  updateStatus: (
    id: string,
    status: WorkflowStatus,
    options?: { lastExportId?: string },
  ) => void;
  removeRecord: (id: string) => void;
  clearHistory: () => void;
}

export function useInvoiceUploadHistory(): InvoiceUploadHistoryReturn {
  const { userData } = useAuthStore();
  const [historyItems, setHistoryItems] = useState<InvoiceUploadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load metadata from API (lazy load data later)
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    const fetchHistory = async () => {
      try {
        const params = new URLSearchParams({ limit: String(MAX_HISTORY) });
        const companyId = userData?.companyId;
        if (companyId) params.set("companyId", companyId);

        const response = await fetch(
          "/api/watson/invoice-history?" + params.toString(),
        );
        if (!response.ok) throw new Error("Failed to fetch history");

        const records = await response.json();

        if (mounted) {
          const formatted = records.map((d: any) => ({
            id: d.id,
            fileName: d.fileName,
            uploadedAt: d.uploadedAt,
            rowCount: d.rowCount,
            supplierCode: d.supplierCode,
            supplierName: d.supplierName,
            reportDate: d.reportDate,
            storageUrl: d.storageUrl,
            status: d.status || "uploaded",
            lastExportId: d.lastExportId,
            validatedAt: d.validatedAt,
            calculatedAt: d.calculatedAt,
            exportedAt: d.exportedAt,
            confirmedAt: d.confirmedAt,
            bulkAcceptedItemCodes: d.bulkAcceptedItemCodes || [],
            qtyOverrides: d.qtyOverrides || {},
            isLoading: false,
          }));
          setHistoryItems(formatted);
        }
      } catch (err) {
        console.error("Error loading invoice upload history:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchHistory();

    return () => {
      mounted = false;
    };
  }, [userData?.companyId]);

  // Update history helper
  const updateLocalHistory = useCallback(
    (updater: (prev: InvoiceUploadRecord[]) => InvoiceUploadRecord[]) => {
      setHistoryItems(updater);
    },
    [],
  );

  // Load full data for a record from API
  const loadRecordData = useCallback(
    async (record: InvoiceUploadRecord): Promise<InvoiceUploadRecord> => {
      // Return existing data if already loaded
      if (record.data && record.headers) return record;

      // Set loading state
      updateLocalHistory((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, isLoading: true } : r)),
      );

      try {
        const response = await fetch(
          `/api/watson/invoice-history/${record.id}`,
        );
        if (!response.ok) throw new Error("Failed to load data");

        const content = await response.json();

        const updatedRecord = {
          ...record,
          headers: content.headers || [],
          data: content.data || [],
          // bulkAcceptedItemCodes and qtyOverrides live in Firestore (not in storage file),
          // so preserve values already on the record (from the list API) rather than
          // overwriting with undefined from the storage-only content response.
          bulkAcceptedItemCodes:
            record.bulkAcceptedItemCodes ?? content.bulkAcceptedItemCodes ?? [],
          qtyOverrides: record.qtyOverrides ?? content.qtyOverrides ?? {},
          isLoading: false,
        };

        // Update history
        updateLocalHistory((prev) =>
          prev.map((r) => (r.id === record.id ? updatedRecord : r)),
        );

        return updatedRecord;
      } catch (error) {
        console.error("Error loading invoice data:", error);
        toast.error("โหลดข้อมูลไม่สำเร็จ", {
          description: "ไม่สามารถดึงข้อมูล Invoice ได้",
        });
        updateLocalHistory((prev) =>
          prev.map((r) =>
            r.id === record.id ? { ...r, isLoading: false } : r,
          ),
        );
        return record;
      }
    },
    [updateLocalHistory],
  );

  // Backward compatibility wrapper
  const loadRecord = useCallback(
    async (id: string): Promise<InvoiceUploadRecord | null> => {
      const record = historyItems.find((r) => r.id === id);
      if (!record) return null;
      if (record.data) return record;

      return loadRecordData(record);
    },
    [historyItems, loadRecordData],
  );

  const addRecord = useCallback(
    async (
      fileName: string,
      headers: string[],
      data: RawRow[],
      meta?: {
        supplierCode?: string;
        supplierName?: string;
        reportDate?: string;
        uploader?: {
          id: string;
          name: string;
          email: string;
          role: string;
        };
      },
    ): Promise<string> => {
      const tempId = `temp-${Date.now()}`;

      const record: InvoiceUploadRecord = {
        id: tempId,
        fileName,
        uploadedAt: new Date().toISOString(),
        rowCount: data.length,
        supplierCode: meta?.supplierCode,
        supplierName: meta?.supplierName,
        reportDate: meta?.reportDate,
        uploader: meta?.uploader,
        headers,
        data,
        status: "uploaded",
        isLoading: false,
      };

      // Optimistic update
      updateLocalHistory((prev) => {
        const filtered = prev.filter((r) => r.fileName !== fileName);
        return [record, ...filtered].slice(0, MAX_HISTORY);
      });

      try {
        const response = await fetch("/api/watson/invoice-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            headers,
            data,
            meta: {
              ...meta,
              companyId: userData?.companyId || null,
              companyName: userData?.companyName || null,
            },
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Upload failed");
        }

        const result = await response.json();
        const newId = result.id;

        // Update with real ID
        updateLocalHistory((prev) =>
          prev.map((r) => (r.id === tempId ? { ...r, id: newId } : r)),
        );
        return newId;
      } catch (err) {
        console.error("Error saving invoice upload:", err);
        toast.error("บันทึกประวัติการอัปโหลดไม่สำเร็จ", {
          description:
            err instanceof Error
              ? err.message
              : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
        });
        return tempId;
      }
    },
    [updateLocalHistory],
  );

  const updateRecord = useCallback(
    async (
      id: string,
      headers: string[],
      data: RawRow[],
      bulkAcceptedItemCodes?: string[],
      qtyOverrides?: Record<
        string,
        {
          stdQty?: string;
          promoQty?: string;
          qtyBuy1?: string;
          qtyPro?: string;
        }
      >,
    ) => {
      // Update local state
      updateLocalHistory((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                headers,
                data,
                rowCount: data.length,
                bulkAcceptedItemCodes,
                qtyOverrides,
              }
            : r,
        ),
      );

      // Skip API for temp records
      if (id.startsWith("temp-")) return;

      try {
        await fetch(`/api/watson/invoice-history/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headers,
            data,
            bulkAcceptedItemCodes,
            qtyOverrides,
          }),
        });
      } catch (err) {
        console.error("Error updating invoice upload:", err);
        toast.error("บันทึกการแก้ไขไม่สำเร็จ");
      }
    },
    [updateLocalHistory],
  );

  const updateStatus = useCallback(
    async (
      id: string,
      status: WorkflowStatus,
      options?: { lastExportId?: string },
    ) => {
      const now = new Date().toISOString();

      // Update local state
      updateLocalHistory((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, status };
          switch (status) {
            case "validated":
              updated.validatedAt = now;
              break;
            case "calculated":
              updated.calculatedAt = now;
              break;
            case "exported":
              updated.exportedAt = now;
              if (options?.lastExportId) {
                updated.lastExportId = options.lastExportId;
              }
              break;
            case "confirmed":
              updated.confirmedAt = now;
              break;
          }
          return updated;
        }),
      );

      // Skip API for temp records
      if (id.startsWith("temp-")) return;

      try {
        await fetch(`/api/watson/invoice-history/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...options,
          }),
        });
      } catch (err) {
        console.error("Error updating invoice status:", err);
      }
    },
    [updateLocalHistory],
  );

  const removeRecord = useCallback(
    async (id: string) => {
      updateLocalHistory((prev) => prev.filter((r) => r.id !== id));

      if (id.startsWith("temp-")) return;

      try {
        await fetch(`/api/watson/invoice-history/${id}`, { method: "DELETE" });
      } catch (err) {
        console.error("Error deleting invoice upload:", err);
      }
    },
    [updateLocalHistory],
  );

  const clearHistory = useCallback(() => {
    updateLocalHistory(() => []);
    // TODO: Implement Bulk Clear API
  }, [updateLocalHistory]);

  // Derived history summary (omit heavy data)
  const history = historyItems.map(
    ({ headers, data, bulkAcceptedItemCodes, qtyOverrides, ...rest }) => rest,
  );

  return {
    history,
    fullHistory: historyItems,
    isLoading,
    addRecord,
    loadRecord,
    loadRecordData,
    updateRecord,
    updateStatus,
    removeRecord,
    clearHistory,
  };
}
