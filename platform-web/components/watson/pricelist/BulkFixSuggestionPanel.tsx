"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Eye,
  Loader2,
  Percent,
  TrendingDown,
  TrendingUp,
  Wand2,
  X,
  Check,
  SkipForward,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/watson/ui/button";
import { Badge } from "@/components/watson/ui/badge";
import { ScrollArea } from "@/components/watson/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/watson/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/watson/ui/dialog";

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
}: BulkFixSuggestionPanelProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
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
    () => headers.find((h) => h.toLowerCase().includes("invoice date")),
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
    </TooltipProvider>
  );
}
