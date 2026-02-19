import { RawRow, ValidationError, ValidationResult } from "@/types/watson/invoice";
import { formatCellValue } from "./excel-parser";

// Column definitions with validation rules
const COLUMN_RULES: {
  [key: string]: {
    required: boolean;
    type: "text" | "number" | "date";
    validate?: (value: string | number | null) => string | null;
  };
} = {
  Supplier: { required: true, type: "text" },
  "Supplier Name": { required: true, type: "text" },
  "Address 1": { required: false, type: "text" },
  "Address 2": { required: false, type: "text" },
  "Address 3": { required: false, type: "text" },
  "Contact Name": { required: false, type: "text" },
  "Contact Phone/Fax": { required: false, type: "text" },
  "Invoice No.": {
    required: true,
    type: "text",
    // ยืดหยุ่น: รับได้ทั้งแบบมี / หรือไม่มีก็ได้
    validate: (value) => {
      if (!value) return null;
      const str = String(value).trim();
      // ต้องมีค่า ไม่ว่าจะรูปแบบไหน
      if (str.length === 0) {
        return "Invoice No. ต้องไม่เป็นค่าว่าง";
      }
      return null;
    },
  },
  Currency: {
    required: true,
    type: "text",
    validate: (value) => {
      if (!value) return null;
      const str = String(value).toUpperCase().trim();
      if (str !== "THB" && str !== "2") {
        return "Currency ต้องเป็น THB";
      }
      return null;
    },
  },
  Store: {
    required: true,
    type: "text", // เปลี่ยนเป็น text เพราะอาจมีชื่อสาขา
    validate: (value) => {
      if (!value) return null;
      // รับได้ทั้งตัวเลขและ text (เช่น "256 - Patong Phuket")
      const str = String(value).trim();
      if (str.length === 0) {
        return "Store ต้องไม่เป็นค่าว่าง";
      }
      return null;
    },
  },
  Date: {
    required: true,
    type: "date",
    validate: (value) => {
      if (!value) return null;
      // รับหลายรูปแบบ
      const dateStr = formatCellValue(value);
      if (dateStr.trim().length === 0) {
        return "Date ต้องไม่เป็นค่าว่าง";
      }
      // ตรวจสอบหลายรูปแบบวันที่
      const datePatterns = [
        // Slash formats
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // M/D/YYYY, D/M/YYYY, M/D/YY
        /^\d{4}\/\d{1,2}\/\d{1,2}$/, // YYYY/MM/DD, YYYY/M/D
        // Dash formats
        /^\d{1,2}-\d{1,2}-\d{2,4}$/, // D-M-YYYY, DD-MM-YYYY
        /^\d{4}-\d{1,2}-\d{1,2}$/, // YYYY-MM-DD, YYYY-M-D
        /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
        // Month name formats
        /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/, // DD-MMM-YYYY (05-JAN-0026, 5-Jan-26)
        /^\d{1,2}\/[A-Za-z]{3}\/\d{2,4}$/, // DD/MMM/YYYY (05/JAN/0026)
        /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}$/, // DD Month YYYY (05 January 2026)
        /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}$/, // Month DD, YYYY (January 5, 2026)
        // Dot formats
        /^\d{1,2}\.\d{1,2}\.\d{2,4}$/, // D.M.YYYY, DD.MM.YYYY
        /^\d{4}\.\d{1,2}\.\d{1,2}$/, // YYYY.MM.DD
        // Compact formats
        /^\d{8}$/, // YYYYMMDD, DDMMYYYY
        /^\d{6}$/, // YYMMDD, DDMMYY
        // ISO format with time
        /^\d{4}-\d{2}-\d{2}T/, // YYYY-MM-DDTHH:mm
        // Thai Buddhist year (พ.ศ.) formats
        /^\d{1,2}\/\d{1,2}\/25\d{2}$/, // D/M/25XX
        /^\d{1,2}-\d{1,2}-25\d{2}$/, // D-M-25XX
      ];
      const isValidFormat = datePatterns.some((pattern) =>
        pattern.test(dateStr.trim()),
      );
      if (!isValidFormat) {
        return "Date รูปแบบไม่ถูกต้อง";
      }
      return null;
    },
  },
  "Item Code": {
    required: true,
    type: "text", // เปลี่ยนเป็น text เผื่อมี prefix
    validate: (value) => {
      if (!value) return null;
      const str = String(value).trim();
      if (str.length === 0) {
        return "Item Code ต้องไม่เป็นค่าว่าง";
      }
      return null;
    },
  },
  "Item Description": { required: true, type: "text" },
  Qty: {
    required: true,
    type: "number",
    validate: (value) => {
      if (!value) return null;
      const num = Number(value);
      if (isNaN(num)) {
        return "Qty ต้องเป็นตัวเลข";
      }
      if (num === 0) {
        return "Qty ต้องไม่เป็น 0";
      }
      // ติดลบได้ (กรณีคืนสินค้า) - จะเป็น warning ใน validateData
      return null;
    },
  },
  "GP%": {
    required: true,
    type: "number",
    validate: (value) => {
      if (!value) return null;
      const num = Number(value);
      if (isNaN(num)) {
        return "GP% ต้องเป็นตัวเลข";
      }
      return null;
    },
  },
  "Total Cost Exclusive": {
    required: true,
    type: "number",
    validate: (value) => {
      if (!value) return null;
      const num = Number(value);
      if (isNaN(num)) {
        return "Total Cost Exclusive ต้องเป็นตัวเลข";
      }
      // ติดลบได้ (กรณีคืนสินค้า) - จะเป็น warning ใน validateData
      return null;
    },
  },
  "VAT %": { required: true, type: "text" },
};

