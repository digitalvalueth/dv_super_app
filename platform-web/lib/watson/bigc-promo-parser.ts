// Pure parser for BigC "PROMOTION ITEM REQUISITION / PRO.01" Excel forms.
//
// BigC sends promotion brochures as .xlsb FORM layouts that are completely
// different from the Watson price list: ~28 header rows, then an item table.
// This module maps those rows to our promotion shape for a PREVIEW.
//
// PURE: only types + plain JS / date math. No react/next/firebase/xlsx here so
// it runs in node-env Vitest. The thin `parseBigCFile` wrapper (which imports
// xlsx + reads a File) is the only non-pure export and is NOT unit-tested.

import type { PromotionItem } from "@/types/watson/promotion";

/** A single mapped promotion row, BigC → our shape. */
export interface BigCPromoRow {
  /** Running "No" from the form (best-effort; "" if absent). */
  no: string;
  /** Barcode cell (EAN/UPC). Doubles as itemCode (BigC has no Watson code). */
  barcode: string;
  /** Watson-style code — same as barcode for BigC. */
  itemCode: string;
  /** Product Name cell. */
  itemName: string;
  /** SELL price · Normal column. */
  stdPrice: number | null;
  /** SELL price · Promotion column. */
  commPrice: number | null;
  /** Free-text PROMOTION column (e.g. "2 For 1198"), if any. */
  remark: string;
  /** Promo period start (whole file = one period). */
  promoStart: Date | null;
  /** Promo period end. */
  promoEnd: Date | null;
}

/** Where the promo period was ultimately resolved from. */
export type PeriodSource = "sheet" | "filename" | "none";

export interface BigCParseResult {
  items: BigCPromoRow[];
  period: { start: Date | null; end: Date | null };
  periodSource: PeriodSource;
  warnings: string[];
  /** Branch group codes seen in the header (HYP/MKT/MINI/FDP/DPO/PURE/OTHER). */
  branches: string[];
}

type Cell = string | number | null;
type Rows = Cell[][];

// ─── Small cell helpers ───────────────────────────────────────────────

const cell = (rows: Rows, r: number, c: number): Cell => {
  const row = rows[r];
  if (!row) return null;
  const v = row[c];
  return v === undefined ? null : v;
};

const cellStr = (rows: Rows, r: number, c: number): string => {
  const v = cell(rows, r, c);
  if (v === null) return "";
  return String(v).trim();
};

/** First non-empty string cell in [cStart, cEnd] inclusive (handles merges). */
const firstNonEmpty = (rows: Rows, r: number, cStart: number, cEnd: number): string => {
  for (let c = cStart; c <= cEnd; c++) {
    const s = cellStr(rows, r, c);
    if (s) return s;
  }
  return "";
};

