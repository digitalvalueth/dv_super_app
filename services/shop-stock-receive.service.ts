import { db, storage } from "@/config/firebase";
import { compressProductImage } from "@/services/image.service";
import { getProductByCode, getProducts } from "@/services/product.service";
import {
  cacheProducts,
  getCachedProducts,
} from "@/services/shop-stock-receive.queue";
import { Product, ShopStockReceive, WatermarkDataStored } from "@/types";
import { WatermarkData } from "@/utils/watermark";
import { addDoc, collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const COLLECTION = "shopStockReceives";

/** parse QR payload เช่น "SR-20260617-7 && BL 41060" */
export const parseTransferQR = (
  raw: string,
): { transferNumber: string; branchCode: string } | null => {
  if (!raw) return null;
  const parts = raw.split("&&").map((s) => s.trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  return { transferNumber: parts[0], branchCode: parts[1] };
};

/** เทียบสาขาจาก QR กับสาขาของผู้ใช้ — match ด้วยเลขสาขาที่อยู่ในสตริง */
const digits = (s?: string): string => (s || "").replace(/\D/g, "");
export const branchMatches = (
  qrBranchCode: string,
  userBranchCode?: string,
  userBranchName?: string,
): boolean => {
  const qr = digits(qrBranchCode);
  if (!qr) return false;
  return qr === digits(userBranchCode) || digits(userBranchName).includes(qr);
};

export const toStoredWatermark = (w: WatermarkData): WatermarkDataStored => ({
  timestamp:
    w.timestamp instanceof Date
      ? w.timestamp.toISOString()
      : new Date(w.timestamp).toISOString(),
  location: w.location,
  coordinates: w.coordinates,
  employeeName: w.employeeName,
  employeeId: w.employeeId,
  deviceModel: w.deviceModel,
  deviceName: w.deviceName,
});

export const uploadReceiveImage = async (
  userId: string,
  receiveId: string,
  imageUri: string,
): Promise<string> => {
  const compressed = await compressProductImage(imageUri);
  const response = await fetch(compressed.uri);
  const blob = await response.blob();

  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const storageRef = ref(
    storage,
    `shop-stock-receives/${userId}/${dateStr}/${receiveId}.jpg`,
  );

  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
};

// remove undefined values recursively so Firestore addDoc won't throw
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object" && !(value instanceof Timestamp)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export const submitShopStockReceive = async (
  data: Omit<ShopStockReceive, "id" | "createdAt" | "updatedAt">,
): Promise<string> => {
  const ref_ = collection(db, COLLECTION);
  const docRef = await addDoc(ref_, {
    ...stripUndefined(data),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

/** lookup สินค้า: online → Firestore; offline → cache (match barcode หรือ sku) */
export const resolveProduct = async (
  companyId: string,
  code: string,
  online: boolean,
): Promise<Product | null> => {
  if (online) {
    return getProductByCode(companyId, code);
  }
  const cached = await getCachedProducts(companyId);
  return (
    cached.find((p) => p.barcode === code || p.sku === code) ?? null
  );
};

/** โหลด products ทั้งบริษัทเก็บ local เพื่อใช้ตอน offline (เรียกตอน online) */
export const cacheCompanyProducts = async (
  companyId: string,
): Promise<void> => {
  const products = await getProducts(companyId);
  await cacheProducts(companyId, products);
};

export const getUserReceiveHistory = async (
  userId: string,
  max = 50,
): Promise<ShopStockReceive[]> => {
  const q = query(
    collection(db, COLLECTION),
    where("receivedBy", "==", userId),
    orderBy("createdAt", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ShopStockReceive);
};
