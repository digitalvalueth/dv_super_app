import { describe, it, expect } from "vitest";
import {
  findOverlappingPromotions,
  rangesOverlap,
  type PromotionItemLike,
} from "./promo-validation";

// Boundary decision (documented):
// Overlap is INCLUSIVE on both ends. Ranges that touch on a single day —
// A = Jun01..Jun15 and B = Jun15..Jun20 — share Jun15 and therefore DO overlap.
// Ranges that are merely ADJACENT with no shared day —
// A = Jun01..Jun15 and B = Jun16..Jun20 — do NOT overlap.
// Dates here use midnight UTC (no time component), so "same day" means the
// exact same timestamp; comparison is by Date.getTime().

const d = (s: string): Date => new Date(s);

const row = (over: Partial<PromotionItemLike> = {}): PromotionItemLike => ({
  itemCode: "303812",
  itemName: "#NestMe Chocolate 35g",
  promoStart: d("2026-06-01"),
  promoEnd: d("2026-06-15"),
  ...over,
});

describe("rangesOverlap", () => {
  it("overlaps when ranges share interior dates", () => {
    expect(
      rangesOverlap(d("2026-06-01"), d("2026-06-15"), d("2026-06-10"), d("2026-06-20")),
    ).toBe(true);
  });

  it("overlaps inclusively when ranges touch on a single day", () => {
    expect(
      rangesOverlap(d("2026-06-01"), d("2026-06-15"), d("2026-06-15"), d("2026-06-20")),
    ).toBe(true);
  });

  it("does NOT overlap when adjacent with no shared day", () => {
    expect(
      rangesOverlap(d("2026-06-01"), d("2026-06-15"), d("2026-06-16"), d("2026-06-20")),
    ).toBe(false);
  });

  it("null start acts as -infinity (open left)", () => {
    expect(
      rangesOverlap(null, d("2026-06-15"), d("2026-06-10"), d("2026-06-20")),
    ).toBe(true);
    // open-left range ending before the other starts → no overlap
    expect(
      rangesOverlap(null, d("2026-06-15"), d("2026-06-16"), d("2026-06-20")),
    ).toBe(false);
  });

  it("null end acts as +infinity (open right)", () => {
    expect(
      rangesOverlap(d("2026-06-10"), null, d("2026-06-01"), d("2026-06-05")),
    ).toBe(false);
    expect(
      rangesOverlap(d("2026-06-10"), null, d("2026-06-01"), d("2026-06-12")),
    ).toBe(true);
  });

  it("both null overlaps any range", () => {
    expect(rangesOverlap(null, null, d("2026-06-01"), d("2026-06-05"))).toBe(true);
    expect(rangesOverlap(null, null, null, null)).toBe(true);
  });
});

