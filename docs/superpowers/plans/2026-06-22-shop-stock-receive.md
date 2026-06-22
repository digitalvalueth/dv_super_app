# Shop StockReceive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม mini-app "Shop StockReceive" บนมือถือ ให้พนักงานสแกน QR ใบส่งของ → ตรวจสาขา → สแกน barcode สินค้าจริง map กับ product master → กรอก Sales/Test/Mkt qty → ถ่ายรูป+watermark → submit (รองรับ offline) แล้วเปิด Open API + dashboard ฝั่งเว็บให้ดู/ดึงข้อมูล

**Architecture:** Mobile (Expo/RN, expo-router) เขียน record ลง Firestore collection ใหม่ `shopStockReceives` พร้อมรูปใน Storage; ถ้า offline เก็บคิวใน AsyncStorage แล้ว flush เมื่อเน็ตกลับ (ตรวจด้วย NetInfo). ฝั่งเว็บ (Next.js) เพิ่ม GET Open API (X-API-Key) ให้ ITP pull และ dashboard page (Bearer/BFF) ให้แอดมินดู.

**Tech Stack:** Expo SDK / React Native, expo-camera, expo-image-manipulator, `@react-native-community/netinfo`, `@react-native-async-storage/async-storage`, Zustand, Firebase JS SDK (named DB), Next.js 16 App Router + firebase-admin.

## Global Constraints

- Firestore database ID **ต้องอ่านจาก env** เสมอ — mobile: `process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID`; web: `process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID`. ใช้ `db`/`storage` จาก `@/config/firebase` (mobile) และ `adminDb`/`adminAuth` จาก `@/lib/firebase-admin` (web) — **ห้าม** เรียก `getFirestore()` แบบ default เอง.
- **ไม่มี test suite** ตาม convention repo — "verify" = `npm run lint` / `npm run build` + รันแอปจริง. ทุก task จบด้วย lint (และ build สำหรับ web) แล้ว commit. ไม่ต้องเขียน unit test เว้นแต่ระบุ.
- Path alias `@/*` → repo root (mobile) และ platform-web root (web), แยก tsconfig.
- Firestore query ทุกอันต้อง scope ด้วย `companyId` (และมัก `branchId`).
- รูปทุกใบต้อง compress ก่อน upload ด้วย `compressProductImage` จาก `@/services/image.service`.
- UI text เป็นภาษาไทยตาม pattern เดิม.
- Commit message ใช้ prefix `feat(shop-stock-receive):` / `chore(...)` ตามเหมาะสม.

**Branch:** ทำงานบน `feature/shop-stock-receive` (สร้างไว้แล้ว, มี spec commit อยู่).

---

## File Structure

**Mobile (repo root):**
- `types/index.ts` — เพิ่ม `ShopStockReceiveItem`, `ShopStockReceive`, `ShopStockReceiveSyncStatus` (modify)
- `services/shop-stock-receive.service.ts` — service ใหม่ (create)
- `services/shop-stock-receive.queue.ts` — offline queue (AsyncStorage) helpers (create)
- `services/product.service.ts` — เพิ่ม `getProductByCode` (modify)
- `stores/shop-stock-receive.store.ts` — Zustand store (create)
- `app/(mini-apps)/shop-stock-receive/_layout.tsx` `index.tsx` `form.tsx` `camera.tsx` `review.tsx` `result.tsx` `history.tsx` (create)
- `constants/mini-apps.ts` — เพิ่ม entry (modify)
- `package.json` — เพิ่ม netinfo (+ async-storage ถ้ายังไม่มี) (modify)

**Shared config:**
- `firestore.indexes.json` — index ของ `shopStockReceives` + products barcode/sku (modify)
- `storage.rules` — path `shop-stock-receives/{userId}/**` (modify)

**Web (`platform-web/`):**
- `app/api/shop-stock-receive/route.ts` — GET Open API (X-API-Key) (create)
- `app/api/dashboard/shop-stock-receive/route.ts` — GET dashboard read (Bearer/BFF) (create)
- `app/dashboard-vendor-center/stock-receive/page.tsx` — dashboard page (create)
- `docs/shop-stock-receive/openapi.yaml` — API spec (create)

---

## Task 1: Dependencies + Types

**Files:**
- Modify: `package.json` (repo root)
- Modify: `types/index.ts`

**Interfaces:**
- Produces: `ShopStockReceiveItem`, `ShopStockReceive`, `ShopStockReceiveSyncStatus` types; deps `@react-native-community/netinfo`, `@react-native-async-storage/async-storage` available.

- [ ] **Step 1: ตรวจ deps ที่มี/ขาด**

Run:
```bash
cd /Users/itswatthachai/super-fitt && node -e "const p=require('./package.json').dependencies; console.log('netinfo:',p['@react-native-community/netinfo']||'MISSING'); console.log('async-storage:',p['@react-native-async-storage/async-storage']||'MISSING')"
```
Expected: แสดงเวอร์ชันหรือ `MISSING` ของแต่ละตัว

- [ ] **Step 2: ติดตั้งตัวที่ MISSING ด้วย expo (จัดเวอร์ชันให้ตรง SDK)**

Run (เฉพาะตัวที่ MISSING จาก Step 1):
```bash
cd /Users/itswatthachai/super-fitt && npx expo install @react-native-community/netinfo @react-native-async-storage/async-storage
```
Expected: ติดตั้งสำเร็จ, `package.json` มี dependency เพิ่ม. (ถ้ามีอยู่แล้วทั้งคู่ ข้าม step นี้)

- [ ] **Step 3: เพิ่ม types ใน `types/index.ts`**

เพิ่มต่อท้ายไฟล์ (ก่อน export รวมถ้ามี). ใช้ `Timestamp` ที่ไฟล์ import อยู่แล้ว และ reuse `WatermarkDataStored` ที่มีอยู่:

