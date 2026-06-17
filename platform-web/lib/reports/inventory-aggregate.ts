// Pure aggregation for the vendor Inventory Report. No react/firebase — runs in
// node-env Vitest. Joins three real sources by BARCODE:
//   - products master   → SKU + name (brand-filtered by the caller)
//   - Phithan EOD        → Stock-On-Hand (sum of EOD_Qty across all branches)
//   - dailySales         → Units sold per rolling window (yesterday / 7d / 30d)
// and derives DOI (Days Of Inventory) = SOH × windowDays ÷ unitsInWindow.

export interface InvProductLite {
  barcode: string;
  sku: string;
  name: string;
}

export interface InvSaleLite {
  saleDate: string; // "YYYY-MM-DD"
  items: { barcode: string; quantity: number }[];
}

/** A flattened Phithan EOD detail row (one barcode at one branch). */
export interface InvEodDetailLite {
  Barcode?: string;
  EOD_Qty?: number;
}

export interface InvRow {
  sku: string;
  name: string;
  cat: string; // brand label, e.g. "NEST ME" / "PRIMANEST"
  totalStock: number; // SOH
  ydUnits: number;
  d7Units: number;
  d30Units: number;
  ydDOI: number;
  d7DOI: number;
  d30DOI: number;
}

/** Add `n` days to a "YYYY-MM-DD" string (UTC, TZ-safe). */
export function addDays(dateStr: string, n: number): string {
  const t = new Date(`${dateStr}T00:00:00Z`).getTime() + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Inclusive set of "YYYY-MM-DD" strings from `fromOffset`..`toOffset` days before today. */
function windowDates(todayStr: string, fromOffset: number, toOffset: number): Set<string> {
  const s = new Set<string>();
  for (let i = toOffset; i <= fromOffset; i++) s.add(addDays(todayStr, -i));
  return s;
}

/** DOI = SOH × windowDays ÷ units (rounded); 0 when no units sold. */
export function computeDOI(soh: number, units: number, windowDays: number): number {
  if (units <= 0) return 0;
  return Math.round((soh * windowDays) / units);
}

export function buildInventoryRows(params: {
  products: InvProductLite[];
  sales: InvSaleLite[];
  eod: InvEodDetailLite[];
  /** Brand label used for the Category column (e.g. "NEST ME"). */
  brand: string;
  todayStr: string;
}): InvRow[] {
  const { products, sales, eod, brand, todayStr } = params;

  // SOH per barcode = sum of EOD_Qty across every branch's detail rows.
  const soh = new Map<string, number>();
  for (const d of eod) {
    const bc = String(d.Barcode ?? "").trim();
    if (!bc) continue;
    soh.set(bc, (soh.get(bc) ?? 0) + (Number(d.EOD_Qty) || 0));
  }

  // Rolling windows that END YESTERDAY (exclude the partial current day):
  //   yesterday = [d-1]; last7 = [d-7..d-1]; last30 = [d-30..d-1].
  const ydSet = windowDates(todayStr, 1, 1);
  const d7Set = windowDates(todayStr, 7, 1);
  const d30Set = windowDates(todayStr, 30, 1);

  // Units per barcode per window.
  const yd = new Map<string, number>();
  const d7 = new Map<string, number>();
  const d30 = new Map<string, number>();
  for (const sale of sales) {
    const inYd = ydSet.has(sale.saleDate);
    const in7 = d7Set.has(sale.saleDate);
    const in30 = d30Set.has(sale.saleDate);
    if (!in7 && !in30 && !inYd) continue;
    for (const it of sale.items || []) {
      const bc = String(it.barcode ?? "").trim();
      if (!bc) continue;
      const q = Number(it.quantity) || 0;
      if (inYd) yd.set(bc, (yd.get(bc) ?? 0) + q);
      if (in7) d7.set(bc, (d7.get(bc) ?? 0) + q);
      if (in30) d30.set(bc, (d30.get(bc) ?? 0) + q);
    }
  }

  return products.map((p) => {
    const bc = String(p.barcode ?? "").trim();
    const totalStock = soh.get(bc) ?? 0;
    const ydUnits = yd.get(bc) ?? 0;
    const d7Units = d7.get(bc) ?? 0;
    const d30Units = d30.get(bc) ?? 0;
    return {
      sku: p.sku || bc || "—",
      name: p.name || "สินค้าไม่ระบุชื่อ",
      cat: brand,
      totalStock,
      ydUnits,
      d7Units,
      d30Units,
      ydDOI: computeDOI(totalStock, ydUnits, 1),
      d7DOI: computeDOI(totalStock, d7Units, 7),
      d30DOI: computeDOI(totalStock, d30Units, 30),
    };
  });
}