// Find matching column name (case-insensitive, partial match)
function findColumnRule(header: string): (typeof COLUMN_RULES)[string] | null {
  // Exact match first
  if (COLUMN_RULES[header]) {
    return COLUMN_RULES[header];
  }

  // Partial match
  const headerLower = header.toLowerCase();
  for (const [key, rule] of Object.entries(COLUMN_RULES)) {
    if (
      headerLower.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(headerLower)
    ) {
      return rule;
    }
  }

  return null;
}

export function validateData(
  data: RawRow[],
  headers: string[],
): ValidationResult {
  const errors: ValidationError[] = [];
  const rowsWithErrors = new Set<number>();

  data.forEach((row, rowIndex) => {
    headers.forEach((header, colIndex) => {
      const rule = findColumnRule(header);
      if (!rule) return;

      const value = row[header];
      const displayValue = formatCellValue(value);

      // Check required
      if (
        rule.required &&
        (value === null || value === undefined || displayValue.trim() === "")
      ) {
        errors.push({
          rowIndex,
          columnName: header,
          columnIndex: colIndex,
          message: `${header} ต้องไม่เป็นค่าว่าง`,
          severity: "error",
          currentValue: value ?? null,
        });
        rowsWithErrors.add(rowIndex);
        return;
      }

      // Check type
      if (value !== null && value !== undefined && displayValue.trim() !== "") {
        if (
          rule.type === "number" &&
          typeof value === "string" &&
          isNaN(Number(value))
        ) {
          errors.push({
            rowIndex,
            columnName: header,
            columnIndex: colIndex,
            message: `${header} ต้องเป็นตัวเลข`,
            severity: "error",
            currentValue: value,
          });
          rowsWithErrors.add(rowIndex);
        }

        // Negative values for Qty and Total Cost are allowed (for returns)
        // Sales confirmed: ค่าติดลบได้ไม่ต้องแจ้งเตือน

        // Custom validation
        if (rule.validate) {
          const validationError = rule.validate(value);
          if (validationError) {
            errors.push({
              rowIndex,
              columnName: header,
              columnIndex: colIndex,
              message: validationError,
              severity: "warning",
              currentValue: value,
            });
            rowsWithErrors.add(rowIndex);
          }
        }
      }
    });
  });

  // นับเฉพาะ error (ไม่นับ warning)
  const errorOnlyRows = new Set(
    errors.filter((e) => e.severity === "error").map((e) => e.rowIndex),
  );
  const warningOnlyRows = new Set(
    errors.filter((e) => e.severity === "warning").map((e) => e.rowIndex),
  );

  return {
    isValid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
    totalRows: data.length,
    validRows: data.length - rowsWithErrors.size,
    errorRows: errorOnlyRows.size,
    warningRows: warningOnlyRows.size,
  };
}

export function getRowErrors(
  errors: ValidationError[],
  rowIndex: number,
): ValidationError[] {
  return errors.filter((e) => e.rowIndex === rowIndex);
}

export function getCellError(
  errors: ValidationError[],
  rowIndex: number,
  columnName: string,
): ValidationError | undefined {
  return errors.find(
    (e) => e.rowIndex === rowIndex && e.columnName === columnName,
  );
}
