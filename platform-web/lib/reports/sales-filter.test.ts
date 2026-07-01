import { describe, it, expect } from "vitest";
import {
  filterSales,
  flattenToItemRows,
  distinctBillCount,
  computeTotals,
} from "./sales-filter";
import type { DailySale } from "./types";

const item = (over: Partial<DailySale["items"][number]> = {}) => ({
  barcode: "111",
  productDescription: "Nest Me Bar",
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

// A representative dataset spanning stores, employees, dates, multi-item bills.
const dataset = (): DailySale[] => [
  sale({
    id: "s1",
    branchName: "Central",
    employeeName: "Alice",
    saleDate: "2026-06-10",
    items: [
      item({ barcode: "A1", productDescription: "Apple", revenue: 10, quantity: 1 }),
      item({ barcode: "A2", productDescription: "Banana", revenue: 20, quantity: 2 }),
    ],
  }),
  sale({
    id: "s2",
    branchName: "Mega",
    employeeName: "Bob",
    saleDate: "2026-06-11",
    items: [item({ barcode: "B1", productDescription: "Cherry", revenue: 30, quantity: 3 })],
  }),
  sale({
    id: "s3",
    branchName: "Central",
    employeeName: "Bob",
    saleDate: "2026-06-12",
    items: [item({ barcode: "C1", productDescription: "Date", revenue: 40, quantity: 4 })],
  }),
];

describe("filterSales", () => {
  it("returns all sales with no filters", () => {
    expect(filterSales(dataset(), {})).toHaveLength(3);
  });

  it("filters by store", () => {
    const r = filterSales(dataset(), { branch: "Central" });
    expect(r.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it('"All Stores" is treated as no store filter', () => {
    expect(filterSales(dataset(), { branch: "All Stores" })).toHaveLength(3);
  });

  it("filters by employee", () => {
    const r = filterSales(dataset(), { employee: "Bob" });
    expect(r.map((s) => s.id)).toEqual(["s2", "s3"]);
  });

  it('"All Salespersons" is treated as no employee filter', () => {
    expect(filterSales(dataset(), { employee: "All Salespersons" })).toHaveLength(3);
  });

  it("filters by start date (inclusive)", () => {
    const r = filterSales(dataset(), { startDate: "2026-06-11" });
    expect(r.map((s) => s.id)).toEqual(["s2", "s3"]);
  });

  it("filters by end date (inclusive)", () => {
    const r = filterSales(dataset(), { endDate: "2026-06-11" });
    expect(r.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("filters by an inclusive date range", () => {
    const r = filterSales(dataset(), {
      startDate: "2026-06-11",
      endDate: "2026-06-11",
    });
    expect(r.map((s) => s.id)).toEqual(["s2"]);
  });

  it("combines store + employee + date dimensions", () => {
    const r = filterSales(dataset(), {
      branch: "Central",
      employee: "Bob",
      startDate: "2026-06-12",
      endDate: "2026-06-12",
    });
    expect(r.map((s) => s.id)).toEqual(["s3"]);
  });

  it("returns [] for empty input", () => {
    expect(filterSales([], { branch: "Central" })).toEqual([]);
  });
});

describe("flattenToItemRows", () => {
  it("flattens every item of every passing bill (no query)", () => {
    const rows = flattenToItemRows(dataset(), {});
    // s1 has 2 items, s2 + s3 have 1 each -> 4 item rows.
    expect(rows).toHaveLength(4);
  });

  it("applies the search query at the item level (by description)", () => {
    const rows = flattenToItemRows(dataset(), { query: "banana" });
    expect(rows).toHaveLength(1);
    expect(rows[0].item.barcode).toBe("A2");
    expect(rows[0].sale.id).toBe("s1");
  });

  it("applies the search query by barcode (case-insensitive)", () => {
    const rows = flattenToItemRows(dataset(), { query: "b1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].sale.id).toBe("s2");
  });

  it("a multi-item bill only yields the items matching the query", () => {
    // s1 has Apple(A1) + Banana(A2); query "apple" yields just A1.
    const rows = flattenToItemRows(dataset(), { query: "apple" });
    expect(rows.map((r) => r.item.barcode)).toEqual(["A1"]);
  });

  it("combines bill-level filters with the item-level query", () => {
    const rows = flattenToItemRows(dataset(), {
      branch: "Central",
      query: "a", // matches Apple/Banana (s1) + Date (s3)
    });
    expect(rows.map((r) => r.item.barcode).sort()).toEqual(["A1", "A2", "C1"]);
  });

  it("returns [] for empty input", () => {
    expect(flattenToItemRows([], {})).toEqual([]);
  });
});

describe("distinctBillCount", () => {
  it("counts distinct bills, not item rows (multi-item bill counts once)", () => {
    // 4 item rows but only 3 distinct bills.
    expect(flattenToItemRows(dataset(), {})).toHaveLength(4);
    expect(distinctBillCount(dataset(), {})).toBe(3);
  });

  it("only counts a bill when at least one item passes the query", () => {
    // "banana" only matches one item in s1 -> 1 bill.
    expect(distinctBillCount(dataset(), { query: "banana" })).toBe(1);
  });

  it("counts a bill once even if multiple of its items match", () => {
    // s1 Apple + Banana both contain letter 'a' but it's one bill.
    expect(distinctBillCount(dataset(), { branch: "Central", query: "a" })).toBe(2); // s1 + s3
  });

  it("respects store/date filters", () => {
    expect(distinctBillCount(dataset(), { branch: "Mega" })).toBe(1);
  });

  it("returns 0 for empty input", () => {
    expect(distinctBillCount([], {})).toBe(0);
  });

  it("counts the same id once across duplicate-id bills", () => {
    const dup: DailySale[] = [
      sale({ id: "dup", items: [item({ barcode: "X" })] }),
      sale({ id: "dup", items: [item({ barcode: "Y" })] }),
    ];
    expect(distinctBillCount(dup, {})).toBe(1);
  });
});

describe("computeTotals", () => {
  it("sums revenue and units across rows", () => {
    expect(
      computeTotals([
        { revenue: 10, units: 1 },
        { revenue: 20, units: 2 },
        { revenue: 30, units: 3 },
      ]),
    ).toEqual({ revenue: 60, units: 6 });
  });

  it("guards undefined/missing revenue+units with || 0", () => {
    expect(
      computeTotals([{ revenue: 5 }, { units: 2 }, {}]),
    ).toEqual({ revenue: 5, units: 2 });
  });

  it("returns zeros for empty input", () => {
    expect(computeTotals([])).toEqual({ revenue: 0, units: 0 });
  });
});
