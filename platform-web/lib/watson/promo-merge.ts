// Pure upsert/merge for promotion imports.
//
// Rule (per business): a promotion is identified by item (barcode, falling back
// to itemCode) + promo period (start–end, day granularity).
//   - same item + same period  → UPDATE that entry (replace in place)
//   - same item + new period    → ADD as a new entry (both periods coexist; the
//     date-aware pricing later picks whichever is active)

import type { PromotionItem } from "@/types/watson/promotion";

type DateLike = Date | string | number | { toDate: () => Date } | null | undefined;

/** Normalize any date-ish value to a UTC "YYYY-MM-DD" key ("" when absent). */
export function dayKey(d: DateLike): string {
  if (d === null || d === undefined || d === "") return "";
  let date: Date;
  if (d instanceof Date) date = d;
  else if (typeof d === "object" && typeof (d as any).toDate === "function") {
    date = (d as { toDate: () => Date }).toDate();
  } else date = new Date(d as string | number);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Identity key for upsert: item (barcode→itemCode) + period (start|end). */
export function promoKey(it: PromotionItem): string {
  const bc = String(it.barcode ?? "").replace(/\D/g, "");
  const id = bc || String(it.itemCode ?? "").trim().toLowerCase();
  return `${id}|${dayKey(it.promoStart)}|${dayKey(it.promoEnd)}`;
}

export interface MergeResult {
  merged: PromotionItem[];
  added: number;
  updated: number;
}

/**
 * Upsert `incoming` into `existing`. Existing entries keep their order; an
 * incoming item with a matching key replaces the existing one in place, a new
 * key is appended. Returns the merged list plus added/updated counts.
 */
export function mergePromotions(
  existing: PromotionItem[],
  incoming: PromotionItem[],
): MergeResult {
  const merged = existing.slice();
  const idxByKey = new Map<string, number>();
  existing.forEach((it, i) => idxByKey.set(promoKey(it), i));

  let added = 0;
  let updated = 0;
  for (const inc of incoming) {
    const k = promoKey(inc);
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
