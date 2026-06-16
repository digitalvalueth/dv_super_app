// Persist an imported promotion preview into the shop's promotion store, with
// upsert semantics (see promo-merge). Side-effecting (Firestore) — not unit
// tested; the pure merge logic it relies on is covered in promo-merge.test.ts.

import { getPromotionData, savePromotionData } from "@/lib/watson-firebase";
import type { PromotionItem } from "@/types/watson/promotion";
import { mergePromotions } from "./promo-merge";
import type { Shop } from "./promo-import";

export interface SaveImportResult {
  added: number;
  updated: number;
  total: number;
}

/**
 * Upsert imported items into the shop's promotion data.
 * Watson writes the shared `watson_promotion_data` store (read by daily-sale
 * pricing + reports). Other shops are not wired to a collection yet.
 */
export async function saveImportedPromotions(
  shop: Shop,
  items: PromotionItem[],
): Promise<SaveImportResult> {
  if (shop !== "Watson") {
    throw new Error(
      `ยังไม่รองรับการบันทึกของร้าน "${shop}" ในรอบนี้ (รองรับเฉพาะ Watson)`,
    );
  }
  if (items.length === 0) throw new Error("ไม่มีรายการให้บันทึก");

  const existing = await getPromotionData();
  const { merged, added, updated } = mergePromotions(existing, items);
  await savePromotionData(merged);
  return { added, updated, total: merged.length };
}
