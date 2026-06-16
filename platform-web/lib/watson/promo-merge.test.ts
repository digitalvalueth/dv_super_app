import { describe, expect, it } from "vitest";
import type { PromotionItem } from "@/types/watson/promotion";
import { dayKey, mergePromotions, promoKey } from "./promo-merge";

const P = (o: Partial<PromotionItem>): PromotionItem => ({
  itemCode: "",
  barcode: "",
  itemName: "",
  stdPrice: 0,
  commPrice: null,
  invoice62IncV: null,
  invoice62ExV: null,
  promoPrice: null,
  promoStart: null,
  promoEnd: null,
  remark: "",
  ...o,
});

const may = new Date(Date.UTC(2026, 4, 21));
const jun = new Date(Date.UTC(2026, 5, 24));
const jul1 = new Date(Date.UTC(2026, 6, 1));
const jul31 = new Date(Date.UTC(2026, 6, 31));

describe("dayKey", () => {
  it("normalizes Date / string / Timestamp-like / null to YYYY-MM-DD", () => {
    expect(dayKey(may)).toBe("2026-05-21");
    expect(dayKey("2026-05-21T08:00:00Z")).toBe("2026-05-21");
    expect(dayKey({ toDate: () => may })).toBe("2026-05-21");
    expect(dayKey(null)).toBe("");
  });
});

describe("promoKey", () => {
  it("keys on stripped barcode + period; ignores barcode spacing", () => {
    const a = P({ barcode: "885 91098 5083 0", promoStart: may, promoEnd: jun });
    const b = P({ barcode: "8859109850830", promoStart: may, promoEnd: jun });
    expect(promoKey(a)).toBe(promoKey(b));
  });
  it("falls back to itemCode when there is no barcode", () => {
    expect(promoKey(P({ itemCode: "278079", promoStart: may, promoEnd: jun }))).toBe(
      "278079|2026-05-21|2026-06-24",
    );
  });
});

describe("mergePromotions", () => {
  const base = P({ barcode: "8859109850830", promoStart: may, promoEnd: jun, commPrice: 985 });

  it("updates in place when item + period match", () => {
    const incoming = P({ barcode: "8859109850830", promoStart: may, promoEnd: jun, commPrice: 950 });
    const r = mergePromotions([base], [incoming]);
    expect(r).toMatchObject({ added: 0, updated: 1 });
    expect(r.merged).toHaveLength(1);
    expect(r.merged[0].commPrice).toBe(950); // replaced
  });

  it("adds a new entry when the same item has a new period", () => {
    const newPeriod = P({ barcode: "8859109850830", promoStart: jul1, promoEnd: jul31, commPrice: 900 });
    const r = mergePromotions([base], [newPeriod]);
    expect(r).toMatchObject({ added: 1, updated: 0 });
    expect(r.merged).toHaveLength(2); // both periods coexist
  });

  it("treats different items as separate additions", () => {
    const other = P({ barcode: "8859109850999", promoStart: may, promoEnd: jun });
    const r = mergePromotions([base], [other]);
    expect(r).toMatchObject({ added: 1, updated: 0 });
    expect(r.merged).toHaveLength(2);
  });

  it("preserves unrelated existing entries and existing order", () => {
    const keepA = P({ barcode: "111", promoStart: may, promoEnd: jun });
    const keepB = P({ barcode: "222", promoStart: may, promoEnd: jun });
    const upd = P({ barcode: "222", promoStart: may, promoEnd: jun, commPrice: 5 });
    const add = P({ barcode: "333", promoStart: may, promoEnd: jun });
    const r = mergePromotions([keepA, keepB], [upd, add]);
    expect(r).toMatchObject({ added: 1, updated: 1 });
    expect(r.merged.map((i) => i.barcode)).toEqual(["111", "222", "333"]);
    expect(r.merged[1].commPrice).toBe(5);
  });

  it("handles empty existing and empty incoming", () => {
    expect(mergePromotions([], [base])).toMatchObject({ added: 1, updated: 0 });
    expect(mergePromotions([base], [])).toMatchObject({ added: 0, updated: 0 });
  });
});
