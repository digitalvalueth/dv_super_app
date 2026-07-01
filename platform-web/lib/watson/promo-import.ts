// Dispatcher for shop promotion imports. Each shop has its own form layout +
// parser; all map to the canonical `PromotionItem[]` so the preview renders the
// same standard columns. Preview only — no Firestore writes here.

import type { PromotionItem } from "@/types/watson/promotion";
import { bigCToPromotionItems, parseBigCFile } from "./bigc-promo-parser";
import {
  parseWatsonProFile,
  watsonProToPromotionItems,
} from "./watson-pro-parser";

/** Shops whose promo we can update. */
export const SHOPS = ["Watson", "BigC", "Lotus"] as const;
export type Shop = (typeof SHOPS)[number];

/** Shops with a working parser right now. */
export const SUPPORTED_SHOPS: Shop[] = ["Watson", "BigC"];

export type PeriodSource = "sheet" | "filename" | "none";

/** Common, shop-agnostic preview result. */
export interface PromoPreview {
  shop: Shop;
  items: PromotionItem[];
  period: { start: Date | null; end: Date | null };
  periodSource: PeriodSource;
  warnings: string[];
  /** BigC reports participating branch groups; empty for other shops. */
  branches: string[];
}

/** Parse a shop's promotion file into the canonical preview shape. */
export async function parsePromoForShop(
  shop: Shop,
  file: File,
): Promise<PromoPreview> {
  switch (shop) {
    case "BigC": {
      const r = await parseBigCFile(file);
      return {
        shop,
        items: bigCToPromotionItems(r),
        period: r.period,
        periodSource: r.periodSource,
        warnings: r.warnings,
        branches: r.branches,
      };
    }
    case "Watson": {
      const r = await parseWatsonProFile(file);
      return {
        shop,
        items: watsonProToPromotionItems(r),
        period: r.period,
        periodSource: r.periodSource,
        warnings: r.warnings,
        branches: [],
      };
    }
    default:
      throw new Error(`ยังไม่รองรับ format ของร้าน "${shop}" ในรอบนี้`);
  }
}
