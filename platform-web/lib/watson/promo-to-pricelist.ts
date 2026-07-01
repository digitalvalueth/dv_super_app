// Map imported promotion items into the validator's price-list shape, so a
// promotion-report import also feeds watson_current_pricelist (read by the
// Watson Excel Validator). Field assignment mirrors the canonical Watson
// price-import (app/api/watson/price-import/route.ts):
//   price        = Std Price IncV ("เต็ม")
//   priceIncVat  = Comm Price IncV ("คอม", falls back to Std)
//   priceExtVat  = Invoice 62% ExcV (falls back to priceIncVat / 1.07)
//   + standardPriceIncV / commPriceIncV / invoice62IncV / invoice62ExcV
//   remarki1     = remark (e.g. "SAVE" → the validator reads it as Buy1)

import type { PriceListItem } from "@/types/watson/pricelist";
import type { PromotionItem } from "@/types/watson/promotion";

/** Date → "YYYY-MM-DDT00:00:00" (the price-list ISO format); "" when null. */
function toPriceListDate(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.toISOString().slice(0, 10)}T00:00:00`;
}

/** Map one promotion item to a price-list entry (mirrors the Watson import). */
export function promotionItemToPriceList(it: PromotionItem): PriceListItem {
  const standardPriceIncV = it.stdPrice ?? 0;
  const commPriceIncV = it.commPrice ?? null;
  const invoice62IncV = it.invoice62IncV ?? null;
  const invoice62ExcV = it.invoice62ExV ?? null;

  const priceIncVat = (commPriceIncV ?? 0) || standardPriceIncV;
  const priceExtVat = (invoice62ExcV ?? 0) || priceIncVat / 1.07;
  const startDate = toPriceListDate(it.promoStart);
  const endDate = toPriceListDate(it.promoEnd);

  return {
    itemCode: it.itemCode,
    prodCode: it.barcode ?? "",
    prodName: it.itemName,
    priceStartDate: startDate,
    priceEndDate: endDate || undefined,
    qty: 1,
    price: standardPriceIncV,
    discamti: 0,
    priceIncVat,
    priceExtVat,
    priceExtVatSt: 0,
    remarki1: it.remark ?? "",
    remarki2: "",
    standardPriceIncV,
    commPriceIncV: commPriceIncV ?? undefined,
    invoice62IncV: invoice62IncV ?? undefined,
    invoice62ExcV: invoice62ExcV ?? undefined,
  };
}

export function promotionItemsToPriceList(
  items: PromotionItem[],
): PriceListItem[] {
  return items.map(promotionItemToPriceList);
}

/** Merge key — mirrors addOrUpdatePriceList: itemCode | startDate | priceExtVat. */
export function priceListKey(it: PriceListItem): string {
  const startDateStr = (it.priceStartDate || "").split("T")[0];
  return `${it.itemCode}|${startDateStr}|${Number(it.priceExtVat).toFixed(4)}`;
}

export interface PriceListMergeResult {
  merged: PriceListItem[];
  added: number;
  updated: number;
}

/**
 * Upsert price-list entries by (itemCode + start date + priceExtVat): an
 * incoming entry with a matching key replaces the existing one in place; a new
 * key is appended. Same item + new period → new entry (both kept).
 */
export function mergePriceList(
  existing: PriceListItem[],
  incoming: PriceListItem[],
): PriceListMergeResult {
  const merged = existing.slice();
  const idxByKey = new Map<string, number>();
  existing.forEach((it, i) => idxByKey.set(priceListKey(it), i));

  let added = 0;
  let updated = 0;
  for (const inc of incoming) {
    const k = priceListKey(inc);
    const at = idxByKey.get(k);
    if (at !== undefined) {
      merged[at] = inc;
      updated++;
    } else {
      idxByKey.set(k, merged.length);
      merged.push(inc);
      added++;
    }
  }
  return { merged, added, updated };
}