/** Parse a number from a cell; returns null when blank/non-numeric. */
const toNum = (v: Cell): number | null => {
  if (v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[, ฿]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Does a cell's text contain `needle` (case-insensitive)? */
const includesCI = (rows: Rows, r: number, c: number, needle: string): boolean =>
  cellStr(rows, r, c).toLowerCase().includes(needle.toLowerCase());

/** Does ANY cell in row r contain `needle`? Returns the col index or -1. */
const findColInRow = (rows: Rows, r: number, needle: string): number => {
  const row = rows[r];
  if (!row) return -1;
  for (let c = 0; c < row.length; c++) {
    if (String(row[c] ?? "").trim().toLowerCase().includes(needle.toLowerCase())) {
      return c;
    }
  }
  return -1;
};

// ─── Date helpers ─────────────────────────────────────────────────────

/** 2-digit year → 4-digit (26 → 2026). Pass-through for 4-digit. */
const expandYear = (yy: number): number => {
  if (yy >= 100) return yy;
  // BigC promo files are current-era; map 00-99 → 2000-2099.
  return 2000 + yy;
};

/** Build a UTC date from D/M/Y numbers; null if any part is invalid. */
const makeDate = (d: number | null, m: number | null, y: number | null): Date | null => {
  if (d === null || m === null || y === null) return null;
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;
  const year = expandYear(y);
  const dt = new Date(Date.UTC(year, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a promo period out of a file name, e.g.
 *   "BigC Period 5 Jan - 28 Jan 2026.xlsb" → {5 Jan 2026, 28 Jan 2026}
 *   "... 5 Jan 2026 - 28 Jan 2026 ..."     → same
 * The year may appear once (after the end month) or on both sides.
 */
export function parseBigCPeriodFromFileName(
  name: string,
): { start: Date | null; end: Date | null } {
  if (!name) return { start: null, end: null };
  const text = name.replace(/\.[a-z0-9]+$/i, " "); // drop extension

  // Match: <d> <Mon> [<year>] (-|–|to) <d> <Mon> [<year>]
  const re =
    /(\d{1,2})\s*([A-Za-z]{3,})\.?\s*(\d{2,4})?\s*(?:-|–|—|to|ถึง)\s*(\d{1,2})\s*([A-Za-z]{3,})\.?\s*(\d{2,4})?/i;
  const m = text.match(re);
  if (!m) return { start: null, end: null };

  const [, d1, mon1, y1, d2, mon2, y2] = m;
  const mo1 = MONTHS[mon1.slice(0, 3).toLowerCase()];
  const mo2 = MONTHS[mon2.slice(0, 3).toLowerCase()];
  if (!mo1 || !mo2) return { start: null, end: null };

  // Year may be specified on one side only; share it across both.
  const yEnd = y2 ?? y1;
  const yStart = y1 ?? y2;
  const start = makeDate(Number(d1), mo1, yStart ? Number(yStart) : null);
  const end = makeDate(Number(d2), mo2, yEnd ? Number(yEnd) : null);
  return { start, end };
}

// ─── Column / table detection ─────────────────────────────────────────

// Stable offsets from the verified BigC layout, used as defensive fallbacks
// when header-text detection fails on a variant.
const FALLBACK = {
  no: 2,
  barcodeStart: 3,
  barcodeEnd: 6,
  nameStart: 7,
  nameEnd: 13,
  sellNormal: 24,
  sellPromo: 27,
  promoText: 39,
  branchStart: 41,
  branchEnd: 47,
};

interface TableLayout {
  headerRow: number; // row with "Barcode" / "Product Name"
  subHeaderRow: number; // row with Normal/Promotion sub-columns
  firstItemRow: number; // subHeaderRow + 1
  cols: {
    no: number;
    barcodeStart: number;
    barcodeEnd: number;
    nameStart: number;
    nameEnd: number;
    sellNormal: number;
    sellPromo: number;
    promoText: number;
  };
}

/** Locate the "Barcode" header row (col ~3) within the first ~40 rows. */
function findHeaderRow(rows: Rows): number {
  const limit = Math.min(rows.length, 45);
  for (let r = 0; r < limit; r++) {
    const col = findColInRow(rows, r, "barcode");
    if (col >= 0) return r;
  }
  return -1;
}

/**
 * Given the header row, find the sub-header row carrying the Normal/Promotion
 * price columns under "ราคาขายสินค้า". It's usually the next row or two.
 */
function findSubHeaderRow(rows: Rows, headerRow: number): number {
  for (let r = headerRow; r <= headerRow + 3 && r < rows.length; r++) {
    // The sub-header row has at least two "Normal"/"Promotion" labels.
    let normals = 0;
    let promos = 0;
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const s = String(row[c] ?? "").trim().toLowerCase();
      if (s === "normal" || s.includes("normal")) normals++;
      if (s === "promotion" || (s.includes("promotion") && s.length < 20)) promos++;
    }
    if (normals >= 1 && promos >= 1) return r;
  }
  return headerRow + 1;
}

/**
 * Resolve the SELL price Normal/Promotion columns. The form has TWO Normal /
 * Promotion pairs: cost (ราคาต้นทุนสินค้า, ~18/21) then SELL (ราคาขายสินค้า,
 * ~24/27). We want the SELL pair — detect via the "ราคาขายสินค้า" header
 * (which spans the sell block) and pick the Normal/Promotion under it; else
 * fall back to fixed offsets.
 */
function resolveSellCols(
  rows: Rows,
  headerRow: number,
  subHeaderRow: number,
): { sellNormal: number; sellPromo: number } {
  // Find the "ขายสินค้า" (SELL) header column across the header rows.
  let sellAnchor = -1;
  for (let r = Math.max(0, headerRow - 1); r <= headerRow + 1 && r < rows.length; r++) {
    const c = findColInRow(rows, r, "ขายสินค้า");
    if (c >= 0) {
      sellAnchor = c;
      break;
    }
  }

  // Collect Normal/Promotion columns on the sub-header row.
  const normals: number[] = [];
  const promos: number[] = [];
  const subRow = rows[subHeaderRow];
  if (subRow) {
    for (let c = 0; c < subRow.length; c++) {
      const s = String(subRow[c] ?? "").trim().toLowerCase();
      if (s.includes("normal")) normals.push(c);
      if (s.includes("promotion")) promos.push(c);
    }
  }

  if (sellAnchor >= 0 && normals.length && promos.length) {
    // Pick the Normal/Promotion pair at/after the SELL anchor.
    const n = normals.find((c) => c >= sellAnchor - 1);
    const p = promos.find((c) => c >= sellAnchor - 1);
    if (n !== undefined && p !== undefined) {
      return { sellNormal: n, sellPromo: p };
    }
  }

  // If we found two pairs, the SELL pair is the SECOND one (cost comes first).
  if (normals.length >= 2 && promos.length >= 2) {
    return { sellNormal: normals[1], sellPromo: promos[1] };
  }

  return { sellNormal: FALLBACK.sellNormal, sellPromo: FALLBACK.sellPromo };
}

/** Resolve the free-text PROMOTION column (~39). */
function resolvePromoTextCol(rows: Rows, headerRow: number): number {
  for (let r = Math.max(0, headerRow - 1); r <= headerRow + 1 && r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const s = String(row[c] ?? "").trim().toLowerCase();
      // The free-text promo column header is "promotion" or "promotion พิเศษ".
      // Avoid the price sub-column "Promotion" (those are < col ~30).
      if (c >= 35 && (s === "promotion" || s.includes("promotion พิเศษ") || s.includes("พิเศษ"))) {
        return c;
      }
    }
  }
  return FALLBACK.promoText;
}

function detectLayout(rows: Rows): TableLayout | null {
  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) return null;

  const subHeaderRow = findSubHeaderRow(rows, headerRow);
  const nameCol = findColInRow(rows, headerRow, "product name");
  const barcodeCol = findColInRow(rows, headerRow, "barcode");
  const noCol = findColInRow(rows, headerRow, "no");

  const { sellNormal, sellPromo } = resolveSellCols(rows, headerRow, subHeaderRow);
  const promoText = resolvePromoTextCol(rows, headerRow);

  const bStart = barcodeCol >= 0 ? barcodeCol : FALLBACK.barcodeStart;
  const nStart = nameCol >= 0 ? nameCol : FALLBACK.nameStart;

  return {
    headerRow,
    subHeaderRow,
    firstItemRow: subHeaderRow + 1,
    cols: {
      no: noCol >= 0 && noCol < bStart ? noCol : FALLBACK.no,
      barcodeStart: bStart,
      barcodeEnd: Math.max(bStart, nStart - 1),
      nameStart: nStart,
      nameEnd: nStart + (FALLBACK.nameEnd - FALLBACK.nameStart),
      sellNormal,
      sellPromo,
      promoText,
    },
  };
}

// ─── Period detection ─────────────────────────────────────────────────

/**
 * Read the promo period from the "Promotion Cost Price" row. That row carries
 * Start DD(~14) MM(~16) YY(~18) … to … DD(~22) MM(~24) YY(~26). The
 * "Promotion Sell Price" row often has STALE template dates (year 21/2021),
 * so we deliberately read the COST row and warn if a stale sell row exists.
 */
function findPeriodInSheet(
  rows: Rows,
): { start: Date | null; end: Date | null; staleSellRow: boolean } {
  const limit = Math.min(rows.length, 45);
  let costRow = -1;
  let sellRow = -1;

  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    if (!row) continue;
    const joined = row.map((c) => String(c ?? "")).join(" ").toLowerCase();
    if (joined.includes("promotion cost price")) costRow = r;
    if (joined.includes("promotion sell price")) sellRow = r;
  }

  let staleSellRow = false;
  if (sellRow >= 0) {
    // A sell row whose year reads 21/2021 is a stale template leftover.
    const yy = toNum(cell(rows, sellRow, 18));
    if (yy !== null && (yy === 21 || yy === 2021)) staleSellRow = true;
  }

  if (costRow < 0) return { start: null, end: null, staleSellRow };

  const start = makeDate(
    toNum(cell(rows, costRow, 14)),
    toNum(cell(rows, costRow, 16)),
    toNum(cell(rows, costRow, 18)),
  );
  const end = makeDate(
    toNum(cell(rows, costRow, 22)),
    toNum(cell(rows, costRow, 24)),
    toNum(cell(rows, costRow, 26)),
  );
  return { start, end, staleSellRow };
}

// ─── Item-row validation ─────────────────────────────────────────────

/**
 * A valid item row must have a real barcode: digits only (after stripping
 * spaces) and length ≥ 8. BigC forms have placeholder rows that carry a
 * running "No" but a blank/invalid barcode — those are NOT items.
 */
function isBarcodeLike(raw: string): boolean {
  const cleaned = raw.replace(/\s+/g, "");
  return /^\d{8,}$/.test(cleaned);
}

/**
 * Footer/notes markers that terminate the item table. Once we see a row whose
 * text contains any of these, we stop scanning (so the footer note never
 * becomes an item).
 */
const FOOTER_MARKERS = ["***", "ผู้ค้าสามารถแนบ", "หมายเหตุ", "total"];

function isFooterRow(rows: Rows, r: number): boolean {
  const row = rows[r];
  if (!row) return false;
  const joined = row
    .map((c) => String(c ?? ""))
    .join(" ")
    .toLowerCase();
  return FOOTER_MARKERS.some((m) => joined.includes(m.toLowerCase()));
}

// ─── Branch detection ─────────────────────────────────────────────────

const BRANCH_CODES = ["HYP", "MKT", "MINI", "FDP", "DPO", "PURE", "OTHER"];

function findBranches(rows: Rows): string[] {
  const found = new Set<string>();
  const limit = Math.min(rows.length, 45);
  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = FALLBACK.branchStart; c <= FALLBACK.branchEnd && c < row.length; c++) {
      const s = String(row[c] ?? "").trim().toUpperCase();
      if (BRANCH_CODES.includes(s)) found.add(s);
    }
  }
  return BRANCH_CODES.filter((b) => found.has(b));
}