```typescript
// ==================== SHOP STOCK RECEIVE ====================

export interface ShopStockReceiveItem {
  productId: string;
  barcode: string;        // ค่าที่สแกนได้ (อาจตรงกับ sku)
  sku?: string;
  productName: string;
  salesQty: number;
  testQty: number;
  mktQty: number;
}

export type ShopStockReceiveSyncStatus = "pending" | "synced";

export interface ShopStockReceive {
  id: string;
  transferNumber: string;   // "SR-20260617-7"
  branchCode: string;       // "BL 41060" (ตามที่อยู่ใน QR)
  companyId: string;
  branchId: string;
  branchName?: string;
  items: ShopStockReceiveItem[];
  totalItems: number;
  receivedBy: string;       // userId (uid)
  receivedByName: string;
  receivedByEmail?: string;
  receivedAt: Timestamp;
  imageUrl: string;         // รูปยืนยันการรับ (Storage download URL)
  watermarkData?: WatermarkDataStored;
  notes?: string;
  syncStatus: ShopStockReceiveSyncStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

- [ ] **Step 4: ตรวจ type + lint**

Run:
```bash
cd /Users/itswatthachai/super-fitt && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20 && npm run lint 2>&1 | tail -10
```
Expected: ไม่มี error ใหม่จากการเพิ่ม types (ignore warning เดิมที่มีอยู่แล้วของ repo)

- [ ] **Step 5: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add package.json package-lock.json types/index.ts && git commit -m "feat(shop-stock-receive): add types and offline deps (netinfo, async-storage)"
```

---

## Task 2: Product lookup by code

**Files:**
- Modify: `services/product.service.ts`

**Interfaces:**
- Consumes: `Product` (types), `db` (`@/config/firebase`), firestore `collection/query/where/getDocs`.
- Produces: `getProductByCode(companyId: string, code: string): Promise<Product | null>` — match `barcode == code` ก่อน, ถ้าไม่เจอลอง `sku == code`.

- [ ] **Step 1: เพิ่มฟังก์ชัน `getProductByCode` ต่อท้าย `services/product.service.ts`**

```typescript
/**
 * หา product ตาม barcode ที่สแกนได้ — ลอง match field `barcode` ก่อน
 * ถ้าไม่เจอ ลอง `sku` (ในข้อมูลจริง barcode บางตัว = sku เช่น "UF-001-M")
 */
export const getProductByCode = async (
  companyId: string,
  code: string,
): Promise<Product | null> => {
  try {
    const productsRef = collection(db, "products");

    const byBarcode = await getDocs(
      query(
        productsRef,
        where("companyId", "==", companyId),
        where("barcode", "==", code),
      ),
    );
    if (!byBarcode.empty) {
      return byBarcode.docs[0].data() as Product;
    }

    const bySku = await getDocs(
      query(
        productsRef,
        where("companyId", "==", companyId),
        where("sku", "==", code),
      ),
    );
    if (!bySku.empty) {
      return bySku.docs[0].data() as Product;
    }

    return null;
  } catch (error) {
    console.error("Error getting product by code:", error);
    throw error;
  }
};
```

- [ ] **Step 2: lint**

Run: `cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add services/product.service.ts && git commit -m "feat(shop-stock-receive): add getProductByCode (barcode or sku match)"
```

---

## Task 3: Offline queue helpers

**Files:**
- Create: `services/shop-stock-receive.queue.ts`

**Interfaces:**
- Consumes: AsyncStorage.
- Produces:
  - `QueuedReceive` type = `{ id: string; localImageUri: string; record: Omit<ShopStockReceive,"id"|"createdAt"|"updatedAt"|"imageUrl"|"syncStatus"> }`
  - `enqueueReceive(item: QueuedReceive): Promise<void>`
  - `getQueuedReceives(): Promise<QueuedReceive[]>`
  - `removeQueuedReceive(id: string): Promise<void>`
  - `cacheProducts(companyId: string, products: Product[]): Promise<void>`
  - `getCachedProducts(companyId: string): Promise<Product[]>`

- [ ] **Step 1: สร้างไฟล์ `services/shop-stock-receive.queue.ts`**

```typescript
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
```

- [ ] **Step 2: lint**

Run: `cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add services/shop-stock-receive.queue.ts && git commit -m "feat(shop-stock-receive): add AsyncStorage offline queue + product cache"
```

---

## Task 4: Receive service

**Files:**
- Create: `services/shop-stock-receive.service.ts`

**Interfaces:**
- Consumes: `db`, `storage` (`@/config/firebase`); `compressProductImage` (`@/services/image.service`); `getProductByCode`, `getProducts` (`@/services/product.service`); queue helpers (Task 3); `WatermarkData`, `WatermarkDataStored`, `ShopStockReceive`, `Product` (types).
- Produces:
  - `parseTransferQR(raw: string): { transferNumber: string; branchCode: string } | null`
  - `branchMatches(qrBranchCode: string, userBranchCode?: string, userBranchName?: string): boolean`
  - `toStoredWatermark(w: WatermarkData): WatermarkDataStored`
  - `uploadReceiveImage(userId: string, receiveId: string, imageUri: string): Promise<string>`
  - `submitShopStockReceive(data: Omit<ShopStockReceive,"id"|"createdAt"|"updatedAt">): Promise<string>`
  - `resolveProduct(companyId: string, code: string, online: boolean): Promise<Product | null>`
  - `cacheCompanyProducts(companyId: string): Promise<void>`

- [ ] **Step 1: สร้างไฟล์ `services/shop-stock-receive.service.ts`**

```typescript
import { db, storage } from "@/config/firebase";
import { compressProductImage } from "@/services/image.service";
import { getProductByCode, getProducts } from "@/services/product.service";
import {
  cacheProducts,
  getCachedProducts,
} from "@/services/shop-stock-receive.queue";
import {
  Product,
  ShopStockReceive,
  WatermarkData,
  WatermarkDataStored,
} from "@/types";
import { addDoc, collection, Timestamp } from "firebase/firestore";
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

export const submitShopStockReceive = async (
  data: Omit<ShopStockReceive, "id" | "createdAt" | "updatedAt">,
): Promise<string> => {
  const ref_ = collection(db, COLLECTION);
  const docRef = await addDoc(ref_, {
    ...data,
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
```

- [ ] **Step 2: lint**

Run: `cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add services/shop-stock-receive.service.ts && git commit -m "feat(shop-stock-receive): add receive service (parse QR, upload, submit, resolve)"
```

---

## Task 5: Zustand store

**Files:**
- Create: `stores/shop-stock-receive.store.ts`

