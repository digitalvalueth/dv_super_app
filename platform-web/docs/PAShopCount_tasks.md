# PAShopCount — Integration Plan & Task List

> **อ้างอิง:** Email จาก Paul Leong (paulleong@phithanlife.com) วันที่ 19 มี.ค. 2026  
> **วัตถุประสงค์:** ส่งข้อมูล Shop Stock Count จาก Firestore → ITP SQL Table `PAShopCount`

---

## Collection ที่ใช้

| Collection           | วัตถุประสงค์                                                    |
| -------------------- | --------------------------------------------------------------- |
| `countingSessions`   | ข้อมูลการนับดิบทั้งหมด — mobile app เขียน                       |
| `shopCountConfirmed` | **✅ ITP ใช้ collection นี้อย่างเดียว** — 1 doc ต่อสินค้าต่อรอบ |
| `countingPeriods`    | บริหารรอบการนับ (H1/H2)                                         |

### shopCountConfirmed — Document Structure

- **Document ID:** `{branchId}_{productId}_{periodId}` เช่น `WL749_SK-C250_2026-03-H1`
- ป้องกัน duplicate อัตโนมัติ — เขียนซ้ำ doc id เดิม = overwrite ค่าล่าสุด
- 1 เดือนมี **2 รอบ**: H1 (วันที่ 1–15) และ H2 (วันที่ 16–สิ้นเดือน)

---

## Field Mapping: `shopCountConfirmed` → PAShopCount

ITP query collection `shopCountConfirmed` ตรงๆ — ไม่ต้อง lookup หรือ group-by

| PAShopCount Field | SQL Type       | `shopCountConfirmed` Field | หมายเหตุ                  |
| ----------------- | -------------- | -------------------------- | ------------------------- |
| `SubmissionID`    | VARCHAR(50) PK | `submissionId`             | อ้างอิง sessionId ต้นทาง  |
| `LocationID`      | NVARCHAR(100)  | `locationId`               | branchId                  |
| `CounterID`       | NVARCHAR(50)   | `counterId`                | userId                    |
| `CounterName`     | NVARCHAR(100)  | `counterName`              |                           |
| `CountDate`       | DATETIME       | `countDate`                | Timestamp → ISO8601       |
| `Item`            | VARCHAR(50)    | `item`                     | productId เช่น "SK-C-250" |
| `Barcode`         | VARCHAR(50)    | `barcode`                  | barcode จาก products      |
| `PATotalQty`      | INT            | `paTotalQty`               | ดู Logic ด้านล่าง         |
| `PASellQty`       | INT            | `paSellQty`                | null — ITP เติมเอง        |
| `PATestQty`       | INT            | `paTestQty`                | null — ITP เติมเอง        |

### Logic: paTotalQty

```
Case A (AI ถูก, ไม่มี mismatch)
  → aiCount  — เขียนทันทีตอน session ถูก save

Case B (มี mismatch, supervisor approve แล้ว)
  → supervisorOverride.selectedCount  — เขียนหลัง supervisor กด approve
```

---

## Updated Workflow

### Case A — AI ถูกต้อง (ไม่มี mismatch)

```
พนักงานถ่ายรูป
  → AI นับ → aiCount
  → บันทึก countingSessions (status: "completed")
  → ✅ เขียน shopCountConfirmed อัตโนมัติ (source: "ai", paTotalQty = aiCount)
  → ITP ดึง shopCountConfirmed ได้เลย
```

### Case B — AI ผิด (พนักงานแจ้ง mismatch)

```
พนักงานถ่ายรูป
  → AI นับ → พนักงานกด "AI นับผิด" + ใส่ค่าที่ถูก
  → บันทึก countingSessions (status: "mismatch", userReportedCount = ค่าพนักงาน)
  → ยังไม่เขียน shopCountConfirmed (รอ supervisor)
  → Supervisor เห็น mismatch ใน web dashboard
  → Supervisor กด approve/override → เลือก source (ai / employee / custom)
  → ✅ เขียน shopCountConfirmed (source: ตามที่เลือก, paTotalQty = selectedCount)
  → ITP ดึง shopCountConfirmed ได้เลย
```

> **สรุป:** ITP ไม่ต้องรู้จัก `countingSessions` เลย — ดึงแค่ `shopCountConfirmed` อย่างเดียว

---

## shopCountConfirmed — TypeScript Interface

