import { describe, expect, it } from "vitest";
import {
  effectiveUnitPrice,
  isBuyOnePromo,
  isNonPromo,
  isPromoActiveOnDate,
  pickLowestCommPrice,
  selectBestPromo,
  type PromoItemLike,
} from "@/services/daily-sale-promo";

// Helper to build a promo row succinctly.
const promo = (
  overrides: Partial<PromoItemLike> = {},
): PromoItemLike => ({
  commPrice: 100,
  remark: "SAVE",
  promoStart: new Date("2026-06-01T00:00:00"),
  promoEnd: new Date("2026-06-30T00:00:00"),
  ...overrides,
});

describe("isNonPromo / isBuyOnePromo", () => {
  it("treats 'buy 1' and 'buy1' (any case/whitespace) as non-promo", () => {
    expect(isNonPromo("buy 1")).toBe(true);
    expect(isNonPromo("Buy1")).toBe(true);
    expect(isNonPromo("  BUY 1  ")).toBe(true);
    expect(isBuyOnePromo("buy1")).toBe(true);
  });

  it("treats real promo remarks and empties as promo (not Buy1)", () => {
    expect(isNonPromo("SAVE")).toBe(false);
    expect(isNonPromo("")).toBe(false);
    expect(isNonPromo(undefined)).toBe(false);
    expect(isNonPromo("buy 2")).toBe(false);
  });
});

describe("isPromoActiveOnDate", () => {
  const p = promo({
    promoStart: new Date("2026-06-10T00:00:00"),
    promoEnd: new Date("2026-06-20T00:00:00"),
  });

  it("is active on the start boundary (inclusive)", () => {
    expect(isPromoActiveOnDate(p, "2026-06-10")).toBe(true);
  });

  it("is active on the end boundary (inclusive)", () => {
    expect(isPromoActiveOnDate(p, "2026-06-20")).toBe(true);
  });

  it("is active in the middle", () => {
    expect(isPromoActiveOnDate(p, "2026-06-15")).toBe(true);
  });

  it("is inactive the day before start and the day after end", () => {
    expect(isPromoActiveOnDate(p, "2026-06-09")).toBe(false);
    expect(isPromoActiveOnDate(p, "2026-06-21")).toBe(false);
  });

  it("is inactive when promoStart or promoEnd is null", () => {
    expect(isPromoActiveOnDate(promo({ promoStart: null }), "2026-06-15")).toBe(
      false,
    );
    expect(isPromoActiveOnDate(promo({ promoEnd: null }), "2026-06-15")).toBe(
      false,
    );
  });
});

describe("pickLowestCommPrice", () => {
  it("returns the row with the lowest commPrice", () => {
    const a = promo({ commPrice: 90 });
    const b = promo({ commPrice: 70 });
    const c = promo({ commPrice: 80 });
    expect(pickLowestCommPrice([a, b, c])).toBe(b);
  });

  it("skips null commPrice rows but falls back to a priced one", () => {
    const nullRow = promo({ commPrice: null });
    const priced = promo({ commPrice: 50 });
    // seed is nullRow; priced should replace it.
    expect(pickLowestCommPrice([nullRow, priced])).toBe(priced);
  });

  it("keeps the accumulator when the candidate price is null", () => {
    const priced = promo({ commPrice: 50 });
    const nullRow = promo({ commPrice: null });
    expect(pickLowestCommPrice([priced, nullRow])).toBe(priced);
  });

  it("returns a null-priced row when all are null", () => {
    const r1 = promo({ commPrice: null, remark: "A" });
    const r2 = promo({ commPrice: null, remark: "B" });
    expect(pickLowestCommPrice([r1, r2])).toBe(r1);
  });
});

