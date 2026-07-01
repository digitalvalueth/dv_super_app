import AsyncStorage from "@react-native-async-storage/async-storage";
import { Product, ShopStockReceive } from "@/types";

const QUEUE_KEY = "shopStockReceive:queue";
const PRODUCT_CACHE_PREFIX = "shopStockReceive:products:";

/** record ที่รอส่ง — เก็บ local image uri ไว้ upload ตอน flush */
export interface QueuedReceive {
  id: string; // client-generated id (เช่น `${uid}-${Date.now()}`)
  localImageUri: string;
  record: Omit<
    ShopStockReceive,
    "id" | "createdAt" | "updatedAt" | "imageUrl" | "syncStatus"
  >;
}

export const enqueueReceive = async (item: QueuedReceive): Promise<void> => {
  const all = await getQueuedReceives();
  all.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(all));
};

export const getQueuedReceives = async (): Promise<QueuedReceive[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedReceive[];
  } catch {
    return [];
  }
};

export const removeQueuedReceive = async (id: string): Promise<void> => {
  const all = await getQueuedReceives();
  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(all.filter((q) => q.id !== id)),
  );
};

export const cacheProducts = async (
  companyId: string,
  products: Product[],
): Promise<void> => {
  await AsyncStorage.setItem(
    PRODUCT_CACHE_PREFIX + companyId,
    JSON.stringify(products),
  );
};

export const getCachedProducts = async (
  companyId: string,
): Promise<Product[]> => {
  const raw = await AsyncStorage.getItem(PRODUCT_CACHE_PREFIX + companyId);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
};
