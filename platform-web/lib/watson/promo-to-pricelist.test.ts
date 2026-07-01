import { describe, expect, it } from "vitest";
import type { PromotionItem } from "@/types/watson/promotion";
import {
  mergePriceList,
  priceListKey,
  promotionItemToPriceList,
} from "./promo-to-pricelist";

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

const may = new Date(Date.UTC(2026, 2, 26)); // 26 Mar 2026
const apr = new Date(Date.UTC(2026, 3, 22)); // 22 Apr 2026

describe("promotionItemToPriceList", () => {
  it("maps fields like the canonical Watson import (real example)", () => {
    // From the validator: เต็ม 2850 / คอม 999 → Invoice IncV 619.38 / ExcV 578.86
    const pl = promotionItemToPriceList(
      P({
        itemCode: "294605",
        barcode: "8859109863120",
        itemName: "PrimaNest",
        stdPrice: 2850,
        commPrice: 999,
        invoice62IncV: 619.38,
        invoice62ExV: 578.86,
        remark: "SAVE",
        promoStart: may,
        promoEnd: apr,
      }),
    );
    expect(pl).toMatchObject({
      itemCode: "294605",
      prodCode: "8859109863120",
      prodName: "PrimaNest",
      priceStartDate: "2026-03-26T00:00:00",
      priceEndDate: "2026-04-22T00:00:00",
      price: 2850, // เต็ม (Std Price IncV)
      priceIncVat: 999, // คอม (Comm Price IncV)
      priceExtVat: 578.86, // Invoice 62% ExcV
      standardPriceIncV: 2850,
      commPriceIncV: 999,
      invoice62IncV: 619.38,
      invoice62ExcV: 578.86,
      remarki1: "SAVE",
    });
  });

  it("falls back: priceIncVat=std when no comm, priceExtVat=IncV/1.07 when no invoice", () => {
    const pl = promotionItemToPriceList(
      P({ itemCode: "X", stdPrice: 100, commPrice: null, invoice62ExV: null }),
    );
    expect(pl.priceIncVat).toBe(100); // std fallback
    expect(pl.priceExtVat).toBeCloseTo(100 / 1.07, 4); // IncV/1.07 fallback
  });
});

describe("mergePriceList", () => {
  const a = promotionItemToPriceList(
    P({ itemCode: "294605", stdPrice: 2850, commPrice: 999, invoice62ExV: 578.86, promoStart: may, promoEnd: apr }),
  );

  it("updates in place on same itemCode + start + priceExtVat", () => {
    const a2 = promotionItemToPriceList(
      P({ itemCode: "294605", stdPrice: 2850, commPrice: 950, invoice62ExV: 578.86, promoStart: may, promoEnd: apr }),
    );
    const r = mergePriceList([a], [a2]);
    expect(r).toMatchObject({ added: 0, updated: 1 });
    expect(r.merged).toHaveLength(1);
    expect(r.merged[0].priceIncVat).toBe(950);
  });

  it("adds a new entry when the start date (period) differs", () => {
    const jul = new Date(Date.UTC(2026, 6, 1));
    const b = promotionItemToPriceList(
      P({ itemCode: "294605", stdPrice: 2850, commPrice: 999, invoice62ExV: 578.86, promoStart: jul, promoEnd: jul }),
    );
    const r = mergePriceList([a], [b]);
    expect(r).toMatchObject({ added: 1, updated: 0 });
    expect(r.merged).toHaveLength(2);
  });

  it("key combines itemCode, start day and priceExtVat", () => {
    expect(priceListKey(a)).toBe("294605|2026-03-26|578.8600");
  });
});