describe("selectBestPromo", () => {
  const date = "2026-06-15";

  it("returns kind 'none' when no promo is active on the date", () => {
    const p = promo({
      promoStart: new Date("2026-07-01T00:00:00"),
      promoEnd: new Date("2026-07-31T00:00:00"),
    });
    const res = selectBestPromo([p], date);
    expect(res.kind).toBe("none");
    expect(res.selected).toBeNull();
    expect(res.buy1Entry).toBeNull();
    expect(res.availablePromos).toEqual([]);
    expect(res.effectivePrice).toBeNull();
  });

  it("returns kind 'none' for an empty promo list", () => {
    const res = selectBestPromo([], date);
    expect(res.kind).toBe("none");
    expect(res.effectivePrice).toBeNull();
  });

  it("treats a Buy1-only active entry as base price (kind 'buy1')", () => {
    const buy1 = promo({ remark: "Buy 1", commPrice: 88 });
    const res = selectBestPromo([buy1], date);
    expect(res.kind).toBe("buy1");
    expect(res.buy1Entry).toBe(buy1);
    expect(res.selected).toBeNull();
    expect(res.availablePromos).toEqual([]);
    expect(res.effectivePrice).toBe(88);
  });

  it("Buy1 with null commPrice yields effectivePrice null (price untouched)", () => {
    const buy1 = promo({ remark: "buy1", commPrice: null });
    const res = selectBestPromo([buy1], date);
    expect(res.kind).toBe("buy1");
    expect(res.effectivePrice).toBeNull();
  });

  it("auto-applies a single real promo", () => {
    const p = promo({ remark: "SAVE", commPrice: 75 });
    const res = selectBestPromo([p], date);
    expect(res.kind).toBe("promotion");
    expect(res.selected).toBe(p);
    expect(res.availablePromos).toEqual([]); // single → no override list
    expect(res.effectivePrice).toBe(75);
  });

  it("single real promo with null commPrice leaves price untouched", () => {
    const p = promo({ remark: "SAVE", commPrice: null });
    const res = selectBestPromo([p], date);
    expect(res.kind).toBe("promotion");
    expect(res.effectivePrice).toBeNull();
  });

  it("picks the lowest commPrice among multiple real promos and exposes all", () => {
    const a = promo({ remark: "A", commPrice: 95 });
    const b = promo({ remark: "B", commPrice: 60 });
    const c = promo({ remark: "C", commPrice: 80 });
    const res = selectBestPromo([a, b, c], date);
    expect(res.kind).toBe("promotion");
    expect(res.selected).toBe(b);
    expect(res.effectivePrice).toBe(60);
    expect(res.availablePromos).toEqual([a, b, c]);
  });

  it("ignores Buy1 rows when real promos exist", () => {
    const buy1 = promo({ remark: "Buy 1", commPrice: 10 });
    const real = promo({ remark: "SAVE", commPrice: 70 });
    const res = selectBestPromo([buy1, real], date);
    expect(res.kind).toBe("promotion");
    expect(res.selected).toBe(real);
    expect(res.effectivePrice).toBe(70);
    // single real promo → no override list even though a buy1 was present
    expect(res.availablePromos).toEqual([]);
  });

  it("only considers promos active on the date when choosing the best", () => {
    const activeCheap = promo({ remark: "A", commPrice: 65 });
    const inactiveCheaper = promo({
      remark: "B",
      commPrice: 30,
      promoStart: new Date("2026-05-01T00:00:00"),
      promoEnd: new Date("2026-05-31T00:00:00"),
    });
    const activeExpensive = promo({ remark: "C", commPrice: 90 });
    const res = selectBestPromo(
      [activeCheap, inactiveCheaper, activeExpensive],
      date,
    );
    expect(res.kind).toBe("promotion");
    // inactiveCheaper (30) is filtered out, so activeCheap (65) wins
    expect(res.selected).toBe(activeCheap);
    expect(res.effectivePrice).toBe(65);
    expect(res.availablePromos).toEqual([activeCheap, activeExpensive]);
  });

  it("falls back to Buy1 when the only active row is Buy1 and the real one is inactive", () => {
    const inactiveReal = promo({
      remark: "SAVE",
      commPrice: 50,
      promoStart: new Date("2026-05-01T00:00:00"),
      promoEnd: new Date("2026-05-31T00:00:00"),
    });
    const activeBuy1 = promo({ remark: "Buy 1", commPrice: 99 });
    const res = selectBestPromo([inactiveReal, activeBuy1], date);
    expect(res.kind).toBe("buy1");
    expect(res.effectivePrice).toBe(99);
  });
});

describe("effectiveUnitPrice", () => {
  it("uses commPrice when present (including 0)", () => {
    expect(effectiveUnitPrice(80, 120)).toBe(80);
    expect(effectiveUnitPrice(0, 120)).toBe(0);
  });

  it("falls back to base price when commPrice is null/undefined", () => {
    expect(effectiveUnitPrice(null, 120)).toBe(120);
    expect(effectiveUnitPrice(undefined, 120)).toBe(120);
  });
});
