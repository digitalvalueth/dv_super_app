"use client";

import { useState, useCallback, useEffect } from "react";
import {
  PromotionItem,
  PriceInfo,
  DEFAULT_PROMOTION_DATA,
} from "@/types/watson/promotion";
import { RawRow } from "@/types/watson/invoice";
import { savePromotionData, getPromotionData } from "@/lib/watson-firebase";

export function usePromotionData() {
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>(
    DEFAULT_PROMOTION_DATA,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load from Firestore on mount
  useEffect(() => {
    let mounted = true;
    getPromotionData()
      .then((items) => {
        if (mounted && items && items.length > 0) {
          setPromotionItems(
            items.map((item: PromotionItem) => ({
              ...item,
              promoStart: item.promoStart ? new Date(item.promoStart) : null,
              promoEnd: item.promoEnd ? new Date(item.promoEnd) : null,
            })),
          );
        }
      })
      .catch((err) => {
        console.error("Error loading promotion data:", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Save to Firestore
  const saveData = useCallback((items: PromotionItem[]) => {
    setPromotionItems(items);
    savePromotionData(items).catch((err) => {
      console.error("Error saving promotion data:", err);
    });
  }, []);

  // Add new promotion item
  const addItem = useCallback(
    (item: PromotionItem) => {
      saveData([...promotionItems, item]);
    },
    [promotionItems, saveData],
  );

  // Update existing item
  const updateItem = useCallback(
    (itemCode: string, updates: Partial<PromotionItem>) => {
      const updated = promotionItems.map((item) =>
        item.itemCode === itemCode ? { ...item, ...updates } : item,
      );
      saveData(updated);
    },
    [promotionItems, saveData],
  );

  // Delete item
  const deleteItem = useCallback(
    (itemCode: string) => {
      saveData(promotionItems.filter((item) => item.itemCode !== itemCode));
    },
    [promotionItems, saveData],
  );

  // Get price info for a specific item code and date
  const getPriceInfo = useCallback(
    (itemCode: string, invoiceDate?: Date): PriceInfo | null => {
      const item = promotionItems.find(
        (p) => p.itemCode === String(itemCode).trim(),
      );

      if (!item) {
        return null;
      }

      const checkDate = invoiceDate || new Date();
      let isPromoActive = false;

      if (item.promoPrice && item.promoStart && item.promoEnd) {
        isPromoActive =
          checkDate >= item.promoStart && checkDate <= item.promoEnd;
      }

      return {
        itemCode: item.itemCode,
        stdPrice: item.stdPrice,
        promoPrice: item.promoPrice,
        isPromoActive,
        promoStart: item.promoStart,
        promoEnd: item.promoEnd,
        priceDiff: item.promoPrice ? item.stdPrice - item.promoPrice : null,
      };
    },
    [promotionItems],
  );

  // Enrich data with price info - add new columns
  const enrichDataWithPrices = useCallback(
    (
      data: RawRow[],
      headers: string[],
    ): { enrichedData: RawRow[]; enrichedHeaders: string[] } => {
      // Find the Item Code column
      const itemCodeHeader = headers.find(
        (h) =>
          h.toLowerCase().includes("item code") ||
          h.toLowerCase() === "itemcode",
      );
      const dateHeader = headers.find((h) => h.toLowerCase() === "date");

      if (!itemCodeHeader) {
        return { enrichedData: data, enrichedHeaders: headers };
      }

      // Add new headers
      const newHeaders = ["STD Price", "Promo Price", "Is Promo", "Price Diff"];
      const enrichedHeaders = [...headers, ...newHeaders];

      // Enrich each row with price info
      const enrichedData = data.map((row) => {
        const itemCode = String(row[itemCodeHeader] || "").trim();
        let invoiceDate: Date | undefined;

        if (dateHeader && row[dateHeader]) {
          // Try to parse date
          const dateVal = row[dateHeader] as unknown;
          if (
            dateVal &&
            typeof dateVal === "object" &&
            (dateVal as object) instanceof Date
          ) {
            invoiceDate = dateVal as Date;
          } else if (typeof dateVal === "string") {
            // Try common date formats
            const parsed = new Date(dateVal);
            if (!isNaN(parsed.getTime())) {
              invoiceDate = parsed;
            }
          } else if (typeof dateVal === "number") {
            // Excel serial date
            const excelEpoch = new Date(1899, 11, 30);
            invoiceDate = new Date(excelEpoch.getTime() + dateVal * 86400000);
          }
        }

        const priceInfo = getPriceInfo(itemCode, invoiceDate);

        return {
          ...row,
          "STD Price": priceInfo?.stdPrice ?? "-",
          "Promo Price": priceInfo?.promoPrice ?? "-",
          "Is Promo": priceInfo?.isPromoActive ? "✅" : priceInfo ? "❌" : "-",
          "Price Diff": priceInfo?.priceDiff ?? "-",
        };
      });

      return { enrichedData, enrichedHeaders };
    },
    [getPriceInfo],
  );

  // Import from Excel/CSV
  const importFromData = useCallback(
    (items: PromotionItem[]) => {
      saveData(items);
    },
    [saveData],
  );

  // Reset to default
  const resetToDefault = useCallback(() => {
    saveData(DEFAULT_PROMOTION_DATA);
  }, [saveData]);

  return {
    promotionItems,
    isLoading,
    addItem,
    updateItem,
    deleteItem,
    getPriceInfo,
    enrichDataWithPrices,
    importFromData,
    resetToDefault,
  };
}
