// Pure aggregation helpers for the report pages (by-store / by-product /
// supervisor team report). No next/react/firebase imports.
//
// These mirror the `rows` / `products` / `branchRows` / `employeeRows`
// useMemos in the respective pages exactly, including the `|| 0` guards,
// the div-by-zero guard on contribution/growth, and the
// `revenue > 0 || unitsSold > 0` filter on the branch/product variants.

import type { DailySale } from "./types";
import { growthPercent } from "./period";

const inRange = (date: string, s: string, e: string): boolean =>
  (!s || date >= s) && (!e || date <= e);

export interface BranchAggregateRow {
  branchId: string;
  store: string;
  unitsSold: number;
  revenue: number;
  revenuePrev: number;
  growth: number;
  contribution: number;
}

export interface ProductStoreBreakdown {
  store: string;
  units: number;
  revenue: number;
}

export interface ProductAggregateRow {
  code: string;
  name: string;
  unitsSold: number;
  revenue: number;
  revenuePrev: number;
  growth: number;
  contribution: number;
  byStore: ProductStoreBreakdown[];
}

export interface EmployeeAggregateRow {
  employeeName: string;
  branchName: string;
  revenue: number;
  units: number;
  bills: number;
}

/**
 * Aggregate brand sales by branch for the by-store report.
 *
 * `cur` is the current inclusive window, `prev` the preceding window
 * (typically from previousPeriodRange). Each row carries current units +
 * revenue, previous-window revenue, growth % vs previous, and % contribution
 * of the branch revenue to the total current revenue. Rows with no current
 * revenue and no current units are dropped (matching the page filter).
 */
export function aggregateByBranch(
  sales: DailySale[],
  cur: { start: string; end: string },
  prev: { prevStart: string; prevEnd: string },
): BranchAggregateRow[] {
  const byBranch = new Map<
    string,
    { store: string; unitsSold: number; revenue: number; revenuePrev: number }
  >();

  for (const sale of sales) {
    const key = sale.branchId || sale.branchName || "—";
    if (!byBranch.has(key)) {
      byBranch.set(key, {
        store: sale.branchName || "ไม่ระบุสาขา",
        unitsSold: 0,
        revenue: 0,
        revenuePrev: 0,
      });
    }
    const entry = byBranch.get(key)!;
    const itemUnits = (sale.items || []).reduce(
      (sum, i) => sum + (i.quantity || 0),
      0,
    );
    const itemRev = (sale.items || []).reduce(
      (sum, i) => sum + (i.revenue || 0),
      0,
    );

    if (inRange(sale.saleDate, cur.start, cur.end)) {
      entry.unitsSold += itemUnits;
      entry.revenue += itemRev;
    }
    if (inRange(sale.saleDate, prev.prevStart, prev.prevEnd)) {
      entry.revenuePrev += itemRev;
    }
  }

  const totalRevenue = Array.from(byBranch.values()).reduce(
    (s, e) => s + e.revenue,
    0,
  );

  return Array.from(byBranch.entries())
    .map(([branchId, e]) => ({
      branchId,
      store: e.store,
      unitsSold: e.unitsSold,
      revenue: e.revenue,
      revenuePrev: e.revenuePrev,
      growth: growthPercent(e.revenue, e.revenuePrev),
      contribution: totalRevenue > 0 ? (e.revenue / totalRevenue) * 100 : 0,
    }))
    .filter((r) => r.revenue > 0 || r.unitsSold > 0);
}

/**
 * Aggregate brand sales by product for the by-product report. Same shape as
 * aggregateByBranch but keyed by barcode (falling back to description), with a
 * per-store breakdown (sorted by units desc) attached to each product.
 */
export function aggregateByProduct(
  sales: DailySale[],
  cur: { start: string; end: string },
  prev: { prevStart: string; prevEnd: string },
): ProductAggregateRow[] {
  const byProduct = new Map<
    string,
    {
      code: string;
      name: string;
      unitsSold: number;
      revenue: number;
      revenuePrev: number;
      byStore: Map<string, ProductStoreBreakdown>;
    }
  >();

  for (const sale of sales) {
    const inCur = inRange(sale.saleDate, cur.start, cur.end);
    const inPrev = inRange(sale.saleDate, prev.prevStart, prev.prevEnd);
    if (!inCur && !inPrev) continue;

    for (const item of sale.items) {
      const key = item.barcode || item.productDescription || "—";
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          code: item.barcode || "—",
          name: item.productDescription || "สินค้าไม่ระบุชื่อ",
          unitsSold: 0,
          revenue: 0,
          revenuePrev: 0,
          byStore: new Map(),
        });
      }
      const entry = byProduct.get(key)!;
      if (inCur) {
        entry.unitsSold += item.quantity || 0;
        entry.revenue += item.revenue || 0;
        const storeKey = sale.branchName || "ไม่ระบุสาขา";
        if (!entry.byStore.has(storeKey)) {
          entry.byStore.set(storeKey, { store: storeKey, units: 0, revenue: 0 });
        }
        const st = entry.byStore.get(storeKey)!;
        st.units += item.quantity || 0;
        st.revenue += item.revenue || 0;
      }
      if (inPrev) {
        entry.revenuePrev += item.revenue || 0;
      }
    }
  }

  const totalRevenue = Array.from(byProduct.values()).reduce(
    (s, e) => s + e.revenue,
    0,
  );

  return Array.from(byProduct.values())
    .map((e) => ({
      code: e.code,
      name: e.name,
      unitsSold: e.unitsSold,
      revenue: e.revenue,
      revenuePrev: e.revenuePrev,
      growth: growthPercent(e.revenue, e.revenuePrev),
      contribution: totalRevenue > 0 ? (e.revenue / totalRevenue) * 100 : 0,
      byStore: Array.from(e.byStore.values()).sort((a, b) => b.units - a.units),
    }))
    .filter((p) => p.revenue > 0 || p.unitsSold > 0);
}

