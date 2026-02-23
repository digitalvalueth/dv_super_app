"use client";

import { useState, useCallback, useMemo } from "react";
import {
  findBestPriceCombination,
  calculateBatch,
  summarizeBatch,
  type BatchItem,
  type BatchResult,
  type BatchSummary,
  type OptimizationOptions,
  type CalculationResult,
} from "@/lib/watson/price-optimizer";

export type CalculationStatus = "idle" | "calculating" | "completed" | "error";

export interface PriceCalculationState {
  status: CalculationStatus;
  results: BatchResult[];
  summary: BatchSummary;
  lastCalculatedAt: Date | null;
  error: string | null;
}

interface UsePriceCalculationOptions {
  /** ค่าความเชื่อมั่นเริ่มต้น (default: 0.95) */
  defaultConfidence?: number;
  /** Auto reset status หลังจากคำนวณเสร็จ (ms, default: 3000) */
  autoResetDelay?: number;
}

export function usePriceCalculation(options: UsePriceCalculationOptions = {}) {
  const { defaultConfidence = 0.95, autoResetDelay = 3000 } = options;

  const [state, setState] = useState<PriceCalculationState>({
    status: "idle",
    results: [],
    summary: {
      totalItems: 0,
      acceptableCount: 0,
      unacceptableCount: 0,
      averageConfidence: 0,
      totalDiff: 0,
    },
    lastCalculatedAt: null,
    error: null,
  });

  const [confidenceThreshold, setConfidenceThreshold] =
    useState(defaultConfidence);

  /**
   * คำนวณหลายรายการพร้อมกัน
   */
  const calculateAll = useCallback(
    (items: BatchItem[], customOptions?: Partial<OptimizationOptions>) => {
      setState((prev) => ({
        ...prev,
        status: "calculating",
        error: null,
      }));

      // Use setTimeout to allow UI to update
      setTimeout(() => {
        try {
          const opts: OptimizationOptions = {
            confidenceThreshold,
            ...customOptions,
          };

          const results = calculateBatch(items, opts);
          const summary = summarizeBatch(results);

          setState({
            status: "completed",
            results,
            summary,
            lastCalculatedAt: new Date(),
            error: null,
          });

          // Auto reset to idle after delay
          if (autoResetDelay > 0) {
            setTimeout(() => {
              setState((prev) => ({
                ...prev,
                status: "idle",
              }));
            }, autoResetDelay);
          }
        } catch (err) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          }));
        }
      }, 50); // Small delay to show "calculating" state
    },
    [confidenceThreshold, autoResetDelay],
  );

  /**
   * คำนวณรายการเดียว
   */
  const calculateSingle = useCallback(
    (
      prices: { price: number; label?: string }[],
      qty: number,
      rawAmt: number,
      customOptions?: Partial<OptimizationOptions>,
    ): CalculationResult => {
      const opts: OptimizationOptions = {
        confidenceThreshold,
        ...customOptions,
      };
      return findBestPriceCombination(prices, qty, rawAmt, opts);
    },
    [confidenceThreshold],
  );

  /**
   * รีเซ็ต state
   */
  const reset = useCallback(() => {
    setState({
      status: "idle",
      results: [],
      summary: {
        totalItems: 0,
        acceptableCount: 0,
        unacceptableCount: 0,
        averageConfidence: 0,
        totalDiff: 0,
      },
      lastCalculatedAt: null,
      error: null,
    });
  }, []);

  /**
   * หาผลลัพธ์สำหรับ item ที่ระบุ
   */
  const getResultById = useCallback(
    (id: string): BatchResult | undefined => {
      return state.results.find((r) => r.id === id);
    },
    [state.results],
  );

  /**
   * หาผลลัพธ์สำหรับ itemCode ที่ระบุ
   */
  const getResultsByItemCode = useCallback(
    (itemCode: string): BatchResult[] => {
      return state.results.filter((r) => r.itemCode === itemCode);
    },
    [state.results],
  );

  /**
   * สร้าง map ของผลลัพธ์ (id -> result)
   */
  const resultsMap = useMemo(() => {
    const map = new Map<string, BatchResult>();
    state.results.forEach((r) => map.set(r.id, r));
    return map;
  }, [state.results]);

  return {
    // State
    status: state.status,
    results: state.results,
    summary: state.summary,
    lastCalculatedAt: state.lastCalculatedAt,
    error: state.error,
    resultsMap,

    // Confidence
    confidenceThreshold,
    setConfidenceThreshold,

    // Actions
    calculateAll,
    calculateSingle,
    reset,

    // Helpers
    getResultById,
    getResultsByItemCode,

    // Status checks
    isCalculating: state.status === "calculating",
    isCompleted: state.status === "completed",
    hasError: state.status === "error",
  };
}

export type UsePriceCalculationReturn = ReturnType<typeof usePriceCalculation>;