**Interfaces:**
- Consumes: Task 3 + Task 4 functions; `User` (types).
- Produces: `useShopStockReceiveStore` hook with state/actions below. `submit(...)` returns `{ id: string; queued: boolean }`.

- [ ] **Step 1: สร้างไฟล์ `stores/shop-stock-receive.store.ts`**

```typescript
import {
  ShopStockReceive,
  ShopStockReceiveItem,
  User,
  WatermarkData,
} from "@/types";
import {
  branchMatches,
  cacheCompanyProducts,
  parseTransferQR,
  resolveProduct,
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
```

- [ ] **Step 2: lint**

Run: `cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add stores/shop-stock-receive.store.ts && git commit -m "feat(shop-stock-receive): add zustand store with submit + offline flush"
```

---

## Task 6: Route scaffold + entry screen (QR scan + branch check)

**Files:**
- Create: `app/(mini-apps)/shop-stock-receive/_layout.tsx`
- Create: `app/(mini-apps)/shop-stock-receive/index.tsx`

**Interfaces:**
- Consumes: `useShopStockReceiveStore`, `useAuthStore`, `expo-camera` CameraView, NetInfo.
- Produces: route `/(mini-apps)/shop-stock-receive`; index นำทางไป `./form` หลัง startTransfer สำเร็จ.

- [ ] **Step 1: สร้าง `_layout.tsx`**

```typescript
import { Stack } from "expo-router";

export default function ShopStockReceiveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="form" />
      <Stack.Screen name="camera" />
      <Stack.Screen name="review" />
      <Stack.Screen name="result" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
```

- [ ] **Step 2: สร้าง `index.tsx` — สแกน QR หรือพิมพ์ TN# เอง + เชื่อม NetInfo + preload cache**

```typescript
import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { useAuthStore } from "@/stores/auth.store";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function ShopStockReceiveIndex() {
  const user = useAuthStore((s) => s.user);
  const { startTransfer, setOnline, flushQueue, preloadProductCache } =
    useShopStockReceiveStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [manual, setManual] = useState("");
  const lastScan = useRef(0);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setOnline(online);
      if (online) flushQueue().catch(() => {});
    });
    if (user?.companyId) preloadProductCache(user.companyId);
    return () => unsub();
  }, [user?.companyId, setOnline, flushQueue, preloadProductCache]);

  const handle = useCallback(
    (raw: string) => {
      if (!user) return;
      const err = startTransfer(raw, user);
      if (err) {
        setScanning(true);
        Alert.alert("ไม่สามารถรับสินค้าได้", err);
        return;
      }
      router.push("/(mini-apps)/shop-stock-receive/form");
    },
    [user, startTransfer],
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      if (now - lastScan.current < 800) return;
      lastScan.current = now;
      setScanning(false);
      handle(data);
    },
    [handle],
  );

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>ต้องการสิทธิ์กล้องเพื่อสแกน QR</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>อนุญาตกล้อง</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        active={scanning}
        onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39"] }}
      />
      <View style={styles.overlay}>
        <Text style={styles.title}>สแกน QR ใบส่งสินค้า</Text>
        <Text style={styles.subtitle}>หรือพิมพ์เลข Transfer เอง</Text>
        <TextInput
          style={styles.input}
          placeholder="SR-20260617-7 && BL 41060"
          value={manual}
          onChangeText={setManual}
          autoCapitalize="characters"
        />
        <Pressable style={styles.btn} onPress={() => manual && handle(manual)}>
          <Text style={styles.btnText}>ตรวจสอบ</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => router.push("/(mini-apps)/shop-stock-receive/history")}>
          <Text style={styles.linkText}>ประวัติการรับสินค้า</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  overlay: { padding: 20, backgroundColor: "#fff", gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#666" },
  info: { fontSize: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  btn: { backgroundColor: "#10B981", padding: 14, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  link: { alignItems: "center", padding: 8 },
  linkText: { color: "#10B981", fontWeight: "600" },
});
```

> **หมายเหตุการรับเลขสาขา:** `branchMatches` เทียบด้วยเลขสาขา (digits) — ของจริง user.branchCode/branchName ควรมีเลข `41060`. ถ้าทดสอบแล้วไม่ match ให้ตรวจค่า `user.branchCode`/`user.branchName` จริงจาก Firestore แล้วปรับ logic ใน `branchMatches` (Task 4) ตามค่าที่พบ.

- [ ] **Step 3: lint + รันแอป (manual smoke)**

Run: `cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10`
Manual: `npm start` → เปิด mini-app (ตอนนี้ยังไม่มีปุ่มใน launcher จนถึง Task 11 — เปิดผ่าน deep link หรือไปต่อหลังเพิ่ม entry) → ยืนยันหน้า index render, ขอสิทธิ์กล้อง, พิมพ์ `SR-1 && BL 41060` แล้วถ้าสาขาตรงเด้งไป form (form ยังว่างจนถึง Task 7).
Expected: lint ผ่าน; หน้า index แสดงผล

