import { describe, it, expect } from "vitest";
import {
  aggregateByBranch,
  aggregateByProduct,
  aggregateByEmployee,
  aggregateTeamByBranch,
  teamSummary,
} from "./aggregate";
import { previousPeriodRange } from "./period";
import type { DailySale } from "./types";

const item = (over: Partial<DailySale["items"][number]> = {}) => ({
  barcode: "P1",
  productDescription: "Prod 1",
  price: 10,
  quantity: 1,
  revenue: 10,
  ...over,
});

const sale = (over: Partial<DailySale> = {}): DailySale => ({
  id: "s1",
  branchId: "b1",
  branchName: "Central",
  employeeId: "e1",
  employeeName: "Alice",
  saleDate: "2026-06-10",
  items: [item()],
  ...over,
});

describe("aggregateByBranch", () => {
  const cur = { start: "2026-06-08", end: "2026-06-10" };
  const prev = previousPeriodRange(cur.start, cur.end); // 2026-06-05..2026-06-07

  it("aggregates units + revenue per branch in the current window", () => {
    const sales: DailySale[] = [
      sale({
        id: "s1",
        branchId: "b1",
        branchName: "Central",
        saleDate: "2026-06-10",
        items: [item({ quantity: 2, revenue: 200 })],
      }),
      sale({
        id: "s2",
        branchId: "b1",
        branchName: "Central",
        saleDate: "2026-06-09",
        items: [item({ quantity: 3, revenue: 300 })],
      }),
      sale({
        id: "s3",
        branchId: "b2",
        branchName: "Mega",
        saleDate: "2026-06-08",
        items: [item({ quantity: 5, revenue: 500 })],
      }),
    ];
    const rows = aggregateByBranch(sales, cur, prev);
    const central = rows.find((r) => r.branchId === "b1")!;
    const mega = rows.find((r) => r.branchId === "b2")!;
    expect(central.unitsSold).toBe(5);
    expect(central.revenue).toBe(500);
    expect(mega.unitsSold).toBe(5);
    expect(mega.revenue).toBe(500);
  });

  it("contribution sums to ~100 across branches", () => {
    const sales: DailySale[] = [
      sale({ id: "s1", branchId: "b1", branchName: "A", items: [item({ revenue: 300 })] }),
      sale({ id: "s2", branchId: "b2", branchName: "B", items: [item({ revenue: 100 })] }),
    ];
    const rows = aggregateByBranch(sales, cur, prev);
    const totalContribution = rows.reduce((s, r) => s + r.contribution, 0);
    expect(totalContribution).toBeCloseTo(100, 6);
    expect(rows.find((r) => r.branchId === "b1")!.contribution).toBeCloseTo(75, 6);
  });

  it("computes growth vs previous window and guards div-by-zero", () => {
    const sales: DailySale[] = [
      // current
      sale({ id: "c", branchId: "b1", branchName: "A", saleDate: "2026-06-10", items: [item({ revenue: 150 })] }),
      // previous window
      sale({ id: "p", branchId: "b1", branchName: "A", saleDate: "2026-06-06", items: [item({ revenue: 100 })] }),
      // a branch with only current revenue -> growth 0 (prev = 0)
      sale({ id: "n", branchId: "b2", branchName: "B", saleDate: "2026-06-10", items: [item({ revenue: 80 })] }),
    ];
    const rows = aggregateByBranch(sales, cur, prev);
    const a = rows.find((r) => r.branchId === "b1")!;
    const b = rows.find((r) => r.branchId === "b2")!;
    expect(a.revenuePrev).toBe(100);
    expect(a.growth).toBeCloseTo(50, 6);
    expect(b.revenuePrev).toBe(0);
    expect(b.growth).toBe(0); // no division by zero
  });

  it("drops branches with no current revenue and no current units", () => {
    // sale only in previous window -> revenue/units are 0 in current -> dropped.
    const sales: DailySale[] = [
      sale({ id: "p", branchId: "b9", branchName: "OldOnly", saleDate: "2026-06-06", items: [item({ revenue: 100 })] }),
    ];
    const rows = aggregateByBranch(sales, cur, prev);
    expect(rows).toHaveLength(0);
  });

  it("returns [] for empty input and contribution 0 when total revenue is 0", () => {
    expect(aggregateByBranch([], cur, prev)).toEqual([]);
    // A current sale with zero revenue but nonzero units survives the filter
    // and gets contribution 0 (total revenue is 0 -> guard).
    const sales = [
      sale({ branchId: "b1", branchName: "A", saleDate: "2026-06-10", items: [item({ revenue: 0, quantity: 2 })] }),
    ];
    const rows = aggregateByBranch(sales, cur, prev);
    expect(rows).toHaveLength(1);
    expect(rows[0].contribution).toBe(0);
  });

  it("guards undefined quantity/revenue with || 0", () => {
    const sales: DailySale[] = [
      sale({
        branchId: "b1",
        branchName: "A",
        saleDate: "2026-06-10",
        items: [{ barcode: "x", productDescription: "x", price: 0, quantity: undefined as any, revenue: 50 }],
      }),
    ];
    const rows = aggregateByBranch(sales, cur, prev);
    expect(rows[0].unitsSold).toBe(0);
    expect(rows[0].revenue).toBe(50);
  });
});

