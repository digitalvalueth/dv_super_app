import * as XLSX from "xlsx";
import { RawRow } from "@/types/watson/invoice";

// Internal calculation columns - not included in export
// These are for display/debugging purposes only
const INTERNAL_COLUMNS = [
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
  "Total Comm",
  "Calc Log",
];

/**
 * Filter headers to exclude internal calculation columns
 * Used for export to Excel/JSON
 */
export function getExportHeaders(headers: string[]): string[] {
  return headers.filter((h) => !INTERNAL_COLUMNS.includes(h));
}

export interface ExportData {
  supplierCode: string;
  supplierName: string;
  reportDate: string;
  headers: string[];
  data: (string | number | null)[][];
  summary?: Record<string, unknown>;
  passedCount?: number;
  lowConfidenceCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Save export data to Firestore via API
 */
export async function saveExportToCloud(
  exportData: ExportData,
): Promise<string> {
  const response = await fetch("/api/exports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(exportData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to save export");
  }

  const result = await response.json();
  return result.data.id;
}

export function exportToJson(
  data: RawRow[],
  headers: string[],
  filename: string = "exported_data.json",
) {
  // Build clean array using only visible headers
  const cleanData = data.map((row) => {
    const obj: Record<string, string | number | null | undefined> = {};
    headers.forEach((header) => {
      obj[header] = row[header] ?? null;
    });
    return obj;
  });

  const jsonStr = JSON.stringify(cleanData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToExcel(
  data: RawRow[],
  headers: string[],
  filename: string = "exported_data.xlsx",
) {
  // Convert data to array of arrays
  const rows: (string | number | null)[][] = data.map((row) =>
    headers.map((header) => row[header] ?? null),
  );

  // Add headers as first row
  const exportData = [headers, ...rows];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(exportData);

  // Auto-fit column widths
  const colWidths = headers.map((header, colIndex) => {
    let maxWidth = header.length;
    rows.forEach((row) => {
      const cellValue = row[colIndex];
      if (cellValue !== null) {
        maxWidth = Math.max(maxWidth, String(cellValue).length);
      }
    });
    return { wch: Math.min(maxWidth + 2, 50) };
  });
  ws["!cols"] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");

  // Download
  XLSX.writeFile(wb, filename);
}

export function exportValidationReport(
  data: RawRow[],
  headers: string[],
  errors: { rowIndex: number; columnName: string; message: string }[],
  filename: string = "validation_report.xlsx",
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ["Validation Report"],
    ["Generated:", new Date().toLocaleString("th-TH")],
    [""],
    ["Total Rows:", data.length],
    ["Rows with Errors:", new Set(errors.map((e) => e.rowIndex)).size],
    ["Total Errors:", errors.length],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // Sheet 2: Error Details
  const errorHeaders = ["Row", "Column", "Error Message"];
  const errorRows = errors.map((e) => [
    e.rowIndex + 1,
    e.columnName,
    e.message,
  ]);
  const errorData = [errorHeaders, ...errorRows];
  const errorWs = XLSX.utils.aoa_to_sheet(errorData);
  errorWs["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, errorWs, "Errors");

  // Sheet 3: Data with highlight info
  const dataHeaders = [...headers, "Has Error"];
  const rowsWithErrors = new Set(errors.map((e) => e.rowIndex));
  const dataRows = data.map((row, index) => [
    ...headers.map((h) => row[h] ?? ""),
    rowsWithErrors.has(index) ? "YES" : "NO",
  ]);
  const dataExport = [dataHeaders, ...dataRows];
  const dataWs = XLSX.utils.aoa_to_sheet(dataExport);
  XLSX.utils.book_append_sheet(wb, dataWs, "Data");

  // Download
  XLSX.writeFile(wb, filename);
}
