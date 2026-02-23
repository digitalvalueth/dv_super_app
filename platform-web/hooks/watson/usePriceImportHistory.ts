"use client";

import { PriceListItem } from "@/types/watson/pricelist";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const MAX_HISTORY = 10;

export interface PriceImportRecord {
  id: string;
  fileName: string;
  importedAt: string; // ISO date string
  itemCount: number;
  source: "excel" | "json";
  storageUrl?: string; // Optional (legacy or reference)
  data?: PriceListItem[]; // Loaded on demand
  isLoading?: boolean; // Loading state for this record
  uploader?: {
    id?: string;
    name: string;
    email?: string;
    role?: string;
  };
}

interface PriceImportHistoryReturn {
  history: PriceImportRecord[];
  isLoading: boolean;
  addRecord: (
    fileName: string,
    source: "excel" | "json",
    data: PriceListItem[],
  ) => void;
  /** Call this after a server-side upload that already saved to Firestore.
   *  It does only a local state update (no extra API call). */
  addRecordFromServer: (
    id: string,
    fileName: string,
    source: "excel" | "json",
    data: PriceListItem[],
  ) => void;
  removeRecord: (id: string) => void;
  clearHistory: () => void;
  loadRecordData: (record: PriceImportRecord) => Promise<PriceListItem[]>;
}

export function usePriceImportHistory(): PriceImportHistoryReturn {
  const [historyItems, setHistoryItems] = useState<PriceImportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load metadata from API (lazy load data later)
  useEffect(() => {
    let mounted = true;
    setIsLoading(true); // Ensure loading state is true on mount/refresh

    const fetchHistory = async () => {
      try {
        const response = await fetch(
          "/api/watson/price-import-history?limit=" + MAX_HISTORY,
        );
        if (!response.ok) throw new Error("Failed to fetch history");

        const records = await response.json();

        if (mounted) {
          // Ensure dates are strings and data is undefined initially
          const formatted = records.map((r: any) => ({
            ...r,
            isLoading: false,
          }));
          setHistoryItems(formatted);
        }
      } catch (err) {
        console.error("Error loading price import history:", err);
        // Don't toast on initial load error to avoid spamming if offline
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchHistory();

    return () => {
      mounted = false;
    };
  }, []);

  // Update history with new items (helper)
  const setHistory = useCallback(
    (updater: (prev: PriceImportRecord[]) => PriceImportRecord[]) => {
      setHistoryItems(updater);
    },
    [],
  );

  // Load full data for a record from API
  const loadRecordData = useCallback(
    async (record: PriceImportRecord): Promise<PriceListItem[]> => {
      // Return existing data if already loaded
      if (record.data) return record.data;

      // Set loading state for this record
      setHistory((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, isLoading: true } : r)),
      );

      try {
        // Fetch from API instead of direct storage URL
        const response = await fetch(
          `/api/watson/price-import-history/${record.id}`,
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to load data");
        }

        const data = await response.json();

        // Update history with loaded data
        setHistory((prev) =>
          prev.map((r) =>
            r.id === record.id ? { ...r, data, isLoading: false } : r,
          ),
        );

        return data;
      } catch (error) {
        console.error("Error loading record data:", error);
        toast.error("โหลดข้อมูลไม่สำเร็จ", {
          description:
            error instanceof Error
              ? error.message
              : "เกิดข้อผิดพลาดในการโหลดข้อมูลจาก Server",
        });
        setHistory((prev) =>
          prev.map((r) =>
            r.id === record.id ? { ...r, isLoading: false } : r,
          ),
        );
        throw error; // Throw so component knows it failed
      }
    },
    [setHistory],
  );

  const addRecord = useCallback(
    async (
      fileName: string,
      source: "excel" | "json",
      data: PriceListItem[],
    ): Promise<void> => {
      const tempId = `temp-${Date.now()}`;
      const record: PriceImportRecord = {
        id: tempId,
        fileName,
        importedAt: new Date().toISOString(),
        itemCount: data.length,
        source,
        data, // New records have data immediately available
        isLoading: false,
      };

      // Optimistic update
      setHistory((prev) => {
        return [record, ...prev].slice(0, MAX_HISTORY);
      });

      try {
        const response = await fetch("/api/watson/import-price-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            source,
            data,
            itemCount: data.length,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Upload failed");
        }

        const result = await response.json();
        const newId = result.id;

        // Update with real ID from API
        setHistory((prev) =>
          prev.map((r) => (r.id === tempId ? { ...r, id: newId } : r)),
        );
      } catch (err) {
        console.error("Error saving price import history:", err);
        toast.error("บันทึกประวัติการ Import ไม่สำเร็จ", {
          description:
            err instanceof Error
              ? err.message
              : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
        });
        // Note: We don't remove the optimistic update here to allow user to keep working
        // even if save failed (data is in memory).
        // But maybe we should warn them? The toast warns them.
      }
    },
    [setHistory],
  );

  // Add a record that was already saved to Firestore server-side (no API call needed)
  const addRecordFromServer = useCallback(
    (
      id: string,
      fileName: string,
      source: "excel" | "json",
      data: PriceListItem[],
    ) => {
      const record: PriceImportRecord = {
        id,
        fileName,
        importedAt: new Date().toISOString(),
        itemCount: data.length,
        source,
        data,
        isLoading: false,
      };
      setHistory((prev) => {
        return [record, ...prev].slice(0, MAX_HISTORY);
      });
    },
    [setHistory],
  );

  const removeRecord = useCallback(
    async (id: string) => {
      // Optimistic remove
      setHistory((prev) => prev.filter((item) => item.id !== id));

      // Skip API call for temp records
      if (id.startsWith("temp-")) return;

      try {
        await fetch(`/api/watson/price-import-history/${id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Error removing price import history:", err);
        // We don't revert optimistic update for delete
      }
    },
    [setHistory],
  );

  const clearHistory = useCallback(async () => {
    // Optimistic clear
    setHistory(() => []);

    // Not implemented in API yet for bulk clear, need loop or endpoint
    // Client-side implementation did loop.
    // For now we just clear local state.
    // TODO: Implement GET /api/watson/price-import-history/clear
  }, [setHistory]);

  return {
    history: historyItems,
    isLoading,
    addRecord,
    addRecordFromServer,
    removeRecord,
    clearHistory,
    loadRecordData,
  };
}
