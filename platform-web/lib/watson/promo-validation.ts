// Pure, framework-free validation for promotion master data.
//
// Detects two promotions for the SAME item (itemCode) whose active date
// ranges overlap, which makes date-aware pricing ambiguous. Imports only
// types + plain JS so it can run in node-env Vitest (no react/next/firebase).

import type { PromotionItem } from "@/types/watson/promotion";

/**
 * Minimal structural shape needed to detect overlaps. A `PromotionItem` is
 * assignable to this, but tests/callers can pass any compatible row.
 */
export type PromotionItemLike = Pick<
  PromotionItem,
  "itemCode" | "itemName" | "promoStart" | "promoEnd"
>;

/** A pair of same-item promotions whose date ranges overlap. */
export interface OverlapConflict {
  /** Original (untrimmed) itemCode of the first row in the pair. */
  itemCode: string;
  /** Item name (best-effort, taken from the first row that has one). */
  itemName: string;
  /** Date range of the first conflicting promotion. */
  rangeA: { start: Date | null; end: Date | null };
  /** Date range of the second conflicting promotion. */
  rangeB: { start: Date | null; end: Date | null };
}

const NEG_INF = -Infinity;
const POS_INF = Infinity;

const startTime = (d: Date | null): number => (d ? d.getTime() : NEG_INF);
const endTime = (d: Date | null): number => (d ? d.getTime() : POS_INF);

/**
 * Inclusive, open-ended overlap test between two date ranges.
 *
 * Range A = [aStart, aEnd], B = [bStart, bEnd] overlap iff
 *   (aStart ?? -∞) <= (bEnd ?? +∞) && (bStart ?? -∞) <= (aEnd ?? +∞)
 *
 * Boundaries are INCLUSIVE: ranges that share a single instant overlap
 * (e.g. A ends and B starts on the same timestamp → conflict). A null start
 * is treated as -∞ (open on the left), a null end as +∞ (open on the right),
 * so a fully-null range (both null) overlaps every same-item range.
 */
export function rangesOverlap(
  aStart: Date | null,
  aEnd: Date | null,
  bStart: Date | null,
  bEnd: Date | null,
): boolean {
  return startTime(aStart) <= endTime(bEnd) && startTime(bStart) <= endTime(aEnd);
}

/** Normalize an itemCode for grouping: trim + lowercase. */
const normCode = (code: string): string => (code ?? "").trim().toLowerCase();

/**
 * Find every pair of same-item promotions whose date ranges overlap.
 *
 * - Rows are grouped by normalized itemCode (trim + lowercase).
 * - Rows with an empty itemCode (after trim) are ignored entirely.
 * - Within a group, every unordered pair is compared with `rangesOverlap`;
 *   each overlapping pair produces one `OverlapConflict`.
 *
 * Pure and deterministic: input order is preserved, so for input order
 * [r0, r1, r2] the pairs are reported as (r0,r1), (r0,r2), (r1,r2).
 */
export function findOverlappingPromotions(
  items: PromotionItemLike[],
): OverlapConflict[] {
  // Group rows (with original index to keep deterministic order) by code.
  const groups = new Map<string, PromotionItemLike[]>();
  for (const item of items) {
    const code = normCode(item.itemCode);
    if (!code) continue; // ignore empty itemCode
    const bucket = groups.get(code);
    if (bucket) bucket.push(item);
    else groups.set(code, [item]);
  }

  const conflicts: OverlapConflict[] = [];
  for (const bucket of groups.values()) {
    for (let a = 0; a < bucket.length; a++) {
      for (let b = a + 1; b < bucket.length; b++) {
        const rowA = bucket[a];
        const rowB = bucket[b];
        if (
          rangesOverlap(
            rowA.promoStart,
            rowA.promoEnd,
            rowB.promoStart,
            rowB.promoEnd,
          )
        ) {
          conflicts.push({
            itemCode: rowA.itemCode,
            itemName: rowA.itemName || rowB.itemName || "",
            rangeA: { start: rowA.promoStart, end: rowA.promoEnd },
            rangeB: { start: rowB.promoStart, end: rowB.promoEnd },
          });
        }
      }
    }
  }
  return conflicts;
}
