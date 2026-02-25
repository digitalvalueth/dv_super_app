"use client";

import {
  clearCurrentPriceList,
  getCurrentPriceList,
  saveCurrentPriceList,
} from "@/lib/watson-firebase";
import { getFMProductCode } from "@/lib/watson/fmcode-mapping";
import {
  findBestPriceCombination,
  formatAllocationString,
  type PriceOption,
} from "@/lib/watson/price-optimizer";
import { RawRow } from "@/types/watson/invoice";
import {
  ItemPriceHistory,
  PriceListItem,
  PriceListSummary,
  PriceMatch,
  PricePeriod,
} from "@/types/watson/pricelist";
import { useCallback, useEffect, useMemo, useState } from "react";

// Month name abbreviations for parsing Watson date formats
const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/**
 * Parse Watson Invoice date formats robustly.
 * Handles: "01-JAN-0026", "06-JAN-0026", "1/6/2026", Excel serial numbers.
 * Watson uses 2-digit year suffix of Buddhist Era: 0026 = BE 2569 = CE 2026.
 */
function parseWatsonDate(dateVal: unknown): Date | null {
  if (dateVal === null || dateVal === undefined) return null;

  if (typeof dateVal === "number") {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateVal * 86400000);
  }

  if (typeof dateVal !== "string") return null;
  const trimmed = String(dateVal).trim();
  if (!trimmed) return null;

  // Pattern 1: DD-MMM-00YY or DD-MMM-YYYY (Watson Invoice format)
  // e.g. "01-JAN-0026", "06-JAN-0026", "25-DEC-2025"
  const watsonMatch = trimmed.match(/^(\d{1,2})-(\w{3,9})-(\d{2,4})$/i);
  if (watsonMatch) {
    const day = parseInt(watsonMatch[1], 10);
    const monthStr = watsonMatch[2].toLowerCase();
    let year = parseInt(watsonMatch[3], 10);
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      // Handle Watson 00YY format: 0026 → 2026, 0025 → 2025
      if (year < 100) {
        year += 2000;
      }
      return new Date(year, month, day);
    }
  }

  // Pattern 2: M/D/YYYY (US format common in Excel)
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1], 10) - 1;
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    return new Date(year, month, day);
  }

  // Fallback: try native Date.parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Normalize a Date to midnight local time for date-only comparison.
 * Eliminates timezone issues when comparing dates from different sources.
 */
