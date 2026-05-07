/**
 * Shared Watson date parser.
 * Handles all date formats found in Watson Excel exports and promotion sheets:
 *  - Excel serial numbers (e.g., 46048)
 *  - Watson invoice format: "01-JAN-0026", "25-DEC-2025"
 *  - Thai short slash format: "23/4/26", "9/2/26"  (D/M/YY, 2-digit year)
 *  - Full slash format: "23/04/2026", "8/1/2026"   (D/M/YYYY)
 *  - ISO input format: "2026-04-23"                (<input type="date">)
 *  - JS Date objects (pass-through)
 */

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export function parseWatsonDate(dateVal: unknown): Date | null {
  if (dateVal === null || dateVal === undefined) return null;

  // Already a Date object
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }

  // Excel serial date number
  if (typeof dateVal === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + dateVal * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof dateVal !== "string") return null;
  const trimmed = String(dateVal).trim();
  if (!trimmed) return null;

  // Pattern 1: DD-MMM-00YY or DD-MMM-YYYY  e.g. "01-JAN-0026"
  const watsonMatch = trimmed.match(/^(\d{1,2})-(\w{3,9})-(\d{2,4})$/i);
  if (watsonMatch) {
    const day = parseInt(watsonMatch[1], 10);
    const monthStr = watsonMatch[2].toLowerCase();
    let year = parseInt(watsonMatch[3], 10);
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }
  }

  // Pattern 2: D/M/YY  (2-digit year, Thai short)  e.g. "23/4/26"
  const dmyShort = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (dmyShort) {
    const day = parseInt(dmyShort[1], 10);
    const month = parseInt(dmyShort[2], 10) - 1;
    const year = 2000 + parseInt(dmyShort[3], 10);
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      return new Date(year, month, day);
    }
  }

  // Pattern 3: D/M/YYYY  e.g. "23/04/2026"
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    return new Date(year, month, day);
  }

  // Pattern 4: YYYY-MM-DD  (ISO / <input type="date"> output)
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10) - 1,
      parseInt(iso[3], 10),
    );
  }

  // Fallback
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}
