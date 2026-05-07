import { db } from "@/config/firebase";
import { DailySale } from "@/types";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

/** Strip undefined values from an object so Firestore doesn't reject them. */
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export const createDailySale = async (
  data: Omit<DailySale, "id" | "createdAt" | "updatedAt">,
): Promise<string> => {
  const ref = collection(db, "dailySales");

  // Strip undefined from top-level and per-item fields
  const cleaned = stripUndefined({
    ...data,
    items: data.items.map((item) => stripUndefined(item)),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const docRef = await addDoc(ref, cleaned);
  return docRef.id;
};

export const getDailySalesByEmployee = async (
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<DailySale[]> => {
  const ref = collection(db, "dailySales");
  const q = query(
    ref,
    where("employeeId", "==", employeeId),
    where("saleDate", ">=", startDate),
    where("saleDate", "<=", endDate),
    orderBy("saleDate", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailySale);
};

export const getDailySalesByBranch = async (
  branchId: string,
  startDate: string,
  endDate: string,
): Promise<DailySale[]> => {
  const ref = collection(db, "dailySales");
  const q = query(
    ref,
    where("branchId", "==", branchId),
    where("saleDate", ">=", startDate),
    where("saleDate", "<=", endDate),
    orderBy("saleDate", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailySale);
};

export const getDailySalesBySupervisor = async (
  supervisorId: string,
  startDate: string,
  endDate: string,
): Promise<DailySale[]> => {
  const ref = collection(db, "dailySales");
  const q = query(
    ref,
    where("supervisorId", "==", supervisorId),
    where("saleDate", ">=", startDate),
    where("saleDate", "<=", endDate),
    orderBy("saleDate", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailySale);
};

export const getDailySalesByCompany = async (
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<DailySale[]> => {
  const ref = collection(db, "dailySales");
  const q = query(
    ref,
    where("companyId", "==", companyId),
    where("saleDate", ">=", startDate),
    where("saleDate", "<=", endDate),
    orderBy("saleDate", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailySale);
};

export const lookupProductByBarcode = async (
  barcode: string,
  companyId: string,
): Promise<{
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
} | null> => {
  try {
    const ref = collection(db, "products");
    const q = query(
      ref,
      where("barcode", "==", barcode),
      where("companyId", "==", companyId),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      name: data.name || barcode,
      description: data.description,
      imageUrl: data.imageUrl || undefined,
      price: typeof data.price === "number" ? data.price : undefined,
    };
  } catch {
    return null;
  }
};

export interface PromoItem {
  itemCode: string;
  barcode?: string;
  itemName: string;
  stdPrice: number;
  commPrice: number | null;
  promoPrice: number | null;
  remark?: string;
  promoStart: Date | null;
  promoEnd: Date | null;
}

/**
 * Fetch promotion items that are active during the given saleDate month.
 * Reads from watson_promotion_data/current (shared collection).
 * @param saleDate "YYYY-MM-DD" — used to compute the month range
 */
export const fetchActivePromoItems = async (
  saleDate: string,
): Promise<PromoItem[]> => {
  try {
    const docRef = doc(db, "watson_promotion_data", "current");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return [];

    const raw = snap.data() as { items?: any[] };
    const items: any[] = raw.items ?? [];

    // Determine the month window from saleDate
    const [y, m] = saleDate.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59); // last day of month

    return items
      .map((it) => ({
        itemCode: String(it.itemCode ?? ""),
        barcode: it.barcode ? String(it.barcode) : undefined,
        itemName: String(it.itemName ?? ""),
        stdPrice: Number(it.stdPrice) || 0,
        promoPrice: it.promoPrice != null ? Number(it.promoPrice) : null,
        commPrice: it.commPrice != null ? Number(it.commPrice) : null,
        invoice62IncV:
          it.invoice62IncV != null ? Number(it.invoice62IncV) : null,
        invoice62ExV: it.invoice62ExV != null ? Number(it.invoice62ExV) : null,
        remark: it.remark ? String(it.remark) : undefined,
        promoStart:
          it.promoStart instanceof Timestamp
            ? it.promoStart.toDate()
            : it.promoStart
              ? new Date(it.promoStart)
              : null,
        promoEnd:
          it.promoEnd instanceof Timestamp
            ? it.promoEnd.toDate()
            : it.promoEnd
              ? new Date(it.promoEnd)
              : null,
      }))
      .filter((it): boolean => {
        if (!it.promoStart || !it.promoEnd) return false;
        // Promo overlaps with the month window
        return it.promoStart <= monthEnd && it.promoEnd >= monthStart;
      });
  } catch (e) {
    console.error("fetchActivePromoItems error:", e);
    return [];
  }
};
