import { RawRow } from "@/types/watson/invoice";

export interface AutoFixSuggestion {
  rowIndex: number;
  description: string;
  action: () => RawRow[];
  type: "shift-left" | "shift-right" | "fill-empty" | "swap";
}

// Detect empty cells in the middle of data and suggest shifting
export function detectEmptyCellsInMiddle(
  data: RawRow[],
  headers: string[],
): AutoFixSuggestion[] {
  const suggestions: AutoFixSuggestion[] = [];

  data.forEach((row, rowIndex) => {
    let lastNonEmptyIndex = -1;
    let hasGap = false;
    let gapStart = -1;

    headers.forEach((header, colIndex) => {
      const value = row[header];
      const isEmpty =
        value === null || value === undefined || String(value).trim() === "";

      if (!isEmpty) {
        if (lastNonEmptyIndex !== -1 && colIndex > lastNonEmptyIndex + 1) {
          hasGap = true;
          gapStart = lastNonEmptyIndex + 1;
        }
        lastNonEmptyIndex = colIndex;
      }
    });

    if (hasGap && gapStart !== -1) {
      suggestions.push({
        rowIndex,
        description: `แถวที่ ${rowIndex + 1}: พบช่องว่างตรงกลาง ควร Shift Left`,
        type: "shift-left",
        action: () => shiftRowLeft(data, headers, rowIndex, gapStart),
      });
    }
  });

  return suggestions;
}

// Shift row data to the left starting from a specific column
export function shiftRowLeft(
  data: RawRow[],
  headers: string[],
  rowIndex: number,
  startColIndex: number,
): RawRow[] {
  const newData = [...data];
  const row = { ...newData[rowIndex] };

  // Find empty columns to shift over
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

// Shift row data to the right starting from a specific column
export function shiftRowRight(
  data: RawRow[],
  headers: string[],
  rowIndex: number,
  startColIndex: number,
): RawRow[] {
  const newData = [...data];
  const row = { ...newData[rowIndex] };

  // Shift values to the right
  for (let i = headers.length - 1; i > startColIndex; i--) {
    row[headers[i]] = row[headers[i - 1]];
  }
  row[headers[startColIndex]] = null;

  newData[rowIndex] = row;
  return newData;
}

// Check if value looks like a number but is in a text column
export function detectTypeMismatch(
  data: RawRow[],
  headers: string[],
  columnTypes: { [key: string]: "text" | "number" | "date" },
): AutoFixSuggestion[] {
  const suggestions: AutoFixSuggestion[] = [];

  data.forEach((row, rowIndex) => {
    headers.forEach((header) => {
      const value = row[header];
      const expectedType = columnTypes[header];

      if (!value || !expectedType) return;

      const strValue = String(value);

      // Number in text column
      if (expectedType === "text" && /^\d+(\.\d+)?$/.test(strValue)) {
        // Find a nearby number column
        const nearbyNumberCols = headers.filter(
          (h) =>
            columnTypes[h] === "number" &&
            (row[h] === null ||
              row[h] === undefined ||
              String(row[h]).trim() === ""),
        );

        if (nearbyNumberCols.length > 0) {
          suggestions.push({
            rowIndex,
            description: `แถวที่ ${rowIndex + 1}: พบตัวเลข "${strValue}" ในคอลัมน์ ${header}`,
            type: "swap",
            action: () => data, // Placeholder
          });
        }
      }
    });
  });

  return suggestions;
}

// Apply auto-fix to all detected issues
export function autoFixAll(
  data: RawRow[],
  headers: string[],
): { data: RawRow[]; fixedCount: number } {
  let currentData = [...data];
  let fixedCount = 0;

  // Fix empty cells in middle by shifting left
  const suggestions = detectEmptyCellsInMiddle(currentData, headers);

  suggestions.forEach((suggestion) => {
    if (suggestion.type === "shift-left") {
      currentData = suggestion.action();
      fixedCount++;
    }
  });

  return { data: currentData, fixedCount };
}
