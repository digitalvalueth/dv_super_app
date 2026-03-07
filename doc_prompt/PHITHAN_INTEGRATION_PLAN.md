# Phithan SQL Server Integration — Implementation Plan

สรุปการเชื่อมต่อระบบ Phithan ERP (Azure SQL Server) กับ Super FITT App

---

## สถานะปัจจุบัน

| รายการ                      | สถานะ                              |
| --------------------------- | ---------------------------------- |
| ติดตั้ง `mssql` package     | ✅ เสร็จ                           |
| สร้าง DB connection lib     | ✅ เสร็จ (`lib/phithan-db.ts`)     |
| สร้าง API routes            | ✅ เสร็จ (4 routes)                |
| อัปเดตหน้า Stock Comparison | ✅ เสร็จ                           |
| Azure Firewall whitelist    | ❌ **ต้องทำ** — IP ยังไม่ได้เปิด   |
| Azure Queue SDK             | ❌ ยังไม่ติดตั้ง (ไม่จำเป็นตอนนี้) |

---

## Part 1: Database Connection (`lib/phithan-db.ts`)

**ไฟล์:** `platform-web/lib/phithan-db.ts`

สร้าง connection pool แบบ singleton สำหรับเชื่อมต่อ Azure SQL Server:

- Server: `phithandata.database.windows.net`
- Database: `phithandata`
- Tables ที่เอกสารระบุ: `Reorder` (SR Orders), `Employee` (พนักงาน)
- Data อัปเดต **nightly** จาก Operational DB (สามารถเพิ่มความถี่ได้)

**ฟังก์ชันที่มี:**

- `getPhithanPool()` — singleton connection pool
- `testConnection()` — ทดสอบ connection
- `listTables()` — แสดงทุกตาราง
- `getTableColumns(table)` — ดูคอลัมน์
- `getTableStats(table)` — row count + last modified
- `fetchReorderData(options)` — ดึง SR Orders
- `fetchEmployeeData(options)` — ดึงพนักงาน
- `runQuery(sql)` — generic query (สำหรับสำรวจ)

---

## Part 2: API Routes (4 routes)

### 2.1 สำรวจ DB — `GET /api/phithan/explore`

- ดูทุกตาราง + คอลัมน์ + sample data
- ใช้ตอน setup เพื่อดูว่า DB มีอะไรบ้าง

### 2.2 ดึง Reorder — `GET /api/phithan/reorder`

- Query params: `?location=xxx&transferNumber=xxx&limit=100`
- ดึง SR Orders จากตาราง Reorder

### 2.3 ดึง Employee — `GET /api/phithan/employee`

- Query params: `?employeeId=xxx&limit=100`
- ดึงข้อมูลพนักงาน

### 2.4 เปรียบเทียบสต็อก — `GET /api/phithan/stock-comparison`

- ดึง Reorder data จาก SQL Server
- ดึง counting sessions จาก Firestore
- เปรียบเทียบ barcode-by-barcode
- Return: summary + comparisons array

### 2.5 Azure Queue — `POST /api/phithan/queue`

- ส่ง ShopReceive message ไป Azure Queue
- Format ตาม ITP spec: `Location|TransferNumber|ReceiverID|...`
- ⚠️ ต้องติดตั้ง `@azure/storage-queue` + ตั้ง `AZURE_STORAGE_CONNECTION_STRING`

---

## Part 3: หน้า Stock Comparison (อัปเดตแล้ว)

**ไฟล์:** `platform-web/app/stock-counter/dashboard/reports/stock-comparison/page.tsx`

**สิ่งที่เพิ่ม:**

- ตรวจสอบ connection Phithan DB อัตโนมัติ
- สถานะ connection (เขียว/แดง) พร้อม error message
- Toggle เลือกแหล่งข้อมูล: **Phithan DB (จริง)** vs **Mock Data (ทดสอบ)**
- ถ้า DB เชื่อมไม่ได้ → fallback เป็น mock อัตโนมัติ
- ตารางแสดง Transfer# + สาขา (เมื่อใช้ Phithan DB)
- Export CSV

---

## สิ่งที่ต้องทำต่อ (Action Items)

### ⚡ ด่วน — Static IP + Azure Firewall

**ปัญหา:** Cloud Run ไม่มี VPC connector → egress IP เปลี่ยนตลอด → Azure Firewall whitelist ไม่ได้

**วิธีแก้:** สร้าง Cloud NAT + Static IP (1 ครั้ง ~10 นาที, ~$10-15/เดือน)

