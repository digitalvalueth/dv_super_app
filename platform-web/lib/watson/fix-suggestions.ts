import { RawRow, ValidationError } from "@/types/watson/invoice";

export type SuggestionType =
  | "shift-left"
  | "shift-right"
  | "delete-cell"
  | "delete-row"
  | "fill-value"
  | "swap-columns"
  | "trim-whitespace"
  | "copy-from-above";

export type SuggestionSeverity = "auto" | "manual" | "destructive";

export interface FixSuggestion {
  id: string;
  rowIndex: number;
  columnName?: string;
  type: SuggestionType;
  severity: SuggestionSeverity;
  title: string;
  description: string;
  preview?: {
    before: string | number | null;
    after: string | number | null;
  };
  affectedCells?: { row: number; col: string }[];
  // Function to apply this fix
  apply: (data: RawRow[], headers: string[]) => RawRow[];
}

export interface FixSuggestionGroup {
  category: string;
  icon: string;
  suggestions: FixSuggestion[];
}

// Helper to generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Detect empty cells in the middle of a row (data shift issue)
export function detectShiftIssues(
  data: RawRow[],
  headers: string[],
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  data.forEach((row, rowIndex) => {
    let lastNonEmptyIndex = -1;
    let hasGap = false;
    let gapStart = -1;
    let gapEnd = -1;

    headers.forEach((header, colIndex) => {
      const value = row[header];
      const isEmpty =
        value === null || value === undefined || String(value).trim() === "";

      if (!isEmpty) {
        if (lastNonEmptyIndex !== -1 && colIndex > lastNonEmptyIndex + 1) {
          hasGap = true;
          gapStart = lastNonEmptyIndex + 1;
          gapEnd = colIndex - 1;
        }
        lastNonEmptyIndex = colIndex;
      }
    });

    if (hasGap && gapStart !== -1) {
      const gapCount = gapEnd - gapStart + 1;
      suggestions.push({
        id: generateId(),
        rowIndex,
        columnName: headers[gapStart],
        type: "shift-left",
        severity: "auto",
        title: `Shift Left แถว ${rowIndex + 1}`,
        description: `พบช่องว่าง ${gapCount} คอลัมน์ตรงกลางข้อมูล`,
        affectedCells: headers
          .slice(gapStart)
          .map((col) => ({ row: rowIndex, col })),
        apply: (d, h) => shiftRowLeftFromCol(d, h, rowIndex, gapStart),
      });
    }
  });

  return suggestions;
}

// Detect missing required fields based on validation errors
export function detectMissingFields(
  data: RawRow[],
  headers: string[],
  validationErrors: ValidationError[],
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  // Group errors by row
  const errorsByRow = new Map<number, ValidationError[]>();
  validationErrors.forEach((err) => {
    if (!errorsByRow.has(err.rowIndex)) {
      errorsByRow.set(err.rowIndex, []);
    }
    errorsByRow.get(err.rowIndex)!.push(err);
  });

  // Check for rows with many errors - might be better to delete
  errorsByRow.forEach((errors, rowIndex) => {
    const errorCount = errors.filter((e) => e.severity === "error").length;
    const row = data[rowIndex];

    // If row has many errors, suggest deletion
    if (errorCount >= 5) {
      suggestions.push({
        id: generateId(),
        rowIndex,
        type: "delete-row",
        severity: "destructive",
        title: `ลบแถว ${rowIndex + 1}`,
        description: `พบ ${errorCount} errors - อาจเป็นแถวที่ไม่ถูกต้อง`,
        apply: (d) => d.filter((_, i) => i !== rowIndex),
      });
    }

    // Check if we can copy from above row
    errors.forEach((err) => {
      if (
        err.severity === "error" &&
        rowIndex > 0 &&
        err.message.includes("ข้อมูลว่าง")
      ) {
        const aboveValue = data[rowIndex - 1]?.[err.columnName];
        if (
          aboveValue !== null &&
          aboveValue !== undefined &&
          String(aboveValue).trim() !== ""
        ) {
          suggestions.push({
            id: generateId(),
            rowIndex,
            columnName: err.columnName,
            type: "copy-from-above",
            severity: "manual",
            title: `Copy จากแถวบน`,
            description: `${err.columnName} ว่าง - คัดลอกจากแถว ${rowIndex}`,
            preview: {
              before: row[err.columnName] ?? null,
              after: aboveValue,
            },
            apply: (d) => {
              const newData = [...d];
              newData[rowIndex] = {
                ...newData[rowIndex],
                [err.columnName]: aboveValue,
              };
              return newData;
            },
          });
        }
      }
    });
  });

  return suggestions;
}