// ─── Main parser ──────────────────────────────────────────────────────

/**
 * Parse already-extracted 2D sheet rows (header:1 form) into our promo shape.
 * PURE — see module header.
 */
export function parseBigCSheet(
  rows: Cell[][],
  opts: { fileName?: string } = {},
): BigCParseResult {
  const warnings: string[] = [];
  const branches = findBranches(rows);

  // Resolve the period: sheet (Cost Price row) first, filename fallback.
  const sheetPeriod = findPeriodInSheet(rows);
  if (sheetPeriod.staleSellRow) {
    warnings.push(
      'พบแถว "Promotion Sell Price" ที่มีวันที่เก่าค้าง (ปี 21/2021) — ใช้วันที่จากแถว Cost Price แทน',
    );
  }

  let period = { start: sheetPeriod.start, end: sheetPeriod.end };
  let periodSource: PeriodSource;
  if (period.start || period.end) {
    periodSource = "sheet";
  } else {
    const fromName = parseBigCPeriodFromFileName(opts.fileName ?? "");
    if (fromName.start || fromName.end) {
      period = fromName;
      periodSource = "filename";
      warnings.push("ไม่พบช่วงโปรโมชั่นในไฟล์ — ใช้ช่วงเวลาจากชื่อไฟล์แทน");
    } else {
      periodSource = "none";
      warnings.push("ไม่พบช่วงโปรโมชั่นทั้งในไฟล์และชื่อไฟล์");
    }
  }

  // Detect the item table.
  const layout = detectLayout(rows);
  if (!layout) {
    warnings.push("ไม่พบตารางรายการสินค้าในไฟล์ (ไม่พบหัวตาราง Barcode/Product Name)");
    return { items: [], period, periodSource, warnings, branches };
  }

  const { cols } = layout;
  const items: BigCPromoRow[] = [];

  // BigC item rows are contiguous: real products first, then empty No-only
  // placeholder rows, then a footer note. We stop at a footer marker, and also
  // bail out after several consecutive non-barcode rows once data has started
  // (so trailing placeholders/footer never become items).
  const MAX_GAP = 5;
  let sawData = false;
  let gap = 0;

  for (let r = layout.firstItemRow; r < rows.length; r++) {
    // Footer / notes marker → end of the item table.
    if (isFooterRow(rows, r)) break;

    const no = firstNonEmpty(rows, r, cols.no, cols.no);
    const barcode = firstNonEmpty(rows, r, cols.barcodeStart, cols.barcodeEnd);
    const itemName = firstNonEmpty(rows, r, cols.nameStart, cols.nameEnd);

    // A row is a real item ONLY if it carries a barcode-like value. Rows with
    // just a running "No" (placeholders) or blank rows are not items.
    if (!isBarcodeLike(barcode)) {
      // Fully blank row, or a No-only/branch-mark placeholder → skip silently.
      if (sawData) {
        gap++;
        // After the contiguous data block, a run of non-barcode rows means we
        // are past the items (placeholders + footer) — stop scanning.
        if (gap >= MAX_GAP) break;
      }
      continue;
    }

    sawData = true;
    gap = 0;

    const stdPrice = toNum(cell(rows, r, cols.sellNormal));
    const commPrice = toNum(cell(rows, r, cols.sellPromo));
    const remark = cellStr(rows, r, cols.promoText);

    if (!itemName) {
      warnings.push(`แถวที่ ${no || r}: มี Barcode (${barcode}) แต่ไม่มีชื่อสินค้า`);
    }
    // Missing-sell-price warning applies ONLY to valid (barcode-bearing) rows.
    if (stdPrice === null && commPrice === null) {
      warnings.push(
        `แถวที่ ${no || r} (${itemName || barcode}): ไม่มีราคาขาย`,
      );
    }

    items.push({
      no,
      barcode,
      itemCode: barcode,
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

  return { items, period, periodSource, warnings, branches };
}

// ─── Map to the standard Watson promotion shape ───────────────────────

/**
 * Convert a BigC parse result into the canonical `PromotionItem[]` (the same
 * shape/columns as the Watson promotion table: Watson Code, Barcode, Item
 * Name, Start, End, Std/Comm Price IncV, Invoice 62% IncV/ExV, Remark), so
 * BigC data renders and merges in the standard format.
 *
 * BigC has no Watson Code (itemCode = barcode) and its sell sheet carries no
 * Invoice-62% figures, so those are left null (not fabricated). The single
 * file-level promo period is applied to every item.
 */
export function bigCToPromotionItems(result: BigCParseResult): PromotionItem[] {
  return result.items.map((row) => ({
    itemCode: row.itemCode,
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

/**
 * Read a BigC .xlsb/.xlsx File and parse it. Thin wrapper around
 * `parseBigCSheet`; the only impure export (imports xlsx, reads a File).
 */
export async function parseBigCFile(file: File): Promise<BigCParseResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  // Pass a byte view so every xlsx build reads .xlsb/.xlsx/.xls reliably.
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, {
    header: 1,
    defval: "",
  }) as Cell[][];
  return parseBigCSheet(rows, { fileName: file.name });
}
