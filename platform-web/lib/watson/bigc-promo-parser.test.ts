import { describe, it, expect, beforeAll } from "vitest";
import {
  parseBigCSheet,
  parseBigCPeriodFromFileName,
  bigCToPromotionItems,
  type BigCParseResult,
} from "./bigc-promo-parser";

// ─── Fixture builder ──────────────────────────────────────────────────
// Mirrors the real BigC "PROMOTION ITEM REQUISITION / PRO.01" layout:
//   - a "Promotion Cost Price" row carrying the period (DD/MM/YY at 14/16/18
//     for start, 22/24/26 for end)
//   - an optional "Promotion Sell Price" row that may hold STALE template dates
//   - a header row with "Barcode" (col 3) and "Product Name" (col 7)
//   - a sub-header row with cost Normal/Promotion (18/21) and SELL
//     Normal/Promotion (24/27)
//   - item rows (No=2, Barcode=3 merged 3-6, Name=7 merged 7-13, sell
//     Normal=24, sell Promo=27, free-text PROMOTION=39)
//   - a blank/footer row that ends the table

type Cell = string | number | null;

const WIDTH = 50;
const blank = (): Cell[] => new Array(WIDTH).fill("");

const set = (row: Cell[], pairs: Record<number, Cell>): Cell[] => {
  for (const [k, v] of Object.entries(pairs)) row[Number(k)] = v;
  return row;
};

interface PeriodCells {
  startD?: Cell;
  startM?: Cell;
  startY?: Cell;
  endD?: Cell;
  endM?: Cell;
  endY?: Cell;
  staleSell?: boolean; // emit a "Promotion Sell Price" row with year 21
}

interface ItemCells {
  no?: Cell;
  barcode?: Cell;
  barcodeMergedAt?: number; // put barcode at this col instead of col 3
  name?: Cell;
  sellNormal?: Cell;
  sellPromo?: Cell;
  promoText?: Cell;
}

function buildSheet(opts: {
  period?: PeriodCells;
  branches?: string[];
  items: ItemCells[];
  omitPeriod?: boolean;
  omitTable?: boolean;
  /** No-only placeholder rows appended after `items` (running No, no barcode). */
  placeholderNos?: Cell[];
  /** Emit a footer "*** ผู้ค้าสามารถแนบ..." note row after the items. */
  footerNote?: boolean;
  /** Item rows appended AFTER the placeholders/footer (to test the stop rule). */
  trailingItems?: ItemCells[];
}): Cell[][] {
  const rows: Cell[][] = [];

  // Some leading header noise.
  rows.push(set(blank(), { 0: "BigC PROMOTION ITEM REQUISITION" }));
  rows.push(set(blank(), { 0: "PRO.01" }));

  // Branch row (codes live around cols 41-47).
  if (opts.branches?.length) {
    const br = blank();
    opts.branches.forEach((b, i) => (br[41 + i] = b));
    rows.push(br);
  } else {
    rows.push(blank());
  }

  // Stale "Promotion Sell Price" row (template leftover, year 21).
  if (opts.period?.staleSell) {
    rows.push(
      set(blank(), {
        0: "Promotion Sell Price",
        12: "Start/เริ่ม :",
        14: 1,
        16: 1,
        18: 21, // stale year
        20: "to/ถึง",
        22: 31,
        24: 12,
        26: 21,
      }),
    );
  }

  // "Promotion Cost Price" row = the authoritative period.
  if (!opts.omitPeriod) {
    const p = opts.period ?? {};
    rows.push(
      set(blank(), {
        0: "Promotion Cost Price",
        12: "Start/เริ่ม :",
        14: p.startD ?? 5,
        16: p.startM ?? 1,
        18: p.startY ?? 26,
        20: "to/ถึง",
        22: p.endD ?? 28,
        24: p.endM ?? 1,
        26: p.endY ?? 26,
      }),
    );
  } else {
    rows.push(blank());
  }

  // Pad to roughly the real offset before the table.
  while (rows.length < 26) rows.push(blank());

  if (!opts.omitTable) {
    // Header row: Barcode @3, Product Name @7, ขายสินค้า (SELL) anchor near 24.
    rows.push(
      set(blank(), {
        2: "No",
        3: "Barcode",
        7: "Product Name",
        18: "ราคาต้นทุนสินค้า",
        24: "ราคาขายสินค้า",
        39: "Promotion พิเศษ",
      }),
    );
    // Sub-header row: cost Normal/Promotion 18/21, sell Normal/Promotion 24/27.
    rows.push(
      set(blank(), {
        18: "Normal",
        21: "Promotion",
        24: "Normal",
        27: "Promotion",
      }),
    );

    const pushItem = (it: ItemCells) => {
      const row = blank();
      if (it.no !== undefined) row[2] = it.no;
      if (it.barcode !== undefined) {
        row[it.barcodeMergedAt ?? 3] = it.barcode;
      }
      if (it.name !== undefined) row[7] = it.name;
      if (it.sellNormal !== undefined) row[24] = it.sellNormal;
      if (it.sellPromo !== undefined) row[27] = it.sellPromo;
      if (it.promoText !== undefined) row[39] = it.promoText;
      rows.push(row);
    };

    // Real (contiguous) item rows.
    for (const it of opts.items) pushItem(it);

    // No-only placeholder rows: running "No" with branch "Y" marks, no barcode.
    for (const n of opts.placeholderNos ?? []) {
      rows.push(set(blank(), { 2: n, 41: "Y", 42: "Y" }));
    }

    // Footer note row (BigC's "*** ผู้ค้าสามารถแนบท้ายเอกสาร...").
    if (opts.footerNote) {
      rows.push(
        set(blank(), {
          2: "*** ผู้ค้าสามารถแนบท้ายเอกสารได้ในกรณีที่รายการสินค้าเกิน",
        }),
      );
    }

    // Trailing item rows after the gap/footer (to exercise the stop rule).
    for (const it of opts.trailingItems ?? []) pushItem(it);
  }

  // Footer / blank row to terminate the table, plus trailing noise.
  rows.push(blank());
  rows.push(set(blank(), { 0: "Authorized by" }));

  return rows;
}