function toDateOnly(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** คำนวณด้วย 4dp ก่อน (ตัด floating-point noise) แล้ว format เป็น 2dp */
const fmt2 = (n: number) => (Math.round(n * 10000) / 10000).toFixed(2);

export function usePriceListData() {
  const [priceListRaw, setPriceListRaw] = useState<PriceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from Firestore on mount
  useEffect(() => {
    let mounted = true;
    getCurrentPriceList()
      .then((data) => {
        if (mounted && data) {
          setPriceListRaw(data);
        }
      })
      .catch((err) => {
        console.error("Error loading price list from Firestore:", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Group by item code — each item can have multiple price tiers per date range
  const priceHistory = useMemo((): ItemPriceHistory[] => {
    const grouped = new Map<string, PriceListItem[]>();

    priceListRaw.forEach((item) => {
      // Skip items with zero or invalid price
      if (!item.priceExtVat || item.priceExtVat <= 0) return;
      const key = item.itemCode;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    const result: ItemPriceHistory[] = [];

    grouped.forEach((items, itemCode) => {
      // Sort by start date ascending, then by priceExtVat descending (Std first)
      const sorted = items.sort((a, b) => {
        const dateDiff =
          new Date(a.priceStartDate).getTime() -
          new Date(b.priceStartDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        // Same start date → sort by priceExtVat desc (highest = Std first)
        return b.priceExtVat - a.priceExtVat;
      });

      // Create periods — use actual endDate from PriceListItem if available
      const periods: PricePeriod[] = sorted.map((item) => {
        const startDate = new Date(item.priceStartDate);
        // Use actual end date from the price list item
        let endDate: Date | null = null;
        if (item.priceEndDate) {
          const parsed = new Date(item.priceEndDate);
          if (!isNaN(parsed.getTime())) {
            endDate = parsed;
          }
        }

        return {
          startDate,
          endDate,
          price: item.price,
          discamti: item.discamti,
          priceIncVat: item.priceIncVat,
          priceExtVat: item.priceExtVat,
          remark: item.remarki1 || undefined,
          invoice62IncV: item.invoice62IncV,
        };
      });

      result.push({
        itemCode,
        prodCode: items[0].prodCode,
        prodName: items[0].prodName,
        periods,
      });
    });

    return result;
  }, [priceListRaw]);

  // Summary stats
  const summary = useMemo((): PriceListSummary => {
    if (priceListRaw.length === 0) {
      return {
        totalItems: 0,
        totalPeriods: 0,
        dateRange: { earliest: null, latest: null },
      };
    }

    const dates = priceListRaw.map((item) => new Date(item.priceStartDate));
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));

    return {
      totalItems: priceHistory.length,
      totalPeriods: priceListRaw.length,
      dateRange: { earliest, latest },
    };
  }, [priceListRaw, priceHistory]);

  // Import from JSON (replace all)
  const importPriceList = useCallback((data: PriceListItem[]) => {
    setPriceListRaw(data);
    // Save to Firestore
    saveCurrentPriceList(data).catch((err) => {
      console.error("Error saving price list to Firestore:", err);
    });
  }, []);

  // Add or update price list items (merge logic)
  // Key: itemCode + priceStartDate + priceExtVat
  // Same item can have multiple price tiers in same date range (Buy1, 2 For 599, etc.)
  // If same key exists, update the row
  // If different key, add new tier
  const addOrUpdatePriceList = useCallback(
    (
      newItems: PriceListItem[],
    ): {
      added: number;
      updated: number;
      addedItems: PriceListItem[];
      updatedItems: PriceListItem[];
    } => {
      let added = 0;
      let updated = 0;
      const addedItems: PriceListItem[] = [];
      const updatedItems: PriceListItem[] = [];

      const existingMap = new Map<string, PriceListItem>();
      priceListRaw.forEach((item) => {
        const key = `${item.itemCode}|${item.priceStartDate}|${item.priceExtVat}`;
        existingMap.set(key, item);
      });

      newItems.forEach((newItem) => {
        const key = `${newItem.itemCode}|${newItem.priceStartDate}|${newItem.priceExtVat}`;
        if (existingMap.has(key)) {
          // Update existing
          existingMap.set(key, newItem);
          updatedItems.push(newItem);
          updated++;
        } else {
          // Add new
          existingMap.set(key, newItem);
          addedItems.push(newItem);
          added++;
        }
      });

      const mergedData = Array.from(existingMap.values());
      setPriceListRaw(mergedData);
      // Save to Firestore
      saveCurrentPriceList(mergedData).catch((err) => {
        console.error("Error saving price list to Firestore:", err);
      });

      return { added, updated, addedItems, updatedItems };
    },
    [priceListRaw],
  );

  // Clear all data
  const clearPriceList = useCallback(() => {
    setPriceListRaw([]);
    // Clear from Firestore
    clearCurrentPriceList().catch((err) => {
      console.error("Error clearing price list from Firestore:", err);
    });
  }, []);

  // Find ALL matching price periods for a given item code and date
  const findAllPricesForDate = useCallback(
    (itemCode: string, invoiceDate: Date): PricePeriod[] => {
      const item = priceHistory.find((h) => h.itemCode === itemCode);
      if (!item) return [];

      // Find all periods that contain this date
      return item.periods.filter((period) => {
        const invoiceDateOnly = toDateOnly(invoiceDate);
        const startDateOnly = toDateOnly(period.startDate);
        if (invoiceDateOnly < startDateOnly) return false;
        if (
          period.endDate !== null &&
          invoiceDateOnly > toDateOnly(period.endDate)
        )
          return false;
        return true;
      });
    },
    [priceHistory],
  );

  // Find matching price period for a given item code and date (first/Std match)
  const findPriceForDate = useCallback(
    (itemCode: string, invoiceDate: Date): PricePeriod | null => {
      const matches = findAllPricesForDate(itemCode, invoiceDate);
      // Return the first match (highest priceExtVat = Std/Buy1)
      return matches.length > 0 ? matches[0] : null;
    },
    [findAllPricesForDate],
  );

  // Match invoice data with price list
  const matchInvoicePrice = useCallback(
    (
      itemCode: string,
      invoiceDate: Date,
      actualPriceExtVat: number,
    ): PriceMatch => {
      const matchedPeriod = findPriceForDate(itemCode, invoiceDate);
      const item = priceHistory.find((h) => h.itemCode === itemCode);

      if (!item) {
        return {
          itemCode,
          prodCode: "",
          invoiceDate,
          matchedPeriod: null,
          expectedPriceExtVat: null,
          actualPriceExtVat,
          priceDiff: null,
          isMatch: false,
          message: "ไม่พบรหัสสินค้าใน Price List",
        };
      }

      if (!matchedPeriod) {
        return {
          itemCode,
          prodCode: item.prodCode,
          invoiceDate,
          matchedPeriod: null,
          expectedPriceExtVat: null,
          actualPriceExtVat,
          priceDiff: null,
          isMatch: false,
          message: "ไม่พบช่วงราคาที่ตรงกับวันที่",
        };
      }

      const expectedPrice = matchedPeriod.priceExtVat;
      const priceDiff = Math.abs(actualPriceExtVat - expectedPrice);
      const tolerance = 0.01; // Allow 0.01 difference due to rounding
      const isMatch = priceDiff <= tolerance;

      return {
        itemCode,
        prodCode: item.prodCode,
        invoiceDate,
        matchedPeriod,
        expectedPriceExtVat: expectedPrice,
        actualPriceExtVat,
        priceDiff: actualPriceExtVat - expectedPrice,
        isMatch,
        message: isMatch
          ? "✅ ราคาตรงกัน"
          : `⚠️ ราคาต่าง ${(actualPriceExtVat - expectedPrice).toFixed(2)} บาท`,
      };
    },
    [findPriceForDate, priceHistory],
  );

  // Enrich invoice data with price matching and Knapsack optimization
  const enrichDataWithPriceMatch = useCallback(
    (
      data: RawRow[],
      headers: string[],
      confidenceThreshold: number = 0.9,
      reportRunDateTime?: string | null,
    ): { enrichedData: RawRow[]; enrichedHeaders: string[] } => {
      // Find relevant columns
      const itemCodeHeader = headers.find(
        (h) =>
          h.toLowerCase().includes("item code") ||
          h.toLowerCase() === "itemcode",
      );
      const dateHeader = headers.find((h) => h.toLowerCase() === "date");
      const totalCostHeader = headers.find(
        (h) =>
          h.toLowerCase().includes("total cost") &&
          h.toLowerCase().includes("exclusive"),
      );
      const qtyHeader = headers.find((h) => h.toLowerCase() === "qty");

      if (!itemCodeHeader || priceListRaw.length === 0) {
        return { enrichedData: data, enrichedHeaders: headers };
      }

      // Add new headers - Export columns first, then internal calculation columns
      const newHeaders = [
        // New export columns (for Excel/JSON export)
        "QtyBuy1",
        "PriceBuy1_Invoice_Formula",
        "PriceBuy1_Com_Calculate",
        "QtyPro",
        "PricePro_Invoice_Formula",
        "PricePro_Com_Calculate",
        "Remark",
        "FMProductCode",
        "ReportRunDateTime",
        // Internal calculation columns (for display/debugging)
        "Expected Price",
        "Price Match",
        "Period Start",
        "Matched Period",
        "Std Qty",
        "Promo Qty",
        "Calc Amt",
        "Diff",
        "Confidence",
        "PL Name",
        "PL Remark",
        "PL Full Price",
        "PL Comm Price",
        "PL Invoice62 IncV",
        "Total Comm",
        "Calc Log",
      ];
      const enrichedHeaders = [...headers, ...newHeaders];

      // Enrich each row
      const enrichedData = data.map((row) => {
        const itemCode = String(row[itemCodeHeader] || "").trim();
        let invoiceDate: Date = new Date();
        let actualPrice: number | null = null;
        let rawAmt: number = 0;
        let qty: number = 1;

        // Calculation log steps
        const calcLog: string[] = [];

        // Parse date
        if (dateHeader && row[dateHeader]) {
          const parsedDate = parseWatsonDate(row[dateHeader]);
          if (parsedDate) {
            invoiceDate = parsedDate;
          }
        }

        // Get actual price and rawAmt (total cost / qty)
        // Detect returns (negative qty or amount)
        let isReturn = false;
        if (totalCostHeader && row[totalCostHeader]) {
          const originalRawAmt = Number(row[totalCostHeader]) || 0;
          const originalQty = qtyHeader ? Number(row[qtyHeader]) || 1 : 1;

          // Mark as return if either value is negative
          isReturn = originalRawAmt < 0 || originalQty < 0;

          rawAmt = Math.abs(originalRawAmt);
          if (qtyHeader && row[qtyHeader]) {
            qty = Math.abs(originalQty);
          }
          actualPrice = rawAmt / qty;
        }

        calcLog.push(`📋 Item Code: ${itemCode}`);
        calcLog.push(
          `📅 Invoice Date: ${invoiceDate.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}`,
        );
        calcLog.push(
          `💰 Raw Amount: ${isReturn ? "-" : ""}${rawAmt.toFixed(2)} | Qty: ${isReturn ? "-" : ""}${qty} | Price/Unit: ${actualPrice?.toFixed(2) ?? "-"}`,
        );

        // Handle returns early (skip all calculations)
        if (isReturn) {
          calcLog.push(``);
          calcLog.push(`📦 ตรวจพบ: รายการคืนสินค้า (Qty หรือ Amount ติดลบ)`);
          calcLog.push(`  ข้ามการคำนวณ Knapsack และ Price Match`);

          // Find rawItem for PL info even for returns (match by invoice date)
          const rawItemReturn = (() => {
            const candidates = priceListRaw.filter(
              (r) => r.itemCode === itemCode,
            );
            if (candidates.length === 0) return undefined;
            const byDate = candidates.find((r) => {
              if (!r.priceStartDate) return false;
              const start = new Date(r.priceStartDate);
              const end = r.priceEndDate ? new Date(r.priceEndDate) : null;
              return (
                toDateOnly(invoiceDate) >= toDateOnly(start) &&
                (end === null || toDateOnly(invoiceDate) <= toDateOnly(end))
              );
            });
            return byDate || candidates[0];
          })();

          return {
            ...row,
            "Expected Price": "-",
            "Price Match": "📦 คืนสินค้า",
            "Period Start": "-",
            "Matched Period": "-",
            "Std Qty": "-",
            "Promo Qty": "-",
            "Calc Amt": "-",
            Diff: "-",
            Confidence: "-",
            "PL Name": rawItemReturn?.prodName || "-",
            "PL Remark": rawItemReturn?.remarki1 || "-",
            "PL Full Price": rawItemReturn?.price
              ? `฿${rawItemReturn.price.toFixed(2)}`
              : "-",
            "PL Comm Price": rawItemReturn?.priceIncVat
              ? `฿${rawItemReturn.priceIncVat.toFixed(2)}`
              : "-",
            "PL Invoice62 IncV": rawItemReturn?.invoice62IncV
              ? fmt2(rawItemReturn.invoice62IncV)
              : "-",
            "Total Comm": "-",
            "Calc Log": calcLog.join("\n"),
            // New export columns
            QtyBuy1: "",
            PriceBuy1_Invoice_Formula: "",
            PriceBuy1_Com_Calculate: "",
            QtyPro: "",
            PricePro_Invoice_Formula: "",
            PricePro_Com_Calculate: "",
            Remark: rawItemReturn?.remarki1 || "-",
            FMProductCode: getFMProductCode(itemCode),
            ReportRunDateTime: reportRunDateTime || "",
          };
        }

        // Skip validation for single item purchases (QTY=1)
        // Price variations for single items are common and acceptable
        if (qty === 1) {
          calcLog.push(``);
          calcLog.push(`⏭️ Qty=1: ข้ามการตรวจสอบราคา`);
          calcLog.push(`  สินค้า 1 ชิ้นอาจมีราคาแตกต่างได้`);
          calcLog.push(`  เริ่มตรวจสอบตั้งแต่ 2 ชิ้นขึ้นไป`);

          const rawItemSingle = (() => {
            const candidates = priceListRaw.filter(
              (r) => r.itemCode === itemCode,
            );
            if (candidates.length === 0) return undefined;
            const byDate = candidates.find((r) => {
              if (!r.priceStartDate) return false;
              const start = new Date(r.priceStartDate);
              const end = r.priceEndDate ? new Date(r.priceEndDate) : null;
              return (
                toDateOnly(invoiceDate) >= toDateOnly(start) &&
                (end === null || toDateOnly(invoiceDate) <= toDateOnly(end))
              );
            });
            return byDate || candidates[0];
          })();

          return {
            ...row,
            "Expected Price": rawItemSingle?.price?.toFixed(2) || "-",
            "Price Match": "⏭️ Qty=1",
            "Period Start": "-",
            "Matched Period": "-",
            "Std Qty": "1",
            "Promo Qty": "0",
            "Calc Amt": rawAmt.toFixed(2),
            Diff: "-",
            Confidence: "100%",
            "PL Name": rawItemSingle?.prodName || "-",
            "PL Remark": rawItemSingle?.remarki1 || "-",
            "PL Full Price": rawItemSingle?.price
              ? `฿${rawItemSingle.price.toFixed(2)}`
              : "-",
            "PL Comm Price": rawItemSingle?.priceIncVat
              ? `฿${rawItemSingle.priceIncVat.toFixed(2)}`
              : "-",
            "PL Invoice62 IncV": rawItemSingle?.invoice62IncV
              ? fmt2(rawItemSingle.invoice62IncV)
              : "-",
            "Total Comm": rawItemSingle?.priceIncVat
              ? `฿${fmt2(rawItemSingle.priceIncVat)}`
              : "-",
            "Calc Log": calcLog.join("\n"),
            // New export columns
            QtyBuy1: "1",
            PriceBuy1_Invoice_Formula: rawItemSingle?.invoice62IncV
              ? fmt2(rawItemSingle.invoice62IncV)
              : fmt2(rawAmt),
            PriceBuy1_Com_Calculate: rawItemSingle?.priceIncVat
              ? fmt2(rawItemSingle.priceIncVat)
              : "",
            QtyPro: "0",
            PricePro_Invoice_Formula: "",
            PricePro_Com_Calculate: "",
            Remark: rawItemSingle?.remarki1 || "-",
            FMProductCode: getFMProductCode(itemCode),
            ReportRunDateTime: reportRunDateTime || "",
            // Hidden metadata for manual qty override recalculation
            _stdPriceExtVat: rawAmt, // single item = entire amount
            _stdPriceIncVat: rawItemSingle?.priceIncVat || 0,
            _stdInvoice62IncV: rawItemSingle?.invoice62IncV || 0,
            _proPriceExtVat: rawAmt, // fallback to std for manual promo split
            _proPriceIncVat: rawItemSingle?.priceIncVat || 0,
            _proInvoice62IncV: rawItemSingle?.invoice62IncV || 0,
            _proRemark: "Buy1",
          };
        }

        // Find matching period
        const matchedPeriod = findPriceForDate(itemCode, invoiceDate);
        const item = priceHistory.find((h) => h.itemCode === itemCode);

        // Find the raw price list item matching the invoice date and matched period
        const rawItem = (() => {
          const candidates = priceListRaw.filter(
            (r) => r.itemCode === itemCode,
          );
          if (candidates.length === 0) return undefined;
          if (matchedPeriod) {
            // Most precise: date range + priceExtVat match
            const byDateAndPrice = candidates.find((r) => {
              if (!r.priceStartDate) return false;
              const start = new Date(r.priceStartDate);
              const end = r.priceEndDate ? new Date(r.priceEndDate) : null;
              const inRange =
                toDateOnly(invoiceDate) >= toDateOnly(start) &&
                (end === null || toDateOnly(invoiceDate) <= toDateOnly(end));
              const priceMatch =
                Math.abs(r.priceExtVat - matchedPeriod.priceExtVat) < 0.02;
              return inRange && priceMatch;
            });
            if (byDateAndPrice) return byDateAndPrice;
          }
          // Fallback: date range only
          const byDate = candidates.find((r) => {
            if (!r.priceStartDate) return false;
            const start = new Date(r.priceStartDate);
            const end = r.priceEndDate ? new Date(r.priceEndDate) : null;
            return (
              toDateOnly(invoiceDate) >= toDateOnly(start) &&
              (end === null || toDateOnly(invoiceDate) <= toDateOnly(end))
            );
          });
          return byDate || candidates[0];
        })();

        let expectedPrice = "-";
        let priceMatch = "-";
        let periodStart = "-";
        let matchedPeriodStr = "-";
        let stdQty = "-";
        let promoQty = "-";
        let calcAmt = "-";
        let diffStr = "-";
        let confidenceStr = "-";
        // New Price List info columns
        let plName = "-";
        let plRemark = "-";
        let plFullPrice = "-";
        let plCommPrice = "-";
        let totalComm = "-";

        // New export columns for calculation breakdown
        let qtyBuy1 = 0;
        let priceBuy1InvoiceFormula = 0;
        let priceBuy1ComCalculate = 0;
        // Per-unit prices for manual override recalculation
        let _stdPricePerUnit = 0;
        let _stdCommPerUnit = 0;
        let _proPricePerUnit = 0;
        let _proCommPerUnit = 0;
        let _proRemarkStr = "";
        let qtyPro = 0;
        let priceProInvoiceFormula = 0;
        let priceProComCalculate = 0;
        let remarkCombined = "";
        let plInvoice62IncV = "-";
        let _stdInvoice62PerUnit = 0;
        let _proInvoice62PerUnit = 0;

        // Set Price List info if found
        if (rawItem) {
          plName = rawItem.prodName || "-";
          plRemark = rawItem.remarki1 || "-";
          plFullPrice = rawItem.price ? `฿${rawItem.price.toFixed(2)}` : "-";
          plCommPrice = rawItem.priceIncVat
            ? `฿${rawItem.priceIncVat.toFixed(2)}`
            : "-";
          plInvoice62IncV = rawItem.invoice62IncV
            ? fmt2(rawItem.invoice62IncV)
            : "-";
        }

        if (matchedPeriod && item) {
          calcLog.push(``);
          calcLog.push(`🔍 Step 1: Period Matching`);
          calcLog.push(`  พบสินค้าใน PL: ${item.prodName || itemCode}`);
          calcLog.push(`  จำนวน periods ทั้งหมด: ${item.periods.length}`);
          calcLog.push(
            `  Matched period: ${matchedPeriod.startDate.toLocaleDateString("th-TH")} - ${matchedPeriod.endDate?.toLocaleDateString("th-TH") ?? "ไม่มีสิ้นสุด"}`,
          );
          calcLog.push(
            `  Expected Price (ExtVat): ${matchedPeriod.priceExtVat.toFixed(2)}`,
          );
          calcLog.push(`  Remark: ${matchedPeriod.remark || "-"}`);
          expectedPrice = matchedPeriod.priceExtVat.toFixed(2);
          periodStart = matchedPeriod.startDate.toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
            year: "2-digit",
          });

          // Show how many price tiers are available for this date
          const allMatchingForDisplay = findAllPricesForDate(
            itemCode,
            invoiceDate,
          );
          matchedPeriodStr = `${allMatchingForDisplay.length} tiers`;

          calcLog.push(``);
          calcLog.push(
            `📊 Step 2: Price Tiers (${allMatchingForDisplay.length} tiers found)`,
          );
          allMatchingForDisplay.forEach((p, i) => {
            calcLog.push(
              `  Tier ${i + 1}: ${p.priceExtVat.toFixed(2)} ExtVat | CommIncV: ${p.priceIncVat.toFixed(2)} | Remark: ${p.remark || "Buy1"} | ${p.startDate.toLocaleDateString("th-TH")} - ${p.endDate?.toLocaleDateString("th-TH") ?? "-"}`,
            );
          });

          // Build price options for Knapsack (all price tiers valid for this date)
          const allMatchingPrices = findAllPricesForDate(itemCode, invoiceDate);
          // Deduplicate by priceExtVat (same price = same option)
          const uniquePrices = new Map<number, PricePeriod>();
          allMatchingPrices.forEach((p) => {
            if (!uniquePrices.has(p.priceExtVat)) {
              uniquePrices.set(p.priceExtVat, p);
            }
          });
          const validPrices: PriceOption[] = Array.from(uniquePrices.values())
            .sort((a, b) => b.priceExtVat - a.priceExtVat) // Sort by price desc
            .map((p, idx) => ({
              price: p.priceExtVat,
              label:
                idx === 0
                  ? "Std"
                  : p.remark
                    ? `Pro${idx}(${p.remark})`
                    : `Pro${idx}`,
              remark: p.remark || (idx === 0 ? "Buy1" : undefined),
              startDate: p.startDate,
              priceIncVat: p.priceIncVat, // Comm Price IncV
              stdPrice: p.price, // Standard Price IncV
            }));

          if (validPrices.length > 0 && rawAmt > 0 && qty > 0) {
            calcLog.push(``);
            calcLog.push(`🧮 Step 3: Knapsack Optimization`);
            calcLog.push(
              `  Input: qty=${qty}, rawAmt=${rawAmt.toFixed(2)}, threshold=${(confidenceThreshold * 100).toFixed(0)}%`,
            );
            calcLog.push(`  Prices:`);
            validPrices.forEach((vp) => {
              calcLog.push(
                `    ${vp.label}: ${vp.price.toFixed(2)} (${vp.remark || "-"})`,
              );
            });

            // Run Knapsack optimization
            const result = findBestPriceCombination(validPrices, qty, rawAmt, {
              confidenceThreshold,
            });

            calcLog.push(``);
            calcLog.push(`✅ Step 4: Knapsack Result`);
            if (result.allocations.length > 0) {
              result.allocations.forEach((a) => {
                const commInfo = a.priceIncVat
                  ? ` | CommIncV: ฿${a.priceIncVat.toFixed(2)}`
                  : "";
                calcLog.push(
                  `  ${a.label || "?"}: ${a.qty} × ${a.price.toFixed(2)} = ${(a.qty * a.price).toFixed(2)} (${a.remark || "-"})${commInfo}`,
                );
              });
              calcLog.push(`  ─────────────`);
              calcLog.push(`  Calc Amt: ${result.calculatedAmt.toFixed(2)}`);
              calcLog.push(`  Raw Amt:  ${rawAmt.toFixed(2)}`);
              calcLog.push(`  Diff:     ${result.diff.toFixed(2)}`);
              calcLog.push(`  Confidence: ${result.confidence.toFixed(1)}%`);
              calcLog.push(
                `  Acceptable: ${result.isAcceptable ? "✅ YES" : "❌ NO"}`,
              );
            } else {
              calcLog.push(`  ⚠ No valid allocation found`);
            }

            if (result.allocations.length > 0) {
              // Parse allocations
              const stdAlloc = result.allocations.find(
                (a) => a.label === "Std",
              );
              const promoAllocs = result.allocations.filter(
                (a) => a.label !== "Std",
              );

              stdQty = stdAlloc ? String(stdAlloc.qty) : "0";
              promoQty =
                promoAllocs.length > 0
                  ? formatAllocationString(promoAllocs)
                  : "0";
              calcAmt = fmt2(result.calculatedAmt);

              // Calculate new export columns
              // Buy1 (Std) allocation
              if (stdAlloc) {
                qtyBuy1 = stdAlloc.qty;
                // Display: per-unit Invoice 62% IncV (not total)
                priceBuy1InvoiceFormula =
                  rawItem?.invoice62IncV || stdAlloc.price;
                // Comm Calculate = Comm Price IncV (not invoice62)
                priceBuy1ComCalculate =
                  rawItem?.priceIncVat || stdAlloc.priceIncVat || 0;
                // Store per-unit prices for manual override recalculation
                _stdPricePerUnit = stdAlloc.price;
                _stdCommPerUnit = stdAlloc.priceIncVat || 0;
                _stdInvoice62PerUnit = rawItem?.invoice62IncV || 0;
              }

              // Promo allocations (sum all promo)
              const remarks: string[] = [];
              promoAllocs.forEach((alloc) => {
                qtyPro += alloc.qty;
                // Display: per-unit Invoice 62% IncV (not accumulated total)
                priceProInvoiceFormula = rawItem?.invoice62IncV || alloc.price;
                // Comm Calculate = Comm Price IncV (not invoice62)
                priceProComCalculate =
                  rawItem?.priceIncVat || alloc.priceIncVat || 0;
                // Store per-unit promo price (use first/dominant promo)
                if (_proPricePerUnit === 0) {
                  _proPricePerUnit = alloc.price;
                  _proCommPerUnit = alloc.priceIncVat || 0;
                  _proRemarkStr = alloc.remark || "";
                  _proInvoice62PerUnit = rawItem?.invoice62IncV || 0;
                }
                if (alloc.remark) {
                  remarks.push(alloc.remark);
                }
              });

              // If Knapsack didn't allocate promo, store available promo tier price
              // so manual QtyPro override can use it for recalculation
              if (_proPricePerUnit === 0 && validPrices.length > 1) {
                const proTier = validPrices.find((v) => v.label !== "Std");
                if (proTier) {
                  _proPricePerUnit = proTier.price;
                  _proCommPerUnit = proTier.priceIncVat || 0;
                  _proRemarkStr = proTier.remark || "";
                }
              }
              // If still no promo price (single tier), fallback to std price
              if (_proPricePerUnit === 0 && _stdPricePerUnit > 0) {
                _proPricePerUnit = _stdPricePerUnit;
                _proCommPerUnit = _stdCommPerUnit;
                _proRemarkStr = "Buy1";
              }

              // Combine remarks
              const allRemarks = [stdAlloc?.remark, ...remarks].filter(Boolean);
              remarkCombined =
                allRemarks.length > 0 ? allRemarks.join("; ") : "-";

              // PL Remark + Comm Price: show info from the dominant tier (highest qty)
              const dominantAlloc = [...result.allocations].sort(
                (a, b) => b.qty - a.qty,
              )[0];
              if (dominantAlloc?.remark) {
                plRemark = dominantAlloc.remark;
              }
              // Update PL Comm Price & Full Price to the dominant (matched) tier
              if (dominantAlloc?.priceIncVat) {
                plCommPrice = `฿${dominantAlloc.priceIncVat.toFixed(2)}`;
              }
              if (dominantAlloc?.stdPrice) {
                plFullPrice = `฿${dominantAlloc.stdPrice.toFixed(2)}`;
              }

              // Log commission info
              calcLog.push(``);
              calcLog.push(`💵 Step 5: Commission (ค่าคอม)`);
              calcLog.push(
                `  Dominant tier: ${dominantAlloc?.label || "-"} (${dominantAlloc?.remark || "-"})`,
              );

              // Calculate Total Commission from ALL allocations
              let totalCommValue = 0;
              result.allocations.forEach((alloc) => {
                if (alloc.qty > 0 && alloc.priceIncVat) {
                  const allocComm = alloc.priceIncVat * alloc.qty;
                  totalCommValue += allocComm;
                  calcLog.push(
                    `  ${alloc.label}: ฿${alloc.priceIncVat.toFixed(2)} × ${alloc.qty} = ฿${allocComm.toFixed(2)}`,
                  );
                }
              });
              if (totalCommValue > 0) {
                totalComm = `฿${fmt2(totalCommValue)}`;
                calcLog.push(`  ───────────────────────`);
                calcLog.push(`  ค่าคอมรวม: ${totalComm}`);
              }

              if (dominantAlloc?.stdPrice) {
                calcLog.push(
                  `  Standard Price IncV: ฿${dominantAlloc.stdPrice.toFixed(2)}`,
                );
              }

              // Use confidence percentage to determine status
              const thresholdPercent = confidenceThreshold * 100;
              const isConfidenceOk = result.confidence >= thresholdPercent;

              diffStr = isConfidenceOk
                ? `✓ ${fmt2(result.diff)}`
                : `⚠ ${fmt2(result.diff)}`;
              confidenceStr = `${result.confidence.toFixed(0)}%`;

              // Update price match based on confidence
              if (isConfidenceOk) {
                priceMatch = "✅ OK";
              } else {
                const diff = result.diff;
                priceMatch =
                  diff > 0 ? `⬆️ +${fmt2(diff)}` : `⬇️ ${fmt2(diff)}`;
              }
            } else {
              // Fallback to simple comparison
              if (actualPrice !== null) {
                const diff = actualPrice - matchedPeriod.priceExtVat;
                const tolerance = 0.5;
                if (Math.abs(diff) <= tolerance) {
                  priceMatch = "✅";
                } else {
                  priceMatch =
                    diff > 0
                      ? `⬆️ +${diff.toFixed(2)}`
                      : `⬇️ ${diff.toFixed(2)}`;
                }
              }
            }
          } else {
            // Simple comparison when can't run Knapsack
            if (actualPrice !== null) {
              const diff = actualPrice - matchedPeriod.priceExtVat;
              const tolerance = 0.5;
              if (Math.abs(diff) <= tolerance) {
                priceMatch = "✅";
              } else {
                priceMatch =
                  diff > 0 ? `⬆️ +${diff.toFixed(2)}` : `⬇️ ${diff.toFixed(2)}`;
              }
            }
          }
        } else if (item) {
          priceMatch = "❓ No period";
          calcLog.push(``);
          calcLog.push(`❓ ไม่พบช่วงราคาที่ตรงกับวันที่ Invoice`);
          calcLog.push(
            `  สินค้า ${itemCode} มี ${item.periods.length} periods:`,
          );
          item.periods.forEach((p, i) => {
            calcLog.push(
              `  ${i + 1}. ${p.startDate.toLocaleDateString("th-TH")} - ${p.endDate?.toLocaleDateString("th-TH") ?? "-"} | ${p.priceExtVat.toFixed(2)} | ${p.remark || "-"}`,
            );
          });
        } else {
          priceMatch = "❌ Not found";
          calcLog.push(``);
          calcLog.push(`❌ ไม่พบรหัสสินค้า ${itemCode} ใน Price List`);
        }

        return {
          ...row,
          "Expected Price": expectedPrice,
          "Price Match": priceMatch,
          "Period Start": periodStart,
          "Matched Period": matchedPeriodStr,
          "Std Qty": stdQty,
          "Promo Qty": promoQty,
          "Calc Amt": calcAmt,
          Diff: diffStr,
          Confidence: confidenceStr,
          "PL Name": plName,
          "PL Remark": plRemark,
          "PL Full Price": plFullPrice,
          "PL Comm Price": plCommPrice,
          "PL Invoice62 IncV": plInvoice62IncV,
          "Total Comm": totalComm,
          "Calc Log": calcLog.join("\n"),
          // New export columns
          QtyBuy1: qtyBuy1 > 0 ? qtyBuy1 : "",
          PriceBuy1_Invoice_Formula:
            priceBuy1InvoiceFormula > 0 ? fmt2(priceBuy1InvoiceFormula) : "",
          PriceBuy1_Com_Calculate:
            priceBuy1ComCalculate > 0 ? fmt2(priceBuy1ComCalculate) : "",
          QtyPro: qtyPro > 0 ? qtyPro : "",
          PricePro_Invoice_Formula:
            priceProInvoiceFormula > 0 ? fmt2(priceProInvoiceFormula) : "",
          PricePro_Com_Calculate:
            priceProComCalculate > 0 ? fmt2(priceProComCalculate) : "",
          Remark: remarkCombined || plRemark || "-",
          FMProductCode: getFMProductCode(itemCode),
          ReportRunDateTime: reportRunDateTime || "",
          // Hidden metadata for manual qty override recalculation
          _stdPriceExtVat: _stdPricePerUnit,
          _stdPriceIncVat: _stdCommPerUnit,
          _stdInvoice62IncV: _stdInvoice62PerUnit,
          _proPriceExtVat: _proPricePerUnit,
          _proPriceIncVat: _proCommPerUnit,
          _proInvoice62IncV: _proInvoice62PerUnit,
          _proRemark: _proRemarkStr,
        };
      });

      return { enrichedData, enrichedHeaders };
    },
    [priceListRaw, priceHistory, findPriceForDate, findAllPricesForDate],
  );

  return {
    priceListRaw,
    priceHistory,
    summary,
    isLoading,
    importPriceList,
    addOrUpdatePriceList,
    clearPriceList,
    findPriceForDate,
    matchInvoicePrice,
    enrichDataWithPriceMatch,
  };
}
