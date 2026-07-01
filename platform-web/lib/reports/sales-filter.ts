// Pure filter / flatten / count helpers for the sales report.
// No next/react/firebase imports.
//
// The sales-report page builds its display rows by enriching each
// (sale, item) pair with page-specific lookups (product RSP from Firestore
// data, date formatting, the active brand). Those enrichment bits stay in the
// page; the *pure* core extracted here is the filter pipeline (date range /
// store / employee / search), the distinct-bill count, and the totals.

import type { DailySale, DailySaleItem } from "./types";

export interface SalesFilters {
  /** Inclusive lower bound on saleDate ("YYYY-MM-DD"); empty = no bound. */
  startDate?: string;
  /** Inclusive upper bound on saleDate ("YYYY-MM-DD"); empty = no bound. */
  endDate?: string;
  /** Store/branch name; "All Stores" (or empty) = no store filter. */
  branch?: string;
  /** Salesperson name; "All Salespersons" (or empty) = no employee filter. */
  employee?: string;
  /** Free-text query matched against item barcode + description. */
  query?: string;
}

const ALL_STORES = "All Stores";
const ALL_EMPLOYEES = "All Salespersons";

const saleMatchesStore = (sale: DailySale, branch?: string): boolean =>
  !branch || branch === ALL_STORES || sale.branchName === branch;

const saleMatchesEmployee = (sale: DailySale, employee?: string): boolean =>
  !employee || employee === ALL_EMPLOYEES || sale.employeeName === employee;

const saleMatchesDate = (sale: DailySale, start?: string, end?: string): boolean => {
  if (start && sale.saleDate < start) return false;
  if (end && sale.saleDate > end) return false;
  return true;
};

const itemMatchesQuery = (item: DailySaleItem, query?: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  const matchCode = (item.barcode || "").toLowerCase().includes(q);
  const matchName = (item.productDescription || "").toLowerCase().includes(q);
  return matchCode || matchName;
};

export interface FilteredItemRow {
  sale: DailySale;
  item: DailySaleItem;
}

/**
 * Apply the store / employee / date-range filters at the sale (bill) level.
 * Note the search query is NOT applied here — it operates per item (see
 * flattenToItemRows), matching the page where a bill survives only when at
 * least one of its items passes the search.
 */
export function filterSales(
  sales: DailySale[],
  filters: SalesFilters,
): DailySale[] {
  const { startDate, endDate, branch, employee } = filters;
  return sales.filter(
    (sale) =>
      saleMatchesStore(sale, branch) &&
      saleMatchesEmployee(sale, employee) &&
      saleMatchesDate(sale, startDate, endDate),
  );
}

/**
 * Flatten the given sales into (sale, item) rows, applying the full filter
 * pipeline: store / employee / date at the bill level, then the search query
 * at the item level. Mirrors the salesRows useMemo loop exactly.
 */
export function flattenToItemRows(
  sales: DailySale[],
  filters: SalesFilters = {},
): FilteredItemRow[] {
  const filtered = filterSales(sales, filters);
  const rows: FilteredItemRow[] = [];
  for (const sale of filtered) {
    for (const item of sale.items) {
      if (!itemMatchesQuery(item, filters.query)) continue;
      rows.push({ sale, item });
    }
  }
  return rows;
}

/**
 * Count distinct bills (sale doc ids) that survive the full filter pipeline:
 * a bill is counted only when at least one of its items passes the search,
 * keeping the metric in sync with the rendered rows.
 */
export function distinctBillCount(
  sales: DailySale[],
  filters: SalesFilters = {},
): number {
  const billIds = new Set<string>();
  for (const { sale } of flattenToItemRows(sales, filters)) {
    billIds.add(sale.id);
  }
  return billIds.size;
}

export interface SalesTotals {
  revenue: number;
  units: number;
}

/** Sum revenue + units over rows that expose numeric `revenue` / `units`. */
export function computeTotals(
  rows: Array<{ revenue?: number; units?: number }>,
): SalesTotals {
  return rows.reduce<SalesTotals>(
    (acc, r) => ({
      revenue: acc.revenue + (r.revenue || 0),
      units: acc.units + (r.units || 0),
    }),
    { revenue: 0, units: 0 },
  );
}