const iso = (d: Date | null): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

// ─── Tests ────────────────────────────────────────────────────────────

describe("parseBigCSheet — mapping", () => {
  let res: BigCParseResult;

  beforeAll(() => {
    res = parseBigCSheet(
      buildSheet({
        branches: ["HYP", "MKT", "MINI"],
        items: [
          {
            no: 1,
            barcode: "8850001112223",
            name: "BigC Snack Original 100g",
            sellNormal: 35,
            sellPromo: 29,
            promoText: "2 For 1198",
          },
          {
            no: 2,
            barcode: "8850004445556",
            name: "BigC Juice Orange 1L",
            sellNormal: 45,
            sellPromo: 39,
          },
        ],
      }),
      { fileName: "BigC.xlsb" },
    );
  });

  it("maps barcode, itemName, itemCode", () => {
    expect(res.items).toHaveLength(2);
    expect(res.items[0].barcode).toBe("8850001112223");
    expect(res.items[0].itemName).toBe("BigC Snack Original 100g");
    // BigC has no Watson code → itemCode = barcode.
    expect(res.items[0].itemCode).toBe("8850001112223");
  });

  it("maps stdPrice from SELL Normal and commPrice from SELL Promotion", () => {
    expect(res.items[0].stdPrice).toBe(35);
    expect(res.items[0].commPrice).toBe(29);
    expect(res.items[1].stdPrice).toBe(45);
    expect(res.items[1].commPrice).toBe(39);
  });

  it("maps remark from the free-text PROMOTION column", () => {
    expect(res.items[0].remark).toBe("2 For 1198");
    expect(res.items[1].remark).toBe("");
  });

  it("detects branch group codes from the header", () => {
    expect(res.branches).toEqual(["HYP", "MKT", "MINI"]);
  });

  it("applies the same parsed period to every item", () => {
    expect(iso(res.items[0].promoStart)).toBe("2026-01-05");
    expect(iso(res.items[0].promoEnd)).toBe("2026-01-28");
    expect(iso(res.items[1].promoStart)).toBe("2026-01-05");
  });
});