- [ ] **Step 4: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add "app/(mini-apps)/shop-stock-receive/_layout.tsx" "app/(mini-apps)/shop-stock-receive/index.tsx" && git commit -m "feat(shop-stock-receive): add layout + QR/transfer entry screen with branch check"
```

---

## Task 7: Form screen (batch + product scan + qty)

**Files:**
- Create: `app/(mini-apps)/shop-stock-receive/form.tsx`

**Interfaces:**
- Consumes: store (`items`, `addItem`, `removeItem`, `resolveProduct via service`, `isOnline`, `transferNumber`, `branchCode`), `useAuthStore`, `resolveProduct` (service), CameraView.
- Produces: นำทางไป `./camera` เมื่อกด "ถัดไป".

- [ ] **Step 1: สร้าง `form.tsx`**

```typescript
import { resolveProduct } from "@/services/shop-stock-receive.service";
import { useAuthStore } from "@/stores/auth.store";
import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { CameraView } from "expo-camera";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function ShopStockReceiveForm() {
  const user = useAuthStore((s) => s.user);
  const { transferNumber, branchCode, items, addItem, removeItem, isOnline } =
    useShopStockReceiveStore();
  const [scanOpen, setScanOpen] = useState(false);
  const [draft, setDraft] = useState<
    | { productId: string; barcode: string; sku?: string; productName: string }
    | null
  >(null);
  const [sales, setSales] = useState("0");
  const [test, setTest] = useState("0");
  const [mkt, setMkt] = useState("0");
  const lastScan = useRef(0);

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      if (now - lastScan.current < 800) return;
      lastScan.current = now;
      setScanOpen(false);
      if (!user?.companyId) return;
      const p = await resolveProduct(user.companyId, data, isOnline);
      if (!p) {
        Alert.alert("ไม่พบสินค้า", `ไม่พบ barcode ${data} ในระบบ`);
        return;
      }
      setDraft({
        productId: p.id,
        barcode: data,
        sku: p.sku,
        productName: p.name,
      });
      setSales("0");
      setTest("0");
      setMkt("0");
    },
    [user?.companyId, isOnline],
  );

  const confirmAdd = useCallback(() => {
    if (!draft) return;
    const s = parseInt(sales, 10) || 0;
    const t = parseInt(test, 10) || 0;
    const m = parseInt(mkt, 10) || 0;
    if (s + t + m <= 0) {
      Alert.alert("จำนวนไม่ถูกต้อง", "ต้องมีอย่างน้อย 1 ช่องมากกว่า 0");
      return;
    }
    const err = addItem({
      productId: draft.productId,
      barcode: draft.barcode,
      sku: draft.sku,
      productName: draft.productName,
      salesQty: s,
      testQty: t,
      mktQty: m,
    });
    if (err) Alert.alert("เพิ่มไม่ได้", err);
    setDraft(null);
  }, [draft, sales, test, mkt, addItem]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.h1}>{transferNumber}</Text>
        <Text style={styles.h2}>สาขา {branchCode}</Text>
        {!isOnline && <Text style={styles.offline}>ออฟไลน์ — จะส่งเมื่อเน็ตกลับมา</Text>}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.barcode}
        ListEmptyComponent={<Text style={styles.empty}>ยังไม่มีสินค้าในรายการ</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.productName}</Text>
              <Text style={styles.sub}>{item.barcode}</Text>
              <Text style={styles.sub}>
                Sales {item.salesQty} · Test {item.testQty} · Mkt {item.mktQty}
              </Text>
            </View>
            <Pressable onPress={() => removeItem(item.barcode)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        )}
      />

      <Pressable style={styles.scanBtn} onPress={() => setScanOpen(true)}>
        <Text style={styles.btnText}>＋ สแกนสินค้า</Text>
      </Pressable>
      <Pressable
        style={[styles.nextBtn, items.length === 0 && styles.disabled]}
        disabled={items.length === 0}
        onPress={() => router.push("/(mini-apps)/shop-stock-receive/camera")}
      >
        <Text style={styles.btnText}>ถัดไป — ถ่ายรูปยืนยัน</Text>
      </Pressable>

      {/* scanner modal */}
      <Modal visible={scanOpen} animationType="slide">
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            active={scanOpen}
            onBarcodeScanned={scanOpen ? onScanned : undefined}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
            }}
          />
          <Pressable style={styles.closeBtn} onPress={() => setScanOpen(false)}>
            <Text style={styles.btnText}>ปิด</Text>
          </Pressable>
        </View>
      </Modal>

      {/* qty entry modal */}
      <Modal visible={!!draft} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.name}>{draft?.productName}</Text>
            <Text style={styles.sub}>{draft?.barcode}</Text>
            <QtyField label="Sales Qty" value={sales} onChange={setSales} />
            <QtyField label="Test Qty" value={test} onChange={setTest} />
            <QtyField label="Mkt Qty" value={mkt} onChange={setMkt} />
            <View style={styles.modalRow}>
              <Pressable style={styles.cancel} onPress={() => setDraft(null)}>
                <Text>ยกเลิก</Text>
              </Pressable>
              <Pressable style={styles.scanBtn} onPress={confirmAdd}>
                <Text style={styles.btnText}>＋ เพิ่ม</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QtyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.qtyRow}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <TextInput
        style={styles.qtyInput}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { marginBottom: 12 },
  h1: { fontSize: 18, fontWeight: "700" },
  h2: { color: "#666" },
  offline: { color: "#D97706", marginTop: 4 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  name: { fontWeight: "600" },
  sub: { color: "#666", fontSize: 12 },
  remove: { color: "#EF4444", fontSize: 18, paddingHorizontal: 8 },
  scanBtn: { backgroundColor: "#10B981", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  nextBtn: { backgroundColor: "#3B82F6", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  disabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "700" },
  closeBtn: { backgroundColor: "#374151", padding: 14, alignItems: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 20, gap: 10 },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancel: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "#ccc" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyInput: { width: 90, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, textAlign: "center" },
});
```

- [ ] **Step 2: lint**

Run: `cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add "app/(mini-apps)/shop-stock-receive/form.tsx" && git commit -m "feat(shop-stock-receive): add batch form with product scan and qty entry"
```

---

## Task 8: Camera (photo + watermark)

**Files:**
- Create: `app/(mini-apps)/shop-stock-receive/camera.tsx`

**Interfaces:**
- Consumes: `useAuthStore`, store `setCapturedImage`, `createWatermarkMetadata` (`@/utils/watermark`), CameraView.
- Produces: นำทางไป `./review` หลังถ่ายรูปเสร็จ.

- [ ] **Step 1: สร้าง `camera.tsx`** (mirror `delivery-receive/camera.tsx`)

```typescript
import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { useAuthStore } from "@/stores/auth.store";
import { createWatermarkMetadata } from "@/utils/watermark";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