/**
 * Aggregate already-period-filtered brand sales by employee (keyed by
 * employeeId|employeeName + branch) for the supervisor team report. `bills`
 * is the distinct sale-doc count for that employee. Sales are expected to
 * carry `totalRevenue` / `totalUnits` (brand-recomputed by the page).
 */
export function aggregateByEmployee(
  periodSales: DailySale[],
): EmployeeAggregateRow[] {
  const map = new Map<
    string,
    {
      employeeName: string;
      branchName: string;
      revenue: number;
      units: number;
      bills: Set<string>;
    }
  >();
  for (const s of periodSales) {
    const key = `${s.employeeId || s.employeeName || "—"}__${s.branchId || ""}`;
    if (!map.has(key)) {
      map.set(key, {
        employeeName: s.employeeName || "ไม่ระบุพนักงาน",
        branchName: s.branchName || "ไม่ระบุสาขา",
        revenue: 0,
        units: 0,
        bills: new Set<string>(),
      });
    }
    const entry = map.get(key)!;
    entry.revenue += s.totalRevenue || 0;
    entry.units += s.totalUnits || 0;
    entry.bills.add(s.id);
  }
  return Array.from(map.values()).map((e) => ({
    employeeName: e.employeeName,
    branchName: e.branchName,
    revenue: e.revenue,
    units: e.units,
    bills: e.bills.size,
  }));
}

export interface TeamBranchRow {
  branchId: string;
  branchName: string;
  revenue: number;
  units: number;
  bills: number;
  share: number;
}

/**
 * Aggregate already-period-filtered brand sales by branch for the supervisor
 * team report. `share` is the branch revenue as a % of `totalRevenue` (the
 * team total), guarded against div-by-zero.
 */
export function aggregateTeamByBranch(
  periodSales: DailySale[],
  totalRevenue: number,
): TeamBranchRow[] {
  const map = new Map<
    string,
    {
      branchId: string;
      branchName: string;
      revenue: number;
      units: number;
      bills: Set<string>;
    }
  >();
  for (const s of periodSales) {
    const key = s.branchId || s.branchName || "—";
    if (!map.has(key)) {
      map.set(key, {
        branchId: s.branchId,
        branchName: s.branchName || "ไม่ระบุสาขา",
        revenue: 0,
        units: 0,
        bills: new Set<string>(),
      });
    }
    const entry = map.get(key)!;
    entry.revenue += s.totalRevenue || 0;
    entry.units += s.totalUnits || 0;
    entry.bills.add(s.id);
  }
  return Array.from(map.values()).map((e) => ({
    branchId: e.branchId,
    branchName: e.branchName,
    revenue: e.revenue,
    units: e.units,
    bills: e.bills.size,
    share: totalRevenue > 0 ? (e.revenue / totalRevenue) * 100 : 0,
  }));
}

export interface TeamSummary {
  revenue: number;
  units: number;
  bills: number;
  branches: number;
  employees: number;
}

/**
 * Team-level summary (revenue, units, distinct bills/branches/employees) over
 * already-period-filtered brand sales, mirroring the supervisor page's
 * `teamSummary` useMemo.
 */
export function teamSummary(periodSales: DailySale[]): TeamSummary {
  let revenue = 0;
  let units = 0;
  const billIds = new Set<string>();
  const branchIds = new Set<string>();
  const employeeKeys = new Set<string>();

  for (const s of periodSales) {
    revenue += s.totalRevenue || 0;
    units += s.totalUnits || 0;
    billIds.add(s.id);
    if (s.branchId) branchIds.add(s.branchId);
    const empKey = s.employeeId || s.employeeName || "";
    if (empKey) employeeKeys.add(empKey);
  }

  return {
    revenue,
    units,
    bills: billIds.size,
    branches: branchIds.size,
    employees: employeeKeys.size,
  };
}
