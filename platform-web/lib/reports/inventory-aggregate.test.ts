import { describe, expect, it } from "vitest";
import {
  addDays,
  buildInventoryRows,
  computeDOI,
  type InvEodDetailLite,
  type InvProductLite,
  type InvSaleLite,
} from "./inventory-aggregate";

describe("addDays", () => {
  it("is TZ-safe across month boundaries", () => {
    expect(addDays("2026-06-01", -1)).toBe("2026-05-31");
    expect(addDays("2026-06-17", -30)).toBe("2026-05-18");
  });
});

describe("computeDOI", () => {
  it("is SOH × windowDays ÷ units, rounded", () => {
    expect(computeDOI(8011, 12, 1)).toBe(668); // 667.58 → 668
    expect(computeDOI(8011, 84, 7)).toBe(668); // matches the 7-day case
  });
  it("is 0 when nothing sold", () => {
    expect(computeDOI(8011, 0, 7)).toBe(0);
  });
});

describe("buildInventoryRows", () => {
  const today = "2026-06-17";
  const products: InvProductLite[] = [
    { barcode: "A", sku: "SKU-A", name: "NEST ME Serum" },
    { barcode: "B", sku: "SKU-B", name: "NEST ME Cream" },
    { barcode: "C", sku: "SKU-C", name: "NEST ME New" }, // no stock, no sales
  ];
  // SOH per barcode = sum of EOD_Qty across branches.
  const eod: InvEodDetailLite[] = [
    { Barcode: "A", EOD_Qty: 5000 },
    { Barcode: "A", EOD_Qty: 3011 }, // another branch → A total 8011
    { Barcode: "B", EOD_Qty: 4000 },
  ];
  const sales: InvSaleLite[] = [
    { saleDate: "2026-06-16", items: [{ barcode: "A", quantity: 12 }, { barcode: "B", quantity: 3 }] }, // yesterday
    { saleDate: "2026-06-12", items: [{ barcode: "A", quantity: 20 }] }, // within 7d, not yesterday
    { saleDate: "2026-05-20", items: [{ barcode: "A", quantity: 100 }] }, // within 30d, not 7d
    { saleDate: "2026-04-01", items: [{ barcode: "A", quantity: 999 }] }, // outside 30d → ignored
  ];

  const rows = buildInventoryRows({ products, sales, eod, brand: "NEST ME", todayStr: today });
  const byBarcode = (sku: string) => rows.find((r) => r.sku === sku)!;

  it("sums SOH from EOD across branches", () => {
    expect(byBarcode("SKU-A").totalStock).toBe(8011);
    expect(byBarcode("SKU-B").totalStock).toBe(4000);
    expect(byBarcode("SKU-C").totalStock).toBe(0);
  });

  it("aggregates units into nested rolling windows ending yesterday", () => {
    const a = byBarcode("SKU-A");
    expect(a.ydUnits).toBe(12);
    expect(a.d7Units).toBe(32); // 12 + 20
    expect(a.d30Units).toBe(132); // 12 + 20 + 100 (the 2026-04-01 sale is excluded)
  });

  it("derives DOI per window", () => {
    const a = byBarcode("SKU-A");
    expect(a.ydDOI).toBe(668); // 8011×1/12
    expect(a.d7DOI).toBe(Math.round((8011 * 7) / 32));
    expect(a.d30DOI).toBe(Math.round((8011 * 30) / 132));
  });

  it("uses the brand as the category and zeroes out unsold/unstocked products", () => {
    const c = byBarcode("SKU-C");
    expect(c.cat).toBe("NEST ME");
    expect(c.ydUnits).toBe(0);
    expect(c.ydDOI).toBe(0);
    expect(c.d30DOI).toBe(0);
  });
});
