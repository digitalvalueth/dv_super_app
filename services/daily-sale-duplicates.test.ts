import { describe, expect, it } from "vitest";
import type { DailySale, DailySaleItem } from "@/types";
import {
  computeDuplicateBarcodes,
  computeItemRevenue,
  computeSaleTotals,
  findInFormDuplicateBarcodes,
  stripUndefined,
} from "@/services/daily-sale-duplicates";

const item = (overrides: Partial<DailySaleItem> = {}): DailySaleItem => ({
  barcode: "111",
  productDescription: "Product",
  price: 100,
  quantity: 1,
  revenue: 100,
  saleType: "normal",
  hasFreebie: false,
  ...overrides,
});

const sale = (
  id: string,
  items: Partial<DailySaleItem>[],
): Pick<DailySale, "id" | "items"> => ({
  id,
  items: items.map(item),
});

describe("findInFormDuplicateBarcodes", () => {
  it("returns barcodes appearing more than once", () => {
    const items = [
      { barcode: "A" },
      { barcode: "B" },
      { barcode: "A" },
      { barcode: "C" },
      { barcode: "B" },
    ];
    expect(findInFormDuplicateBarcodes(items).sort()).toEqual(["A", "B"]);
  });

  it("returns an empty array when there are no duplicates", () => {
    expect(
      findInFormDuplicateBarcodes([{ barcode: "A" }, { barcode: "B" }]),
    ).toEqual([]);
  });

  it("reports a barcode only once even if it appears three times", () => {
    expect(
      findInFormDuplicateBarcodes([
        { barcode: "X" },
        { barcode: "X" },
        { barcode: "X" },
      ]),
    ).toEqual(["X"]);
  });

  it("ignores falsy / missing barcodes", () => {
    expect(
      findInFormDuplicateBarcodes([
        { barcode: "" },
        { barcode: "" },
        { barcode: null },
        { barcode: undefined },
        {},
      ]),
    ).toEqual([]);
  });

  it("returns empty for an empty list", () => {
    expect(findInFormDuplicateBarcodes([])).toEqual([]);
  });
});

describe("computeDuplicateBarcodes", () => {
  it("returns colliding barcodes between existing sales and new barcodes", () => {
    const existing = [
      sale("s1", [{ barcode: "A" }, { barcode: "B" }]),
      sale("s2", [{ barcode: "C" }]),
    ];
    expect(
      computeDuplicateBarcodes(existing, ["B", "C", "Z"]).sort(),
    ).toEqual(["B", "C"]);
  });

  it("returns empty when there are no overlaps (partial-overlap negative case)", () => {
    const existing = [sale("s1", [{ barcode: "A" }, { barcode: "B" }])];
    expect(computeDuplicateBarcodes(existing, ["X", "Y"])).toEqual([]);
  });

  it("returns empty when there are no existing sales", () => {
    expect(computeDuplicateBarcodes([], ["A", "B"])).toEqual([]);
  });

  it("returns empty when newBarcodes is empty or all-falsy", () => {
    const existing = [sale("s1", [{ barcode: "A" }])];
    expect(computeDuplicateBarcodes(existing, [])).toEqual([]);
    expect(computeDuplicateBarcodes(existing, ["", ""])).toEqual([]);
  });

  it("excludes the record matching excludeId (editing case)", () => {
    const existing = [
      sale("editing", [{ barcode: "A" }]),
      sale("other", [{ barcode: "A" }, { barcode: "B" }]),
    ];
    // Without exclude: both A and B; A is also in 'editing' but still found via 'other'
    expect(computeDuplicateBarcodes(existing, ["A", "B"]).sort()).toEqual([
      "A",
      "B",
    ]);
    // Excluding 'other' leaves only 'editing' which has A
    expect(computeDuplicateBarcodes(existing, ["A", "B"], "other")).toEqual([
      "A",
    ]);
  });

  it("dedupes a barcode found in multiple existing sales", () => {
    const existing = [
      sale("s1", [{ barcode: "DUP" }]),
      sale("s2", [{ barcode: "DUP" }]),
    ];
    expect(computeDuplicateBarcodes(existing, ["DUP"])).toEqual(["DUP"]);
  });

  it("tolerates sales with missing items array", () => {
    const existing = [{ id: "s1" } as Pick<DailySale, "id" | "items">];
    expect(computeDuplicateBarcodes(existing, ["A"])).toEqual([]);
  });
});

describe("computeItemRevenue", () => {
  it("multiplies price by quantity", () => {
    expect(computeItemRevenue(100, 3)).toBe(300);
  });

  it("defaults quantity to 1 when zero, null, or undefined", () => {
    expect(computeItemRevenue(50, 0)).toBe(50);
    expect(computeItemRevenue(50, null)).toBe(50);
    expect(computeItemRevenue(50, undefined)).toBe(50);
  });

  it("treats null/undefined price as 0", () => {
    expect(computeItemRevenue(null, 5)).toBe(0);
    expect(computeItemRevenue(undefined, 5)).toBe(0);
  });
});

describe("computeSaleTotals", () => {
  it("sums quantities and revenues", () => {
    const items = [
      { quantity: 2, revenue: 200 },
      { quantity: 3, revenue: 150 },
    ];
    expect(computeSaleTotals(items)).toEqual({
      totalItems: 5,
      totalRevenue: 350,
    });
  });

  it("returns zeros for an empty list", () => {
    expect(computeSaleTotals([])).toEqual({ totalItems: 0, totalRevenue: 0 });
  });

  it("handles zero-quantity / zero-revenue items", () => {
    const items = [
      { quantity: 0, revenue: 0 },
      { quantity: 1, revenue: 99 },
    ];
    expect(computeSaleTotals(items)).toEqual({
      totalItems: 1,
      totalRevenue: 99,
    });
  });
});

describe("stripUndefined", () => {
  it("removes only undefined values, keeping null/0/empty-string/false", () => {
    expect(
      stripUndefined({ a: 1, b: undefined, c: null, d: 0, e: "", f: false }),
    ).toEqual({ a: 1, c: null, d: 0, e: "", f: false });
  });

  it("returns an empty object when all values are undefined", () => {
    expect(stripUndefined({ a: undefined, b: undefined })).toEqual({});
  });

  it("can be applied per-item on a nested items array (mirrors service usage)", () => {
    const data = {
      saleDate: "2026-06-15",
      workDescription: undefined,
      items: [
        { barcode: "A", freebieBarcode: undefined, price: 10 },
        { barcode: "B", promotionRemark: undefined, price: 20 },
      ],
    };
    const cleaned = stripUndefined({
      ...data,
      items: data.items.map((i) => stripUndefined(i)),
    });
    expect(cleaned).not.toHaveProperty("workDescription");
    expect(cleaned.items).toEqual([
      { barcode: "A", price: 10 },
      { barcode: "B", price: 20 },
    ]);
  });
});