// Detect cells that might need to be cleared (e.g., garbage data)
export function detectCellsToDelete(
  data: RawRow[],
  headers: string[],
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  // Detect cells with only special characters or garbage
  const garbagePattern = /^[\s\-_#*\.]+$/;

  data.forEach((row, rowIndex) => {
    headers.forEach((header) => {
      const value = row[header];
      if (value !== null && value !== undefined) {
        const strValue = String(value).trim();
        if (strValue && garbagePattern.test(strValue)) {
          suggestions.push({
            id: generateId(),
            rowIndex,
            columnName: header,
            type: "delete-cell",
            severity: "auto",
            title: `ลบข้อมูลขยะ`,
            description: `${header} แถว ${rowIndex + 1}: "${strValue}"`,
            preview: {
              before: value,
              after: null,
            },
            apply: (d) => {
              const newData = [...d];
              newData[rowIndex] = { ...newData[rowIndex], [header]: null };
              return newData;
            },
          });
        }
      }
    });
  });

  return suggestions;
}

// Detect and fix extra whitespace
export function detectWhitespaceIssues(
  data: RawRow[],
  headers: string[],
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  data.forEach((row, rowIndex) => {
    headers.forEach((header) => {
      const value = row[header];
      if (typeof value === "string") {
        const trimmed = value.trim().replace(/\s+/g, " ");
        if (value !== trimmed && trimmed.length > 0) {
          suggestions.push({
            id: generateId(),
            rowIndex,
            columnName: header,
            type: "trim-whitespace",
            severity: "auto",
            title: `ตัด Whitespace`,
            description: `${header} แถว ${rowIndex + 1}`,
            preview: {
              before: value,
              after: trimmed,
            },
            apply: (d) => {
              const newData = [...d];
              newData[rowIndex] = { ...newData[rowIndex], [header]: trimmed };
              return newData;
            },
          });
        }
      }
    });
  });

  return suggestions;
}

// Shift row data to the left starting from a specific column
function shiftRowLeftFromCol(
  data: RawRow[],
  headers: string[],
  rowIndex: number,
  startColIndex: number,
): RawRow[] {
  const newData = [...data];
  const row = { ...newData[rowIndex] };

  // Collect non-empty values from startColIndex onwards
  const values: (string | number | null)[] = [];
  for (let i = startColIndex; i < headers.length; i++) {
    const value = row[headers[i]];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      values.push(value);
    }
  }

  // Fill from startColIndex with non-empty values
  for (let i = startColIndex; i < headers.length; i++) {
    const valueIndex = i - startColIndex;
    row[headers[i]] = valueIndex < values.length ? values[valueIndex] : null;
  }

  newData[rowIndex] = row;
  return newData;
}

// Get all suggestions grouped by category
export function getAllSuggestions(
  data: RawRow[],
  headers: string[],
  validationErrors: ValidationError[] = [],
): FixSuggestionGroup[] {
  const shiftSuggestions = detectShiftIssues(data, headers);
  const missingSuggestions = detectMissingFields(
    data,
    headers,
    validationErrors,
  );
  const deleteSuggestions = detectCellsToDelete(data, headers);
  const whitespaceSuggestions = detectWhitespaceIssues(data, headers);

  const groups: FixSuggestionGroup[] = [];

  if (shiftSuggestions.length > 0) {
    groups.push({
      category: "Shift ข้อมูล",
      icon: "↔️",
      suggestions: shiftSuggestions,
    });
  }

  if (whitespaceSuggestions.length > 0) {
    groups.push({
      category: "ตัด Whitespace",
      icon: "✂️",
      suggestions: whitespaceSuggestions.slice(0, 10), // Limit to 10
    });
  }

  if (missingSuggestions.length > 0) {
    groups.push({
      category: "ข้อมูลที่ขาด",
      icon: "📝",
      suggestions: missingSuggestions,
    });
  }

  if (deleteSuggestions.length > 0) {
    groups.push({
      category: "ลบข้อมูลขยะ",
      icon: "🗑️",
      suggestions: deleteSuggestions,
    });
  }

  return groups;
}

// Apply multiple suggestions
export function applySuggestions(
  data: RawRow[],
  headers: string[],
  suggestions: FixSuggestion[],
): { data: RawRow[]; appliedCount: number } {
  let currentData = [...data];
  let appliedCount = 0;

  // Sort by row index descending for deletion to work correctly
  const sorted = [...suggestions].sort((a, b) => b.rowIndex - a.rowIndex);

  sorted.forEach((suggestion) => {
    try {
      currentData = suggestion.apply(currentData, headers);
      appliedCount++;
    } catch (error) {
      console.error("Failed to apply suggestion:", suggestion.id, error);
    }
  });

  return { data: currentData, appliedCount };
}

// Get count summary
export function getSuggestionSummary(groups: FixSuggestionGroup[]): {
  total: number;
  auto: number;
  manual: number;
  destructive: number;
} {
  let total = 0;
  let auto = 0;
  let manual = 0;
  let destructive = 0;

  groups.forEach((group) => {
    group.suggestions.forEach((s) => {
      total++;
      if (s.severity === "auto") auto++;
      else if (s.severity === "manual") manual++;
      else if (s.severity === "destructive") destructive++;
    });
  });

  return { total, auto, manual, destructive };
}