describe("findOverlappingPromotions", () => {
  it("returns no conflicts for an empty list", () => {
    expect(findOverlappingPromotions([])).toEqual([]);
  });

  it("returns no conflicts for a single item", () => {
    expect(findOverlappingPromotions([row()])).toEqual([]);
  });

  it("no conflict for same item with adjacent (non-overlapping) ranges", () => {
    const items = [
      row({ promoStart: d("2026-06-01"), promoEnd: d("2026-06-15") }),
      row({ promoStart: d("2026-06-16"), promoEnd: d("2026-06-30") }),
    ];
    expect(findOverlappingPromotions(items)).toEqual([]);
  });

  it("conflict for same item touching on a single day (inclusive)", () => {
    const items = [
      row({ promoStart: d("2026-06-01"), promoEnd: d("2026-06-15") }),
      row({ promoStart: d("2026-06-15"), promoEnd: d("2026-06-30") }),
    ];
    const conflicts = findOverlappingPromotions(items);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].itemCode).toBe("303812");
    expect(conflicts[0].rangeA).toEqual({
      start: d("2026-06-01"),
      end: d("2026-06-15"),
    });
    expect(conflicts[0].rangeB).toEqual({
      start: d("2026-06-15"),
      end: d("2026-06-30"),
    });
  });

  it("conflict for same item with overlapping ranges", () => {
    const items = [
      row({ promoStart: d("2026-06-01"), promoEnd: d("2026-06-20") }),
      row({ promoStart: d("2026-06-10"), promoEnd: d("2026-06-30") }),
    ];
    expect(findOverlappingPromotions(items)).toHaveLength(1);
  });

  it("no conflict for DIFFERENT items with overlapping dates", () => {
    const items = [
      row({ itemCode: "303812", promoStart: d("2026-06-01"), promoEnd: d("2026-06-20") }),
      row({ itemCode: "400101", promoStart: d("2026-06-01"), promoEnd: d("2026-06-20") }),
    ];
    expect(findOverlappingPromotions(items)).toEqual([]);
  });

  it("null start (open-ended) conflicts with a fixed range it covers", () => {
    const items = [
      row({ promoStart: null, promoEnd: d("2026-06-15") }),
      row({ promoStart: d("2026-06-10"), promoEnd: d("2026-06-20") }),
    ];
    expect(findOverlappingPromotions(items)).toHaveLength(1);
  });

  it("null start does NOT conflict with a later disjoint range", () => {
    const items = [
      row({ promoStart: null, promoEnd: d("2026-06-15") }),
      row({ promoStart: d("2026-06-16"), promoEnd: d("2026-06-20") }),
    ];
    expect(findOverlappingPromotions(items)).toEqual([]);
  });

  it("null end (open-ended) conflicts with any later range", () => {
    const items = [
      row({ promoStart: d("2026-06-10"), promoEnd: null }),
      row({ promoStart: d("2026-12-01"), promoEnd: d("2026-12-31") }),
    ];
    expect(findOverlappingPromotions(items)).toHaveLength(1);
  });

  it("both-null range conflicts with any same-item row", () => {
    const items = [
      row({ promoStart: null, promoEnd: null }),
      row({ promoStart: d("2026-06-01"), promoEnd: d("2026-06-05") }),
      row({ promoStart: d("2030-01-01"), promoEnd: d("2030-01-31") }),
    ];
    // both-null conflicts with each of the other two; the other two are
    // disjoint from each other → exactly 2 conflicts.
    expect(findOverlappingPromotions(items)).toHaveLength(2);
  });

  it("ignores rows with empty itemCode", () => {
    const items = [
      row({ itemCode: "", promoStart: d("2026-06-01"), promoEnd: d("2026-06-20") }),
      row({ itemCode: "   ", promoStart: d("2026-06-01"), promoEnd: d("2026-06-20") }),
    ];
    expect(findOverlappingPromotions(items)).toEqual([]);
  });

  it("groups itemCode case- and space-insensitively", () => {
    const items = [
      row({ itemCode: "ABC123", promoStart: d("2026-06-01"), promoEnd: d("2026-06-20") }),
      row({ itemCode: "  abc123 ", promoStart: d("2026-06-10"), promoEnd: d("2026-06-30") }),
    ];
    const conflicts = findOverlappingPromotions(items);
    expect(conflicts).toHaveLength(1);
    // reports the original (untrimmed) code of the first row in the pair
    expect(conflicts[0].itemCode).toBe("ABC123");
  });

  it("handles 3+ rows of same item with mixed overlaps", () => {
    // r0 [Jun01..Jun10], r1 [Jun05..Jun15] overlaps r0,
    // r2 [Jun20..Jun30] disjoint from both.
    const items = [
      row({ promoStart: d("2026-06-01"), promoEnd: d("2026-06-10") }), // r0
      row({ promoStart: d("2026-06-05"), promoEnd: d("2026-06-15") }), // r1
      row({ promoStart: d("2026-06-20"), promoEnd: d("2026-06-30") }), // r2
    ];
    const conflicts = findOverlappingPromotions(items);
    // only (r0, r1) overlap
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].rangeA.end).toEqual(d("2026-06-10"));
    expect(conflicts[0].rangeB.end).toEqual(d("2026-06-15"));
  });

  it("reports each overlapping pair when all three rows overlap", () => {
    const items = [
      row({ promoStart: d("2026-06-01"), promoEnd: d("2026-06-30") }),
      row({ promoStart: d("2026-06-05"), promoEnd: d("2026-06-25") }),
      row({ promoStart: d("2026-06-10"), promoEnd: d("2026-06-20") }),
    ];
    // pairs: (0,1),(0,2),(1,2) all overlap → 3 conflicts
    expect(findOverlappingPromotions(items)).toHaveLength(3);
  });
});