```typescript
export interface ShopCountConfirmed {
  id: string; // doc ID = {branchId}_{productId}_{periodId}

  // Period
  periodId: string; // "2026-03-H1" | "2026-03-H2"
  periodHalf: 1 | 2;
  periodMonth: string; // "2026-03"

  // PAShopCount fields (ส่ง ITP ได้เลย)
  submissionId: string; // → SubmissionID
  locationId: string; // → LocationID (branchId)
  counterId: string; // → CounterID (userId)
  counterName: string; // → CounterName
  countDate: Timestamp; // → CountDate
  item: string; // → Item (productId เช่น "SK-C-250")
  barcode: string; // → Barcode
  paTotalQty: number; // → PATotalQty
  paSellQty: null; // → PASellQty (placeholder)
  paTestQty: null; // → PATestQty (placeholder)

  // Metadata
  confirmedBy: string; // userId ที่ confirm (พนักงาน=Case A, supervisor=Case B)
  confirmedAt: Timestamp;
  source: "ai" | "employee" | "custom";
  originalSessionId: string; // อ้างอิงกลับ countingSessions
}
```

## countingSessions — Fields ที่เพิ่ม/แก้ไข

```typescript
{
  barcode: string;              // ⚠️ เพิ่ม — copy จาก product ตอน save
  status: "completed"           // Case A: AI ถูก
         | "mismatch"           // Case B: พนักงานแจ้งผิด
         | "approved";          // Case B: หลัง supervisor approve
  userReportedCount?: number;   // บันทึกเมื่อพนักงานแจ้งต่างจาก AI
  finalCountSource?: "ai" | "employee" | "custom";
  supervisorOverride?: { ... }; // มีอยู่แล้ว
}
```

---

## Tasks

### Phase 1 — Mobile App

**ไฟล์:** `app/(mini-apps)/stock-counter/result.tsx`  
**Service ใหม่:** `services/shopCountConfirmed.service.ts`

- [x] **[P1-1] เพิ่ม `barcode` field ใน session** — copy `params.productBarcode` เข้า session document
- [x] **[P1-2] เปลี่ยน `status → "mismatch"`** — เมื่อ `hasDispute === true` ให้ set status เป็น "mismatch" แทน "completed"
- [x] **[P1-3] เขียน `shopCountConfirmed` (Case A)** — เมื่อ session สำเร็จ (ไม่มี dispute) ให้เขียน confirmed record อัตโนมัติ
- [x] **[P1-4] สร้าง `shopCountConfirmed.service.ts`** — mobile-side service สำหรับ write `shopCountConfirmed`

---

### Phase 2 — Web Dashboard (Supervisor)

**ไฟล์:** `platform-web/app/api/supervisor/override/route.ts`  
**Service ใหม่:** `platform-web/services/shopCountConfirmed.service.ts`

- [x] **[P2-1] เขียน `shopCountConfirmed` (Case B)** — หลัง supervisor approve/override ให้เขียน confirmed record
- [x] **[P2-2] สร้าง `shopCountConfirmed.service.ts` (web)** — web-side service สำหรับ read/query `shopCountConfirmed`
- [x] **[P2-3] UI — แสดง mismatch sessions** — อัปเดต label, แสดง userReportedCount/errorRemark, เพิ่ม override UI ใน modal

---

### Phase 3 — ITP Integration

> **หมายเหตุ:** เพื่อนฝั่ง ITP จะ query `shopCountConfirmed` collection โดยตรง — ไม่ต้องสร้าง API endpoint

- [x] ~~**[P3-1] สร้าง API Endpoint**~~ — **ยกเลิก** เพื่อน ITP จะ get ข้อมูลจาก collection เอง
- [x] **[P3-2] เพิ่ม Type ใน `platform-web/types/index.ts`** — `ShopCountConfirmed` interface

---

## สถานะ

| Task                                              | สถานะ                                   | ผู้รับผิดชอบ |
| ------------------------------------------------- | --------------------------------------- | ------------ |
| P1-1 เพิ่ม barcode field ใน session               | ✅ Done                                 | —            |
| P1-2 status → "mismatch"                          | ✅ Done                                 | —            |
| P1-3 เขียน shopCountConfirmed (Case A)            | ✅ Done                                 | —            |
| P1-4 สร้าง shopCountConfirmed.service.ts (mobile) | ✅ Done                                 | —            |
| P2-1 เขียน shopCountConfirmed (Case B)            | ✅ Done                                 | —            |
| P2-2 สร้าง shopCountConfirmed.service.ts (web)    | ✅ Done                                 | —            |
| P2-3 UI — แสดง mismatch sessions                  | ✅ Done                                 | —            |
| P3-1 API Endpoint สำหรับ ITP                      | ❌ ยกเลิก (เพื่อน query collection เอง) | —            |
| P3-2 เพิ่ม ShopCountConfirmed type                | ✅ Done                                 | —            |

---

_อัปเดตล่าสุด: 26 มี.ค. 2026_
