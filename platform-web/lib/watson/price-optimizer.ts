/**
 * Price Optimizer - Bounded Knapsack Algorithm
 * คำนวณหาจำนวนสินค้าในแต่ละราคาที่ทำให้ยอดรวมใกล้เคียง rawAmt มากที่สุด
 */

export interface PriceOption {
  price: number; // ราคาต่อชิ้น (ExtVat)
  label?: string; // ชื่อราคา เช่น "Standard", "Promo"
  remark?: string; // Promotion remark จาก Price List
  startDate?: Date; // วันที่เริ่มใช้ราคา
  priceIncVat?: number; // Comm Price IncV (ราคาคอม รวม VAT)
  stdPrice?: number; // Standard Price IncV (ราคาเต็ม)
}

export interface PriceAllocation {
  price: number;
  qty: number;
  label?: string;
  remark?: string; // Promotion remark จาก Price List
  priceIncVat?: number; // Comm Price IncV (ราคาคอม รวม VAT)
  stdPrice?: number; // Standard Price IncV (ราคาเต็ม)
}

export interface CalculationResult {
  allocations: PriceAllocation[];
  calculatedAmt: number;
  diff: number;
  diffPercent: number;
  confidence: number; // 0-100%
  isAcceptable: boolean;
  totalQty: number;
}

export interface OptimizationOptions {
  /** ค่าความเชื่อมั่น 0.80 - 1.00 (default: 0.95) */
  confidenceThreshold?: number;
  /** ห้ามให้ยอดรวมเกิน rawAmt (default: false) */
  notExceedRawAmt?: boolean;
  /** จำนวน qty สูงสุดที่จะคำนวณ (default: 500) */
  maxQty?: number;
  /** จำนวนราคาสูงสุดที่จะคำนวณ (default: 10) */
  maxPrices?: number;
}

/**
 * หาการจัดสรร qty ต่อราคาที่ดีที่สุด (Bounded Knapsack)
 * @param prices - รายการราคาที่เป็นไปได้
 * @param totalQty - จำนวนสินค้าทั้งหมด
 * @param rawAmt - ยอดเงินจริง
 * @param options - ตัวเลือกเพิ่มเติม
 */
export function findBestPriceCombination(
  prices: PriceOption[],
  totalQty: number,
  rawAmt: number,
  options: OptimizationOptions = {},
): CalculationResult {
  const {
    confidenceThreshold = 0.9,
    notExceedRawAmt = false,
    maxQty = 500,
    maxPrices = 100,
  } = options;

  // Handle edge cases
  if (prices.length === 0 || totalQty <= 0 || rawAmt <= 0) {
    return {
      allocations: [],
      calculatedAmt: 0,
      diff: rawAmt,
      diffPercent: 100,
      confidence: 0,
      isAcceptable: false,
      totalQty: 0,
    };
  }

  // Limit for performance
  const limitedQty = Math.min(totalQty, maxQty);
  const limitedPrices = prices.slice(0, maxPrices);
  const n = limitedPrices.length;

  // Best result tracker
  let bestDiff = Infinity;
  let bestSum = 0;
  let bestAllocation: number[] = [];

  // Current allocation
  const x: number[] = new Array(n).fill(0);

  /**
   * DFS/Backtracking with pruning
   */
  function dfs(idx: number, remainQty: number, currentSum: number): void {
    // Prune: ถ้าเกินแล้วและตั้งค่า notExceedRawAmt
    if (notExceedRawAmt && currentSum > rawAmt) {
      return;
    }

    // Early pruning: ถ้า diff ปัจจุบันดีกว่า best แล้ว และเหลือ qty = 0
    if (remainQty === 0) {
      const diff = Math.abs(currentSum - rawAmt);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSum = currentSum;
        bestAllocation = [...x];
      }
      return;
    }

    // Base case: ใช้ราคาครบทุกตัว
    if (idx === n) {
      // ถ้าเหลือ qty ต้องใช้ราคาสุดท้าย
      if (remainQty > 0 && n > 0) {
        const lastPrice = limitedPrices[n - 1].price;
        const sum = currentSum + lastPrice * remainQty;
        if (!notExceedRawAmt || sum <= rawAmt) {
          const diff = Math.abs(sum - rawAmt);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestSum = sum;
            bestAllocation = [...x];
            bestAllocation[n - 1] += remainQty;
          }
        }
      }
      return;
    }

    // Pruning: ถ้าใช้ราคาต่ำสุดที่เหลือทั้งหมดแล้วยังเกิน rawAmt
    if (notExceedRawAmt) {
      const minPrice = Math.min(
        ...limitedPrices.slice(idx).map((p) => p.price),
      );
      if (currentSum + minPrice * remainQty > rawAmt) {
        return;
      }
    }

    // Try all possible quantities for current price
    for (let i = 0; i <= remainQty; i++) {
      x[idx] = i;
      dfs(idx + 1, remainQty - i, currentSum + limitedPrices[idx].price * i);

      // Early exit if found perfect match
      if (bestDiff < 0.01) {
        return;
      }
    }
    x[idx] = 0; // Reset for backtracking
  }

  // Start DFS
  dfs(0, limitedQty, 0);

  // Build result
  const allocations: PriceAllocation[] = [];
  let actualTotalQty = 0;

  for (let i = 0; i < n; i++) {
    if (bestAllocation[i] > 0) {
      allocations.push({
        price: limitedPrices[i].price,
        qty: bestAllocation[i],
        label: limitedPrices[i].label,
        remark: limitedPrices[i].remark,
        priceIncVat: limitedPrices[i].priceIncVat,
        stdPrice: limitedPrices[i].stdPrice,
      });
      actualTotalQty += bestAllocation[i];
    }
  }

  // Calculate confidence
  const diffPercent = rawAmt > 0 ? (bestDiff / rawAmt) * 100 : 100;
  const tolerance = rawAmt * (1 - confidenceThreshold);
  const isAcceptable = bestDiff <= tolerance;

  // Confidence: 100% if diff = 0, decreases as diff increases
  const confidence = Math.max(0, Math.min(100, 100 - diffPercent));

  return {
    allocations,
    calculatedAmt: bestSum,
    diff: bestDiff,
    diffPercent,
    confidence,
    isAcceptable,
    totalQty: actualTotalQty,
  };
}