```bash
cd platform-web && bash scripts/setup-cloud-nat.sh
```

Script จะ:

1. จอง Static IP (เช่น `34.xxx.xxx.xxx`)
2. สร้าง VPC subnet + connector
3. สร้าง Cloud Router + NAT
4. อัปเดต Cloud Run ทั้ง sandbox + production ให้ใช้ VPC connector

จากนั้นส่ง Static IP ให้ ITP whitelist ใน Azure:

```sql
EXEC sp_set_firewall_rule N'FITT-CloudRun', '<STATIC_IP>', '<STATIC_IP>';
```

**Deployment:**

- `uat-app.fittbsa.com` (sandbox) — Cloud Run `fittbsa-admin-web-dev`
- `app.fittbsa.com` (production) — Cloud Run `fittbsa-admin-web-prod`
- ทั้งคู่อยู่ `asia-southeast1`, deploy ผ่าน Cloud Build
- Phithan DB env vars ถูกเพิ่มใน `cloudbuild-sandbox.yaml` + `cloudbuild-production.yaml` แล้ว
  → ต้องตั้ง `_PHITHAN_DB_USER` + `_PHITHAN_DB_PASSWORD` ใน Cloud Build Trigger

### 📋 หลัง Firewall เปิดแล้ว

1. **รัน explore script:**

   ```bash
   cd platform-web && npx tsx scripts/explore-phithan-db.ts
   ```

   จะเห็นตาราง, คอลัมน์, sample data, วันที่อัปเดตล่าสุด

2. **ดูผ่าน API:**
   เปิดหน้า web admin → Stock Comparison → จะเชื่อมต่ออัตโนมัติ
3. **ตรวจสอบชื่อคอลัมน์จริง:**
   ชื่อคอลัมน์ใน code อาจไม่ตรงกับ DB จริง (เช่น `ProductBarcode` อาจเป็น `Barcode` หรือ `SKU`)
   ดูจาก explore script แล้วมาปรับ `lib/phithan-db.ts` + `api/phithan/stock-comparison/route.ts`

### 🔮 Phase 2 — Azure Queue (ShopReceive)

เมื่อต้องการส่งข้อมูลกลับ:

```bash
cd platform-web && npm install @azure/storage-queue
```

ตั้ง env:

```
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...
AZURE_QUEUE_NAME=ShopReceiveQueue
```

### 🔮 Phase 3 — หน้ารับสินค้า (Delivery + ShopReceive)

เชื่อมหน้า Delivery (`/stock-counter/dashboard/delivery`) กับ:

- QR code scan → ดึง SR order จาก Reorder table
- แสดงรายการ SKU ที่ต้องรับ
- พนักงานนับ + กรอก qty
- ส่ง message ไป Azure Queue

### 🔮 Phase 4 — Offline Mode

- ใช้ AsyncStorage / IndexedDB cache ข้อมูล SR order
- Retry logic สำหรับส่ง Queue message
- สำหรับสาขาที่สัญญาณไม่ดี

---

## File Map

```
platform-web/
├── lib/
│   └── phithan-db.ts              ← DB connection + queries
├── app/api/phithan/
│   ├── explore/route.ts           ← สำรวจ DB
│   ├── reorder/route.ts           ← ดึง SR Orders
│   ├── employee/route.ts          ← ดึงพนักงาน
│   ├── stock-comparison/route.ts  ← เปรียบเทียบสต็อก
│   └── queue/route.ts             ← ส่ง Azure Queue
├── app/stock-counter/dashboard/
│   └── reports/stock-comparison/
│       └── page.tsx               ← หน้า UI (อัปเดตแล้ว)
├── scripts/
│   └── explore-phithan-db.ts      ← Script สำรวจ DB
└── .env.example                   ← เพิ่ม PHITHAN_DB_* vars
```

---

## ข้อมูลจาก Phithan DB ที่ใช้ได้

ตามเอกสาร spec:

| ตาราง      | ข้อมูล                            | ใช้กับฟีเจอร์               |
| ---------- | --------------------------------- | --------------------------- |
| `Reorder`  | SR Orders (คำสั่งส่งสินค้าไปสาขา) | เปรียบเทียบสต็อก, รับสินค้า |
| `Employee` | ชื่อ/ID พนักงาน                   | ระบุตัวผู้รับ, เช็คชื่อ     |

- Data อัปเดต **nightly** (สามารถขอเพิ่มความถี่ได้)
- แต่ละ SR มีไม่เกิน 50 SKU
- การรับสินค้าเกิดวันละ 1-2 ครั้ง
