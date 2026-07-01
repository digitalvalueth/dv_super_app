// Pure, date-aware std-vs-promo price selection.
// Mirrors the core of usePromotionData's `getPriceInfo` without the React/
// Firestore wrapper, so it can be unit tested in node-env Vitest.

import type { PriceInfo, PromotionItem } from "@/types/watson/promotion";

/**
 * Whether the item's promo price is active on `checkDate`.
 *
 * Active requires a non-null `promoPrice` AND both promo bounds set, with
 * `promoStart <= checkDate <= promoEnd` (boundaries inclusive). Mirrors the
 * `isPromoActive` computation in getPriceInfo.
 */
export function isPromoActive(item: PromotionItem, checkDate: Date): boolean {
  if (item.promoPrice && item.promoStart && item.promoEnd) {
    return checkDate >= item.promoStart && checkDate <= item.promoEnd;
  }
  return false;
}

/**
 * Resolve the date-aware price info for a promotion item.
 *
 * `checkDate` defaults to "now" when omitted (matching getPriceInfo).
 * `priceDiff` is `stdPrice - promoPrice` when a promo price exists, else null.
 * Note `isPromoActive` reflects the promo *window*, independent of whether the
 * resolved effective price is std or promo on that date.
 */
export function getEffectivePriceInfo(
  item: PromotionItem,
  checkDate: Date = new Date(),
): PriceInfo {
  const active = isPromoActive(item, checkDate);
  return {
    itemCode: item.itemCode,
    stdPrice: item.stdPrice,
    promoPrice: item.promoPrice,
    isPromoActive: active,
    promoStart: item.promoStart,
    promoEnd: item.promoEnd,
    priceDiff: item.promoPrice ? item.stdPrice - item.promoPrice : null,
  };
}

/**
 * Resolve the single effective price for an item on a given date: the promo
 * price when the promo is active on that date, otherwise the standard price.
 */
export function getEffectivePrice(
  item: PromotionItem,
  checkDate: Date = new Date(),
): number {
  return isPromoActive(item, checkDate)
    ? (item.promoPrice as number)
    : item.stdPrice;
}