describe("aggregateByProduct", () => {
  const cur = { start: "2026-06-08", end: "2026-06-10" };
  const prev = previousPeriodRange(cur.start, cur.end);

  it("aggregates per product with byStore breakdown sorted by units desc", () => {
    const sales: DailySale[] = [
      sale({
        id: "s1",
        branchName: "Central",
        saleDate: "2026-06-10",
        items: [item({ barcode: "P1", productDescription: "Prod 1", quantity: 2, revenue: 200 })],
      }),
      sale({
        id: "s2",
        branchName: "Mega",
        saleDate: "2026-06-09",
        items: [item({ barcode: "P1", productDescription: "Prod 1", quantity: 5, revenue: 500 })],
      }),
    ];
    const rows = aggregateByProduct(sales, cur, prev);
    expect(rows).toHaveLength(1);
    const p = rows[0];
    expect(p.code).toBe("P1");
    expect(p.unitsSold).toBe(7);
    expect(p.revenue).toBe(700);
    // byStore sorted by units desc: Mega(5) then Central(2)
    expect(p.byStore.map((s) => s.store)).toEqual(["Mega", "Central"]);
    expect(p.byStore[0].units).toBe(5);
  });

  it("contribution sums to ~100 across products", () => {
    const sales: DailySale[] = [
      sale({ saleDate: "2026-06-10", items: [item({ barcode: "P1", revenue: 250 })] }),
      sale({ saleDate: "2026-06-10", items: [item({ barcode: "P2", revenue: 250 })] }),
    ];
    const rows = aggregateByProduct(sales, cur, prev);
    expect(rows.reduce((s, r) => s + r.contribution, 0)).toBeCloseTo(100, 6);
  });

  it("computes prev-window revenue and growth per product", () => {
    const sales: DailySale[] = [
      sale({ saleDate: "2026-06-10", items: [item({ barcode: "P1", revenue: 120 })] }),
      sale({ saleDate: "2026-06-06", items: [item({ barcode: "P1", revenue: 100 })] }),
    ];
    const rows = aggregateByProduct(sales, cur, prev);
    expect(rows[0].revenuePrev).toBe(100);
    expect(rows[0].growth).toBeCloseTo(20, 6);
  });

  it("drops a product whose current revenue and units are both zero", () => {
    // Product appears only in prev window: current revenue/units 0 BUT the
    // page's filter keeps it out only when both are 0. Here revenue 0 + units 0
    // -> dropped, matching by-product behaviour.
    const sales: DailySale[] = [
      sale({ saleDate: "2026-06-06", items: [item({ barcode: "Pold", revenue: 100 })] }),
    ];
    const rows = aggregateByProduct(sales, cur, prev);
    expect(rows).toHaveLength(0);
  });

  it("returns [] for empty input", () => {
    expect(aggregateByProduct([], cur, prev)).toEqual([]);
  });
});

describe("aggregateByEmployee", () => {
  it("aggregates by employee+branch with distinct bill count", () => {
    const periodSales: DailySale[] = [
      sale({ id: "s1", employeeId: "e1", employeeName: "Alice", branchId: "b1", branchName: "Central", totalRevenue: 100, totalUnits: 2 }),
      sale({ id: "s2", employeeId: "e1", employeeName: "Alice", branchId: "b1", branchName: "Central", totalRevenue: 50, totalUnits: 1 }),
      sale({ id: "s3", employeeId: "e2", employeeName: "Bob", branchId: "b1", branchName: "Central", totalRevenue: 30, totalUnits: 3 }),
    ];
    const rows = aggregateByEmployee(periodSales);
    const alice = rows.find((r) => r.employeeName === "Alice")!;
    const bob = rows.find((r) => r.employeeName === "Bob")!;
    expect(alice.revenue).toBe(150);
    expect(alice.units).toBe(3);
    expect(alice.bills).toBe(2);
    expect(bob.bills).toBe(1);
  });

  it("splits the same employee across different branches", () => {
    const periodSales: DailySale[] = [
      sale({ id: "s1", employeeId: "e1", employeeName: "Alice", branchId: "b1", totalRevenue: 100 }),
      sale({ id: "s2", employeeId: "e1", employeeName: "Alice", branchId: "b2", totalRevenue: 40 }),
    ];
    const rows = aggregateByEmployee(periodSales);
    expect(rows).toHaveLength(2);
  });

  it("counts a duplicate bill id once", () => {
    const periodSales: DailySale[] = [
      sale({ id: "dup", employeeName: "Alice", branchId: "b1", totalRevenue: 10 }),
      sale({ id: "dup", employeeName: "Alice", branchId: "b1", totalRevenue: 10 }),
    ];
    const rows = aggregateByEmployee(periodSales);
    expect(rows[0].bills).toBe(1);
    expect(rows[0].revenue).toBe(20); // revenue still summed
  });

  it("guards missing totals with || 0 and falls back to default names", () => {
    const periodSales: DailySale[] = [
      { id: "s1", branchId: "", branchName: "", employeeName: "", saleDate: "2026-06-10", items: [] },
    ];
    const rows = aggregateByEmployee(periodSales);
    expect(rows[0].revenue).toBe(0);
    expect(rows[0].units).toBe(0);
    expect(rows[0].employeeName).toBe("ไม่ระบุพนักงาน");
    expect(rows[0].branchName).toBe("ไม่ระบุสาขา");
  });

  it("returns [] for empty input", () => {
    expect(aggregateByEmployee([])).toEqual([]);
  });
});

