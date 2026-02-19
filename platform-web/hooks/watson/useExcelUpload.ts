"use client";

import { useState, useCallback } from "react";
import { parseExcelFile, ParsedExcel, ReportMeta } from "@/lib/watson/excel-parser";

interface UseExcelUploadReturn {
  isLoading: boolean;
  error: string | null;
  parsedData: ParsedExcel | null;
  uploadFile: (file: File) => Promise<void>;
  reset: () => void;
  fileName: string | null;
  setFileName: (name: string | null) => void;
  reportMeta: ReportMeta | null;
  setReportMeta: (meta: ReportMeta | null) => void;
}

export function useExcelUpload(): UseExcelUploadReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcel | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate file type
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      if (!fileExtension || !["xls", "xlsx"].includes(fileExtension)) {
        throw new Error("กรุณาเลือกไฟล์ Excel (.xls หรือ .xlsx)");
      }

      const result = await parseExcelFile(file);

      if (result.data.length === 0) {
        throw new Error("ไม่พบข้อมูลในไฟล์");
      }

      setParsedData(result);
      setFileName(file.name);
      setReportMeta(result.reportMeta);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอ่านไฟล์",
      );
      setParsedData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setParsedData(null);
    setError(null);
    setFileName(null);
    setReportMeta(null);
  }, []);

  return {
    isLoading,
    error,
    parsedData,
    uploadFile,
    reset,
    fileName,
    setFileName,
    reportMeta,
    setReportMeta,
  };
}
