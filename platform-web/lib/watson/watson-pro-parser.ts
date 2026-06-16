// Pure parser for the Watson "Price and Cost Application Form" (RMS) .xls/.xlsx
// promotion file (e.g. "Pro.6-2026 (PrimaNest …)"). Different from both the old
// Watson report and the BigC form: a header block with the promo period, then
// an item table.
//
// Mapping (as specified by the business):
//   Old RSP  → Std Price IncV  (stdPrice)
//   New RSP  → Comm Price IncV (commPrice)
//   Product Code → Watson Code (itemCode)
//
// PURE: only types + plain JS. The `parseWatsonProFile` File wrapper (imports
// xlsx) is the one impure export and is NOT unit-tested.

import type { PromotionItem } from "@/types/watson/promotion";

/** One mapped Watson-Pro promotion row. */
export interface WatsonProRow {
  no: string;
  /** Watson Product Code (itemCode). */
  productCode: string;
  /** Barcode (whitespace stripped). */
  barcode: string;
  itemName: string;
  /** Old RSP → Std Price IncV. */
  stdPrice: number | null;
  /** New RSP → Comm Price IncV. */
  commPrice: number | null;
  remark: string;
  promoStart: Date | null;
  promoEnd: Date | null;
}

export type PeriodSource = "sheet" | "filename" | "none";

export interface WatsonProParseResult {
  items: WatsonProRow[];
  period: { start: Date | null; end: Date | null };
  periodSource: PeriodSource;
  warnings: string[];
}

type Cell = string | number | null;
type Rows = Cell[][];

// ─── Cell helpers ─────────────────────────────────────────────────────

const cell = (rows: Rows, r: number, c: number): Cell => {
  const row = rows[r];
  if (!row) return null;
  const v = row[c];
  return v === undefined ? null : v;
};

const cellStr = (rows: Rows, r: number, c: number): string => {
  const v = cell(rows, r, c);
  return v === null ? "" : String(v).trim();
};

