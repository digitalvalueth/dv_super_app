import { db } from "@/config/firebase";
import { FinalCountSource, ShopCountConfirmed } from "@/types";
import { doc, setDoc, Timestamp } from "firebase/firestore";

const COLLECTION = "shopCountConfirmed";

/**
 * Determine periodId, periodHalf, periodMonth from a date.
 * H1 = day 1–15, H2 = day 16–end of month.
 */
function getPeriodInfo(date: Date): {
  periodId: string;
  periodHalf: 1 | 2;
  periodMonth: string;
} {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const periodHalf: 1 | 2 = day <= 15 ? 1 : 2;
  const paddedMonth = String(month).padStart(2, "0");
  const periodMonth = `${year}-${paddedMonth}`;
  const periodId = `${periodMonth}-H${periodHalf}`;
  return { periodId, periodHalf, periodMonth };
}

export interface WriteShopCountConfirmedParams {
  sessionId: string;
  branchId: string;
  productId: string;
  userId: string;
  userName: string;
  barcode: string;
  paTotalQty: number;
  source: FinalCountSource;
  countDate: Date;
  periodId?: string;
  periodMonth?: string;
  periodHalf?: 1 | 2;
}

/**
 * Write (or overwrite) a confirmed count record to shopCountConfirmed.
 * Document ID: {branchId}_{productId}_{periodId} — guarantees 1 record per product per period.
 * Called from:
 *  - Case A (AI correct): result.tsx after session save (source: "ai")
 *  - Case B (mismatch):   supervisor/override API after approval (source: "employee" | "custom")
 */
export const writeShopCountConfirmed = async (
  params: WriteShopCountConfirmedParams,
): Promise<void> => {
  const fallbackPeriod = getPeriodInfo(params.countDate);
  const periodId = params.periodId || fallbackPeriod.periodId;
  const periodHalf = params.periodHalf || fallbackPeriod.periodHalf;
  const periodMonth = params.periodMonth || fallbackPeriod.periodMonth;

  const docId = `${params.branchId}_${params.productId}_${periodId}`;

  const data: Omit<ShopCountConfirmed, "id"> = {
    periodId,
    periodHalf,
    periodMonth,
    submissionId: params.sessionId,
    locationId: params.branchId,
    counterId: params.userId,
    counterName: params.userName,
    countDate: Timestamp.fromDate(params.countDate),
    item: params.productId,
    barcode: params.barcode,
    paTotalQty: params.paTotalQty,
    paSellQty: null,
    paTestQty: null,
    confirmedBy: params.userId,
    confirmedAt: Timestamp.now(),
    source: params.source,
    originalSessionId: params.sessionId,
  };

  await setDoc(doc(db, COLLECTION, docId), data);
};
