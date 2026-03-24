"use client";

import { Badge } from "@/components/watson/ui/badge";
import { Button } from "@/components/watson/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/watson/ui/dialog";
import { ScrollArea } from "@/components/watson/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/watson/ui/tooltip";
import type { ItemPriceHistory, PricePeriod } from "@/types/watson/pricelist";
import {
  AlertTriangle,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Eye,
  Loader2,
  Percent,
  SkipForward,
  Tag,
  TrendingDown,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface PatternAnalysis {
  itemCode: string;
  itemName: string;
  rowCount: number;
  rowIndices: number[];
  /** Average diff (negative = lower than expected, positive = higher) */
  avgDiffPercent: number;
  /** Min diff percent */
  minDiffPercent: number;
  /** Max diff percent */
  maxDiffPercent: number;
  /** How consistent is the pattern (0-1, higher = more consistent) */
  consistency: number;
  /** Detected pattern type */
  patternType: "discount" | "markup" | "mixed" | "unknown";
  /** Suggested action */
  suggestion: string;
  /** Suggested reason */
  reason: string;
  /** Raw diff values for each row */
  diffValues: number[];
  /** Raw rawAmt values for each row */
  rawAmtValues: number[];
  /** Number of price tiers available for this item */
  priceTiers: number;
  /** Sample Std Qty from one row */
  sampleStdQty: string;
  /** Sample Promo Qty from one row */
  samplePromoQty: string;
  /** Expected price from one row */
  expectedPrice: string;
  /** PL Remark (promotion name) */
  plRemark: string;
  /** Calc Amt from one row */
  calcAmt: string;
  /** Smart Qty Analysis suggestions */
  qtyAnalysis?: QtyAnalysisResult[];
}

export interface QtyAnalysisResult {
  /** Total qty of this row */
  totalQty: number;
  /** Suggested breakdown e.g. "2+2" or "3+1" */
  breakdown: string;
  /** Calculated price per breakdown */
  calculatedPrice: number;
  /** Actual rawAmt */
  actualAmount: number;
  /** Diff from actual */
  diff: number;
  /** Diff percent */
  diffPercent: number;
  /** Is this a good match? */
  isMatch: boolean;
  /** Explanation */
  explanation: string;
}

export interface BulkFixAction {
  itemCode: string;
  action: "accept" | "skip" | "adjust-threshold";
  adjustedThreshold?: number;
}

interface BulkFixSuggestionPanelProps {
  /** Enriched data rows */
  enrichedData: Record<string, unknown>[];
  /** Headers for the data */
  headers: string[];
  /** Current confidence threshold */
  confidenceThreshold: number;
  /** Items that have already been bulk fixed */
  acceptedItemCodes: Set<string>;
  /** Callback when user applies a bulk fix */
  onBulkFix: (action: BulkFixAction) => void;
  /** Callback to close the panel */
  onClose?: () => void;
  /** Price history for looking up available promotions per item */
  priceHistory?: ItemPriceHistory[];
  /** Callback when user forces a promo tier on rows — each override carries separate buy1 and pro tiers */
  onApplyBulkPromo?: (
    overrides: {
      ridx: number;
      qtyBuy1: number;
      qtyPro: number;
      buy1Tier: PricePeriod;
      proTier: PricePeriod;
    }[],
  ) => void;
}

/**
 * Analyze patterns in low-confidence rows grouped by item code.
 * Detects systematic discounts/markups that may indicate coupon/coin usage.
 */
export function analyzePatterns(
  enrichedData: Record<string, unknown>[],
  headers: string[],
  confidenceThreshold: number,
): PatternAnalysis[] {
  // Find relevant columns
  const itemCodeHeader = headers.find(
    (h) =>
      h.toLowerCase().includes("item code") || h.toLowerCase() === "itemcode",
  );
  const diffHeader = "Diff";
  const confidenceHeader = "Confidence";
  const descHeader = headers.find((h) =>
    h.toLowerCase().includes("item description"),
  );

  if (!itemCodeHeader) return [];

  const thresholdPercent = confidenceThreshold * 100;

  // Group low-confidence rows by itemCode
  const itemGroups = new Map<
    string,
    {
      rowIndices: number[];
      itemName: string;
      diffValues: number[];
      rawAmtValues: number[];
      confidenceValues: number[];
      // New fields for detailed analysis
      priceTiers: number;
      sampleStdQty: string;
      samplePromoQty: string;
      expectedPrice: string;
      plRemark: string;
      calcAmt: string;
    }
  >();

  enrichedData.forEach((row, idx) => {
    const confidenceStr = String(row[confidenceHeader] || "");
    const diffStr = String(row[diffHeader] || "");
    const itemCode = String(row[itemCodeHeader] || "").trim();
    const itemName = String(
      row[descHeader || ""] || row["PL Name"] || "",
    ).trim();

    // Skip if no valid confidence
    if (confidenceStr === "-" || diffStr === "-") return;

    const confMatch = confidenceStr.match(/(\d+)/);
    const confidencePercent = confMatch ? parseInt(confMatch[1], 10) : 0;

    // Only analyze rows below threshold
    if (confidencePercent >= thresholdPercent) return;

    // Parse diff value - remove ✓/⬆️/⬇️ symbols and parse number
    const diffNumMatch = diffStr.match(/-?[\d.]+/);
    const diffValue = diffNumMatch ? parseFloat(diffNumMatch[0]) : 0;

    // Get rawAmt for percentage calculation
    const rawAmtHeader = headers.find(
      (h) =>
        h.toLowerCase().includes("total cost") &&
        h.toLowerCase().includes("exclusive"),
    );
    const rawAmt = rawAmtHeader
      ? Math.abs(parseFloat(String(row[rawAmtHeader])) || 0)
      : 0;

    // Extract additional fields
    const matchedPeriodStr = String(row["Matched Period"] || "");
    const tiersMatch = matchedPeriodStr.match(/(\d+)\s*tiers?/i);
    const priceTiers = tiersMatch ? parseInt(tiersMatch[1], 10) : 1;
    const stdQty = String(row["Std Qty"] || "-");
    const promoQty = String(row["Promo Qty"] || "-");
    const expectedPrice = String(row["Expected Price"] || "-");
    const plRemark = String(row["PL Remark"] || "-");
    const calcAmt = String(row["Calc Amt"] || "-");

    const existing = itemGroups.get(itemCode);
    if (existing) {
      existing.rowIndices.push(idx);
      existing.diffValues.push(diffValue);
      existing.rawAmtValues.push(rawAmt);
      existing.confidenceValues.push(confidencePercent);
      // Update priceTiers if this row has more tiers (previous row might have been a return)
      if (priceTiers > existing.priceTiers) {
        existing.priceTiers = priceTiers;
        existing.sampleStdQty = stdQty;
        existing.samplePromoQty = promoQty;
        existing.expectedPrice = expectedPrice;
        existing.plRemark = plRemark;
        existing.calcAmt = calcAmt;
      }
    } else {
      itemGroups.set(itemCode, {
        rowIndices: [idx],
        itemName,
        diffValues: [diffValue],
        rawAmtValues: [rawAmt],
        confidenceValues: [confidencePercent],
        priceTiers,
        sampleStdQty: stdQty,
        samplePromoQty: promoQty,
        expectedPrice,
        plRemark,
        calcAmt,
      });
    }
  });

  // Analyze each group
  const patterns: PatternAnalysis[] = [];

  itemGroups.forEach((group, itemCode) => {
    // Calculate diff percentages relative to rawAmt
    const diffPercents = group.diffValues.map((diff, i) => {
      const rawAmt = group.rawAmtValues[i];
      return rawAmt > 0 ? (diff / rawAmt) * 100 : 0;
    });

    // Statistics
    const avgDiffPercent =
      diffPercents.reduce((a, b) => a + b, 0) / diffPercents.length;
    const minDiffPercent = Math.min(...diffPercents);
    const maxDiffPercent = Math.max(...diffPercents);

    // For single-row items, consistency is 1 (no variance)
    // For multi-row items, calculate from variance
    let consistency: number;
    if (group.rowIndices.length === 1) {
      consistency = 1; // Single row = perfectly consistent with itself
    } else {
      const variance =
        diffPercents.reduce(
          (sum, p) => sum + Math.pow(p - avgDiffPercent, 2),
          0,
        ) / diffPercents.length;
      const stdDev = Math.sqrt(variance);
      consistency = Math.max(0, 1 - stdDev / 20);
    }

    // Detect pattern type
    let patternType: PatternAnalysis["patternType"] = "unknown";
    let suggestion = "";
    let reason = "";

    if (consistency >= 0.7) {
      // Consistent pattern detected
      if (avgDiffPercent < -3) {
        patternType = "discount";
        const discountPercent = Math.abs(avgDiffPercent).toFixed(1);
        suggestion = `ยอมรับทั้งหมด (${group.rowIndices.length} แถว)`;
        reason =
          group.rowIndices.length === 1
            ? `ราคาต่ำกว่า ${discountPercent}% อาจใช้ส่วนลด/Coin`
            : `ราคาต่ำกว่าเฉลี่ย ${discountPercent}% อาจใช้ส่วนลด/Coin`;
      } else if (avgDiffPercent > 3) {
        patternType = "markup";
        const markupPercent = avgDiffPercent.toFixed(1);
        suggestion = `ยอมรับทั้งหมด (${group.rowIndices.length} แถว)`;
        reason =
          group.rowIndices.length === 1
            ? `ราคาสูงกว่า ${markupPercent}% อาจมีค่าบริการเพิ่ม`
            : `ราคาสูงกว่าเฉลี่ย ${markupPercent}% อาจมีค่าบริการเพิ่ม`;
      } else {
        patternType = "mixed";
        suggestion = `ยอมรับทั้งหมด (${group.rowIndices.length} แถว)`;
        reason = `ราคาต่างจาก Price List เล็กน้อย (±${Math.abs(avgDiffPercent).toFixed(1)}%)`;
      }
    } else if (consistency >= 0.4) {
      patternType = "mixed";
      suggestion = `ตรวจสอบ (${group.rowIndices.length} แถว)`;
      reason = `มีรูปแบบไม่แน่นอน อาจใช้ส่วนลดหลายแบบ`;
    } else {
      patternType = "unknown";
      suggestion = `ตรวจสอบทีละแถว`;
      reason = `ไม่พบรูปแบบที่ชัดเจน`;
    }

    // Build detailed reason based on price tiers
    let detailedReason = reason;
    if (group.priceTiers === 1) {
      detailedReason += ` | มีแค่ 1 ราคาใน PL ไม่มีโปรโมชัน`;
    } else if (group.priceTiers > 1) {
      detailedReason += ` | มี ${group.priceTiers} ราคาใน PL`;
    }
    if (group.plRemark && group.plRemark !== "-") {
      detailedReason += ` | โปร: ${group.plRemark}`;
    }

    patterns.push({
      itemCode,
      itemName: group.itemName,
      rowCount: group.rowIndices.length,
      rowIndices: group.rowIndices,
      avgDiffPercent,
      minDiffPercent,
      maxDiffPercent,
      consistency,
      patternType,
      suggestion,
      reason: detailedReason,
      diffValues: group.diffValues,
      rawAmtValues: group.rawAmtValues,
      priceTiers: group.priceTiers,
      sampleStdQty: group.sampleStdQty,
      samplePromoQty: group.samplePromoQty,
      expectedPrice: group.expectedPrice,
      plRemark: group.plRemark,
      calcAmt: group.calcAmt,
    });
  });

  // Sort by row count descending (biggest impact first)
  return patterns.sort((a, b) => b.rowCount - a.rowCount);
}

export function BulkFixSuggestionPanel({
  enrichedData,
  headers,
  confidenceThreshold,
  acceptedItemCodes,
  onBulkFix,
  onClose,
  priceHistory,
  onApplyBulkPromo,
}: BulkFixSuggestionPanelProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [selectedPromoPerItem, setSelectedPromoPerItem] = useState<
    Map<string, string>
  >(new Map());
  // undefined entry = all rows selected; Set entry = only those indices selected
  const [selectedRowsPerItem, setSelectedRowsPerItem] = useState<
    Map<string, Set<number>>
  >(new Map());
  // per-row qty overrides: key = ridx, value = { qtyBuy1, qtyPro }
  const [rowQtyEdits, setRowQtyEdits] = useState<
    Map<number, { qtyBuy1: number; qtyPro: number }>
  >(new Map());
  // per-row tier overrides for Buy1 and Pro portions separately: key = ridx, value = tier key string
  const [rowBuy1TierSelects, setRowBuy1TierSelects] = useState<
    Map<number, string>
  >(new Map());
  const [rowProTierSelects, setRowProTierSelects] = useState<
    Map<number, string>
  >(new Map());
  // confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    pattern: PatternAnalysis;
    defaultTier: PricePeriod;
    overrides: {
      ridx: number;
      qtyBuy1: number;
      qtyPro: number;
      buy1Tier: PricePeriod;
      proTier: PricePeriod;
      date: string;
      rawAmt: number;
      stdQty: number;
    }[];
  } | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [viewingPattern, setViewingPattern] = useState<PatternAnalysis | null>(
    null,
  );
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState<{
    rows: Record<string, unknown>[];
    qtyAnalysis: ReturnType<typeof analyzeQtyCombinationsSync>;
  } | null>(null);

  // Find relevant headers for displaying rows
  const qtyHeader = useMemo(
    () => headers.find((h) => h.toLowerCase() === "qty"),
    [headers],
  );
  const rawAmtHeader = useMemo(
    () =>
      headers.find(
        (h) =>
          h.toLowerCase().includes("total cost") &&
          h.toLowerCase().includes("exclusive"),
      ),
    [headers],
  );
  const invoiceDateHeader = useMemo(
    () =>
      headers.find(
        (h) =>
          h.toLowerCase().includes("invoice date") ||
          h.toLowerCase() === "date",
      ),
    [headers],
  );

  // Analyze patterns
  const patterns = useMemo(
    () => analyzePatterns(enrichedData, headers, confidenceThreshold),
    [enrichedData, headers, confidenceThreshold],
  );

  // Filter out already accepted items
  const pendingPatterns = useMemo(
    () => patterns.filter((p) => !acceptedItemCodes.has(p.itemCode)),
    [patterns, acceptedItemCodes],
  );

  const acceptedPatterns = useMemo(
    () => patterns.filter((p) => acceptedItemCodes.has(p.itemCode)),
    [patterns, acceptedItemCodes],
  );

  const totalPendingRows = pendingPatterns.reduce(
    (sum, p) => sum + p.rowCount,
    0,
  );

  // Smart Qty Analysis - try different qty combinations to find matches
  const analyzeQtyCombinationsSync = useCallback(
    (pattern: PatternAnalysis) => {
      // Get rows inline to avoid stale closure
      const rows = pattern.rowIndices
        .map((idx) => enrichedData[idx])
        .filter(Boolean);
      const expectedPriceNum = parseFloat(pattern.expectedPrice) || 0;
      if (expectedPriceNum <= 0) return [];

      const results: Array<{
        rowIdx: number;
        qty: number;
        rawAmt: number;
        suggestions: Array<{
          breakdown: string;
          stdQty: number;
          promoQty: number;
          promoDiscount: number; // percent discount from std price
          calculatedAmt: number;
          diff: number;
          diffPercent: number;
          isMatch: boolean;
        }>;
      }> = [];

      rows.forEach((row, i) => {
        const qty = parseInt(String(row[qtyHeader || ""] || "0"), 10);
        const rawAmt = Math.abs(
          parseFloat(String(row[rawAmtHeader || ""] || "0")),
        );
        if (qty <= 0 || rawAmt <= 0) return;

        const suggestions: (typeof results)[0]["suggestions"] = [];

        // Try different std+promo splits
        for (let stdQty = 0; stdQty <= qty; stdQty++) {
          const promoQty = qty - stdQty;
          // Try different promo discounts: 50%, 40%, 33%, 25%, 20%, 10%, 5%, 1฿
          const discounts = [0.5, 0.4, 0.333, 0.25, 0.2, 0.1, 0.05];

          for (const discount of discounts) {
            const promoPrice = expectedPriceNum * (1 - discount);
            const calcAmt = stdQty * expectedPriceNum + promoQty * promoPrice;
            const diff = rawAmt - calcAmt;
            const diffPercent = Math.abs(diff / rawAmt) * 100;

            if (diffPercent <= 2 && (stdQty > 0 || promoQty > 0)) {
              suggestions.push({
                breakdown:
                  promoQty > 0
                    ? `${stdQty} std + ${promoQty} promo(${(discount * 100).toFixed(0)}% off)`
                    : `${stdQty} std`,
                stdQty,
                promoQty,
                promoDiscount: discount * 100,
                calculatedAmt: calcAmt,
                diff,
                diffPercent,
                isMatch: true,
              });
            }
          }

          // Also try +1฿ promo (very common)
          if (promoQty > 0) {
            const calcAmt = stdQty * expectedPriceNum + promoQty * 0.93; // ~1฿ incl VAT ≈ 0.93 excl
            const diff = rawAmt - calcAmt;
            const diffPercent = Math.abs(diff / rawAmt) * 100;

            if (diffPercent <= 2) {
              suggestions.push({
                breakdown: `${stdQty} std + ${promoQty} promo(+1฿)`,
                stdQty,
                promoQty,
                promoDiscount: 99.9,
                calculatedAmt: calcAmt,
                diff,
                diffPercent,
                isMatch: true,
              });
            }
          }
        }

        if (suggestions.length > 0 || pattern.rowIndices.includes(i)) {
          results.push({
            rowIdx: pattern.rowIndices[i],
            qty,
            rawAmt,
            suggestions: suggestions.slice(0, 3), // Top 3 suggestions
          });
        }
      });

      return results;
    },
    [enrichedData, qtyHeader, rawAmtHeader],
  );

  // Handler to open the modal with loading state
  const openViewingModal = useCallback((pattern: PatternAnalysis) => {
    setViewingPattern(pattern);
    setIsLoadingAnalysis(true);
    setAnalysisData(null);
  }, []);

  // Handler to close the modal
  const closeViewingModal = useCallback(() => {
    setViewingPattern(null);
    setAnalysisData(null);
    setIsLoadingAnalysis(false);
  }, []);

  // Load analysis data when modal opens (only runs the async computation)
  useEffect(() => {
    if (!viewingPattern || !isLoadingAnalysis) return;

    let cancelled = false;

    // Use requestAnimationFrame + setTimeout to allow UI to render loading state first
    const rafId = requestAnimationFrame(() => {
      setTimeout(() => {
        if (cancelled) return;
        const rows = viewingPattern.rowIndices
          .map((idx) => enrichedData[idx])
          .filter(Boolean);
        const qtyAnalysis = analyzeQtyCombinationsSync(viewingPattern);
        setAnalysisData({ rows, qtyAnalysis });
        setIsLoadingAnalysis(false);
      }, 50);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [
    viewingPattern,
    isLoadingAnalysis,
    enrichedData,
    analyzeQtyCombinationsSync,
  ]);

  if (patterns.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
        <p className="text-sm">ไม่พบรูปแบบราคาที่ต้องแก้ไข</p>
      </div>
    );
  }

  const getPatternIcon = (type: PatternAnalysis["patternType"]) => {
    switch (type) {
      case "discount":
        return <TrendingDown className="h-4 w-4 text-blue-500" />;
      case "markup":
        return <TrendingUp className="h-4 w-4 text-orange-500" />;
      case "mixed":
        return <Percent className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPatternColor = (type: PatternAnalysis["patternType"]) => {
    switch (type) {
      case "discount":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "markup":
        return "bg-orange-50 border-orange-200 text-orange-700";
      case "mixed":
        return "bg-purple-50 border-purple-200 text-purple-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const getConsistencyLabel = (consistency: number) => {
    if (consistency >= 0.8)
      return { text: "สม่ำเสมอมาก", color: "text-green-600" };
    if (consistency >= 0.6) return { text: "สม่ำเสมอ", color: "text-blue-600" };
    if (consistency >= 0.4)
      return { text: "ปานกลาง", color: "text-yellow-600" };
    return { text: "ไม่สม่ำเสมอ", color: "text-red-600" };
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-amber-50">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800">
                Bulk Fix - ตรวจพบรูปแบบ
              </h3>
              <p className="text-xs text-amber-600">
                {pendingPatterns.length} สินค้า • {totalPendingRows} แถว
                รอดำเนินการ
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {/* Pending patterns */}
            {pendingPatterns.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    รอดำเนินการ
                  </span>
                  {pendingPatterns.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      onClick={() => {
                        pendingPatterns.forEach((p) => {
                          onBulkFix({
                            itemCode: p.itemCode,
                            action: "accept",
                          });
                        });
                      }}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      ยอมรับทั้งหมด ({pendingPatterns.length})
                    </Button>
                  )}
                </div>

                {pendingPatterns.map((pattern) => {
                  const isExpanded = expandedItem === pattern.itemCode;
                  const consistencyInfo = getConsistencyLabel(
                    pattern.consistency,
                  );

                  return (
                    <div
                      key={pattern.itemCode}
                      className={`border rounded-lg overflow-hidden ${getPatternColor(pattern.patternType)}`}
                    >
                      {/* Item header */}
                      <div
                        className="p-2.5 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() =>
                          setExpandedItem(isExpanded ? null : pattern.itemCode)
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getPatternIcon(pattern.patternType)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-sm">
                                  {pattern.itemCode}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {pattern.rowCount} แถว
                                </Badge>
                              </div>
                              <p className="text-xs truncate opacity-80 mt-0.5">
                                {pattern.itemName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            {/* Quick action buttons */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 w-7 p-0 ${pattern.consistency >= 0.5 ? "hover:bg-green-100" : "hover:bg-amber-100"}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onBulkFix({
                                      itemCode: pattern.itemCode,
                                      action: "accept",
                                    });
                                  }}
                                >
                                  <Check
                                    className={`h-4 w-4 ${pattern.consistency >= 0.5 ? "text-green-600" : "text-amber-600"}`}
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                ยอมรับทั้งหมด
                                {pattern.consistency < 0.5
                                  ? " (ไม่สม่ำเสมอ)"
                                  : ""}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 hover:bg-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onBulkFix({
                                      itemCode: pattern.itemCode,
                                      action: "skip",
                                    });
                                  }}
                                >
                                  <SkipForward className="h-4 w-4 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>ข้าม</TooltipContent>
                            </Tooltip>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 opacity-50" />
                            ) : (
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            )}
                          </div>
                        </div>

                        {/* Quick summary */}
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            {pattern.avgDiffPercent < 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            {pattern.avgDiffPercent < 0 ? "ต่ำกว่า" : "สูงกว่า"}{" "}
                            {Math.abs(pattern.avgDiffPercent).toFixed(1)}%
                          </span>
                          <span className={`${consistencyInfo.color}`}>
                            {consistencyInfo.text}
                          </span>
                          {pattern.patternType === "discount" && (
                            <span className="flex items-center gap-1 text-blue-600">
                              <Coins className="h-3 w-3" />
                              อาจใช้ส่วนลด
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t bg-white/50 p-3 space-y-3">
                          {/* Price Tier Info */}
                          <div className="bg-gray-50 rounded p-2 text-xs space-y-1">
                            <p className="font-medium text-gray-700 mb-1">
                              📊 ข้อมูล Price List:
                            </p>
                            <p>
                              <span className="text-gray-500">
                                จำนวน Price Tiers:
                              </span>{" "}
                              <span
                                className={
                                  pattern.priceTiers > 1
                                    ? "text-green-600 font-medium"
                                    : "text-orange-600 font-medium"
                                }
                              >
                                {pattern.priceTiers} ราคา
                              </span>
                              {pattern.priceTiers === 1 && (
                                <span className="text-orange-500 ml-2">
                                  (ไม่มีโปรโมชัน)
                                </span>
                              )}
                            </p>
                            {pattern.plRemark && pattern.plRemark !== "-" && (
                              <p>
                                <span className="text-gray-500">โปรโมชัน:</span>{" "}
                                <span className="text-purple-600">
                                  {pattern.plRemark}
                                </span>
                              </p>
                            )}
                            <p>
                              <span className="text-gray-500">
                                Expected Price:
                              </span>{" "}
                              <span className="font-mono">
                                {pattern.expectedPrice}
                              </span>
                            </p>
                          </div>

                          {/* Knapsack Result */}
                          <div className="bg-blue-50 rounded p-2 text-xs space-y-1">
                            <p className="font-medium text-blue-700 mb-1">
                              🧮 Knapsack Result (ตัวอย่าง):
                            </p>
                            <div className="flex gap-4">
                              <p>
                                <span className="text-gray-500">Std Qty:</span>{" "}
                                <span className="font-mono font-medium">
                                  {pattern.sampleStdQty}
                                </span>
                              </p>
                              <p>
                                <span className="text-gray-500">
                                  Promo Qty:
                                </span>{" "}
                                <span className="font-mono font-medium">
                                  {pattern.samplePromoQty}
                                </span>
                              </p>
                            </div>
                            <p>
                              <span className="text-gray-500">Calc Amt:</span>{" "}
                              <span className="font-mono">
                                {pattern.calcAmt}
                              </span>
                            </p>
                          </div>

                          {/* Diff Analysis */}
                          <div className="text-xs space-y-1">
                            <p>
                              <span className="font-medium">การวิเคราะห์:</span>{" "}
                              {pattern.reason}
                            </p>
                            <p>
                              <span className="font-medium">ช่วง Diff:</span>{" "}
                              {pattern.minDiffPercent.toFixed(1)}% ถึง{" "}
                              {pattern.maxDiffPercent.toFixed(1)}%
                            </p>
                            <p>
                              <span className="font-medium">ความสม่ำเสมอ:</span>{" "}
                              {(pattern.consistency * 100).toFixed(0)}%
                            </p>
                          </div>

                          {/* Explanation */}
                          {pattern.priceTiers === 1 &&
                            pattern.avgDiffPercent > 5 && (
                              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                                <p className="font-medium">
                                  ⚠️ สาเหตุที่เป็นไปได้:
                                </p>
                                <ul className="list-disc list-inside mt-1 space-y-0.5">
                                  <li>ลูกค้าใช้ Coin/ส่วนลด Watson Member</li>
                                  <li>
                                    โปรโมชันพิเศษที่ยังไม่ได้ Import เข้า PL
                                  </li>
                                  <li>ส่วนลดพนักงาน หรือ โค้ดส่วนลด</li>
                                </ul>
                              </div>
                            )}

                          {/* Bulk Promo Override */}
                          {priceHistory &&
                            onApplyBulkPromo &&
                            (() => {
                              const itemHistory = priceHistory.find(
                                (h) => h.itemCode === pattern.itemCode,
                              );
                              const allPeriods = itemHistory?.periods ?? [];
                              const seen = new Set<string>();
                              const uniqueTiers = allPeriods
                                .filter((p) => {
                                  const k = `${Number(p.priceExtVat).toFixed(4)}|${p.remark ?? ""}`;
                                  if (seen.has(k)) return false;
                                  seen.add(k);
                                  return true;
                                })
                                .sort((a, b) => b.priceExtVat - a.priceExtVat);
                              if (uniqueTiers.length < 2) return null;
                              const selectedKey = selectedPromoPerItem.get(
                                pattern.itemCode,
                              );
                              return (
                                <div className="bg-purple-50 border border-purple-200 rounded p-2 text-xs">
                                  <p className="font-medium text-purple-700 mb-2 flex items-center gap-1">
                                    <Tag className="h-3.5 w-3.5" />
                                    เลือกโปร
                                  </p>
                                  {/* Row selector */}
                                  {(() => {
                                    const selRows = selectedRowsPerItem.get(
                                      pattern.itemCode,
                                    );
                                    const allChecked =
                                      !selRows ||
                                      selRows.size ===
                                        pattern.rowIndices.length;
                                    const noneChecked =
                                      selRows !== undefined &&
                                      selRows.size === 0;
                                    const toggleAll = () =>
                                      setSelectedRowsPerItem((prev) => {
                                        const next = new Map(prev);
                                        if (allChecked) {
                                          // currently all selected → uncheck all
                                          next.set(pattern.itemCode, new Set());
                                        } else {
                                          // partial or none → check all
                                          next.set(
                                            pattern.itemCode,
                                            new Set(pattern.rowIndices),
                                          );
                                        }
                                        return next;
                                      });
                                    const toggleRow = (ridx: number) =>
                                      setSelectedRowsPerItem((prev) => {
                                        const next = new Map(prev);
                                        const current = new Set(
                                          next.get(pattern.itemCode) ??
                                            pattern.rowIndices,
                                        );
                                        if (current.has(ridx))
                                          current.delete(ridx);
                                        else current.add(ridx);
                                        next.set(pattern.itemCode, current);
                                        return next;
                                      });
                                    return (
                                      <div className="mb-2">
                                        <div className="flex items-center justify-between mb-1">
                                          <label className="flex items-center gap-1 cursor-pointer font-medium text-purple-700">
                                            <input
                                              type="checkbox"
                                              checked={allChecked}
                                              ref={(el) => {
                                                if (el)
                                                  el.indeterminate =
                                                    !allChecked && !noneChecked;
                                              }}
                                              onChange={toggleAll}
                                              className="accent-purple-600"
                                            />
                                            เลือกแถวที่จะปรับ
                                          </label>
                                          <span className="text-purple-500">
                                            {selRows
                                              ? selRows.size
                                              : pattern.rowIndices.length}
                                            /{pattern.rowIndices.length} แถว
                                          </span>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto border border-purple-100 rounded bg-white divide-y divide-purple-50">
                                          {pattern.rowIndices.map((ridx) => {
                                            const row = enrichedData[ridx] as
                                              | Record<string, unknown>
                                              | undefined;
                                            const isChecked =
                                              !selRows || selRows.has(ridx);
                                            const date =
                                              invoiceDateHeader && row
                                                ? String(
                                                    row[invoiceDateHeader] ??
                                                      "-",
                                                  )
                                                : "-";
                                            const rawAmt =
                                              rawAmtHeader && row
                                                ? Math.abs(
                                                    Number(row[rawAmtHeader]) ||
                                                      0,
                                                  )
                                                : 0;
                                            const diff = row
                                              ? String(row["Diff"] ?? "-")
                                              : "-";
                                            const diffBad = diff.includes("⚠");
                                            const stdQty =
                                              qtyHeader && row
                                                ? Math.abs(
                                                    Number(row[qtyHeader]) || 0,
                                                  )
                                                : 0;
                                            const origBuy1 = row
                                              ? Number(row["QtyBuy1"] ?? 0)
                                              : 0;
                                            const origPro = row
                                              ? Number(row["QtyPro"] ?? 0)
                                              : 0;
                                            const edited =
                                              rowQtyEdits.get(ridx);
                                            const editBuy1 =
                                              edited?.qtyBuy1 ?? origBuy1;
                                            const editPro =
                                              edited?.qtyPro ?? origPro;
                                            const actualRowNum = row
                                              ? Number(
                                                  (
                                                    row as Record<
                                                      string,
                                                      unknown
                                                    >
                                                  )["_originalIdx"] ?? 0,
                                                ) + 1
                                              : ridx + 1;
                                            return (
                                              <div
                                                key={ridx}
                                                className={`px-2 py-2 transition-colors ${isChecked ? "bg-white" : "bg-gray-50 opacity-50"}`}
                                              >
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() =>
                                                      toggleRow(ridx)
                                                    }
                                                    className="accent-purple-600 shrink-0 w-3.5 h-3.5"
                                                  />
                                                  <span className="text-xs font-mono text-gray-400 shrink-0 w-12">
                                                    แถว {actualRowNum}
                                                  </span>
                                                  <span className="text-xs text-gray-600 shrink-0 w-20">
                                                    {date}
                                                  </span>
                                                  <span className="text-xs text-gray-500 shrink-0">
                                                    รวม×{stdQty}
                                                  </span>
                                                  <span className="text-xs font-mono text-gray-700 shrink-0 ml-auto">
                                                    ฿{rawAmt.toFixed(2)}
                                                  </span>
                                                  <span
                                                    className={`text-xs font-mono shrink-0 w-16 text-right ${diffBad ? "text-red-500" : "text-green-600"}`}
                                                  >
                                                    {diff}
                                                  </span>
                                                </div>
                                                {isChecked &&
                                                  (() => {
                                                    // helpers scoped to this row
                                                    const txDate = (() => {
                                                      try {
                                                        const d = new Date(
                                                          date,
                                                        );
                                                        return isNaN(
                                                          d.getTime(),
                                                        )
                                                          ? null
                                                          : d;
                                                      } catch {
                                                        return null;
                                                      }
                                                    })();
                                                    const fmtShort = (
                                                      d: Date | null,
                                                    ) =>
                                                      d
                                                        ? d.toLocaleDateString(
                                                            "th-TH",
                                                            {
                                                              day: "numeric",
                                                              month: "short",
                                                              year: "2-digit",
                                                            },
                                                          )
                                                        : "ปัจจุบัน";
                                                    const outOfRange = (
                                                      t: PricePeriod,
                                                    ) => {
                                                      if (!txDate) return false;
                                                      const tooEarly =
                                                        txDate < t.startDate;
                                                      const tooLate =
                                                        t.endDate !== null &&
                                                        txDate > t.endDate;
                                                      return (
                                                        tooEarly || tooLate
                                                      );
                                                    };
                                                    const resolveTier = (
                                                      selects: Map<
                                                        number,
                                                        string
                                                      >,
                                                    ) => {
                                                      const key =
                                                        selects.get(ridx) ??
                                                        selectedKey;
                                                      return key
                                                        ? (uniqueTiers.find(
                                                            (t) =>
                                                              `${Number(t.priceExtVat).toFixed(4)}|${t.remark ?? ""}` ===
                                                              key,
                                                          ) ?? null)
                                                        : null;
                                                    };

                                                    const makeTierBtns = (
                                                      selects: Map<
                                                        number,
                                                        string
                                                      >,
                                                      setSelects: React.Dispatch<
                                                        React.SetStateAction<
                                                          Map<number, string>
                                                        >
                                                      >,
                                                      color:
                                                        | "purple"
                                                        | "indigo",
                                                    ) =>
                                                      uniqueTiers
                                                        .filter(
                                                          (t) => !outOfRange(t),
                                                        )
                                                        .map((t) => {
                                                          const tKey = `${Number(t.priceExtVat).toFixed(4)}|${t.remark ?? ""}`;
                                                          const rowKey =
                                                            selects.get(ridx);
                                                          const isActive =
                                                            rowKey === tKey;
                                                          const isDefault =
                                                            !rowKey &&
                                                            tKey ===
                                                              selectedKey;
                                                          const activeCls =
                                                            color === "purple"
                                                              ? "bg-purple-600 text-white border-purple-600"
                                                              : "bg-indigo-600 text-white border-indigo-600";
                                                          const defaultCls =
                                                            color === "purple"
                                                              ? "bg-purple-100 text-purple-700 border-purple-300"
                                                              : "bg-indigo-100 text-indigo-700 border-indigo-300";
                                                          return (
                                                            <button
                                                              key={tKey}
                                                              title={`฿${t.priceIncVat.toFixed(2)} IncV\n${fmtShort(t.startDate)} → ${fmtShort(t.endDate)}`}
                                                              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex flex-col items-start leading-tight max-w-28 ${
                                                                isActive
                                                                  ? activeCls
                                                                  : isDefault
                                                                    ? defaultCls
                                                                    : "bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600"
                                                              }`}
                                                              onClick={() =>
                                                                setSelects(
                                                                  (prev) => {
                                                                    const next =
                                                                      new Map(
                                                                        prev,
                                                                      );
                                                                    if (
                                                                      isActive
                                                                    )
                                                                      next.delete(
                                                                        ridx,
                                                                      );
                                                                    else
                                                                      next.set(
                                                                        ridx,
                                                                        tKey,
                                                                      );
                                                                    return next;
                                                                  },
                                                                )
                                                              }
                                                            >
                                                              <span className="truncate w-full">
                                                                {t.remark ??
                                                                  "std"}{" "}
                                                                {isActive
                                                                  ? "●"
                                                                  : isDefault
                                                                    ? "✓"
                                                                    : ""}
                                                              </span>
                                                              <span
                                                                className={`font-mono ${isActive || isDefault ? "opacity-80" : "opacity-60"}`}
                                                              >
                                                                ฿
                                                                {t.priceIncVat.toFixed(
                                                                  2,
                                                                )}
                                                              </span>
                                                            </button>
                                                          );
                                                        });

                                                    const buy1Tier =
                                                      resolveTier(
                                                        rowBuy1TierSelects,
                                                      );
                                                    const proTier =
                                                      resolveTier(
                                                        rowProTierSelects,
                                                      );
                                                    const buy1Oor = buy1Tier
                                                      ? outOfRange(buy1Tier)
                                                      : false;
                                                    const proOor = proTier
                                                      ? outOfRange(proTier)
                                                      : false;

                                                    return (
                                                      <>
                                                        {/* Buy1 row: stepper + tier picker */}
                                                        <div className="flex items-center gap-1.5 mt-1.5 ml-5 pl-1 flex-wrap">
                                                          <span className="text-[11px] text-purple-600 font-medium shrink-0 w-8">
                                                            Buy1:
                                                          </span>
                                                          <button
                                                            className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-xs font-bold hover:bg-purple-200 flex items-center justify-center"
                                                            onClick={() =>
                                                              setRowQtyEdits(
                                                                (p) => {
                                                                  const n =
                                                                    new Map(p);
                                                                  const cur =
                                                                    n.get(
                                                                      ridx,
                                                                    ) ?? {
                                                                      qtyBuy1:
                                                                        origBuy1,
                                                                      qtyPro:
                                                                        origPro,
                                                                    };
                                                                  const b =
                                                                    Math.max(
                                                                      0,
                                                                      cur.qtyBuy1 -
                                                                        1,
                                                                    );
                                                                  n.set(ridx, {
                                                                    qtyBuy1: b,
                                                                    qtyPro:
                                                                      stdQty -
                                                                      b,
                                                                  });
                                                                  return n;
                                                                },
                                                              )
                                                            }
                                                          >
                                                            -
                                                          </button>
                                                          <span className="text-xs font-mono w-5 text-center font-semibold">
                                                            {editBuy1}
                                                          </span>
                                                          <button
                                                            className="w-5 h-5 rounded bg-purple-100 text-purple-700 text-xs font-bold hover:bg-purple-200 flex items-center justify-center"
                                                            onClick={() =>
                                                              setRowQtyEdits(
                                                                (p) => {
                                                                  const n =
                                                                    new Map(p);
                                                                  const cur =
                                                                    n.get(
                                                                      ridx,
                                                                    ) ?? {
                                                                      qtyBuy1:
                                                                        origBuy1,
                                                                      qtyPro:
                                                                        origPro,
                                                                    };
                                                                  const b =
                                                                    Math.min(
                                                                      stdQty,
                                                                      cur.qtyBuy1 +
                                                                        1,
                                                                    );
                                                                  n.set(ridx, {
                                                                    qtyBuy1: b,
                                                                    qtyPro:
                                                                      stdQty -
                                                                      b,
                                                                  });
                                                                  return n;
                                                                },
                                                              )
                                                            }
                                                          >
                                                            +
                                                          </button>
                                                          <span className="text-[10px] text-gray-400 shrink-0 ml-1">
                                                            ราคา:
                                                          </span>
                                                          {makeTierBtns(
                                                            rowBuy1TierSelects,
                                                            setRowBuy1TierSelects,
                                                            "purple",
                                                          )}
                                                        </div>
                                                        {buy1Tier &&
                                                          !buy1Oor && (
                                                            <div className="ml-14 mt-0.5 text-[10px] flex items-center gap-1 text-gray-400">
                                                              <span>
                                                                {fmtShort(
                                                                  buy1Tier.startDate,
                                                                )}{" "}
                                                                →{" "}
                                                                {fmtShort(
                                                                  buy1Tier.endDate,
                                                                )}
                                                              </span>
                                                            </div>
                                                          )}
                                                        {/* Pro row: stepper + tier picker */}
                                                        <div className="flex items-center gap-1.5 mt-1 ml-5 pl-1 flex-wrap">
                                                          <span className="text-[11px] text-indigo-600 font-medium shrink-0 w-8">
                                                            Pro:
                                                          </span>
                                                          <button
                                                            className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 text-xs font-bold hover:bg-indigo-200 flex items-center justify-center"
                                                            onClick={() =>
                                                              setRowQtyEdits(
                                                                (p) => {
                                                                  const n =
                                                                    new Map(p);
                                                                  const cur =
                                                                    n.get(
                                                                      ridx,
                                                                    ) ?? {
                                                                      qtyBuy1:
                                                                        origBuy1,
                                                                      qtyPro:
                                                                        origPro,
                                                                    };
                                                                  const pro =
                                                                    Math.max(
                                                                      0,
                                                                      cur.qtyPro -
                                                                        1,
                                                                    );
                                                                  n.set(ridx, {
                                                                    qtyBuy1:
                                                                      stdQty -
                                                                      pro,
                                                                    qtyPro: pro,
                                                                  });
                                                                  return n;
                                                                },
                                                              )
                                                            }
                                                          >
                                                            -
                                                          </button>
                                                          <span className="text-xs font-mono w-5 text-center font-semibold">
                                                            {editPro}
                                                          </span>
                                                          <button
                                                            className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 text-xs font-bold hover:bg-indigo-200 flex items-center justify-center"
                                                            onClick={() =>
                                                              setRowQtyEdits(
                                                                (p) => {
                                                                  const n =
                                                                    new Map(p);
                                                                  const cur =
                                                                    n.get(
                                                                      ridx,
                                                                    ) ?? {
                                                                      qtyBuy1:
                                                                        origBuy1,
                                                                      qtyPro:
                                                                        origPro,
                                                                    };
                                                                  const pro =
                                                                    Math.min(
                                                                      stdQty,
                                                                      cur.qtyPro +
                                                                        1,
                                                                    );
                                                                  n.set(ridx, {
                                                                    qtyBuy1:
                                                                      stdQty -
                                                                      pro,
                                                                    qtyPro: pro,
                                                                  });
                                                                  return n;
                                                                },
                                                              )
                                                            }
                                                          >
                                                            +
                                                          </button>
                                                          <span className="text-[10px] text-gray-400 shrink-0 ml-1">
                                                            ราคา:
                                                          </span>
                                                          {makeTierBtns(
                                                            rowProTierSelects,
                                                            setRowProTierSelects,
                                                            "indigo",
                                                          )}
                                                          {editBuy1 +
                                                            editPro !==
                                                            stdQty && (
                                                            <span className="text-[10px] text-red-500 ml-1">
                                                              รวม ≠ {stdQty}
                                                            </span>
                                                          )}
                                                        </div>
                                                        {proTier && !proOor && (
                                                          <div className="ml-14 mt-0.5 text-[10px] flex items-center gap-1 text-gray-400">
                                                            <span>
                                                              {fmtShort(
                                                                proTier.startDate,
                                                              )}{" "}
                                                              →{" "}
                                                              {fmtShort(
                                                                proTier.endDate,
                                                              )}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </>
                                                    );
                                                  })()}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  <div className="space-y-1">
                                    {uniqueTiers
                                      .filter((tier) =>
                                        // only show tiers where at least one transaction row falls within the period
                                        pattern.rowIndices.some((ridx) => {
                                          const r = enrichedData[ridx] as
                                            | Record<string, unknown>
                                            | undefined;
                                          const ds =
                                            invoiceDateHeader && r
                                              ? String(
                                                  r[invoiceDateHeader] ?? "",
                                                )
                                              : "";
                                          try {
                                            const d = new Date(ds);
                                            if (isNaN(d.getTime())) return true;
                                            return (
                                              d >= tier.startDate &&
                                              (tier.endDate === null ||
                                                d <= tier.endDate)
                                            );
                                          } catch {
                                            return true;
                                          }
                                        }),
                                      )
                                      .map((tier) => {
                                        const key = `${Number(tier.priceExtVat).toFixed(4)}|${tier.remark ?? ""}`;
                                        const isSelected = selectedKey === key;
                                        return (
                                          <button
                                            key={key}
                                            className={`w-full text-left px-2 py-1.5 rounded border flex items-center justify-between transition-colors ${
                                              isSelected
                                                ? "bg-purple-600 text-white border-purple-600"
                                                : "bg-white border-purple-200 text-gray-700 hover:border-purple-400"
                                            }`}
                                            onClick={() =>
                                              setSelectedPromoPerItem(
                                                (prev) => {
                                                  const next = new Map(prev);
                                                  if (isSelected)
                                                    next.delete(
                                                      pattern.itemCode,
                                                    );
                                                  else
                                                    next.set(
                                                      pattern.itemCode,
                                                      key,
                                                    );
                                                  return next;
                                                },
                                              )
                                            }
                                          >
                                            <span className="flex flex-col gap-0.5">
                                              <span>
                                                {tier.remark ??
                                                  "Std (ราคาปกติ)"}
                                              </span>
                                              <span
                                                className={`text-[10px] ${isSelected ? "text-purple-100" : "text-gray-400"}`}
                                              >
                                                {tier.startDate.toLocaleDateString(
                                                  "th-TH",
                                                  {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "2-digit",
                                                  },
                                                )}
                                                {" → "}
                                                {tier.endDate
                                                  ? tier.endDate.toLocaleDateString(
                                                      "th-TH",
                                                      {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "2-digit",
                                                      },
                                                    )
                                                  : "ปัจจุบัน"}
                                              </span>
                                            </span>
                                            <span className="font-mono ml-2 shrink-0 text-right">
                                              <span className="block">
                                                ฿{tier.priceIncVat.toFixed(2)}
                                              </span>
                                              <span
                                                className={`block text-[10px] ${isSelected ? "text-purple-200" : "text-gray-400"}`}
                                              >
                                                ExcV ฿
                                                {tier.priceExtVat.toFixed(2)}
                                              </span>
                                            </span>
                                          </button>
                                        );
                                      })}
                                  </div>
                                  {(selectedKey ||
                                    pattern.rowIndices.some(
                                      (r) =>
                                        rowBuy1TierSelects.has(r) ||
                                        rowProTierSelects.has(r),
                                    )) &&
                                    (() => {
                                      const selRows = selectedRowsPerItem.get(
                                        pattern.itemCode,
                                      );
                                      const rowsToApply =
                                        selRows && selRows.size > 0
                                          ? pattern.rowIndices.filter((r) =>
                                              selRows.has(r),
                                            )
                                          : pattern.rowIndices;
                                      // defaultTier: from item-level selectedKey, or fall back to first unique tier
                                      const defaultTier =
                                        (selectedKey
                                          ? uniqueTiers.find(
                                              (t) =>
                                                `${Number(t.priceExtVat).toFixed(4)}|${t.remark ?? ""}` ===
                                                selectedKey,
                                            )
                                          : undefined) ?? uniqueTiers[0];
                                      const hasInvalidQty = rowsToApply.some(
                                        (ridx) => {
                                          const row = enrichedData[ridx] as
                                            | Record<string, unknown>
                                            | undefined;
                                          const stdQty =
                                            qtyHeader && row
                                              ? Math.abs(
                                                  Number(row[qtyHeader]) || 0,
                                                )
                                              : 0;
                                          const edit = rowQtyEdits.get(ridx);
                                          const b1 =
                                            edit?.qtyBuy1 ??
                                            Number(row?.["QtyBuy1"] ?? 0);
                                          const pro =
                                            edit?.qtyPro ??
                                            Number(row?.["QtyPro"] ?? 0);
                                          return b1 + pro !== stdQty;
                                        },
                                      );
                                      return (
                                        <Button
                                          size="sm"
                                          disabled={
                                            rowsToApply.length === 0 ||
                                            hasInvalidQty
                                          }
                                          className="w-full mt-2 h-8 bg-purple-600 hover:bg-purple-700 text-xs disabled:opacity-50"
                                          onClick={() => {
                                            if (!defaultTier) return;
                                            const overrides = rowsToApply.map(
                                              (ridx) => {
                                                const row = enrichedData[
                                                  ridx
                                                ] as
                                                  | Record<string, unknown>
                                                  | undefined;
                                                const stdQty =
                                                  qtyHeader && row
                                                    ? Math.abs(
                                                        Number(
                                                          row[qtyHeader],
                                                        ) || 0,
                                                      )
                                                    : 0;
                                                const edit =
                                                  rowQtyEdits.get(ridx);
                                                const b1 =
                                                  edit?.qtyBuy1 ??
                                                  Number(row?.["QtyBuy1"] ?? 0);
                                                const pro =
                                                  edit?.qtyPro ??
                                                  Number(row?.["QtyPro"] ?? 0);
                                                const date =
                                                  invoiceDateHeader && row
                                                    ? String(
                                                        row[
                                                          invoiceDateHeader
                                                        ] ?? "-",
                                                      )
                                                    : "-";
                                                const rawAmt =
                                                  rawAmtHeader && row
                                                    ? Math.abs(
                                                        Number(
                                                          row[rawAmtHeader],
                                                        ) || 0,
                                                      )
                                                    : 0;
                                                // resolve effective tiers per portion: row override → item-level default
                                                const resolveTier = (
                                                  key: string | undefined,
                                                ) =>
                                                  key
                                                    ? (uniqueTiers.find(
                                                        (t) =>
                                                          `${Number(t.priceExtVat).toFixed(4)}|${t.remark ?? ""}` ===
                                                          key,
                                                      ) ?? defaultTier)
                                                    : defaultTier;
                                                const effectiveBuy1Tier =
                                                  resolveTier(
                                                    rowBuy1TierSelects.get(
                                                      ridx,
                                                    ),
                                                  );
                                                const effectiveProTier =
                                                  resolveTier(
                                                    rowProTierSelects.get(ridx),
                                                  );
                                                return {
                                                  ridx,
                                                  qtyBuy1: b1,
                                                  qtyPro: pro,
                                                  buy1Tier: effectiveBuy1Tier,
                                                  proTier: effectiveProTier,
                                                  date,
                                                  rawAmt,
                                                  stdQty,
                                                };
                                              },
                                            );
                                            setConfirmState({
                                              pattern,
                                              defaultTier,
                                              overrides,
                                            });
                                          }}
                                        >
                                          <Check className="h-3 w-3 mr-1" />
                                          สรุปการเปลี่ยนแปลง{" "}
                                          {rowsToApply.length} แถว
                                          {hasInvalidQty && (
                                            <span className="ml-1 text-red-200">
                                              ⚠ qty ไม่ตรง
                                            </span>
                                          )}
                                        </Button>
                                      );
                                    })()}
                                </div>
                              );
                            })()}

                          {/* Action buttons - always show */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                openViewingModal(pattern);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              ดูแถว
                            </Button>
                            <Button
                              size="sm"
                              className={`flex-1 h-8 ${
                                pattern.consistency >= 0.5
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-amber-500 hover:bg-amber-600"
                              }`}
                              onClick={() =>
                                onBulkFix({
                                  itemCode: pattern.itemCode,
                                  action: "accept",
                                })
                              }
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              ยอมรับทั้ง {pattern.rowCount} แถว
                              {pattern.consistency < 0.5 && (
                                <span className="ml-1 text-[10px] opacity-75">
                                  (⚠️)
                                </span>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() =>
                                onBulkFix({
                                  itemCode: pattern.itemCode,
                                  action: "skip",
                                })
                              }
                            >
                              ข้าม
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Accepted patterns */}
            {acceptedPatterns.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-medium text-gray-500 uppercase">
                  ยอมรับแล้ว ({acceptedPatterns.length})
                </span>
                {acceptedPatterns.map((pattern) => (
                  <div
                    key={pattern.itemCode}
                    className="flex items-center justify-between p-2 border rounded-lg bg-green-50 border-green-200"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-mono text-sm">
                        {pattern.itemCode}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-green-100"
                      >
                        {pattern.rowCount} แถว
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-gray-500"
                      onClick={() =>
                        onBulkFix({
                          itemCode: pattern.itemCode,
                          action: "skip",
                        })
                      }
                    >
                      ยกเลิก
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer summary */}
        {acceptedPatterns.length > 0 && (
          <div className="border-t p-3 bg-green-50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-700">
                <CheckCircle2 className="h-4 w-4 inline mr-1" />
                ยอมรับแล้ว{" "}
                {acceptedPatterns.reduce((s, p) => s + p.rowCount, 0)} แถว
              </span>
            </div>
          </div>
        )}
      </div>

      {/* View Rows Modal - Full Screen */}
      <Dialog
        open={viewingPattern !== null}
        onOpenChange={(open) => !open && closeViewingModal()}
      >
        <DialogContent className="w-[95vw]! max-w-[95vw]! h-[90vh]! max-h-[90vh]! overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              <span>วิเคราะห์แถว: {viewingPattern?.itemCode}</span>
              <Badge variant="outline" className="ml-2">
                {viewingPattern?.rowCount} แถว
              </Badge>
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {viewingPattern?.itemName}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {viewingPattern && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 rounded p-3 text-center">
                    <p className="text-xs text-gray-500">Expected Price</p>
                    <p className="font-mono font-medium text-lg">
                      {viewingPattern.expectedPrice}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-3 text-center">
                    <p className="text-xs text-gray-500">Avg Diff</p>
                    <p
                      className={`font-mono font-medium text-lg ${viewingPattern.avgDiffPercent > 0 ? "text-orange-600" : "text-blue-600"}`}
                    >
                      {viewingPattern.avgDiffPercent > 0 ? "+" : ""}
                      {viewingPattern.avgDiffPercent.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-3 text-center">
                    <p className="text-xs text-gray-500">Price Tiers</p>
                    <p className="font-mono font-medium text-lg">
                      {viewingPattern.priceTiers}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-3 text-center">
                    <p className="text-xs text-gray-500">Consistency</p>
                    <p className="font-mono font-medium text-lg">
                      {(viewingPattern.consistency * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Loading State */}
                {isLoadingAnalysis && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      <span className="text-gray-600">
                        กำลังวิเคราะห์ {viewingPattern.rowCount} แถว...
                      </span>
                    </div>
                    {/* Skeleton Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-3 py-3 flex gap-4">
                        {[
                          "แถว",
                          "วันที่",
                          "Qty",
                          "Raw Amt",
                          "Calc Amt",
                          "Diff",
                          "Qty Analysis",
                        ].map((h) => (
                          <div
                            key={h}
                            className="h-4 bg-gray-200 rounded w-20 animate-pulse"
                          />
                        ))}
                      </div>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="border-t px-3 py-3 flex gap-4">
                          <div className="h-4 bg-gray-100 rounded w-12 animate-pulse" />
                          <div className="h-4 bg-gray-100 rounded w-24 animate-pulse" />
                          <div className="h-4 bg-gray-100 rounded w-10 animate-pulse" />
                          <div className="h-4 bg-gray-100 rounded w-20 animate-pulse" />
                          <div className="h-4 bg-gray-100 rounded w-20 animate-pulse" />
                          <div className="h-4 bg-gray-100 rounded w-16 animate-pulse" />
                          <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loaded Content */}
                {!isLoadingAnalysis && analysisData && (
                  <>
                    {/* Rows Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                              แถว
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                              วันที่
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                              Raw Amt
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                              Calc Amt
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                              Diff
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                              Qty Analysis
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {analysisData.rows.map((row, idx) => {
                            const rowIdx = viewingPattern.rowIndices[idx];
                            const qty = parseInt(
                              String(row[qtyHeader || ""] || "0"),
                              10,
                            );
                            const rawAmt = Math.abs(
                              parseFloat(
                                String(row[rawAmtHeader || ""] || "0"),
                              ),
                            );
                            const calcAmt = String(row["Calc Amt"] || "-");
                            const diff = String(row["Diff"] || "-");
                            const invoiceDate = String(
                              row[invoiceDateHeader || ""] || "-",
                            );
                            const analysis = analysisData.qtyAnalysis.find(
                              (a) => a.rowIdx === rowIdx,
                            );

                            return (
                              <tr key={rowIdx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-xs text-gray-500">
                                  #{rowIdx + 1}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {invoiceDate}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {qty}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {rawAmt.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {calcAmt}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span
                                    className={`font-mono ${diff.includes("⬆️") ? "text-orange-600" : diff.includes("⬇️") ? "text-blue-600" : "text-green-600"}`}
                                  >
                                    {diff}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {analysis &&
                                  analysis.suggestions.length > 0 ? (
                                    <div className="space-y-1">
                                      {analysis.suggestions.map((s, si) => (
                                        <div
                                          key={si}
                                          className="flex items-center gap-2"
                                        >
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] bg-green-50 border-green-200 text-green-700"
                                          >
                                            ✓ {s.breakdown}
                                          </Badge>
                                          <span className="text-[10px] text-gray-500">
                                            = {s.calculatedAmt.toFixed(2)} (diff{" "}
                                            {s.diffPercent.toFixed(1)}%)
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      ไม่พบรูปแบบ
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Smart Analysis Summary */}
                    {(() => {
                      const matchedRows = analysisData.qtyAnalysis.filter(
                        (a) => a.suggestions.length > 0,
                      );

                      if (matchedRows.length > 0) {
                        // Find most common suggestion pattern
                        const patternCounts = new Map<string, number>();
                        matchedRows.forEach((row) => {
                          row.suggestions.forEach((s) => {
                            const key = s.breakdown;
                            patternCounts.set(
                              key,
                              (patternCounts.get(key) || 0) + 1,
                            );
                          });
                        });
                        const sortedPatterns = Array.from(
                          patternCounts.entries(),
                        ).sort((a, b) => b[1] - a[1]);

                        return (
                          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="font-medium text-green-800 mb-2 text-lg">
                              <Calculator className="h-5 w-5 inline mr-2" />
                              พบรูปแบบที่เป็นไปได้ ({matchedRows.length}/
                              {viewingPattern.rowCount} แถว)
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {sortedPatterns
                                .slice(0, 8)
                                .map(([pattern, count]) => (
                                  <div
                                    key={pattern}
                                    className="flex items-center gap-2 text-sm bg-white rounded px-2 py-1"
                                  >
                                    <Badge className="bg-green-600">
                                      {count} แถว
                                    </Badge>
                                    <span className="truncate">{pattern}</span>
                                  </div>
                                ))}
                            </div>
                            <p className="text-sm text-green-600 mt-3">
                              💡 สินค้านี้อาจมีโปรโมชันที่ยังไม่ได้ Import เข้า
                              Price List
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => closeViewingModal()}>
              ปิด
            </Button>
            {viewingPattern && (
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  onBulkFix({
                    itemCode: viewingPattern.itemCode,
                    action: "accept",
                  });
                  closeViewingModal();
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                ยอมรับทั้ง {viewingPattern.rowCount} แถว
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm bulk promo apply dialog */}
      <Dialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open && !isApplying) setConfirmState(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-purple-700 flex items-center gap-2">
              <Tag className="h-5 w-5" />
              ยืนยันการใช้โปรโมชัน
            </DialogTitle>
            <DialogDescription>
              ตรวจสอบรายละเอียดก่อนยืนยัน — ระบบจะคำนวณ Calc Amt / Diff /
              Confidence ใหม่
            </DialogDescription>
          </DialogHeader>

          {confirmState &&
            (() => {
              const { pattern, defaultTier, overrides } = confirmState;
              const fmtDate = (d: string | undefined) => {
                if (!d) return "-";
                try {
                  return new Date(d).toLocaleDateString("th-TH", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  });
                } catch {
                  return d;
                }
              };
              const totalB1 = overrides.reduce((s, o) => s + o.qtyBuy1, 0);
              const totalPro = overrides.reduce((s, o) => s + o.qtyPro, 0);
              const hasMultipleTiers =
                new Set(
                  overrides.map(
                    (o) =>
                      `${o.buy1Tier.priceExtVat}|${o.buy1Tier.remark ?? ""}|${o.proTier.priceExtVat}|${o.proTier.remark ?? ""}`,
                  ),
                ).size > 1;
              return (
                <>
                  {/* Tier summary */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                    <div className="font-semibold text-purple-800 mb-1">
                      {pattern.itemCode} — {pattern.itemName ?? ""}
                    </div>
                    {hasMultipleTiers ? (
                      <p className="text-purple-600 text-xs">
                        ⚠ แต่ละแถวใช้โปรต่างกัน — ดูรายละเอียดในตารางด้านล่าง
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-4 text-purple-700">
                        <span>
                          โปร:{" "}
                          <strong>{defaultTier.remark ?? "(ไม่มีชื่อ)"}</strong>
                        </span>
                        <span>
                          ราคา (รวม VAT):{" "}
                          <strong>
                            {Number(
                              defaultTier.priceIncVat ??
                                defaultTier.priceExtVat,
                            ).toFixed(2)}
                          </strong>
                        </span>
                        <span>
                          ราคา (ไม่รวม VAT):{" "}
                          <strong>
                            {Number(defaultTier.priceExtVat).toFixed(2)}
                          </strong>
                        </span>
                        {defaultTier.startDate && (
                          <span>
                            ช่วงเวลา:{" "}
                            {fmtDate(defaultTier.startDate.toISOString())} –{" "}
                            {fmtDate(defaultTier.endDate?.toISOString())}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rows table */}
                  <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg mt-2">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">
                            แถว
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">
                            วันที่
                          </th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">
                            รวม
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-purple-600">
                            Buy1 qty × ราคา
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-indigo-600">
                            Pro qty × ราคา
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">
                            Calc ExcV
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {overrides.map((o) => {
                          const rowData = enrichedData[o.ridx] as
                            | Record<string, unknown>
                            | undefined;
                          const actualRowNum = rowData
                            ? Number(rowData["_originalIdx"] ?? 0) + 1
                            : o.ridx + 1;
                          const buy1PriceExcV = Number(o.buy1Tier.priceExtVat);
                          const proPriceExcV = Number(o.proTier.priceExtVat);
                          const calcAmt =
                            o.qtyBuy1 > 0
                              ? (o.rawAmt - o.qtyPro * proPriceExcV) / o.qtyBuy1
                              : 0;
                          const buy1Diff =
                            `${o.buy1Tier.priceExtVat}|${o.buy1Tier.remark ?? ""}` !==
                            `${defaultTier.priceExtVat}|${defaultTier.remark ?? ""}`;
                          const proDiff =
                            `${o.proTier.priceExtVat}|${o.proTier.remark ?? ""}` !==
                            `${defaultTier.priceExtVat}|${defaultTier.remark ?? ""}`;
                          return (
                            <tr key={o.ridx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono text-gray-700">
                                แถว {actualRowNum}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {fmtDate(o.date)}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-500 text-[11px]">
                                {o.stdQty}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`text-xs font-semibold ${buy1Diff ? "text-orange-600" : "text-purple-700"}`}
                                >
                                  {o.qtyBuy1} × ฿{buy1PriceExcV.toFixed(2)}
                                </span>
                                <span className="block text-[10px] text-gray-400">
                                  {o.buy1Tier.remark ?? "std"}
                                  {buy1Diff ? " ●" : ""}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`text-xs font-semibold ${proDiff ? "text-orange-600" : "text-indigo-700"}`}
                                >
                                  {o.qtyPro} × ฿{proPriceExcV.toFixed(2)}
                                </span>
                                <span className="block text-[10px] text-gray-400">
                                  {o.proTier.remark ?? "std"}
                                  {proDiff ? " ●" : ""}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700">
                                {calcAmt.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-purple-50">
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-2 text-xs font-medium text-purple-700"
                          >
                            รวม {overrides.length} แถว
                          </td>
                          <td className="px-3 py-2 text-purple-700 font-bold text-xs">
                            {totalB1} pcs
                          </td>
                          <td className="px-3 py-2 text-indigo-700 font-bold text-xs">
                            {totalPro} pcs
                          </td>
                          <td className="px-3 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      disabled={isApplying}
                      onClick={() => setConfirmState(null)}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      disabled={isApplying}
                      className="bg-purple-600 hover:bg-purple-700 min-w-30"
                      onClick={async () => {
                        if (!onApplyBulkPromo) return;
                        setIsApplying(true);
                        try {
                          await onApplyBulkPromo(
                            overrides.map((o) => ({
                              ridx: o.ridx,
                              qtyBuy1: o.qtyBuy1,
                              qtyPro: o.qtyPro,
                              buy1Tier: o.buy1Tier,
                              proTier: o.proTier,
                            })),
                          );
                          // Clear row state for this pattern
                          setRowQtyEdits((prev) => {
                            const next = new Map(prev);
                            overrides.forEach((o) => next.delete(o.ridx));
                            return next;
                          });
                          setRowBuy1TierSelects((prev) => {
                            const next = new Map(prev);
                            overrides.forEach((o) => next.delete(o.ridx));
                            return next;
                          });
                          setRowProTierSelects((prev) => {
                            const next = new Map(prev);
                            overrides.forEach((o) => next.delete(o.ridx));
                            return next;
                          });
                          setSelectedPromoPerItem((prev) => {
                            const next = new Map(prev);
                            next.delete(pattern.itemCode);
                            return next;
                          });
                          setSelectedRowsPerItem((prev) => {
                            const next = new Map(prev);
                            next.delete(pattern.itemCode);
                            return next;
                          });
                          setConfirmState(null);
                        } finally {
                          setIsApplying(false);
                        }
                      }}
                    >
                      {isApplying ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 mr-2"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8H4z"
                            />
                          </svg>
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          ยืนยัน {overrides.length} แถว
                        </>
                      )}
                    </Button>
                  </div>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
