import { describe, expect, it } from "vitest";
import {
  parsePromoPeriodText,
  parseWatsonProSheet,
  watsonProToPromotionItems,
} from "./watson-pro-parser";

type Cell = string | number | null;
const W = 22;
const blank = (): Cell[] => new Array(W).fill("");
const set = (pairs: Record<number, Cell>): Cell[] => {
  const row = blank();
  for (const [k, v] of Object.entries(pairs)) row[Number(k)] = v;
  return row;
};

// Build a minimal Watson "Price and Cost Application Form" sheet:
//   - a "Price (Promo)" period cell
//   - a group-header row with Old RSP (c10) / New RSP (c11) / Mechanic (c20)
//   - the table header row (No/Product Code/Barcode/Description)
//   - item rows
function buildSheet(items: Cell[][], promoText?: string): Cell[][] {
  const rows: Cell[][] = [];
  rows.push(
    set({
      6:
        promoText ??
        "Price (Promo) : Start _21_May_2026__ End _24_Jun_2026_____",
    }),
  );
  rows.push(blank());
  rows.push(set({ 10: "Old RSP", 11: "New RSP", 20: "Mechanic (Simple)" }));
  rows.push(
    set({
      0: "No",
      1: "Product Code",
      2: "Barcode",
      3: "Description",
      10: "(Recommended Retail Price)",
      20: "Mechanic",
    }),
  );
  for (const it of items) rows.push(it);
  return rows;
}

const item = (o: {
  no?: Cell;
  code?: Cell;
  barcode?: Cell;
  name?: Cell;
  oldRSP?: Cell;
  newRSP?: Cell;
  remark?: Cell;
}): Cell[] =>
  set({
    0: o.no ?? "",
    1: o.code ?? "",
    2: o.barcode ?? "",
    3: o.name ?? "",
    10: o.oldRSP ?? "",
    11: o.newRSP ?? "",
    20: o.remark ?? "",
  });

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe("parsePromoPeriodText", () => {
  it("parses 'Start _21_May_2026 End _24_Jun_2026'", () => {
    const p = parsePromoPeriodText(
      "Price (Promo) : Start _21_May_2026__ End _24_Jun_2026_____",
    );
    expect(iso(p.start)).toBe("2026-05-21");
    expect(iso(p.end)).toBe("2026-06-24");
  });

  it("returns nulls when no parseable dates", () => {
    const p = parsePromoPeriodText("Price (Promo) : Start ____ End ____");
    expect(p.start).toBeNull();
    expect(p.end).toBeNull();
  });
});

describe("parseWatsonProSheet", () => {
  it("maps Old RSP → std, New RSP → comm, Product Code, stripped barcode", () => {
    const r = parseWatsonProSheet(
      buildSheet([
        item({
          no: 1,
          code: "278079",
          barcode: "885 91098 5083 0",
          name: "PrimaNest Intense Serum",
          oldRSP: 2850,
          newRSP: 985,
          remark: "SAVE",
        }),
      ]),
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      productCode: "278079",
      barcode: "8859109850830",
      itemName: "PrimaNest Intense Serum",
      stdPrice: 2850,
      commPrice: 985,
      remark: "SAVE",
    });
    expect(iso(r.period.start)).toBe("2026-05-21");
    expect(iso(r.period.end)).toBe("2026-06-24");
    expect(r.periodSource).toBe("sheet");
    expect(r.warnings).toEqual([]);
  });

  it("keeps an item whose name contains 'Total' (footer-marker false positive)", () => {
    const r = parseWatsonProSheet(
      buildSheet([
        item({ no: 1, code: "1", barcode: "8859109850001", name: "A", oldRSP: 100, newRSP: 90 }),
        item({
          no: 2,
          code: "2",
          barcode: "8859109850002",
          name: "PrimaNest Total Protect",
          oldRSP: 200,
          newRSP: 150,
        }),
        item({ no: 3, code: "3", barcode: "8859109850003", name: "C", oldRSP: 300, newRSP: 250 }),
      ]),
    );
    expect(r.items).toHaveLength(3);
    expect(r.items[1].itemName).toBe("PrimaNest Total Protect");
  });

  it("includes a bundle row that has a barcode but no running No", () => {
    const r = parseWatsonProSheet(
      buildSheet([
        item({ no: 1, code: "10", barcode: "8859109850010", name: "A", oldRSP: 100, newRSP: 90 }),
        item({
          code: "10",
          barcode: "8859109850010",
          name: "A (bundle)",
          oldRSP: 100,
          newRSP: 80,
          remark: "ซื้อ A + B",
        }),
      ]),
    );
    expect(r.items).toHaveLength(2);
    expect(r.items[1].remark).toBe("ซื้อ A + B");
  });

  it("stops at a footer row and skips No-only/blank placeholder rows", () => {
    const rows = buildSheet([
      item({ no: 1, code: "1", barcode: "8859109850001", name: "A", oldRSP: 100, newRSP: 90 }),
    ]);
    rows.push(set({ 0: 2 })); // No-only placeholder, no barcode
    rows.push(set({ 0: "Remark : เงื่อนไขการอนุมัติ" })); // footer marker
    rows.push(item({ code: "9", barcode: "8859109859999", name: "after footer", oldRSP: 1, newRSP: 1 }));
    const r = parseWatsonProSheet(rows);
    expect(r.items).toHaveLength(1);
  });

  it("warns when an item has no RSP prices", () => {
    const r = parseWatsonProSheet(
      buildSheet([item({ no: 1, code: "1", barcode: "8859109850001", name: "A" })]),
    );
    expect(r.items).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes("ไม่มีราคา RSP"))).toBe(true);
  });

  it("warns and returns no items when the table header is missing", () => {
    const r = parseWatsonProSheet([set({ 0: "nothing here" })]);
    expect(r.items).toEqual([]);
    expect(r.warnings.some((w) => w.includes("ไม่พบตาราง"))).toBe(true);
  });
});

describe("watsonProToPromotionItems", () => {
  it("maps to the canonical PromotionItem columns (Invoice-62 null)", () => {
    const r = parseWatsonProSheet(
      buildSheet([
        item({ no: 1, code: "278079", barcode: "885 91098 5083 0", name: "X", oldRSP: 2850, newRSP: 985, remark: "SAVE" }),
      ]),
    );
    const items = watsonProToPromotionItems(r);
    expect(items[0]).toEqual({
      itemCode: "278079",
      barcode: "8859109850830",
      itemName: "X",
      stdPrice: 2850,
      commPrice: 985,
      invoice62IncV: null,
      invoice62ExV: null,
      promoPrice: 985,
      promoStart: r.period.start,
      promoEnd: r.period.end,
      remark: "SAVE",
    });
  });
});
