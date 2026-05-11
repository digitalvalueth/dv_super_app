"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useCallback, useEffect, useState } from "react";

export interface PromotionUploadRecord {
  id: string;
  fileName: string;
  uploadedAt: string; // ISO string
  itemCount: number;
  added: number;
  updated: number;
  duplicate: number;
  hasFile: boolean;
  originalFileName?: string;
  uploader?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface PromotionUploadHistoryReturn {
  history: PromotionUploadRecord[];
  isLoading: boolean;
  addRecord: (
    file: File,
    stats: {
      itemCount: number;
      added: number;
      updated: number;
      duplicate: number;
    },
  ) => Promise<void>;
  downloadFile: (record: PromotionUploadRecord) => Promise<void>;
  refetch: () => Promise<void>;
}

export function usePromotionUploadHistory(): PromotionUploadHistoryReturn {
  const { userData } = useAuthStore();
  const [history, setHistory] = useState<PromotionUploadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/watson/promotion-upload-history?limit=20");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: PromotionUploadRecord[] = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Error loading promotion upload history:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const addRecord = useCallback(
    async (
      file: File,
      stats: {
        itemCount: number;
        added: number;
        updated: number;
        duplicate: number;
      },
    ) => {
      try {
        const uploader = userData
          ? {
              id: userData.uid || userData.id,
              name: userData.displayName || userData.name || userData.email,
              email: userData.email,
              role: userData.role,
            }
          : undefined;

        // 1. Create metadata record
        const createRes = await fetch("/api/watson/promotion-upload-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, ...stats, uploader }),
        });
        if (!createRes.ok) throw new Error("Failed to create record");
        const { id } = await createRes.json();

        // 2. Upload original file to Storage
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch(
          `/api/watson/promotion-upload-history/${id}/file`,
          { method: "POST", body: formData },
        );
        if (!uploadRes.ok) {
          console.warn("File upload failed — record saved without file");
        }

        // 3. Optimistically prepend to local state
        const newRecord: PromotionUploadRecord = {
          id,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          hasFile: uploadRes.ok,
          uploader,
          ...stats,
        };
        setHistory((prev) => [newRecord, ...prev]);
      } catch (err) {
        console.error("Error adding promotion upload record:", err);
      }
    },
    [userData],
  );

  const downloadFile = useCallback(async (record: PromotionUploadRecord) => {
    if (!record.hasFile) return;
    const res = await fetch(
      `/api/watson/promotion-upload-history/${record.id}/file`,
    );
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = record.originalFileName ?? record.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { history, isLoading, addRecord, downloadFile, refetch: fetchHistory };
}
