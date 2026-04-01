import { adminDb } from "@/lib/firebase-admin";
import { ShopCountConfirmed } from "@/types";

const COLLECTION = "shopCountConfirmed";

/**
 * Get all confirmed count records for a given period.
 * ITP calls this to build the PAShopCount payload.
 *
 * @param periodId  e.g. "2026-03-H1"
 * @param branchId  optional — filter by branch
 */
export async function getConfirmedByPeriod(
  periodId: string,
  branchId?: string,
): Promise<ShopCountConfirmed[]> {
  let query = adminDb.collection(COLLECTION).where("periodId", "==", periodId);

  if (branchId) {
    query = query.where("locationId", "==", branchId) as typeof query;
  }

  const snap = await query.get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ShopCountConfirmed, "id">),
  }));
}

/**
 * Map shopCountConfirmed records to PAShopCount SQL payload format.
 */
export function mapToPAShopCount(records: ShopCountConfirmed[]): object[] {
  return records.map((r) => ({
    SubmissionID: r.submissionId,
    LocationID: r.locationId,
    CounterID: r.counterId,
    CounterName: r.counterName,
    CountDate:
      r.countDate instanceof Date
        ? r.countDate.toISOString()
        : ((r.countDate as any)?.toDate?.()?.toISOString() ?? null),
    Item: r.item,
    Barcode: r.barcode,
    PATotalQty: r.paTotalQty,
    PASellQty: null,
    PATestQty: null,
  }));
}