describe("parseBigCSheet — period from Cost Price row", () => {
  it("parses the period from the Cost Price row with 2-digit year → 20xx", () => {
    const res = parseBigCSheet(
      buildSheet({
        period: { startD: 5, startM: 1, startY: 26, endD: 28, endM: 1, endY: 26 },
        items: [
          { no: 1, barcode: "8850000000001", name: "X", sellNormal: 10, sellPromo: 9 },
        ],
      }),
    );
    expect(res.periodSource).toBe("sheet");
    expect(iso(res.period.start)).toBe("2026-01-05");
    expect(iso(res.period.end)).toBe("2026-01-28");
  });

  it("does NOT use the stale Sell Price row (year 21) as the period", () => {
    const res = parseBigCSheet(
      buildSheet({
        period: {
          staleSell: true,
          startD: 5,
          startM: 1,
          startY: 26,
          endD: 28,
          endM: 1,
          endY: 26,
        },
        items: [
          { no: 1, barcode: "8850000000001", name: "X", sellNormal: 10, sellPromo: 9 },
        ],
      }),
    );
    expect(iso(res.period.start)).toBe("2026-01-05");
    expect(iso(res.period.start)).not.toBe("2021-01-01");
    expect(res.warnings.some((w) => w.includes("Sell Price"))).toBe(true);
  });
});

describe("parseBigCSheet — filename fallback", () => {
  it("falls back to the filename period when the sheet has none", () => {
    const res = parseBigCSheet(
      buildSheet({
        omitPeriod: true,
        items: [
          { no: 1, barcode: "8850000000001", name: "X", sellNormal: 10, sellPromo: 9 },
        ],
      }),
      { fileName: "BigC Period 5 Jan - 28 Jan 2026.xlsb" },
    );
    expect(res.periodSource).toBe("filename");
    expect(iso(res.period.start)).toBe("2026-01-05");
    expect(iso(res.period.end)).toBe("2026-01-28");
    expect(res.warnings.some((w) => w.includes("ชื่อไฟล์"))).toBe(true);
  });

  it("reports periodSource 'none' when neither sheet nor filename has a period", () => {
    const res = parseBigCSheet(
      buildSheet({
        omitPeriod: true,
        items: [
          { no: 1, barcode: "8850000000001", name: "X", sellNormal: 10, sellPromo: 9 },
        ],
      }),
      { fileName: "BigC.xlsb" },
    );
    expect(res.periodSource).toBe("none");
    expect(res.period.start).toBeNull();
  });
});

describe("parseBigCSheet — table boundaries & merges", () => {
  it("stops at the first footer/blank row (no No and no barcode)", () => {
    const res = parseBigCSheet(
      buildSheet({
        items: [
          { no: 1, barcode: "8850000000111", name: "A", sellNormal: 10, sellPromo: 9 },
          { no: 2, barcode: "8850000000222", name: "B", sellNormal: 20, sellPromo: 19 },
        ],
      }),
    );
    // Two items only — the trailing blank/"Authorized by" rows are excluded.
    expect(res.items).toHaveLength(2);
    expect(res.items.map((i) => i.barcode)).toEqual([
      "8850000000111",
      "8850000000222",
    ]);
  });

  it("reads a merged barcode from the first non-empty of cols 3-6", () => {
    const res = parseBigCSheet(
      buildSheet({
        items: [
          {
            no: 1,
            barcode: "8850009998887",
            barcodeMergedAt: 5, // barcode physically lands in col 5
            name: "Merged Barcode Item",
            sellNormal: 50,
            sellPromo: 45,
          },
        ],
      }),
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].barcode).toBe("8850009998887");
  });
});