/**
 * คำนวณหลายรายการพร้อมกัน (batch processing)
 */
export interface BatchItem {
  id: string;
  itemCode: string;
  qty: number;
  rawAmt: number;
  prices: PriceOption[];
}

export interface BatchResult extends CalculationResult {
  id: string;
  itemCode: string;
}

export function calculateBatch(
  items: BatchItem[],
  options: OptimizationOptions = {},
): BatchResult[] {
  return items.map((item) => ({
    id: item.id,
    itemCode: item.itemCode,
    ...findBestPriceCombination(item.prices, item.qty, item.rawAmt, options),
  }));
}

/**
 * สรุปผลการคำนวณ batch
 */
export interface BatchSummary {
  totalItems: number;
  acceptableCount: number;
  unacceptableCount: number;
  averageConfidence: number;
  totalDiff: number;
}

export function summarizeBatch(results: BatchResult[]): BatchSummary {
  if (results.length === 0) {
    return {
      totalItems: 0,
      acceptableCount: 0,
      unacceptableCount: 0,
      averageConfidence: 0,
      totalDiff: 0,
    };
  }

  const acceptableCount = results.filter((r) => r.isAcceptable).length;
  const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
  const totalDiff = results.reduce((sum, r) => sum + r.diff, 0);

  return {
    totalItems: results.length,
    acceptableCount,
    unacceptableCount: results.length - acceptableCount,
    averageConfidence: totalConfidence / results.length,
    totalDiff,
  };
}

/**
 * Format ผลลัพธ์เป็น string สำหรับแสดงใน cell
 */
export function formatAllocationString(allocations: PriceAllocation[]): string {
  if (allocations.length === 0) return "-";

  return allocations
    .map((a) => {
      const label = a.label || `฿${a.price.toFixed(2)}`;
      return `${label}: ${a.qty}`;
    })
    .join(", ");
}

/**
 * Format diff เป็น string พร้อม emoji
 */
export function formatDiffString(diff: number, isAcceptable: boolean): string {
  const emoji = isAcceptable ? "✓" : "⚠";
  const sign = diff >= 0 ? "+" : "";
  return `${emoji} ${sign}${diff.toFixed(2)}`;
}
