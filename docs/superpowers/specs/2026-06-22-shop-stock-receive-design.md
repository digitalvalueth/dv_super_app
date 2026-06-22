# Shop StockReceive (มือถือ) — Design Spec

วันที่: 2026-06-22
แอป: Mobile super-app (Expo / React Native, repo root) + Platform web (Open API)
สถานะ: รออนุมัติเพื่อทำ implementation plan

## 1. ปัญหา / เป้าหมาย

พนักงานสาขาต้อง "รับสินค้า" ที่ถูกส่งมาตาม reorder/transfer จากคลังกลาง (PhithanLife) ผ่านมือถือ
ใบส่งของ (Consign Delivery Order) มี QR code ที่บรรจุ **เลข transfer + รหัสสาขา** เท่านั้น
ต้องการ mini-app ใหม่ที่:

- สแกน QR เพื่อดึง transfer number + สาขาอัตโนมัติ (หรือพิมพ์เลข TN# เองเป็น fallback)
- ให้พนักงานสแกน barcode ตัวสินค้าจริงในกล่อง แล้ว map กับ product master ในระบบเรา
- กรอกจำนวนรับ 3 ช่อง: Sales Qty / Test Qty / Mkt Qty (อย่างน้อย 1 ช่อง > 0)
- เพิ่มหลายสินค้าเข้า batch, กันซ้ำ, ลบได้, ใส่ notes
- review แล้ว submit
- **รองรับ offline**: ถ้าเน็ตไม่ดี เก็บคิวไว้ส่งทีหลังตอนเน็ตกลับมา
- ฝั่ง ITP มาดึงข้อมูล receives ผ่าน Open API ได้
- มีหน้า dashboard ฝั่งเว็บไว้ดู receives

## 2. ข้อเท็จจริงจากการสำรวจโค้ด (load-bearing)

- **QR บนใบส่งของเป็นของ PhithanLife (ระบบภายนอก)** — เราไม่ได้ generate เอง. payload คือสตริง `SR-20260617-7 && BL 41060` (transfer `&&` สาขา) **ไม่มีรายการสินค้า**
- **Product master อยู่ใน Firestore collection `products`** (`types/index.ts:118`): มีทั้ง `barcode` และ `sku`, scope ด้วย `companyId`. ของจริงในใบส่งของ `BARCODE = UF-001-M` = ค่าเดียวกับ `sku` → **lookup ต้อง match ทั้ง `barcode` และ `sku`**
- ปัจจุบัน **ไม่มี `getProductByBarcode` แบบ exact-match** — `searchProducts` โหลดสินค้าทั้งบริษัทมา filter ฝั่ง client. ต้องเพิ่ม query แบบ `where("barcode","==",code)` / `where("sku","==",code)` ใหม่
- มี `POST /api/phithan/queue` (ShopReceiveMessage pipe-delimited) แต่ **Azure Queue ถูกปิดอยู่** (`success:false, "Azure Queue not configured"`) และ pipe-format **ไม่มีช่อง Mkt Qty** → ไม่ใช้เส้นทางนี้
- มี `GET /api/phithan/reorder?transferNumber=...` (Phithan SQL `[dbo].[Reorder]`) แต่ **ตัดสินใจไม่พึ่ง** (ต่อ SQL ต้อง IP allowlist + offline-first)
- mini-app เดิม `delivery-receive/` เป็น photo+watermark เขียน Firestore ตรง **ไม่มี offline / queue / batch line-item** → ต้องสร้าง pattern offline ใหม่
- Barcode scanning ใช้ `expo-camera` `CameraView.onBarcodeScanned` (อ้างอิง `app/(mini-apps)/stock-counter/camera.tsx`); ต้องเพิ่ม type `qr` สำหรับสแกน QR
- Open API ฝั่งเว็บมี pattern พร้อม: `app/api/employee-photos/route.ts` ใช้ `withApiKeyAuth` (header `X-API-Key`, คีย์ `wv_...`) จาก `lib/watson/api-utils.ts` + `lib/watson-firebase.ts:validateApiKey`. envelope `{success, data, meta}`. **คัดลอกเป็น template ได้เลย**

## 3. การตัดสินใจ (decisions)

1. **ไม่ตรวจว่าสินค้าอยู่ใน transfer จริงไหม** — QR ไม่มีรายการ และไม่พึ่ง reorder API. พนักงานดูกล่อง สแกน barcode สินค้าจริง map กับ `products` ในระบบเราล้วนๆ
2. **บังคับสาขาตรง** — ถ้า `branchCode` จาก QR ไม่ตรงกับสาขาของพนักงาน → บล็อก ไม่ให้รับ
3. **มีหน้า dashboard ฝั่งเว็บ** ไว้ดู receives
4. **ส่งเข้า ITP ผ่าน GET Open API** (ITP มา pull) ไม่ใช่ push เข้า Azure Queue — เก็บ `mktQty` เป็น JSON field ได้
5. **Product lookup**: Firestore `products` (match barcode OR sku); pre-cache ลง local เพื่อใช้ตอน offline

## 4. สถาปัตยกรรม

### 4.1 Route ใหม่ (mobile) `app/(mini-apps)/shop-stock-receive/`

| ไฟล์ | หน้าที่ |
|------|---------|
| `_layout.tsx` | Stack: index → form → review → result; history |
| `index.tsx` | สแกน QR (camera) หรือพิมพ์ TN# เอง → parse → ตรวจสาขา → แสดง Shop Location → ไป form |
| `form.tsx` | หน้ารวม batch + ปุ่ม "สแกนสินค้า" (เปิด scanner) → resolve product → กรอก Sales/Test/Mkt → ➕ เพิ่ม (กันซ้ำ) / ✕ ลบ |
| `review.tsx` | ตรวจทั้งหมด + Notes → Submit |
| `result.tsx` | สำเร็จ (online เขียน Firestore) หรือ "เข้าคิวรอส่ง" (offline) |
| `history.tsx` | receives ย้อนหลังของ user + แสดงรายการที่ `syncStatus = pending` |

เพิ่มปุ่มเข้า launcher grid ใน `constants/mini-apps.ts`

หมายเหตุ scanner: ใช้ `CameraView` เดียวกับ stock-counter; โหมด QR (`barcodeTypes: ["qr"]`) ในหน้า index, โหมด product barcode (`ean13, ean8, upc_a, upc_e, code128, code39`) ในหน้า form. อาจทำเป็น component `BarcodeScannerModal` ใช้ร่วม

### 4.2 Types (`types/index.ts`)

```ts
interface ShopStockReceiveItem {
  productId: string;
  barcode: string;        // ค่าที่สแกนได้
  sku?: string;
  productName: string;
  salesQty: number;
  testQty: number;
  mktQty: number;
}

type ShopStockReceiveSyncStatus = "pending" | "synced";

interface ShopStockReceive {
  id: string;
  transferNumber: string;     // "SR-20260617-7"
  branchCode: string;         // "BL 41060"
  companyId: string;
  branchId: string;
  branchName?: string;
  items: ShopStockReceiveItem[];
  totalItems: number;
  receivedBy: string;         // userId
  receivedByName: string;
  receivedByEmail?: string;
  receivedAt: Timestamp;
  notes?: string;
  syncStatus: ShopStockReceiveSyncStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

Firestore collection ใหม่: **`shopStockReceives`** (scope `companyId` + `branchId`)

### 4.3 Service `services/shop-stock-receive.service.ts`

```ts
parseTransferQR(raw: string): { transferNumber: string; branchCode: string } | null
  // split ด้วย "&&", trim; ทนทั้ง prefix SR-/SN-; คืน null ถ้า format ไม่ถูก

getProductByCode(companyId: string, code: string): Promise<Product | null>
  // exact: where("barcode","==",code) OR where("sku","==",code)
  // fallback: contains-filter จาก cache (กรณี barcode มี suffix size ฯลฯ)

submitShopStockReceive(
  data: Omit<ShopStockReceive,"id"|"createdAt"|"updatedAt">
): Promise<string>
  // เขียน collection shopStockReceives, set syncStatus="synced"

cacheCompanyProducts(companyId: string): Promise<void>
  // โหลด products ทั้งบริษัทเก็บ local (AsyncStorage) เพื่อ lookup ตอน offline
```

ต้องเพิ่ม Firestore index สำหรับ `barcode` / `sku` (composite กับ `companyId`) — อัปเดต `firestore.indexes.json`

### 4.4 Offline (สร้าง pattern ใหม่)

- ใช้ `@react-native-community/netinfo` (ตรวจว่าติดตั้งหรือยัง; ถ้ายัง = เพิ่ม dependency) เช็คสถานะเน็ต
- **Submit ตอน online** → `submitShopStockReceive` เขียน Firestore ตรง (`syncStatus = "synced"`)
- **Submit ตอน offline** → เก็บ record ลง AsyncStorage queue (`syncStatus = "pending"`) + แจ้ง "บันทึกแล้ว รอส่งเมื่อเน็ตกลับมา"
- **Flush**: เมื่อเน็ตกลับมา (NetInfo listener) หรือเปิดแอป/เข้า mini-app → ส่ง pending ทั้งหมดเข้า Firestore แล้วเคลียร์ queue; ถ้าส่งไม่ผ่านคงไว้ใน queue
- **Product lookup offline**: เรียก `cacheCompanyProducts` ตอนเข้า mini-app ขณะ online; lookup อ่านจาก cache ก่อน เพื่อให้สแกนตอน offline ทำงานได้

### 4.5 Store `stores/shop-stock-receive.store.ts`

```ts
state: {
  transferNumber, branchCode, shopLocationName,
  items: ShopStockReceiveItem[],
  productCache: Product[],
  pendingQueue: ShopStockReceive[],
  isSubmitting, isOnline
}
actions:
  setTransfer(raw)            // parse + ตรวจสาขา (บังคับตรง) + set
  addItem(item)              // กันซ้ำ barcode
  removeItem(barcode)
  resolveProduct(code)       // getProductByCode (ผ่าน cache)
  submit(user, branch, notes)// online → Firestore | offline → queue
  flushQueue()
  loadHistory(userId)
  reset()
```

### 4.6 Open API ฝั่งเว็บ (ITP มาดึง)

`platform-web/app/api/shop-stock-receive/route.ts` — mirror `employee-photos/route.ts`:

- `GET` ห่อด้วย `withApiKeyAuth` (header `X-API-Key`, คีย์ `wv_...` เดิม), `OPTIONS` → `handleCorsOptions()`
- query params (snake_case): `branch_code`, `transfer_number`, `start_date`, `end_date`, `limit` (default 50, 1–200), `offset`
- query collection `shopStockReceives` (`where`/`orderBy`) → resolve users/branches → map เป็น DTO ซ้อน (`receiver{}`, `branch{}`, `items[]` รวม `mktQty`)
- envelope `{ success, data, meta:{ total, limit, offset, returned } }`, timestamps เป็น ISO
- เพิ่ม spec `platform-web/docs/shop-stock-receive/openapi.yaml` + public `platform-web/public/docs/openapi.yaml`

### 4.7 Dashboard ฝั่งเว็บ

หน้าใหม่ใต้ `platform-web/app/dashboard-vendor-center/` (เช่น `stock-receive/page.tsx`) แสดงตาราง receives: transfer, สาขา, ผู้รับ, เวลา, จำนวนรายการ, สถานะ sync; filter ตามสาขา/ช่วงวัน; กดดู line items. อ่านผ่าน API route ที่ verify Firebase ID token (ตาม pattern dashboard เดิม ไม่ใช่ X-API-Key)

## 5. Data flow

```
ใบส่งของ (PhithanLife) ──QR "SR-... && BL ..."──> [index] parse + ตรวจสาขา
กล่องสินค้า ──scan product barcode──> getProductByCode(products) ──> auto-fill ชื่อ
พนักงานกรอก Sales/Test/Mkt ──> addItem ──> batch
[review] + notes ──submit──> online: Firestore `shopStockReceives` (synced)
                              offline: AsyncStorage queue (pending) ──เน็ตกลับ──> flush ──> Firestore
Firestore `shopStockReceives` ──> GET Open API (X-API-Key) ──> ITP pull
                               └─> Dashboard ฝั่งเว็บ (ID token)
```

## 6. Error handling / edge cases

- QR format ผิด / parse ไม่ได้ → error + ให้พิมพ์ TN# เอง
- สาขาใน QR ≠ สาขาพนักงาน → บล็อก + ข้อความชัดเจน (decision 2)
- สแกน barcode แล้วไม่พบใน `products` → "ไม่พบสินค้าในระบบ" ไม่ให้เพิ่ม
- เพิ่ม barcode ซ้ำ → เตือน/รวมเข้ารายการเดิม (กันซ้ำ)
- ทุกช่อง qty = 0 → กด ➕ ไม่ได้ (อย่างน้อย 1 ช่อง > 0)
- Submit offline → ไม่ fail; เข้า queue + แจ้งผู้ใช้
- Flush แล้ว Firestore error → คง record ใน queue, retry รอบหน้า
- Cache สินค้าว่าง (เข้า offline ตั้งแต่แรก) → เตือนว่าต้องเปิดเน็ตครั้งแรกเพื่อโหลดรายการสินค้า

## 7. ขอบเขต (scope)

**ในขอบเขต:** mini-app ใหม่ (index/form/review/result/history), types, service, store, offline queue, Firestore index, GET Open API + openapi.yaml, dashboard page

**นอกขอบเขต:** generate ใบส่งของ/QR (เป็นของ PhithanLife), ต่อ Azure Queue/pipe-format, ต่อ Phithan SQL reorder, watermark รูปถ่าย (ไม่ต้องถ่ายรูปในรอบนี้)

## 8. Verify (ไม่มี test suite)

- `npm run lint` ที่ repo root (mobile) และ `cd platform-web && npm run lint && npm run build`
- รันแอปจริง: สแกน QR ตัวอย่าง → ตรวจสาขา → สแกนสินค้า → กรอก qty → submit (online) → เช็ค Firestore; ทดสอบ offline (ปิดเน็ต) → เข้า queue → เปิดเน็ต → flush
- ยิง GET Open API ด้วย `X-API-Key` เช็ค envelope + `mktQty`

## 9. Open questions (เหลือยืนยันตอนทำ)

- prefix QR จริงเป็น `SR-` หรือ `SN-` (parser ทำให้ทนทั้งคู่ไว้แล้ว)
- delimiter เป็น `&&` เสมอไหม
- `@react-native-community/netinfo` ติดตั้งแล้วหรือยัง (ถ้ายังต้องเพิ่ม)
