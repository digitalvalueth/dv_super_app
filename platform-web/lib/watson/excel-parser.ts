import * as XLSX from "xlsx";
import { RawRow } from "@/types/watson/invoice";

export interface ReportMeta {
  reportName: string | null;
  reportRunDateTime: string | null;
  reportParameters: string | null; // e.g. supplier code
}

export interface ParsedExcel {
  headers: string[];
  data: RawRow[];
  rawData: (string | number | null)[][];
  reportMeta: ReportMeta;
}

// Watson report มี header อยู่แถวที่ 11 (index 10)
const DATA_START_ROW = 10;

/**
 * Extract report metadata from the top rows (before data header)
 */
function extractReportMeta(
  rawData: (string | number | null)[][],
  headerRowIndex: number,
): ReportMeta {
  const meta: ReportMeta = {
    reportName: null,
    reportRunDateTime: null,
    reportParameters: null,
  };

  // Scan rows above the header row
  for (let i = 0; i < headerRowIndex; i++) {
    const row = rawData[i];
    if (!row) continue;

    const firstCell = row[0] != null ? String(row[0]).trim() : "";
    const secondCell = row[1] != null ? String(row[1]).trim() : "";

    if (firstCell.toLowerCase().includes("report name")) {
      meta.reportName = secondCell || null;
    } else if (
      firstCell.toLowerCase().includes("report run") ||
      firstCell.toLowerCase().includes("date time")
    ) {
      // Could be in second cell or further right
      const rawVal = row[1] != null ? row[1] : findFirstRawNonEmpty(row, 1);
      if (rawVal != null) {
        meta.reportRunDateTime = convertExcelDate(rawVal);
      }
    } else if (firstCell.toLowerCase().includes("report parameters")) {
      // Parameter value might be on same row (column B) or next row(s)
      // First check column B of current row
      if (secondCell && !secondCell.startsWith("---")) {
        meta.reportParameters = secondCell;
      } else {
        // Look ahead for a non-empty, non-separator value
        // Check both column A and B of subsequent rows
        for (let j = i + 1; j < headerRowIndex; j++) {
          const paramRow = rawData[j];
          if (!paramRow) continue;

          // Check column B first (common pattern: value is in second column)
          const colB = paramRow[1] != null ? String(paramRow[1]).trim() : "";
          if (colB && !colB.startsWith("---")) {
            // Validate it looks like a supplier code (numeric or alphanumeric)
            if (/^[0-9A-Za-z\-_]+$/.test(colB)) {
              meta.reportParameters = colB;
              break;
            }
          }

          // Then check column A
          const colA = paramRow[0] != null ? String(paramRow[0]).trim() : "";
          if (colA && !colA.startsWith("---")) {
            // Validate it looks like a supplier code
            if (/^[0-9A-Za-z\-_]+$/.test(colA)) {
              meta.reportParameters = colA;
              break;
            }
          }
        }
      }
    }
  }

  // Debug logging (remove in production)
  console.log("[extractReportMeta] Parsed metadata:", meta);

  return meta;
}

/**
 * Find first non-empty raw value (preserving type) in a row from startCol
 */
function findFirstRawNonEmpty(
  row: (string | number | null)[],
  startCol: number,
): string | number | null {
  for (let c = startCol; c < row.length; c++) {
    const v = row[c];
    if (v != null && String(v).trim() !== "" && !String(v).startsWith("---")) {
      return v;
    }
  }
  return null;
}

/**
 * Convert an Excel date value (serial number or string) to a formatted date string.
 * Excel serial dates are numbers like 46048.63 → "26/01/2026 15:07:25"
 */
function convertExcelDate(val: string | number | null): string | null {
  if (val == null) return null;

  if (typeof val === "number") {
    // Excel serial date number
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      const dd = String(parsed.d).padStart(2, "0");
      const mm = String(parsed.m).padStart(2, "0");
      const yyyy = parsed.y;
      const hh = String(parsed.H).padStart(2, "0");
      const mi = String(parsed.M).padStart(2, "0");
      const ss = String(parsed.S).padStart(2, "0");
      return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
    }
    return String(val);
  }

  // Already a string — return as-is
  const s = String(val).trim();
  return s || null;
}

export function parseExcelFile(file: File): Promise<ParsedExcel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to array of arrays
        const rawData: (string | number | null)[][] = XLSX.utils.sheet_to_json(
          worksheet,
          { header: 1, defval: null },
        );

        // Find header row (row with "Supplier" text)
        let headerRowIndex = DATA_START_ROW;
        for (let i = 0; i < Math.min(20, rawData.length); i++) {
          const row = rawData[i];
          if (
            row &&
            row.some(
              (cell) =>
                typeof cell === "string" &&
                cell.toLowerCase().includes("supplier"),
            )
          ) {
            headerRowIndex = i;
            break;
          }
        }

        // Extract report metadata from header rows
        const reportMeta = extractReportMeta(rawData, headerRowIndex);

        // Extract headers
        const headerRow = rawData[headerRowIndex] || [];
        const headers = headerRow.map((h, index) =>
          h ? String(h).trim() : `Column ${index + 1}`,
        );

        // Extract data rows (after header)
        const dataRows = rawData.slice(headerRowIndex + 1);

        // Convert to array of objects
        const parsedData: RawRow[] = dataRows
          .filter(
            (row) => row && row.some((cell) => cell !== null && cell !== ""),
          )
          .map((row, rowIndex) => {
            const rowObj: RawRow = { _rowIndex: rowIndex };
            headers.forEach((header, colIndex) => {
              rowObj[header] = row[colIndex] ?? null;
            });
            return rowObj;
          });

        resolve({
          headers,
          data: parsedData,
          rawData: dataRows,
          reportMeta,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
}

export function formatCellValue(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    // Check if it's a date serial number (Excel stores dates as numbers)
    if (value > 40000 && value < 50000) {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.m}/${date.d}/${date.y}`;
      }
    }
    return String(value);
  }
  return String(value);
}

export function getCellDisplayValue(row: RawRow, header: string): string {
  const value = row[header];
  return formatCellValue(value);
}