export default function ShopStockReceiveCamera() {
  const user = useAuthStore((s) => s.user);
  const setCapturedImage = useShopStockReceiveStore((s) => s.setCapturedImage);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    try {
      setIsCapturing(true);
      const watermarkPromise = createWatermarkMetadata(
        user?.name || "Unknown",
        user?.uid || "",
      );
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
        return;
      }
      const watermark = await watermarkPromise;
      setCapturedImage(photo.uri, watermark);
      router.push("/(mini-apps)/shop-stock-receive/review");
    } catch (e) {
      console.error("capture error", e);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, user, setCapturedImage]);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>ต้องการสิทธิ์กล้อง</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>อนุญาต</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.controls}>
        <Text style={styles.hint}>ถ่ายรูปยืนยันการรับสินค้า</Text>
        <Pressable
          style={[styles.shutter, isCapturing && styles.disabled]}
          disabled={isCapturing}
          onPress={handleCapture}
        >
          <Text style={styles.btnText}>{isCapturing ? "กำลังถ่าย..." : "ถ่ายรูป"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  controls: { padding: 20, backgroundColor: "#000", alignItems: "center", gap: 12 },
  hint: { color: "#fff" },
  shutter: { backgroundColor: "#10B981", paddingVertical: 16, paddingHorizontal: 40, borderRadius: 40 },
  disabled: { opacity: 0.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  btn: { backgroundColor: "#10B981", padding: 14, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
});
```

- [ ] **Step 2: lint**

Run: `cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add "app/(mini-apps)/shop-stock-receive/camera.tsx" && git commit -m "feat(shop-stock-receive): add photo capture with watermark"
```

---

## Task 9: Review + Result screens

**Files:**
- Create: `app/(mini-apps)/shop-stock-receive/review.tsx`
- Create: `app/(mini-apps)/shop-stock-receive/result.tsx`

**Interfaces:**
- Consumes: store (`items`, `transferNumber`, `branchCode`, `capturedImageUri`, `submit`, `reset`, `isSubmitting`), `useAuthStore`.
- Produces: review เรียก `submit` → push `./result?queued=0|1`. result อ่าน param `queued`.

- [ ] **Step 1: สร้าง `review.tsx`**

```typescript
import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { useAuthStore } from "@/stores/auth.store";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function ShopStockReceiveReview() {
  const user = useAuthStore((s) => s.user);
  const {
    transferNumber,
    branchCode,
    items,
    capturedImageUri,
    submit,
    isSubmitting,
  } = useShopStockReceiveStore();
  const [notes, setNotes] = useState("");

  const onSubmit = async () => {
    if (!user) return;
    if (!capturedImageUri) {
      Alert.alert("ยังไม่มีรูป", "กรุณาถ่ายรูปยืนยันการรับก่อน");
      return;
    }
    try {
      const res = await submit(user, notes || undefined);
      router.replace(
        `/(mini-apps)/shop-stock-receive/result?queued=${res.queued ? 1 : 0}`,
      );
    } catch (e) {
      console.error(e);
      Alert.alert("ส่งไม่สำเร็จ", "เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>ตรวจสอบก่อนส่ง</Text>
      <Text style={styles.h2}>{transferNumber} · สาขา {branchCode}</Text>

      {capturedImageUri && (
        <Image source={{ uri: capturedImageUri }} style={styles.image} />
      )}

      {items.map((i) => (
        <View key={i.barcode} style={styles.row}>
          <Text style={styles.name}>{i.productName}</Text>
          <Text style={styles.sub}>{i.barcode}</Text>
          <Text style={styles.sub}>
            Sales {i.salesQty} · Test {i.testQty} · Mkt {i.mktQty}
          </Text>
        </View>
      ))}

      <Text style={styles.label}>หมายเหตุ (ถ้ามี)</Text>
      <TextInput
        style={styles.notes}
        multiline
        placeholder="เช่น ของเสียหาย 2 กล่อง"
        value={notes}
        onChangeText={setNotes}
      />

      <Pressable
        style={[styles.btn, isSubmitting && styles.disabled]}
        disabled={isSubmitting}
        onPress={onSubmit}
      >
        <Text style={styles.btnText}>
          {isSubmitting ? "กำลังส่ง..." : "📤 ยืนยันการรับสินค้า"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  h1: { fontSize: 20, fontWeight: "700" },
  h2: { color: "#666", marginBottom: 12 },
  image: { width: "100%", height: 220, borderRadius: 12, marginBottom: 12 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  name: { fontWeight: "600" },
  sub: { color: "#666", fontSize: 12 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 6 },
  notes: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, minHeight: 70, textAlignVertical: "top" },
  btn: { backgroundColor: "#10B981", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 20 },
  disabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
```

- [ ] **Step 2: สร้าง `result.tsx`**

```typescript
import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ShopStockReceiveResult() {
  const { queued } = useLocalSearchParams<{ queued?: string }>();
  const reset = useShopStockReceiveStore((s) => s.reset);
  const isQueued = queued === "1";

  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{isQueued ? "🕒" : "✅"}</Text>
      <Text style={styles.title}>
        {isQueued ? "บันทึกแล้ว รอส่งเมื่อเน็ตกลับมา" : "รับสินค้าสำเร็จ"}
      </Text>
      <Text style={styles.sub}>
        {isQueued
          ? "ระบบจะส่งข้อมูลอัตโนมัติเมื่ออินเทอร์เน็ตกลับมา"
          : "ข้อมูลถูกบันทึกเรียบร้อย"}
      </Text>
      <Pressable
        style={styles.btn}
        onPress={() => router.replace("/(mini-apps)/shop-stock-receive")}
      >
        <Text style={styles.btnText}>รับสินค้าใบถัดไป</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  icon: { fontSize: 64 },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  sub: { color: "#666", textAlign: "center" },
  btn: { backgroundColor: "#10B981", padding: 14, borderRadius: 8, marginTop: 20, paddingHorizontal: 32 },
  btnText: { color: "#fff", fontWeight: "700" },
});
```

- [ ] **Step 3: lint + manual full-flow (online)**

Run: `cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10`
Manual (`npm start`): index → พิมพ์/สแกน transfer (สาขาตรง) → form สแกนสินค้า → กรอก qty → ＋เพิ่ม → ถัดไป → camera ถ่ายรูป → review → ยืนยัน → result "สำเร็จ". เช็คใน Firestore console (named DB) ว่ามี doc ใน `shopStockReceives` + รูปใน Storage `shop-stock-receives/...`.
Expected: lint ผ่าน; doc + รูปถูกสร้าง

- [ ] **Step 4: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add "app/(mini-apps)/shop-stock-receive/review.tsx" "app/(mini-apps)/shop-stock-receive/result.tsx" && git commit -m "feat(shop-stock-receive): add review and result screens"
```

---

## Task 10: History screen + launcher entry + storage/index rules

**Files:**
- Create: `app/(mini-apps)/shop-stock-receive/history.tsx`
- Modify: `constants/mini-apps.ts`
- Modify: `storage.rules`
- Modify: `firestore.indexes.json`

**Interfaces:**
- Consumes: `getQueuedReceives` (queue), Firestore read of `shopStockReceives` by `receivedBy`.
- Produces: launcher entry id `shop-stock-receive`; storage path + indexes deployed.

- [ ] **Step 1: เพิ่มฟังก์ชันอ่านประวัติใน `services/shop-stock-receive.service.ts`**

เพิ่มต่อท้ายไฟล์ (ใช้ import `query/where/orderBy/getDocs/limit` — เพิ่มเข้า import เดิม):

```typescript
// เพิ่มใน import จาก "firebase/firestore": getDocs, orderBy, query, where, limit
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
```

- [ ] **Step 2: สร้าง `history.tsx`**

```typescript
import { getUserReceiveHistory } from "@/services/shop-stock-receive.service";
import { getQueuedReceives, QueuedReceive } from "@/services/shop-stock-receive.queue";
import { useAuthStore } from "@/stores/auth.store";
import { ShopStockReceive } from "@/types";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

export default function ShopStockReceiveHistory() {
  const user = useAuthStore((s) => s.user);
  const [synced, setSynced] = useState<ShopStockReceive[]>([]);
  const [pending, setPending] = useState<QueuedReceive[]>([]);

  useEffect(() => {
    (async () => {
      if (user?.uid) setSynced(await getUserReceiveHistory(user.uid));
      setPending(await getQueuedReceives());
    })();
  }, [user?.uid]);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>ประวัติการรับสินค้า</Text>
      {pending.length > 0 && (
        <Text style={styles.pending}>รอส่ง {pending.length} รายการ</Text>
      )}
      <FlatList
        data={synced}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Text style={styles.empty}>ยังไม่มีประวัติ</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.transferNumber}</Text>
            <Text style={styles.sub}>
              สาขา {item.branchCode} · {item.totalItems} รายการ
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  h1: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  pending: { color: "#D97706", marginBottom: 8 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  name: { fontWeight: "600" },
  sub: { color: "#666", fontSize: 12 },
});
```

- [ ] **Step 3: เพิ่ม entry ใน `constants/mini-apps.ts`** (วางต่อจาก entry `delivery-receive`)

```typescript
{
  id: "shop-stock-receive",
  name: "รับสินค้า (Transfer)",
  description: "สแกน QR ใบส่งของ รับสินค้าเข้าสาขา",
  icon: "download-outline",
  color: "#0EA5E9",
  bgColor: "#E0F2FE",
  gradientColors: ["#0EA5E9", "#0369A1"],
  route: "/(mini-apps)/shop-stock-receive",
  category: "inventory",
},
```

- [ ] **Step 4: เพิ่ม block ใน `storage.rules`** (ต่อจาก block `delivery-receives`)

```
// ==================== SHOP STOCK RECEIVE IMAGES ====================
// Path: shop-stock-receives/{userId}/{date}/{filename}
match /shop-stock-receives/{userId}/{allPaths=**} {
  allow write: if isAuthenticated() && request.auth.uid == userId
               && request.resource.size < 10 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
  allow read: if isAuthenticated();
}
```

- [ ] **Step 5: เพิ่ม index ใน `firestore.indexes.json`** (เพิ่มใน array `indexes`)

```json
{
  "collectionGroup": "shopStockReceives",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "receivedBy", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "shopStockReceives",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "branchId", "order": "ASCENDING" },
    { "fieldPath": "receivedAt", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 6: lint + deploy rules/indexes (ทั้ง 2 named DB ตาม firebase.json)**

Run:
```bash
cd /Users/itswatthachai/super-fitt && npm run lint 2>&1 | tail -10
firebase deploy --only firestore:indexes,storage --project fittbsa 2>&1 | tail -15
```
Expected: lint ผ่าน; indexes + storage rules deploy สำเร็จ (ถ้าไม่มีสิทธิ์ deploy ให้ข้ามและแจ้งผู้ใช้รัน deploy เอง)
Manual: เปิดแอป launcher เห็นปุ่ม "รับสินค้า (Transfer)" → กดเข้า mini-app ได้ → หน้า history แสดง

- [ ] **Step 7: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add "app/(mini-apps)/shop-stock-receive/history.tsx" services/shop-stock-receive.service.ts constants/mini-apps.ts storage.rules firestore.indexes.json && git commit -m "feat(shop-stock-receive): add history screen, launcher entry, storage rules + indexes"
```

---

## Task 11: Offline end-to-end verification

**Files:** (ไม่มีไฟล์ใหม่ — verification task)

- [ ] **Step 1: ทดสอบ flow offline**

Manual (`npm start`, อุปกรณ์/emulator):
1. ก่อนตัดเน็ต: เข้า mini-app ครั้งหนึ่งตอนออนไลน์ (เพื่อ preload product cache)
2. เปิด Airplane mode / ตัดเน็ต
3. สแกน/พิมพ์ transfer → form สแกนสินค้า (ต้อง resolve จาก cache ได้) → กรอก qty → camera ถ่ายรูป → review → ยืนยัน
4. result ต้องขึ้น "บันทึกแล้ว รอส่งเมื่อเน็ตกลับมา"
5. ดู history → เห็น "รอส่ง 1 รายการ"
6. เปิดเน็ตกลับ → NetInfo listener (หน้า index) trigger `flushQueue`
7. กลับเข้า history → pending = 0; doc ปรากฏใน Firestore `shopStockReceives` + รูปใน Storage

Expected: ครบทุกข้อ; ไม่มี data หาย

- [ ] **Step 2: Commit (ถ้ามีแก้ระหว่างทดสอบ) หรือข้าม**

```bash
cd /Users/itswatthachai/super-fitt && git status
```

---

## Task 12: Open API (GET) for ITP pull

**Files:**
- Create: `platform-web/app/api/shop-stock-receive/route.ts`
- Create: `platform-web/docs/shop-stock-receive/openapi.yaml`

**Interfaces:**
- Consumes: `adminDb` (`@/lib/firebase-admin`), `withApiKeyAuth/getCorsHeaders/handleCorsOptions` (`@/lib/watson/api-utils`).
- Produces: `GET /api/shop-stock-receive` (X-API-Key) envelope `{success,data,meta}`.

- [ ] **Step 1: สร้าง `platform-web/app/api/shop-stock-receive/route.ts`**

```typescript
import { adminDb } from "@/lib/firebase-admin";
import {
  getCorsHeaders,
  handleCorsOptions,
  withApiKeyAuth,
} from "@/lib/watson/api-utils";
import { NextRequest, NextResponse } from "next/server";

function tsToISO(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

export async function OPTIONS(): Promise<NextResponse> {
  return handleCorsOptions();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withApiKeyAuth(req, async () => {
    try {
      const url = new URL(req.url);
      const p = (k: string) => url.searchParams.get(k) || undefined;

      const companyId = p("company_id");
      const branchId = p("branch_id");
      const branchCode = p("branch_code");
      const transferNumber = p("transfer_number");
      const startDateStr = p("start_date");
      const endDateStr = p("end_date");

      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
        200,
      );
      const offset = Math.max(
        parseInt(url.searchParams.get("offset") || "0", 10),
        0,
      );

      let q: FirebaseFirestore.Query = adminDb.collection("shopStockReceives");
      if (companyId) q = q.where("companyId", "==", companyId);
      if (branchId) q = q.where("branchId", "==", branchId);
      if (branchCode) q = q.where("branchCode", "==", branchCode);
      if (transferNumber) q = q.where("transferNumber", "==", transferNumber);

      const startDate = startDateStr ? new Date(startDateStr) : null;
      const endDate = endDateStr ? new Date(endDateStr) : null;
      if (startDate && !isNaN(startDate.getTime()))
        q = q.where("receivedAt", ">=", startDate);
      if (endDate && !isNaN(endDate.getTime()))
        q = q.where("receivedAt", "<=", endDate);

      q = q.orderBy("receivedAt", "desc");

      const snapshot = await q.get();
      const total = snapshot.docs.length;
      const paged = snapshot.docs.slice(offset, offset + limit);

      const data = paged.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          transferNumber: d.transferNumber ?? null,
          branchCode: d.branchCode ?? null,
          branchId: d.branchId ?? null,
          branchName: d.branchName ?? null,
          companyId: d.companyId ?? null,
          receiver: {
            userId: d.receivedBy ?? null,
            name: d.receivedByName ?? null,
            email: d.receivedByEmail ?? null,
          },
          items: Array.isArray(d.items)
            ? d.items.map((it: Record<string, unknown>) => ({
                barcode: it.barcode ?? null,
                sku: it.sku ?? null,
                productName: it.productName ?? null,
                salesQty: it.salesQty ?? 0,
                testQty: it.testQty ?? 0,
                mktQty: it.mktQty ?? 0,
              }))
            : [],
          totalItems: d.totalItems ?? 0,
          imageUrl: d.imageUrl ?? null,
          watermark: d.watermarkData ?? null,
          notes: d.notes ?? null,
          syncStatus: d.syncStatus ?? null,
          receivedAt: tsToISO(d.receivedAt),
          createdAt: tsToISO(d.createdAt),
        };
      });

      return NextResponse.json(
        { success: true, data, meta: { total, limit, offset, returned: data.length } },
        { headers: getCorsHeaders() },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[shop-stock-receive][GET]", message);
      return NextResponse.json(
        { success: false, error: { error: "Internal Server Error", message, code: "INTERNAL_ERROR" } },
        { status: 500, headers: getCorsHeaders() },
      );
    }
  });
}
```

- [ ] **Step 2: สร้าง `platform-web/docs/shop-stock-receive/openapi.yaml`**

```yaml
openapi: 3.1.0
info:
  title: Shop Stock Receive API
  version: 1.0.0
  description: |
    API ให้ ITP/ระบบภายนอกดึงข้อมูลการรับสินค้าเข้าสาขา (Firestore `shopStockReceives`)
    รวม Sales/Test/Mkt qty, รูปยืนยัน, watermark.
    **Authentication:** `X-API-Key` header.
servers:
  - url: https://app.fittbsa.com
    description: Production
  - url: https://uat-app.fittbsa.com
    description: Sandbox
security:
  - ApiKeyAuth: []
paths:
  /api/shop-stock-receive:
    get:
      summary: ดึงข้อมูลการรับสินค้า (Transfer)
      operationId: getShopStockReceives
      parameters:
        - { name: company_id, in: query, schema: { type: string } }
        - { name: branch_id, in: query, schema: { type: string } }
        - { name: branch_code, in: query, schema: { type: string }, example: "BL 41060" }
        - { name: transfer_number, in: query, schema: { type: string }, example: "SR-20260617-7" }
        - { name: start_date, in: query, schema: { type: string, format: date } }
        - { name: end_date, in: query, schema: { type: string, format: date } }
        - { name: limit, in: query, schema: { type: integer, default: 50, maximum: 200 } }
        - { name: offset, in: query, schema: { type: integer, default: 0 } }
      responses:
        "200":
          description: รายการการรับสินค้า
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
```

- [ ] **Step 3: lint + build (web)**

Run:
```bash
cd /Users/itswatthachai/super-fitt/platform-web && npm run lint 2>&1 | tail -10 && npm run build 2>&1 | tail -15
```
Expected: lint ผ่าน; build สำเร็จ (route `/api/shop-stock-receive` ปรากฏใน output)

- [ ] **Step 4: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add platform-web/app/api/shop-stock-receive/route.ts platform-web/docs/shop-stock-receive/openapi.yaml && git commit -m "feat(shop-stock-receive): add GET open API for ITP + openapi spec"
```

---

## Task 13: Dashboard read API + page

**Files:**
- Create: `platform-web/app/api/dashboard/shop-stock-receive/route.ts`
- Create: `platform-web/app/dashboard-vendor-center/stock-receive/page.tsx`

**Interfaces:**
- Consumes: `adminAuth`, `adminDb` (`@/lib/firebase-admin`), `getCorsHeaders` (`@/lib/watson/api-utils`), `useAuthStore` (web).
- Produces: `GET /api/dashboard/shop-stock-receive` (Bearer) scoped by company; page render ตาราง.

- [ ] **Step 1: สร้าง `platform-web/app/api/dashboard/shop-stock-receive/route.ts`** (BFF — verify ID token + scope company/branch)

```typescript
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getCorsHeaders } from "@/lib/watson/api-utils";
import { NextRequest, NextResponse } from "next/server";

function tsToISO(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: getCorsHeaders() },
      );
    }
    const decoded = await adminAuth.verifyIdToken(
      authHeader.slice("Bearer ".length),
    );
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }
    const userData = userDoc.data() || {};
    const companyId =
      typeof userData.companyId === "string" ? userData.companyId : "";
    const role = typeof userData.role === "string" ? userData.role : "employee";
    const userBranchId =
      typeof userData.branchId === "string" ? userData.branchId : "";
    const managedBranchIds = Array.isArray(userData.managedBranchIds)
      ? userData.managedBranchIds.filter((v): v is string => typeof v === "string")
      : [];

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "No company scope" },
        { status: 403, headers: getCorsHeaders() },
      );
    }

    let q: FirebaseFirestore.Query = adminDb
      .collection("shopStockReceives")
      .where("companyId", "==", companyId)
      .orderBy("receivedAt", "desc");

    const url = new URL(req.url);
    const branchCode = url.searchParams.get("branch_code") || undefined;
    if (branchCode) q = q.where("branchCode", "==", branchCode);

    const snapshot = await q.get();

    // branch-scope สำหรับ manager/supervisor
    const allowed =
      role === "manager" || role === "supervisor"
        ? new Set(
            managedBranchIds.length > 0
              ? managedBranchIds
              : userBranchId
                ? [userBranchId]
                : [],
          )
        : null;

    const data = snapshot.docs
      .map((docSnap) => {
        const d = docSnap.data();
        if (allowed && !allowed.has(d.branchId)) return null;
        return {
          id: docSnap.id,
          transferNumber: d.transferNumber ?? null,
          branchCode: d.branchCode ?? null,
          branchName: d.branchName ?? null,
          receiverName: d.receivedByName ?? null,
          totalItems: d.totalItems ?? 0,
          imageUrl: d.imageUrl ?? null,
          syncStatus: d.syncStatus ?? null,
          items: d.items ?? [],
          receivedAt: tsToISO(d.receivedAt),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json(
      { success: true, data },
      { headers: getCorsHeaders() },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/shop-stock-receive][GET]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
```

- [ ] **Step 2: สร้าง `platform-web/app/dashboard-vendor-center/stock-receive/page.tsx`**

```typescript
"use client";

import { auth } from "@/lib/firebase";
import { useEffect, useState } from "react";

interface ReceiveRow {
  id: string;
  transferNumber: string | null;
  branchCode: string | null;
  branchName: string | null;
  receiverName: string | null;
  totalItems: number;
  syncStatus: string | null;
  receivedAt: string | null;
}

export default function StockReceivePage() {
  const [rows, setRows] = useState<ReceiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
        const token = await user.getIdToken();
        const res = await fetch("/api/dashboard/shop-stock-receive", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
        setRows(json.data as ReceiveRow[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">การรับสินค้า (Transfer)</h1>
      {loading && <p>กำลังโหลด...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Transfer</th>
              <th>สาขา</th>
              <th>ผู้รับ</th>
              <th>รายการ</th>
              <th>สถานะ</th>
              <th>เวลา</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.transferNumber}</td>
                <td>{r.branchCode}</td>
                <td>{r.receiverName}</td>
                <td>{r.totalItems}</td>
                <td>{r.syncStatus}</td>
                <td>{r.receivedAt ? new Date(r.receivedAt).toLocaleString("th-TH") : "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

> **หมายเหตุ:** ตรวจว่า web `lib/firebase.ts` export `auth` — ถ้าใช้ pattern อื่น (เช่น `useAuthStore().user.getIdToken()`) ให้ปรับการดึง token ให้ตรงกับ dashboard page อื่นๆ ใน repo (ดู Task reference: dashboard page ใช้ `useAuthStore`/`user.getIdToken()`).

- [ ] **Step 3: lint + build (web)**

Run:
```bash
cd /Users/itswatthachai/super-fitt/platform-web && npm run lint 2>&1 | tail -10 && npm run build 2>&1 | tail -15
```
Expected: lint + build ผ่าน; route + page ปรากฏใน build output
Manual: `npm run dev` → login เป็น admin → เปิด `/dashboard-vendor-center/stock-receive` → เห็นตาราง (มีข้อมูลถ้า Task 9 สร้าง doc ไว้)

- [ ] **Step 4: Commit**

```bash
cd /Users/itswatthachai/super-fitt && git add platform-web/app/api/dashboard/shop-stock-receive/route.ts platform-web/app/dashboard-vendor-center/stock-receive/page.tsx && git commit -m "feat(shop-stock-receive): add dashboard read API + page"
```

---

## Self-Review Notes

- **Spec coverage:** scan QR (Task 6) ✓ · branch enforce (Task 4 `branchMatches` + Task 5/6) ✓ · scan product → Firestore products match barcode/sku (Task 2/4/7) ✓ · Sales/Test/Mkt + ≥1>0 (Task 7) ✓ · batch กันซ้ำ/ลบ (Task 5/7) ✓ · photo+watermark (Task 8) ✓ · notes+review+submit (Task 9) ✓ · offline queue+flush (Task 3/5/6/11) ✓ · product cache offline (Task 3/4/6) ✓ · Firestore `shopStockReceives`+index (Task 1/10) ✓ · storage.rules (Task 10) ✓ · Open API + openapi (Task 12) ✓ · dashboard (Task 13) ✓ · launcher entry (Task 10) ✓
- **Type consistency:** `submit()` คืน `{id, queued}` (store Task 5) ใช้โดย review (Task 9) ✓ · `resolveProduct(companyId, code, online)` signature ตรงระหว่าง service (Task 4) และ form (Task 7) ✓ · `QueuedReceive.record` = `Omit<...,"imageUrl"|...>` ตรงกับ flush (Task 5) ✓
- **Known follow-ups (ไม่บล็อก):** ค่าจริงของ `user.branchCode/branchName` อาจต้องปรับ `branchMatches`; ตรวจ web token pattern (`auth` vs `useAuthStore`) ใน Task 13.

---

## Execution Handoff

ดู "Which approach?" ด้านล่าง
