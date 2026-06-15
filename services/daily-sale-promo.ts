/**
 * Pure (framework-free) promotion logic for the daily-sale mini-app.
 *
 * This module MUST NOT import react / react-native / expo / firebase.
 * It only depends on plain JS and `import type` declarations.
 *
 * The logic here is extracted verbatim from
 * `app/(mini-apps)/daily-sale/record.tsx` so it can be unit-tested in a
 * node environment. Behavior must mirror the component exactly.
 */

/**
 * Minimal shape of a promotion row needed by the pure logic.
 * The real `PromoItem` (in daily-sale.service.ts) is assignable to this.
 */
export interface PromoItemLike {
  commPrice: number | null;
  remark?: string;
  promoStart: Date | null;
  promoEnd: Date | null;
}

/** Remarks that mark a row as a non-promo (base price) entry. */
export const NON_PROMO_REMARKS = ["buy 1", "buy1"];

/**
 * True when the remark identifies a non-promotion (Buy 1 / base-price) row.
 * Mirrors `isNonPromo` in record.tsx.
 */
export const isNonPromo = (remark?: string): boolean =>
  NON_PROMO_REMARKS.includes(
    String(remark ?? "")
      .trim()
      .toLowerCase(),
  );

/** Alias spelled out for clarity: a Buy1 promo is the non-promo / base-price kind. */
export const isBuyOnePromo = (remark?: string): boolean => isNonPromo(remark);

/**
 * Check if a promo is active on the exact saleDate.
 * Inclusive on both boundaries. saleDate is "YYYY-MM-DD".
 * Mirrors `isPromoActiveOnDate` in record.tsx.
 */
export const isPromoActiveOnDate = (
  promo: PromoItemLike,
  saleDateStr: string,
): boolean => {
  if (!promo.promoStart || !promo.promoEnd) return false;
  const d = new Date(saleDateStr + "T00:00:00");
  return promo.promoStart <= d && d <= promo.promoEnd;
};

/**
 * Pick the real promo with the LOWEST commPrice (highest discount).
 * Mirrors the reducer in `applyPromoToItem` (record.tsx).
 *
 * `realPromos` must be non-empty; the seed is `realPromos[0]` exactly as in
 * the component. A promo with `commPrice == null` never replaces the
 * accumulator, and an accumulator with `commPrice == null` is always replaced
 * by the first candidate that has a price.
 */
export const pickLowestCommPrice = <T extends Pick<PromoItemLike, "commPrice">>(
  realPromos: T[],
): T =>
  realPromos.reduce((acc, p) => {
    const accPrice = acc.commPrice;
    const pPrice = p.commPrice;
    if (pPrice == null) return acc;
    if (accPrice == null) return p;
    return pPrice < accPrice ? p : acc;
  }, realPromos[0]);

/** The decision returned by {@link selectBestPromo}. */
export interface BestPromoSelection<T extends PromoItemLike> {
  /**
   * "promotion" → a real promo was selected (`selected` is set),
   * "buy1"      → only a Buy1/base-price entry is active (`buy1Entry` set),
   * "none"      → no promo active on the date; leave the item unchanged.
   */
  kind: "promotion" | "buy1" | "none";
  /** The chosen real promo (best discount) when kind === "promotion". */
  selected: T | null;
  /** The Buy1/base-price entry when kind === "buy1". */
  buy1Entry: T | null;
  /**
   * Active real promos for the manual-override picker.
   * Matches `availablePromos` behavior in record.tsx:
   * empty for the single-real-promo and buy1 cases, the full list when >1.
   */
  availablePromos: T[];
  /**
   * The effective unit price to apply, or `null` to leave the existing price
   * untouched (mirrors the `...(x != null ? { price: x } : {})` spreads).
   */
  effectivePrice: number | null;
}

/**
 * Decide which promo applies for a scanned barcode on a given saleDate.
 *
 * Mirrors `applyPromoToItem` in record.tsx exactly:
 *  - filter promos to those active on the date,
 *  - drop Buy1 entries to get "real" promos,
 *  - 0 real promos → use a Buy1 base-price entry if present, else nothing,
 *  - 1 real promo  → auto-apply it,
 *  - >1 real promos → auto-apply the lowest commPrice and expose all for override.
 */
export const selectBestPromo = <T extends PromoItemLike>(
  promosForBarcode: T[],
  saleDateStr: string,
): BestPromoSelection<T> => {
  const activePromos = promosForBarcode.filter((p) =>
    isPromoActiveOnDate(p, saleDateStr),
  );
  const realPromos = activePromos.filter((p) => !isNonPromo(p.remark));

  if (realPromos.length === 0) {
    const buy1Entry = activePromos.find((p) => isNonPromo(p.remark)) ?? null;
    if (buy1Entry) {
      return {
        kind: "buy1",
        selected: null,
        buy1Entry,
        availablePromos: [],
        effectivePrice: buy1Entry.commPrice != null ? buy1Entry.commPrice : null,
      };
    }
    return {
      kind: "none",
      selected: null,
      buy1Entry: null,
      availablePromos: [],
      effectivePrice: null,
    };
  }

  if (realPromos.length === 1) {
    const promo = realPromos[0];
    return {
      kind: "promotion",
      selected: promo,
      buy1Entry: null,
      availablePromos: [],
      effectivePrice: promo.commPrice != null ? promo.commPrice : null,
    };
  }

  const best = pickLowestCommPrice(realPromos);
  return {
    kind: "promotion",
    selected: best,
    buy1Entry: null,
    availablePromos: realPromos,
    effectivePrice: best.commPrice != null ? best.commPrice : null,
  };
};

/**
 * The effective unit price for an item: the promo `commPrice` when present,
 * otherwise fall back to the supplied base/std price (product catalog price).
 */
export const effectiveUnitPrice = (
  commPrice: number | null | undefined,
  basePrice: number,
): number => (commPrice != null ? commPrice : basePrice);