describe("aggregateTeamByBranch", () => {
  it("aggregates per branch with distinct bills and share of team revenue", () => {
    const periodSales: DailySale[] = [
      sale({ id: "s1", branchId: "b1", branchName: "Central", totalRevenue: 300, totalUnits: 3 }),
      sale({ id: "s2", branchId: "b1", branchName: "Central", totalRevenue: 0, totalUnits: 0 }),
      sale({ id: "s3", branchId: "b2", branchName: "Mega", totalRevenue: 100, totalUnits: 1 }),
    ];
    const rows = aggregateTeamByBranch(periodSales, 400);
    const central = rows.find((r) => r.branchId === "b1")!;
    const mega = rows.find((r) => r.branchId === "b2")!;
    expect(central.revenue).toBe(300);
    expect(central.bills).toBe(2);
    expect(central.share).toBeCloseTo(75, 6);
    expect(mega.share).toBeCloseTo(25, 6);
  });

  it("share is 0 when total revenue is 0 (no div-by-zero)", () => {
    const periodSales: DailySale[] = [
      sale({ id: "s1", branchId: "b1", branchName: "A", totalRevenue: 0, totalUnits: 5 }),
    ];
    const rows = aggregateTeamByBranch(periodSales, 0);
    expect(rows[0].share).toBe(0);
  });

  it("returns [] for empty input", () => {
    expect(aggregateTeamByBranch([], 0)).toEqual([]);
  });
});

describe("teamSummary", () => {
  it("sums revenue/units and counts distinct bills/branches/employees", () => {
    const periodSales: DailySale[] = [
      sale({ id: "s1", branchId: "b1", employeeId: "e1", employeeName: "Alice", totalRevenue: 100, totalUnits: 2 }),
      sale({ id: "s2", branchId: "b1", employeeId: "e2", employeeName: "Bob", totalRevenue: 50, totalUnits: 1 }),
      sale({ id: "s3", branchId: "b2", employeeId: "e1", employeeName: "Alice", totalRevenue: 25, totalUnits: 1 }),
    ];
    const s = teamSummary(periodSales);
    expect(s.revenue).toBe(175);
    expect(s.units).toBe(4);
    expect(s.bills).toBe(3);
    expect(s.branches).toBe(2); // b1, b2
    expect(s.employees).toBe(2); // e1, e2
  });

  it("falls back to employeeName when employeeId is absent", () => {
    const periodSales: DailySale[] = [
      sale({ id: "s1", employeeId: undefined, employeeName: "Alice", branchId: "b1", totalRevenue: 10 }),
      sale({ id: "s2", employeeId: undefined, employeeName: "Alice", branchId: "b1", totalRevenue: 10 }),
    ];
    expect(teamSummary(periodSales).employees).toBe(1);
  });

  it("does not count blank branch/employee keys", () => {
    const periodSales: DailySale[] = [
      { id: "s1", branchId: "", branchName: "", employeeId: "", employeeName: "", saleDate: "2026-06-10", items: [], totalRevenue: 10 },
    ];
    const s = teamSummary(periodSales);
    expect(s.branches).toBe(0);
    expect(s.employees).toBe(0);
    expect(s.bills).toBe(1);
    expect(s.revenue).toBe(10);
  });

  it("returns zeros for empty input", () => {
    expect(teamSummary([])).toEqual({
      revenue: 0,
      units: 0,
      bills: 0,
      branches: 0,
      employees: 0,
    });
  });
});