describe("parseBigCSheet — empty placeholder & footer rows (real-file bug)", () => {
  // Reproduces the BigC layout: contiguous real items, then No-only placeholder
  // rows (running No + branch "Y" marks, no barcode), then a "***" footer note.
  it("drops No-only placeholder rows and never lists the footer note", () => {
    const res = parseBigCSheet(
      buildSheet({
        items: [
          { no: 1, barcode: "8859109863120", name: "FoodSup A", sellNormal: 100, sellPromo: 90 },
          { no: 2, barcode: "8859109863137", name: "FoodSup B", sellNormal: 200, sellPromo: 180 },
          { no: 3, barcode: "8859109863151", name: "FoodSup C", sellNormal: 300, sellPromo: 270 },
          { no: 4, barcode: "8859109863205", name: "FoodSup D", sellNormal: 400, sellPromo: 360 },
        ],
        // No 5–10: running No, branch "Y" marks, but no barcode/name/price.
        placeholderNos: [5, 6, 7, 8, 9, 10],
        footerNote: true,
      }),
    );

    // Only the 4 real items — placeholders (5–10) and footer note are excluded.
    expect(res.items).toHaveLength(4);
    expect(res.items.map((i) => i.barcode)).toEqual([
      "8859109863120",
      "8859109863137",
      "8859109863151",
      "8859109863205",
    ]);
    // Every returned item has a real barcode (no empty trailing item).
    expect(res.items.every((i) => i.barcode !== "")).toBe(true);
    // No footer note leaked in as an item.
    expect(res.items.some((i) => i.itemName.includes("***"))).toBe(false);
    expect(res.items.some((i) => i.no === "***")).toBe(false);
  });

  it("emits NO spurious 'no sell price' warning for skipped empty rows", () => {
    const res = parseBigCSheet(
      buildSheet({
        items: [
          { no: 1, barcode: "8859109863120", name: "A", sellNormal: 100, sellPromo: 90 },
          { no: 2, barcode: "8859109863137", name: "B", sellNormal: 200, sellPromo: 180 },
        ],
        placeholderNos: [3, 4, 5, 6, 7],
        footerNote: true,
      }),
    );
    // Both real items have prices → no "ไม่มีราคาขาย" warning at all.
    expect(res.warnings.some((w) => w.includes("ไม่มีราคาขาย"))).toBe(false);
    expect(res.items).toHaveLength(2);
  });

  it("stops after the contiguous block: trailing items past the gap are NOT picked up", () => {
    // Matches the real files: products are contiguous, then empty rows, then a
    // trailing valid-looking row appears AFTER ≥5 empties → we have stopped.
    const res = parseBigCSheet(
      buildSheet({
        items: [
          { no: 1, barcode: "8859109863120", name: "A", sellNormal: 100, sellPromo: 90 },
          { no: 2, barcode: "8859109863137", name: "B", sellNormal: 200, sellPromo: 180 },
        ],
        placeholderNos: [3, 4, 5, 6, 7],
        trailingItems: [
          { no: 8, barcode: "8859109999999", name: "After Gap", sellNormal: 50, sellPromo: 40 },
        ],
      }),
    );
    expect(res.items).toHaveLength(2);
    expect(res.items.some((i) => i.barcode === "8859109999999")).toBe(false);
  });

  it("treats a short/invalid 'barcode' (running No only) as a non-item", () => {
    const res = parseBigCSheet(
      buildSheet({
        items: [
          { no: 1, barcode: "8859109863120", name: "Real", sellNormal: 100, sellPromo: 90 },
          // No-only placeholder with a short numeric in the barcode col.
          { no: 2, barcode: "5", sellNormal: undefined, sellPromo: undefined },
        ],
      }),
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].barcode).toBe("8859109863120");
    // No "no sell price" warning for the skipped short-barcode row.
    expect(res.warnings.some((w) => w.includes("ไม่มีราคาขาย"))).toBe(false);
  });
});