const toNum = (v: Cell): number | null => {
  if (v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[, ฿]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Find the first column in row r whose text contains `needle` (CI); -1 if none. */
const findColInRow = (rows: Rows, r: number, needle: string): number => {
  const row = rows[r];
  if (!row) return -1;
  const n = needle.toLowerCase();
  for (let c = 0; c < row.length; c++) {
    if (String(row[c] ?? "").trim().toLowerCase().includes(n)) return c;
  }
  return -1;
};

/** Strip all whitespace from a barcode (Watson barcodes are space-separated). */
const stripBarcode = (raw: string): string => raw.replace(/\s+/g, "");

/** A valid item: barcode digits-only (after stripping spaces), length ≥ 8. */
const isBarcodeLike = (raw: string): boolean => /^\d{8,}$/.test(stripBarcode(raw));

// ─── Date helpers ─────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const makeDate = (d: number, mon: string, y: number): Date | null => {
  const m = MONTHS[mon.slice(0, 3).toLowerCase()];
  if (!m || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  const dt = new Date(Date.UTC(year, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
};

/**
 * Parse the promo period out of the "Price (Promo) : Start _21_May_2026__ End
 * _24_Jun_2026" form text. Underscores/spaces separate the parts.
 */
export function parsePromoPeriodText(
  text: string,
): { start: Date | null; end: Date | null } {
  if (!text) return { start: null, end: null };
  const re =
    /start\s*[_\s]*(\d{1,2})[_\s]+([A-Za-z]{3,})[_\s]+(\d{2,4})[_\s]*end\s*[_\s]*(\d{1,2})[_\s]+([A-Za-z]{3,})[_\s]+(\d{2,4})/i;
  const m = text.match(re);
  if (!m) return { start: null, end: null };
  const [, d1, mo1, y1, d2, mo2, y2] = m;
  return {
    start: makeDate(Number(d1), mo1, Number(y1)),
    end: makeDate(Number(d2), mo2, Number(y2)),
  };
}

// ─── Layout detection ─────────────────────────────────────────────────

const FALLBACK = {
  no: 0,
  productCode: 1,
  barcode: 2,
  description: 3,
  oldRSP: 10,
  newRSP: 11,
  remark: 20,
};

interface Layout {
  headerRow: number;
  cols: {
    no: number;
    productCode: number;
    barcode: number;
    description: number;
    oldRSP: number;
    newRSP: number;
    remark: number;
  };
}

/** Header row carries "Product Code" + "Barcode" + "Description". */
function findHeaderRow(rows: Rows): number {
  const limit = Math.min(rows.length, 40);
  for (let r = 0; r < limit; r++) {
    if (
      findColInRow(rows, r, "product code") >= 0 &&
      findColInRow(rows, r, "barcode") >= 0
    ) {
      return r;
    }
  }
  return -1;
}

/** Old RSP / New RSP live in a group-header row a couple rows above the table. */
function resolveRspCols(
  rows: Rows,
  headerRow: number,
): { oldRSP: number; newRSP: number } {
  for (let r = Math.max(0, headerRow - 4); r <= headerRow; r++) {
    const oldC = findColInRow(rows, r, "old rsp");
    const newC = findColInRow(rows, r, "new rsp");
    if (oldC >= 0 && newC >= 0) return { oldRSP: oldC, newRSP: newC };
  }
  return { oldRSP: FALLBACK.oldRSP, newRSP: FALLBACK.newRSP };
}

function detectLayout(rows: Rows): Layout | null {
  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) return null;
  const { oldRSP, newRSP } = resolveRspCols(rows, headerRow);
  const pc = findColInRow(rows, headerRow, "product code");
  const bc = findColInRow(rows, headerRow, "barcode");
  const desc = findColInRow(rows, headerRow, "description");
  const no = findColInRow(rows, headerRow, "no");
  const mech = findColInRow(rows, headerRow, "mechanic");
  return {
    headerRow,
    cols: {
      no: no >= 0 ? no : FALLBACK.no,
      productCode: pc >= 0 ? pc : FALLBACK.productCode,
      barcode: bc >= 0 ? bc : FALLBACK.barcode,
      description: desc >= 0 ? desc : FALLBACK.description,
      oldRSP,
      newRSP,
      remark: mech >= 0 ? mech : FALLBACK.remark,
    },
  };
}

// ─── Period from sheet ────────────────────────────────────────────────

function findPeriodInSheet(rows: Rows): { start: Date | null; end: Date | null } {
  const limit = Math.min(rows.length, 30);
  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const s = String(row[c] ?? "");
      if (s.toLowerCase().includes("price (promo)")) {
        const p = parsePromoPeriodText(s);
        if (p.start || p.end) return p;
      }
    }
  }
  return { start: null, end: null };
}

// ─── Footer ───────────────────────────────────────────────────────────

const FOOTER_MARKERS = ["remark", "หมายเหตุ", "total", "เงื่อนไข", "approve"];
function isFooterRow(rows: Rows, r: number): boolean {
  const row = rows[r];
  if (!row) return false;
  const joined = row.map((c) => String(c ?? "")).join(" ").toLowerCase();
  return FOOTER_MARKERS.some((m) => joined.includes(m));
}

// ─── Main parser ──────────────────────────────────────────────────────

export function parseWatsonProSheet(
  rows: Cell[][],
  opts: { fileName?: string } = {},
): WatsonProParseResult {
  void opts; // filename has no parseable period for this format
  const warnings: string[] = [];

  const sheetPeriod = findPeriodInSheet(rows);
  let period = sheetPeriod;
  let periodSource: PeriodSource;
  if (period.start || period.end) {
    periodSource = "sheet";
  } else {
    period = { start: null, end: null };
    periodSource = "none";
    warnings.push("ไม่พบช่วงโปรโมชั่น (แถว Price (Promo)) ในไฟล์");
  }

  const layout = detectLayout(rows);
  if (!layout) {
    warnings.push("ไม่พบตารางรายการสินค้า (ไม่พบหัวตาราง Product Code/Barcode)");
    return { items: [], period, periodSource, warnings };
  }

  const { cols } = layout;
  const items: WatsonProRow[] = [];
  const MAX_GAP = 5;
  let sawData = false;
  let gap = 0;

  for (let r = layout.headerRow + 1; r < rows.length; r++) {
    const barcodeRaw = cellStr(rows, r, cols.barcode);

    // A row with a real barcode is always an item — never a footer. (Footer
    // markers like "total" can appear inside product names, e.g. "Total
    // Protect", so they must only end the table on NON-item rows.)
    if (!isBarcodeLike(barcodeRaw)) {
      if (isFooterRow(rows, r)) break;
      if (sawData && ++gap >= MAX_GAP) break;
      continue;
    }
    sawData = true;
    gap = 0;

    const no = cellStr(rows, r, cols.no);
    const productCode = cellStr(rows, r, cols.productCode);
    const itemName = cellStr(rows, r, cols.description);
    const stdPrice = toNum(cell(rows, r, cols.oldRSP));
    const commPrice = toNum(cell(rows, r, cols.newRSP));
    const remark = cellStr(rows, r, cols.remark);

    if (stdPrice === null && commPrice === null) {
      warnings.push(`แถวที่ ${no || r} (${productCode || barcodeRaw}): ไม่มีราคา RSP`);
    }

    items.push({
      no,
      productCode,
      barcode: stripBarcode(barcodeRaw),
      itemName,
      stdPrice,
      commPrice,
      remark,
      promoStart: period.start,
      promoEnd: period.end,
    });
  }

  if (items.length === 0) {
    warnings.push("ไม่พบรายการสินค้าในไฟล์ (0 รายการ)");
  }

  return { items, period, periodSource, warnings };
}

// ─── Map to the standard PromotionItem shape ──────────────────────────

/**
 * Watson-Pro result → canonical `PromotionItem[]`:
 *   Watson Code = Product Code · Old RSP → stdPrice · New RSP → commPrice ·
 *   Invoice-62% left null (not in this form). File-level period on every item.
 */
export function watsonProToPromotionItems(
  result: WatsonProParseResult,
): PromotionItem[] {
  return result.items.map((row) => ({
    itemCode: row.productCode || row.barcode,
    barcode: row.barcode,
    itemName: row.itemName,
    stdPrice: row.stdPrice ?? 0,
    commPrice: row.commPrice,
    invoice62IncV: null,
    invoice62ExV: null,
    promoPrice: row.commPrice ?? null,
    promoStart: row.promoStart,
    promoEnd: row.promoEnd,
    remark: row.remark || "",
  }));
}

// ─── Non-pure File wrapper (NOT unit-tested) ──────────────────────────

export async function parseWatsonProFile(
  file: File,
): Promise<WatsonProParseResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  // .xls (BIFF) + .xlsx/.xlsb: pass a byte view so every xlsx build reads it.
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, {
    header: 1,
    defval: "",
  }) as Cell[][];
  return parseWatsonProSheet(rows, { fileName: file.name });
}
