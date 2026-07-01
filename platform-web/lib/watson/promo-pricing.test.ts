import { describe, it, expect } from "vitest";
import {
  isPromoActive,
  getEffectivePrice,
  getEffectivePriceInfo,
} from "./promo-pricing";
import type { PromotionItem } from "@/types/watson/promotion";

const promoItem = (over: Partial<PromotionItem> = {}): PromotionItem => ({
  itemCode: "303812",
  itemName: "#NestMe Chocolate 35g",
  stdPrice: 35,
  promoPrice: 29,
  promoStart: new Date("2026-01-01"),
  promoEnd: new Date("2026-03-31"),
  ...over,
});

describe("isPromoActive", () => {
  it("is active inside the promo window", () => {
    expect(isPromoActive(promoItem(), new Date("2026-02-15"))).toBe(true);
  });

  it("is active on the start boundary (inclusive)", () => {
    expect(isPromoActive(promoItem(), new Date("2026-01-01"))).toBe(true);
  });

  it("is active on the end boundary (inclusive)", () => {
    expect(isPromoActive(promoItem(), new Date("2026-03-31"))).toBe(true);
  });

  it("is inactive the day before the window", () => {
    expect(isPromoActive(promoItem(), new Date("2025-12-31"))).toBe(false);
  });

  it("is inactive the day after the window", () => {
    expect(isPromoActive(promoItem(), new Date("2026-04-01"))).toBe(false);
  });

  it("is inactive when promoPrice is null", () => {
    const item = promoItem({ promoPrice: null });
    expect(isPromoActive(item, new Date("2026-02-15"))).toBe(false);
  });

  it("is inactive when promo bounds are missing", () => {
    expect(
      isPromoActive(
        promoItem({ promoStart: null, promoEnd: null }),
        new Date("2026-02-15"),
      ),
    ).toBe(false);
  });
});

describe("getEffectivePrice", () => {
  it("returns the promo price when the promo is active", () => {
    expect(getEffectivePrice(promoItem(), new Date("2026-02-15"))).toBe(29);
  });

  it("returns the std price when the date is outside the promo window", () => {
    expect(getEffectivePrice(promoItem(), new Date("2026-05-01"))).toBe(35);
  });

  it("returns the std price on the day after the promo ends", () => {
    expect(getEffectivePrice(promoItem(), new Date("2026-04-01"))).toBe(35);
  });

  it("returns the promo price exactly on the start boundary", () => {
    expect(getEffectivePrice(promoItem(), new Date("2026-01-01"))).toBe(29);
  });

  it("returns the std price when there is no promo at all", () => {
    const item = promoItem({ promoPrice: null, promoStart: null, promoEnd: null });
    expect(getEffectivePrice(item, new Date("2026-02-15"))).toBe(35);
  });
});

describe("getEffectivePriceInfo", () => {
  it("mirrors getPriceInfo: active promo with priceDiff", () => {
    const info = getEffectivePriceInfo(promoItem(), new Date("2026-02-15"));
    expect(info).toEqual({
      itemCode: "303812",
      stdPrice: 35,
      promoPrice: 29,
      isPromoActive: true,
      promoStart: new Date("2026-01-01"),
      promoEnd: new Date("2026-03-31"),
      priceDiff: 6,
    });
  });

  it("reports isPromoActive false outside the window but keeps priceDiff", () => {
    const info = getEffectivePriceInfo(promoItem(), new Date("2026-05-01"));
    expect(info.isPromoActive).toBe(false);
    expect(info.priceDiff).toBe(6); // priceDiff reflects the promo, not the window
  });

  it("priceDiff is null when there is no promo price", () => {
    const info = getEffectivePriceInfo(
      promoItem({ promoPrice: null, promoStart: null, promoEnd: null }),
      new Date("2026-02-15"),
    );
    expect(info.isPromoActive).toBe(false);
    expect(info.priceDiff).toBeNull();
  });
});