describe("parseBigCSheet — warnings", () => {
  it("warns when an item is missing a sell price but still lists it", () => {
    const res = parseBigCSheet(
      buildSheet({
        items: [
          { no: 1, barcode: "8850000000111", name: "No Price Item" }, // no sell prices
        ],
      }),
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].stdPrice).toBeNull();
    expect(res.items[0].commPrice).toBeNull();
    expect(res.warnings.some((w) => w.includes("ไม่มีราคาขาย"))).toBe(true);
  });

  it("warns when a barcode has no name", () => {
    const res = parseBigCSheet(
      buildSheet({
        items: [
          { no: 1, barcode: "8850000000111", sellNormal: 10, sellPromo: 9 },
        ],
      }),
    );
    expect(res.warnings.some((w) => w.includes("ไม่มีชื่อสินค้า"))).toBe(true);
  });

  it("returns zero items + a warning for an empty/tableless sheet", () => {
    const res = parseBigCSheet(
      buildSheet({ omitTable: true, items: [] }),
    );
    expect(res.items).toHaveLength(0);
    expect(res.warnings.some((w) => w.includes("ไม่พบตาราง"))).toBe(true);
  });

  it("returns zero items + a warning for a completely empty sheet", () => {
    const res = parseBigCSheet([]);
    expect(res.items).toHaveLength(0);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

describe("parseBigCPeriodFromFileName", () => {
  it("parses '5 Jan - 28 Jan 2026' (year on end side only)", () => {
    const p = parseBigCPeriodFromFileName("BigC Period 5 Jan - 28 Jan 2026.xlsb");
    expect(iso(p.start)).toBe("2026-01-05");
    expect(iso(p.end)).toBe("2026-01-28");
  });

  it("parses years on both sides", () => {
    const p = parseBigCPeriodFromFileName("Promo 1 Feb 2026 to 15 Feb 2026.xlsx");
    expect(iso(p.start)).toBe("2026-02-01");
    expect(iso(p.end)).toBe("2026-02-15");
  });

  it("returns nulls when there is no parseable period", () => {
    const p = parseBigCPeriodFromFileName("BigC promotion.xlsb");
    expect(p.start).toBeNull();
    expect(p.end).toBeNull();
  });
});

describe("bigCToPromotionItems (BigC → standard PromotionItem columns)", () => {
  const start = new Date(Date.UTC(2026, 0, 5));
  const end = new Date(Date.UTC(2026, 0, 28));
  const result: BigCParseResult = {
    items: [
      {
        no: "1",
        barcode: "8859109863120",
        itemCode: "8859109863120",
        itemName: "P_พรีมาเนสท์ คอลลาเจน",
        stdPrice: 690,
        commPrice: 659,
        remark: "2 For 1198",
        promoStart: start,
        promoEnd: end,
      },
      {
        no: "2",
        barcode: "8859109863137",
        itemCode: "8859109863137",
        itemName: "P_พรีมาเนสท์วีต้า",
        stdPrice: null, // no sell price in the form
        commPrice: null,
        remark: "",
        promoStart: start,
        promoEnd: end,
      },
    ],
    period: { start, end },
    periodSource: "sheet",
    warnings: [],
    branches: ["HYP"],
  };

  it("maps each BigC row to the canonical PromotionItem shape", () => {
    const items = bigCToPromotionItems(result);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      itemCode: "8859109863120",
      barcode: "8859109863120",
      itemName: "P_พรีมาเนสท์ คอลลาเจน",
      stdPrice: 690,
      commPrice: 659,
      invoice62IncV: null,
      invoice62ExV: null,
      promoPrice: 659,
      promoStart: start,
      promoEnd: end,
      remark: "2 For 1198",
    });
  });

  it("uses barcode as itemCode (BigC has no Watson Code) and leaves Invoice-62 null", () => {
    const items = bigCToPromotionItems(result);
    expect(items[0].itemCode).toBe(items[0].barcode);
    expect(items[0].invoice62IncV).toBeNull();
    expect(items[0].invoice62ExV).toBeNull();
  });

  it("coerces a missing std price to 0 and keeps comm/promo price null", () => {
    const items = bigCToPromotionItems(result);
    expect(items[1].stdPrice).toBe(0);
    expect(items[1].commPrice).toBeNull();
    expect(items[1].promoPrice).toBeNull();
    expect(items[1].remark).toBe("");
  });

  it("applies the file-level period to every item", () => {
    const items = bigCToPromotionItems(result);
    expect(items.every((i) => i.promoStart === start && i.promoEnd === end)).toBe(true);
  });

  it("returns an empty array for no items", () => {
    expect(
      bigCToPromotionItems({ ...result, items: [] }),
    ).toEqual([]);
  });
});
