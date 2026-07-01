/**
 * Pure (framework-free) duplicate-detection + totals logic for the
 * daily-sale mini-app.
 *
 * This module MUST NOT import react / react-native / expo / firebase.
 * Logic is extracted verbatim from record.tsx and daily-sale.service.ts so it
 * can be unit-tested in a node environment.
 */
import type { DailySale, DailySaleItem } from "@/types";

/** Minimal item shape needed for in-form duplicate detection. */
type WithBarcode = { barcode?: string | null };

/**
 * Barcodes that appear more than once across the given items.
 * Mirrors the "duplicates within the current form" logic in record.tsx.
 * Falsy barcodes are ignored.
 */
export const findInFormDuplicateBarcodes = (items: WithBarcode[]): string[] => {
  const seen = new Set<string>();
  const dup = new Set<string>();
  items.forEach((it) => {
    const bc = it.barcode;
    if (!bc) return;
    if (seen.has(bc)) dup.add(bc);
    else seen.add(bc);
  });
  return Array.from(dup);
};

/**
 * Pure comparison core of `findDuplicateDailySaleBarcodes`.
 *
 * Given the DailySale records already saved for the same employee + saleDate
 * and the list of new barcodes, return the barcodes that collide.
 *
 * @param existingSales already-saved records (the Firestore query result)
 * @param newBarcodes   barcodes from the current form
 * @param excludeId     optional record id to ignore (when editing)
 */
export const computeDuplicateBarcodes = (
  existingSales: Pick<DailySale, "id" | "items">[],
  newBarcodes: string[],
  excludeId?: string,
): string[] => {
  const target = new Set(newBarcodes.filter(Boolean));
  if (target.size === 0) return [];

  const found = new Set<string>();
  existingSales.forEach((sale) => {
    if (excludeId && sale.id === excludeId) return;
    (sale.items ?? []).forEach((it) => {
      if (it.barcode && target.has(it.barcode)) found.add(it.barcode);
    });
  });
  return Array.from(found);
};

/** Revenue for a single item = price * quantity (quantity defaults to 1). */
export const computeItemRevenue = (
  price: number | null | undefined,
  quantity: number | null | undefined,
): number => (Number(price) || 0) * (Number(quantity) || 1);

/** Aggregate totals over a list of sale items. */
export interface SaleTotals {
  totalItems: number;
  totalRevenue: number;
}

/**
 * Compute totalItems (sum of quantities) and totalRevenue (sum of revenue)
 * for a finalized list of sale items. Mirrors the totals in record.tsx's
 * submit handler, which operate on items whose `revenue` is already set.
 */
export const computeSaleTotals = (
  items: Pick<DailySaleItem, "quantity" | "revenue">[],
): SaleTotals => ({
  totalItems: items.reduce((s, i) => s + i.quantity, 0),
  totalRevenue: items.reduce((s, i) => s + i.revenue, 0),
});

/** Strip undefined values from an object so Firestore doesn't reject them. */
export function stripUndefined<T extends Record<string, any>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
