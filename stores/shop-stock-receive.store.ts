import {
  ShopStockReceiveItem,
  User,
} from "@/types";
import { WatermarkData } from "@/utils/watermark";
import {
  branchMatches,
  cacheCompanyProducts,
  parseTransferQR,
  submitShopStockReceive,
  toStoredWatermark,
  uploadReceiveImage,
} from "@/services/shop-stock-receive.service";
import {
  enqueueReceive,
  getQueuedReceives,
  removeQueuedReceive,
} from "@/services/shop-stock-receive.queue";
import { Timestamp } from "firebase/firestore";
import { create } from "zustand";

interface ShopStockReceiveState {
  transferNumber: string;
  branchCode: string;
  items: ShopStockReceiveItem[];
  capturedImageUri: string | null;
  watermark: WatermarkData | null;
  isOnline: boolean;
  isSubmitting: boolean;

  setOnline: (v: boolean) => void;
  /** parse QR + ตรวจสาขา (บังคับตรง). คืน error string ถ้าไม่ผ่าน */
  startTransfer: (raw: string, user: User) => string | null;
  addItem: (item: ShopStockReceiveItem) => string | null; // คืน error ถ้าซ้ำ
  removeItem: (barcode: string) => void;
  setCapturedImage: (uri: string, watermark: WatermarkData) => void;
  submit: (
    user: User,
    notes: string | undefined,
  ) => Promise<{ id: string; queued: boolean }>;
  flushQueue: () => Promise<number>;
  preloadProductCache: (companyId: string) => Promise<void>;
  reset: () => void;
}

export const useShopStockReceiveStore = create<ShopStockReceiveState>(
  (set, get) => ({
    transferNumber: "",
    branchCode: "",
    items: [],
    capturedImageUri: null,
    watermark: null,
    isOnline: true,
    isSubmitting: false,

    setOnline: (v) => set({ isOnline: v }),

    startTransfer: (raw, user) => {
      const parsed = parseTransferQR(raw);
      if (!parsed) return "รูปแบบ QR/เลข Transfer ไม่ถูกต้อง";
      if (!branchMatches(parsed.branchCode, user.branchCode, user.branchName)) {
        return `สาขาในใบส่งของ (${parsed.branchCode}) ไม่ตรงกับสาขาของคุณ`;
      }
      set({
        transferNumber: parsed.transferNumber,
        branchCode: parsed.branchCode,
        items: [],
        capturedImageUri: null,
        watermark: null,
      });
      return null;
    },

    addItem: (item) => {
      if (get().items.some((i) => i.barcode === item.barcode)) {
        return "สินค้านี้ถูกเพิ่มไปแล้ว";
      }
      set((s) => ({ items: [...s.items, item] }));
      return null;
    },

    removeItem: (barcode) =>
      set((s) => ({ items: s.items.filter((i) => i.barcode !== barcode) })),

    setCapturedImage: (uri, watermark) =>
      set({ capturedImageUri: uri, watermark }),

    submit: async (user, notes) => {
      const s = get();
      set({ isSubmitting: true });
      try {
        const baseRecord = {
          transferNumber: s.transferNumber,
          branchCode: s.branchCode,
          companyId: user.companyId || "",
          branchId: user.branchId || "",
          branchName: user.branchName,
          items: s.items,
          totalItems: s.items.length,
          receivedBy: user.uid,
          receivedByName: user.name,
          receivedByEmail: user.email,
          receivedAt: Timestamp.now(),
          watermarkData: s.watermark
            ? toStoredWatermark(s.watermark)
            : undefined,
          notes,
        };

        if (s.isOnline && s.capturedImageUri) {
          const tempId = `${user.uid}-${Date.now()}`;
          const imageUrl = await uploadReceiveImage(
            user.uid,
            tempId,
            s.capturedImageUri,
          );
          const id = await submitShopStockReceive({
            ...baseRecord,
            imageUrl,
            syncStatus: "synced",
          });
          return { id, queued: false };
        }

        // offline → เก็บคิว (เก็บ local image uri ไว้ upload ตอน flush)
        const queueId = `${user.uid}-${Date.now()}`;
        await enqueueReceive({
          id: queueId,
          localImageUri: s.capturedImageUri || "",
          record: baseRecord,
        });
        return { id: queueId, queued: true };
      } finally {
        set({ isSubmitting: false });
      }
    },

    flushQueue: async () => {
      const queued = await getQueuedReceives();
      let sent = 0;
      for (const q of queued) {
        try {
          const imageUrl = q.localImageUri
            ? await uploadReceiveImage(
                q.record.receivedBy,
                q.id,
                q.localImageUri,
              )
            : "";
          await submitShopStockReceive({
            ...q.record,
            imageUrl,
            syncStatus: "synced",
          });
          await removeQueuedReceive(q.id);
          sent += 1;
        } catch (e) {
          console.error("flushQueue failed for", q.id, e);
          // คงไว้ในคิว ลองใหม่รอบหน้า
        }
      }
      return sent;
    },

    preloadProductCache: async (companyId) => {
      try {
        await cacheCompanyProducts(companyId);
      } catch (e) {
        console.warn("preloadProductCache failed", e);
      }
    },

    reset: () =>
      set({
        transferNumber: "",
        branchCode: "",
        items: [],
        capturedImageUri: null,
        watermark: null,
      }),
  }),
);
