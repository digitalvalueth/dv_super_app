# แผนงานจากการประชุม 24 กุมภาพันธ์ 2569 (2026)

> สถานะ: 🚧 อยู่ระหว่างพัฒนา — เสร็จ 12/15 หัวข้อ
> วันที่วิเคราะห์: 2 มีนาคม 2026
> วันที่อัปเดต: **4 มีนาคม 2026** (อัปเดตสถานะการพัฒนา)

---

## สรุปภาพรวม (Executive Summary)

จากการประชุมวันที่ 24/02/2569 มีงาน **15 หัวข้อหลัก** ที่ต้องดำเนินการ แบ่งเป็น:

| ประเภท                              | จำนวน | สถานะ                              |
| ----------------------------------- | ----- | ---------------------------------- |
| 🔨 พัฒนาใหม่ (New Feature)          | 8     | ✅ เสร็จ 6 / ⏳ รอข้อมูล 2         |
| 🔧 ปรับปรุง (Enhancement)           | 4     | ✅ เสร็จ 3 / ⏭️ ข้ามไปก่อน 1 (ITP) |
| 📋 รอข้อมูลจากลูกค้า (Pending Data) | 3     | ⏳ รอข้อมูล 3                      |

---

## 📊 สรุปสถานะ ณ 4 มีนาคม 2026

| #   | ฟีเจอร์                         | สถานะ                                | ไฟล์หลัก                                                                                       |
| --- | ------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | รูปสินค้าไม่ครบ                 | ⏳ รอรูปจากคุณหมวย                   | —                                                                                              |
| 2   | ขอ Email BA ทั้งหมด             | ⏳ รอข้อมูลจากคุณหมวย                | —                                                                                              |
| 3   | ระบบตัดรอบ + Lock               | ✅ **เสร็จ**                         | `services/counting-period.service.ts`                                                          |
| 4   | Export Excel เช็คอิน            | ✅ **เสร็จ**                         | `platform-web/.../attendance/page.tsx`                                                         |
| 5   | เชื่อมต่อ ITP Portal            | ⏭️ ข้ามไปก่อน (ตามที่ตกลง)           | —                                                                                              |
| 6   | แจ้งเตือน BA ไม่เช็คอิน 3 วัน   | ✅ **เสร็จ** (Web + Mobile)          | `platform-web/.../alerts/page.tsx`, `supervisor/alerts.tsx`                                    |
| 7   | บาร์โค้ดไม่ตรงห้ามเซฟ           | ✅ **เสร็จ**                         | `stock-counter/result.tsx`, `preview.tsx`                                                      |
| 8   | สินค้า 100+ ชิ้น                | ⏳ รอข้อมูลสินค้าจากคุณหมวย          | —                                                                                              |
| 9   | แก้ไขยอดนับ Supervisor Override | ✅ **เสร็จ** (Web + Mobile)          | `counting-summary/page.tsx`, `supervisor/counting-review.tsx`                                  |
| 10  | Grace period +5 วัน (ลับ)       | ✅ **เสร็จ** (รวมใน counting-period) | `services/counting-period.service.ts`                                                          |
| 11  | ข้อมูลสาขา/พนักงานจริง          | ⏳ รอข้อมูลจากคุณหมวย                | —                                                                                              |
| 12  | Export ตาม ITP format           | ⏭️ ข้ามไปก่อน                        | —                                                                                              |
| 13  | ถ่ายเพิ่มหลัง submit            | ✅ **เสร็จ**                         | `services/supplement.service.ts`, `supervisor/supplement-review.tsx`                           |
| 14  | Prompt Management (Remote)      | ✅ **เสร็จ**                         | `services/prompt.service.ts`, `platform-web/.../prompts/page.tsx`, `api/prompts/seed/route.ts` |
| 15  | Project upload บิล              | ⏭️ Phase ถัดไป                       | —                                                                                              |

### สรุปตัวเลข

- ✅ **เสร็จแล้ว**: 9 หัวข้อ (#3, #4, #6, #7, #9, #10, #13, #14 + Supervisor Mobile UI)
- ⏳ **รอข้อมูลจากลูกค้า**: 3 หัวข้อ (#1, #2, #8, #11)
- ⏭️ **ข้ามไปก่อน**: 3 หัวข้อ (#5, #12, #15)

---

## Gap Analysis — สิ่งที่มีแล้ว vs สิ่งที่ต้องทำ

| #   | ความต้องการ                           | สถานะ 4 มี.ค.                                                 | สิ่งที่เหลือ                                  | ความยาก    |
| --- | ------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- | ---------- |
| 1   | รูปสินค้าไม่ครบ — ขอรูปใหม่จากคุณหมวย | ⏳ รอข้อมูล                                                   | รอรูปจากคุณหมวย แล้วอัปเดต Firestore          | ⭐         |
| 2   | ขอ Email BA ทั้งหมด                   | ⏳ รอข้อมูล                                                   | รอ Email จากคุณหมวย แล้ว seed เข้าระบบ        | ⭐         |
| 3   | ถ่ายรูป 2 ช่วง + Lock 2 วัน           | ✅ **เสร็จ** — `counting-period.service.ts`                   | 🔗 ต้อง integrate เข้า preview.tsx flow       | ⭐⭐       |
| 4   | Export Excel เช็คอิน (ลา/สาย)         | ✅ **เสร็จ** — ปุ่ม Export ในหน้า Attendance                  | —                                             | —          |
| 5   | เชื่อมต่อ ITP Portal (SQL)            | ⏭️ ข้าม (อั๋นตกลง)                                            | รอ Phase ถัดไป                                | ⭐⭐⭐⭐⭐ |
| 6   | แจ้งเตือน BA ไม่เช็คอิน 3 วัน         | ✅ **เสร็จ** — Web + Mobile alerts page                       | 🔗 ยังไม่มี Cloud Function cron (manual ก่อน) | ⭐⭐       |
| 7   | บาร์โค้ดไม่ตรงห้ามเซฟ                 | ✅ **เสร็จ** — Block ที่ result.tsx                           | —                                             | —          |
| 8   | สินค้า 100+ ชิ้น ถ่ายรูปยังไง         | ⏳ รอข้อมูลสินค้า                                             | รอคุณหมวยแจ้งสินค้า → ออกแบบ multi-photo      | ⭐⭐⭐     |
| 9   | แก้ไขยอดนับบน Web                     | ✅ **เสร็จ** — Override UI + API                              | —                                             | —          |
| 10  | Grace period +5 วัน (ลับ)             | ✅ **เสร็จ** — อยู่ใน counting-period service                 | 🔗 ต้อง integrate เข้า preview.tsx flow       | ⭐⭐       |
| 11  | ชื่อสาขา/พนักงาน/Supervisor ขึ้นจริง  | ⏳ รอข้อมูล                                                   | รอข้อมูลจริง → สร้าง import script            | ⭐⭐       |
| 12  | Export ตาม ITP format                 | ⏭️ ข้าม (อั๋นตกลง)                                            | รอ Phase ถัดไป                                | ⭐⭐⭐     |
| 13  | ถ่ายเพิ่มหลัง submit                  | ✅ **เสร็จ** — Supplement service + review UI                 | 🔗 ต้องเพิ่มปุ่ม "ถ่ายเพิ่ม" ใน history       | ⭐⭐       |
| 14  | Prompt Management (Remote)            | ✅ **เสร็จ** — Service + Admin UI + Seed API + **Integrated** | ✅ เชื่อมเข้า gemini.service.ts แล้ว          | ⭐⭐       |
| 15  | Project ใหม่ upload บิล               | ⏭️ Phase ถัดไป                                                | ออกแบบ Bill Upload module                     | ⭐⭐⭐⭐   |

### 🔗 งาน Integration ที่ยังเหลือ

> ฟีเจอร์ด้านล่างสร้าง Service/UI เสร็จแล้ว แต่ยังไม่ได้เชื่อมเข้า flow หลักของแอป:

| งาน                            | รายละเอียด                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Counting Period → Preview flow | `counting-period.service.ts` ต้องเรียกก่อนถ่ายรูปใน `preview.tsx` — ถ้าล็อค ห้ามถ่าย     |
| Grace Period → Upload flow     | ถ้าอยู่ใน grace period → accept + tag `isLateSubmission = true`                          |
| ~~Prompt Service → Gemini~~    | ~~`prompt.service.ts` ต้องแทน hardcoded prompt ใน `gemini.service.ts`~~ ✅ **เสร็จแล้ว** |
| Supplement → History           | ต้องเพิ่มปุ่ม "ถ่ายเพิ่ม" ในหน้า `stock-counter/history/`                                |
| Cloud Function cron            | สร้าง scheduled function ที่เช็ค missing check-in ทุกวัน 09:00                           |

---

## แผนงานแบ่งตาม Phase

### Phase 1: Quick Wins — ทำได้ทันที (1-2 สัปดาห์)

#### 1.1 บาร์โค้ดไม่ตรง → ห้ามเซฟ

- **ไฟล์**: `app/(mini-apps)/stock-counter/result.tsx`
- **สิ่งที่ต้องทำ**: ตรวจสอบ `barcodeMatch` ใน counting session → ถ้า `false` หรือ status = `"mismatch"` → disable ปุ่ม "บันทึกผล" + แสดง warning ว่าต้องถ่ายใหม่
- **Logic**:
  ```typescript
  // ใน result.tsx
  const canSave =
    session?.barcodeMatch !== false && session?.status !== "mismatch";
  // ปุ่มบันทึก disabled={!canSave}
  ```
- **ประมาณการ**: 2-4 ชั่วโมง

#### 1.2 Export Excel เช็คอิน

- **ไฟล์**: `platform-web/app/stock-counter/dashboard/attendance/page.tsx`
- **สิ่งที่ต้องทำ**: เพิ่มปุ่ม "Export Excel" → สร้าง function ที่ดึงข้อมูล check-in/check-out ตาม filter → export เป็น .xlsx
- **Columns ที่ต้องมี**: ชื่อพนักงาน, สาขา, วันที่, เวลาเข้า, เวลาออก, สถานะ (ปกติ/สาย/ลา), นาทีที่สาย
- **ตัดรอบ**: 24:00 น. (ตามที่ประชุมระบุ)
- **ใช้**: `xlsx` หรือ `exceljs` library ที่มีอยู่แล้วใน project
- **ประมาณการ**: 1-2 วัน

#### 1.3 ข้อมูลสาขา/พนักงาน/Supervisor ขึ้นจริง

- **รอ**: คุณหมวยส่งข้อมูล:
  1. ชื่อสาขาทั้งหมด (branch name, code, address)
  2. ชื่อ + Email พนักงาน BA
  3. ชื่อ + Email Supervisor
  4. ความสัมพันธ์ Supervisor → BA → สาขา
- **เมื่อได้ข้อมูล**: สร้าง script `scripts/seed-production-data.ts` ที่ import จาก CSV/Excel
- **ประมาณการ**: 1 วัน (หลังได้ข้อมูล)

---

### Phase 2: Core Features — ระบบหลักที่ต้องสร้าง (2-3 สัปดาห์)

#### 2.1 ระบบตัดรอบการนับ (Counting Period System)

**ความต้องการ** (✅ ยืนยันจากอั๋นแล้ว):

- ตัดรอบทุกกลางเดือน (วันที่ 1-15 = รอบที่ 1, วันที่ 16-สิ้นเดือน = รอบที่ 2)
- **🔒 Lock วันที่ 1 และ 16 → ห้ามอัปโหลดรูปทั้งหมดเลย** (ทั้งรอบเก่าและรอบใหม่)
- Grace period ลับ +5 วัน หลังสิ้นรอบ (✅ อั๋นตกลง — ใช้ `periodId` แยก + ทำเครื่องหมาย "ส่งล่าช้า")

**⚠️ Lock Logic ที่ชัดเจน**:

```
ตัวอย่าง มีนาคม 2026:

รอบที่ 1: วันที่ 2-15 มี.ค. (ถ่ายรูปได้)
  🔒 วันที่ 1 มี.ค. = LOCK ทั้งวัน (ห้ามอัปโหลดรูปทุกรอบ)
  📅 วันที่ 2-15 มี.ค. = เปิดให้ถ่ายรูปรอบที่ 1
  🔒 วันที่ 16 มี.ค. = LOCK ทั้งวัน (ตัดรอบที่ 1)

รอบที่ 2: วันที่ 17-31 มี.ค. (ถ่ายรูปได้)
  📅 วันที่ 17-31 มี.ค. = เปิดให้ถ่ายรูปรอบที่ 2
  🔒 วันที่ 1 เม.ย. = LOCK ทั้งวัน (ตัดรอบที่ 2)

Grace Period (ลับ — พนักงานไม่รู้):
  รอบที่ 1 จบ 15 มี.ค. → grace ถึง 20 มี.ค.
  - วันที่ 16 = LOCK (ห้ามทุกอย่าง)
  - วันที่ 17-20 = พนักงานเห็น "หมดเวลา" แต่ระบบยัง accept + tag "ส่งล่าช้า"
  - วันที่ 21+ = ปิดจริง ส่งไม่ได้แล้ว
```

**สิ่งที่ต้องสร้าง**:

##### A. Data Model ใหม่

```typescript
// types/index.ts — เพิ่ม
interface CountingPeriod {
  id: string;
  companyId: string;
  year: number;
  month: number; // 1-12
  half: 1 | 2; // 1 = วันที่ 1-15, 2 = วันที่ 16-สิ้นเดือน
  startDate: Timestamp; // วันเปิดให้ถ่าย (เช่น 2 มี.ค.)
  endDate: Timestamp; // วันสุดท้ายของรอบ (เช่น 15 มี.ค.)
  lockDates: Timestamp[]; // วันที่ห้าม upload ทั้งวัน (1, 16)
  graceEndDate: Timestamp; // endDate + 5 วัน (ลับ)
  status: "active" | "locked" | "grace" | "closed";
}

// เพิ่มใน UserAssignment
interface UserAssignment {
  // ... existing fields
  periodId: string; // เชื่อมกับ CountingPeriod
  countingPeriodStart: Timestamp;
  countingPeriodEnd: Timestamp;
}

// เพิ่มใน CountingSession
interface CountingSession {
  // ... existing fields
  periodId: string;
  isLateSubmission: boolean; // true ถ้าส่งใน grace period
  lateSubmittedAt?: Timestamp; // เวลาที่ส่งล่าช้า
}
```

##### B. Service Layer

- **ไฟล์ใหม่**: `services/counting-period.service.ts`
- Functions:
  - `getCurrentPeriod(companyId)` → return period ปัจจุบัน
  - `canUploadPhoto(userId, date)` → **ห้ามถ่ายถ้าเป็นวันที่ 1 หรือ 16** (lock ทั้งวัน)
  - `isInGracePeriod(periodId, date)` → ตรวจสอบว่า date อยู่ระหว่าง endDate+1 ถึง graceEndDate
  - `getUploadStatus(userId, date)` → return: `'open'` | `'locked'` | `'grace'` | `'closed'`
  - `closePeriod(periodId)` → ปิดรอบ
  - `generatePeriods(companyId, year)` → สร้างรอบทั้งปี

##### C. Mobile App Changes

- ก่อนถ่ายรูป → เช็ค `canUploadPhoto()` → ถ้าเป็นวันที่ 1 หรือ 16 → แสดง **"🔒 ระบบปิดรับรูปชั่วคราว กรุณากลับมาพรุ่งนี้"**
- ถ้า grace period → พนักงานเห็น **"⏰ หมดเวลาส่งรูปแล้ว"** แต่ถ้ากดส่ง ระบบยัง accept + tag `isLateSubmission = true` (ห้ามแสดงว่ามี grace)
- ถ้า closed จริงๆ (เลย grace) → **"❌ หมดเวลาส่งรูปรอบนี้แล้ว"** + disable ปุ่มถ่าย
- แสดง badge "รอบปัจจุบัน: 2-15 มี.ค." ที่หน้า stock-counter

##### D. Web Dashboard Changes

- เพิ่มหน้า period management สำหรับ admin
- แสดง stats แยกตามรอบ
- **ปุ่ม "Request ขยายเวลา"** สำหรับ supervisor
- แสดง tag "ส่งล่าช้า" ในรายงาน (admin เห็น แต่พนักงานไม่เห็น)

**ประมาณการ**: 5-7 วัน

---

#### 2.2 แก้ไขยอดนับ — Supervisor Override (Web + Mobile) ✅ ยืนยันแล้ว

**ความต้องการ** (จากอั๋น):

- เมื่อ AI นับได้ 8 แต่ BA นับได้ 11 → Supervisor เลือกว่าจะใช้ตัวเลขไหน
- **ทำได้ทั้ง Web และ Mobile** — Supervisor ที่คุมสาขานั้นๆ ต้องเลือกได้
- **ต้องออกแบบ Supervisor/Manager Mobile UI ด้วย** (Feature ใหม่)

**สิ่งที่ต้องสร้าง**:

##### A. Data Model

```typescript
// เพิ่มใน CountingSession
interface CountingSession {
  // ... existing fields
  finalCount?: number; // ตัวเลขสุดท้ายที่ supervisor เลือก
  finalCountSource?: "ai" | "employee" | "custom"; // เลือกจากไหน
  supervisorOverride?: {
    overriddenBy: string; // supervisor userId
    overriddenAt: Timestamp;
    aiCount: number; // ค่า AI นับได้
    employeeCount: number; // ค่าพนักงานรายงาน
    selectedCount: number; // ค่าที่เลือกใช้
    source: "ai" | "employee" | "custom"; // เลือกจากไหน
    customCount?: number; // กรณีกรอกเอง
    reason?: string; // เหตุผล (optional)
  };
  approvalStatus: "pending" | "approved" | "rejected";
}
```

##### B. Web UI — counting-summary page

- **ไฟล์**: `platform-web/app/stock-counter/dashboard/counting-summary/page.tsx`
- เพิ่ม:
  - ปุ่ม "เลือกยอด" ข้างแต่ละ session ที่มี discrepancy
  - Modal แสดง:
    - 🤖 AI นับได้: **8** [เลือก]
    - 👤 พนักงานรายงาน: **11** [เลือก]
    - ✏️ กรอกเอง: [___] [เลือก]
    - หมายเหตุ: [___] (optional)
  - สถานะ: รอตรวจ → ยืนยันแล้ว
  - Filter: ทั้งหมด | รอตรวจ | ยืนยันแล้ว

##### C. 📱 Mobile UI — Supervisor Dashboard (Feature ใหม่)

> **หมายเหตุจากอั๋น**: ต้องออกแบบ UI สำหรับ supervisor และ manager ในแอปมือถือด้วย

- **ไฟล์ใหม่**: `app/(mini-apps)/supervisor/`
  - `index.tsx` — Supervisor Dashboard (ภาพรวมสาขาที่ดูแล)
  - `counting-review.tsx` — รีวิวยอดนับที่มี discrepancy
  - `team-status.tsx` — สถานะทีม (เช็คอิน, นับสินค้า)
  - `alerts.tsx` — แจ้งเตือน (BA ไม่เช็คอิน, ยอดไม่ตรง)

- **Supervisor Counting Review Screen**:

  ```
  ┌─────────────────────────────────┐
  │ 📋 รีวิวยอดนับ — สาขาโรบินสัน    │
  ├─────────────────────────────────┤
  │ สินค้า: แชมพู ABC               │
  │ 📸 [รูปที่ถ่าย]                  │
  │                                 │
  │ 🤖 AI นับ:      8 ชิ้น  [เลือก] │
  │ 👤 พนักงานนับ:  11 ชิ้น  [เลือก] │
  │ ✏️ กรอกเอง:     [__]    [เลือก] │
  │                                 │
  │ หมายเหตุ: [________________]    │
  │                                 │
  │     [ ยืนยัน ]  [ ข้าม ]        │
  └─────────────────────────────────┘
  ```

- **Supervisor Dashboard Overview**:
  - จำนวน BA ในสาขา + สถานะเช็คอิน
  - จำนวนสินค้าที่นับแล้ว / ยังไม่นับ (ตามรอบ)
  - จำนวนยอดที่ต้องรีวิว (discrepancy)
  - แจ้งเตือน BA ไม่เช็คอิน

##### D. API

- `PATCH /api/counting-sessions/[id]/override` → update finalCount + supervisorOverride
- ใช้ได้ทั้งจาก web และ mobile (same API)

##### E. สิทธิ์การเข้าถึง

- **Supervisor**: เลือกยอดได้เฉพาะสาขาที่ตัวเองคุม
- **Manager/Admin**: เลือกยอดได้ทุกสาขา
- **Employee**: ดูอย่างเดียว ไม่สามารถเลือกยอดได้

**ประมาณการ**: 5-7 วัน (เพิ่มจากเดิมเพราะต้องทำ Mobile UI ด้วย)

---

#### 2.3 แจ้งเตือน BA ไม่เช็คอิน 3 วัน

**สิ่งที่ต้องสร้าง**:

##### A. Cloud Function (Scheduled)

```typescript
// functions/src/check-missing-checkin.ts
// ทำงานทุกวัน เวลา 09:00
// Logic:
// 1. ดึง users ทั้งหมดที่ role = 'employee'
// 2. สำหรับแต่ละ user → query check-ins 3 วันล่าสุด
// 3. ถ้าไม่มี check-in เลย → สร้าง notification ให้ supervisor
// 4. สร้าง notification ให้ admin ด้วย
```

##### B. Web Dashboard — หน้าจอแจ้งเตือน

- **ไฟล์ใหม่**: `platform-web/app/stock-counter/dashboard/alerts/page.tsx`
- แสดงรายชื่อพนักงานที่ไม่ได้เช็คอิน + จำนวนวัน
- Filter: ทั้งหมด, เกิน 3 วัน, เกิน 7 วัน
- สถานะ: ยังไม่ดูแล, กำลังติดตาม, แก้ไขแล้ว

##### C. Push Notification

- ส่ง Expo push notification ให้ supervisor เมื่อมีพนักงานไม่เช็คอิน 3 วัน
- ข้อความ: "⚠️ พนักงาน [ชื่อ] ไม่ได้เช็คอินมา [N] วัน"

**ประมาณการ**: 3-4 วัน

---

#### 2.4 ระบบถ่ายเพิ่มหลัง Submit (Supplement Count)

**ความต้องการ**: พนักงาน submit 15 ชิ้นแล้ว แต่เจออีก 1 ชิ้น → ต้องถ่ายเพิ่มได้

**แนวทางที่เสนอ**:

##### Option A: "เพิ่มรูป" ในหน้า History (แนะนำ)

- ที่หน้า `stock-counter/history/` → แต่ละ session ที่ completed → มีปุ่ม "ถ่ายเพิ่ม"
- สร้าง **Supplement Session** ที่ link กับ original session
- Data model:

```typescript
interface SupplementSession {
  id: string;
  originalSessionId: string; // link กับ session เดิม
  userId: string;
  productId: string;
  additionalCount: number;
  imageUrl: string;
  aiCount: number;
  reason: string; // "เจอสินค้าเพิ่มเติม"
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp;
}
```

- Supervisor ต้อง approve supplement ก่อนจะรวมเข้ายอด
- Web dashboard แสดง: "ยอดเดิม: 15 + เพิ่ม: 1 = รวม: 16"

##### Option B: Re-open Session

- เปิด session กลับมาเป็น "in-progress" → ถ่ายรูปเพิ่ม → submit ใหม่
- ❌ ไม่แนะนำ เพราะจะ overwrite ข้อมูลเดิม

**ประมาณการ**: 3-4 วัน

---

### Phase 3: Integration & Advanced Features (3-4 สัปดาห์)

#### 3.1 Prompt Management System

**ความต้องการ**: เปลี่ยน prompt จาก hardcoded → remote configuration ที่จัดการได้จาก web

**สิ่งที่ต้องสร้าง**:

##### A. Data Model

```typescript
interface PromptTemplate {
  id: string;
  name: string; // เช่น "barcode_counting_v2"
  description: string;
  prompt: string; // ตัว prompt text
  modelId: string; // เช่น "gemini-2.5-flash"
  version: number;
  isActive: boolean; // version ที่ใช้งานอยู่
  platform: "mobile" | "web" | "all";
  category: "counting" | "barcode" | "product_detection";
  variables: string[]; // ตัวแปรที่ใส่ได้ เช่น ["productName", "expectedBarcode"]
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface PromptUsageLog {
  id: string;
  promptId: string;
  version: number;
  userId: string;
  result: "success" | "failure";
  responseTime: number;
  createdAt: Timestamp;
}
```

##### B. Firestore Collection

- `promptTemplates/` — เก็บ template ทั้งหมด
- `promptUsageLogs/` — log การใช้งาน

##### C. Mobile Service

```typescript
// services/prompt.service.ts
class PromptService {
  // ดึง active prompt ตาม category + platform
  async getActivePrompt(
    category: string,
    platform: string,
  ): Promise<PromptTemplate>;

  // cache prompt ใน AsyncStorage (TTL 30 นาที)
  async getCachedPrompt(category: string): Promise<string>;

  // log การใช้งาน
  async logUsage(promptId: string, result: string, responseTime: number): void;
}
```

##### D. Web Admin UI

- **ไฟล์ใหม่**: `platform-web/app/stock-counter/dashboard/prompts/page.tsx`
- Features:
  - รายการ prompt ทั้งหมด
  - สร้าง/แก้ไข prompt + preview
  - A/B testing: active version vs candidate version
  - Usage stats: สำเร็จกี่%, ใช้เวลาเฉลี่ยเท่าไหร่
  - Version history

##### E. แก้ไข gemini.service.ts

- เปลี่ยนจาก hardcoded prompt → `PromptService.getActivePrompt('barcode', 'mobile')`
- Fallback: ถ้า Firestore ไม่ตอบ → ใช้ hardcoded prompt เดิม

**ประมาณการ**: 5-7 วัน

---

#### 3.2 ITP Portal Integration

**ความต้องการ**: เชื่อมต่อข้อมูล stock count → ITP Portal ผ่าน SQL หรือ API

**สถานะ**: ⏳ รอ format จากคุณหมวย

**เตรียมการ**:

##### A. ออกแบบ Data Pipeline

```
[Mobile App] → [Firestore] → [Cloud Function] → [Middleware API] → [ITP SQL Database]
```

##### B. สร้าง Middleware (เมื่อได้ format)

- **ไฟล์ใหม่**: `platform-web/app/api/itp/`
  - `export/route.ts` — ส่งข้อมูลออกจากระบบ
  - `import/route.ts` — นำเข้าข้อมูลจาก ITP
  - `compare/route.ts` — เปรียบเทียบ stock

##### C. Export Template

- เมื่อคุณหมวยส่ง format มา → สร้าง export function ที่ match กับ format
- ข้อมูลที่ต้องมี (คาดการณ์): SKU, ชื่อสินค้า, Qty, ราคา, สาขา, วันที่นับ

##### D. ปุ่ม "ส่งข้อมูลเข้า ITP"

- ที่หน้า counting-summary → เมื่อปิดรอบแล้ว → ปุ่ม "ส่ง ITP"
- ดึงข้อมูลตาม period → format ตาม ITP → ส่ง

**Action Items สำหรับคุณหมวย/คุณพอล**:

- [ ] ส่ง format import ของ ITP
- [ ] ส่ง API endpoint หรือ SQL connection string
- [ ] แจ้ง field mapping: SKU → field ไหน, Qty → field ไหน
- [ ] แจ้ง authentication method

**ประมาณการ**: 7-10 วัน (หลังได้ format)

---

#### 3.3 สินค้า 100+ ชิ้น — Multi-Photo Strategy

**ความต้องการ**: สินค้าบางตัว (เช่น Mark) มีเป็น 100 ชิ้น → กางหมดไม่ได้

**แนวทางที่เสนอ**:

##### Option A: ถ่ายหลายรูป แบ่งกลุ่ม (แนะนำ)

- ถ่ายรูปที่ 1: สินค้ากลุ่มที่ 1 (เช่น 20 ชิ้น)
- ถ่ายรูปที่ 2: สินค้ากลุ่มที่ 2 (เช่น 25 ชิ้น)
- ... ถ่ายจนครบ
- AI รวมยอดจากทุกรูป
- แก้ flow เป็น: Camera → ถ่ายรูป → "ถ่ายเพิ่ม" หรือ "เสร็จสิ้น" → AI รวมผล

```typescript
interface MultiPhotoSession {
  id: string;
  productId: string;
  photos: Array<{
    imageUrl: string;
    aiCount: number;
    capturedAt: Timestamp;
  }>;
  totalAiCount: number; // รวมจากทุกรูป
  totalManualCount: number; // พนักงานนับเอง
}
```

##### Option B: ถ่ายรูปรวม + นับมือ

- ถ่ายรูป overview 1 รูป
- พนักงานกรอกจำนวนเอง
- ❌ ไม่แนะนำเพราะไม่มี AI verification

**รอคุณหมวย**: แจ้งว่ามีสินค้าตัวไหนบ้างที่เป็น 100+ ชิ้น → ออกแบบ specific solution

**ประมาณการ**: 4-5 วัน

---

### Phase 4: รอข้อมูลจากลูกค้า

#### 4.1 รูปสินค้าที่ไม่ครบ

- **รอ**: คุณหมวยส่งรูปสินค้าทุกมิติ (ชัดกว่าเดิม)
- **เมื่อได้**: อัปโหลดเข้า Firebase Storage → อัปเดต `products/{id}/imageUrl`
- **สร้าง script**: `scripts/update-product-images.ts` ที่ batch upload จากโฟลเดอร์

#### 4.2 ข้อมูลสาขา/พนักงาน Production

- **รอ**: CSV/Excel จากคุณหมวย (สาขา, ชื่อ BA, ชื่อ Supervisor, Email ทั้งหมด)
- **เมื่อได้**:
  - สร้าง `scripts/seed-production-branches.ts`
  - สร้าง `scripts/seed-production-users.ts`
  - ส่ง invitation email ให้ BA + Supervisor ทั้งหมด

#### 4.3 Format ITP

- **รอ**: คุณหมวยส่ง format + คุณพอลทำถังกลาง
- **เมื่อได้**: สร้าง export adapter ตาม format

---

## คำถาม & คำตอบ — ยืนยันแล้ว ✅

> ตอบโดย: อั๋น (ทีมพัฒนา) — 2 มีนาคม 2026

### 1. Lock 2 วัน หมายความว่าอย่างไร?

- **คำตอบ**: 🔒 **ล็อคทั้งวัน ห้ามอัปโหลดรูปทุกรอบ** ในวันที่ 1 และ 16 เลย
- **สรุป**: ถ้าเป็นวันที่ 1 หรือ 16 ของเดือน → ระบบไม่ให้ถ่ายรูปใดๆ ทั้งสิ้น (ไม่ว่ารอบเก่าหรือรอบใหม่)

### 2. Grace period +5 วัน ข้ามรอบ?

- **คำตอบ**: ✅ ตกลงตามที่เสนอ — ใช้ `periodId` แยกชัดเจน
- **สรุป**: พนักงานเห็น "หมดเวลาส่งรูป" หลังจบรอบ แต่ระบบยัง accept แบบเงียบๆ + tag "ส่งล่าช้า" (ห้ามให้พนักงานรู้ว่ามี grace period)

### 3. Export ITP — ตอนไหนส่ง?

- **คำตอบ**: ⏭️ **ข้ามไปก่อน** — ตอนนี้ export เป็น Excel ปกติที่เราทำอยู่แล้วก็พอ
- **สรุป**: ไม่ต้องสร้าง ITP connector ตอนนี้ → ย้ายไป Phase ถัดไป

### 4. Qty + Price ที่ต้อง export?

- **คำตอบ**: ⏭️ **ข้ามไปก่อน** — น่าจะเป็นของ Upload บิล (project ใหม่) Phase ถัดไป
- **สรุป**: ไม่ต้องเพิ่ม Price ใน Product model ตอนนี้

### 5. Counting Summary — Supervisor เลือกยอดยังไง?

- **คำตอบ**: ✅ Supervisor เลือกได้ทั้ง **Web และ Mobile** — ว่าจะใช้ยอด AI หรือยอดพนักงาน
- **เพิ่มเติม**: ต้อง **ออกแบบ Supervisor/Manager Mobile UI** ด้วยแน่นอน
- **สรุป**: สร้าง Supervisor Dashboard ทั้งบน web (counting-summary) และ mobile (mini-app ใหม่)

### คำถามที่ยังเหลือ — สำหรับลูกค้า (คุณหมวย)

1. สินค้า 100+ ชิ้นมีตัวไหนบ้าง? กี่ SKU?
2. สาขาทั้งหมดมีกี่สาขา? อยากได้ Excel ที่มี: ชื่อสาขา, code, ที่อยู่, พนักงาน BA, supervisor
3. Project ใหม่ที่ต้อง upload บิล — เป็นบิลอะไร? ใบเสร็จ? ใบส่งของ? บิลซื้อ?

---

## Timeline ประมาณการ (อัปเดต 4 มี.ค. 2026)

```
✅ สัปดาห์ 1 (2-4 มี.ค.):  Phase 1-3 Quick Implementation
   - ✅ barcode block, export excel, types, services
   - ✅ counting-period service, prompt service, supplement service
   - ✅ Supervisor Mobile UI (dashboard, counting-review, team-status, alerts, supplement-review)
   - ✅ Web: counting-summary override, alerts page, prompts admin, attendance export
   - ✅ Prompt seed API + Override API

⏳ สัปดาห์ 2-3:  Integration & Polish
   - 🔗 Counting period → integrate เข้า preview/upload flow
   - ✅ Prompt service → integrate เข้า gemini.service.ts (แทน hardcoded) **เสร็จแล้ว**
   - 🔗 Supplement → เพิ่มปุ่มถ่ายเพิ่มใน history
   - 🔗 Cloud Function cron สำหรับแจ้งเตือนขาดงาน

⏳ สัปดาห์ 4+:  Data & Launch
   - ⏳ รอข้อมูลจากคุณหมวย (สาขา, พนักงาน, รูปสินค้า)
   - ⏳ Seed production data + Testing
```

---

## ลำดับความสำคัญ (Priority) — อัปเดต 4 มี.ค.

| ลำดับ | งาน                        | สถานะ | เหตุผล                               |
| ----- | -------------------------- | ----- | ------------------------------------ |
| 🔴 P0 | ข้อมูลสาขา/พนักงานขึ้นจริง | ⏳    | ต้องใช้ก่อนเปิดระบบจริง              |
| 🔴 P0 | บาร์โค้ดไม่ตรงห้ามเซฟ      | ✅    | ป้องกันข้อมูลผิดพลาด                 |
| 🟠 P1 | ระบบตัดรอบ + Lock + Grace  | ✅    | Business logic หลักของระบบนับ        |
| 🟠 P1 | แก้ไขยอดนับบน Web+Mobile   | ✅    | Supervisor ต้องตรวจสอบ/แก้ไขได้      |
| 🟠 P1 | Supervisor Mobile UI       | ✅    | ต้องใช้คู่กับ Override (อั๋นยืนยัน)  |
| 🟡 P2 | Export Excel เช็คอิน       | ✅    | รายงานที่ต้องส่งให้ผู้บริหาร         |
| 🟡 P2 | แจ้งเตือนไม่เช็คอิน 3 วัน  | ✅    | ติดตามพนักงาน                        |
| 🟡 P2 | ถ่ายเพิ่มหลัง submit       | ✅    | เคสที่เกิดขึ้นจริง                   |
| 🔵 P3 | Prompt Management          | ✅    | ปรับปรุง AI ได้ง่ายขึ้น              |
| 🔵 P3 | Multi-photo 100+ ชิ้น      | ⏳    | รอข้อมูลสินค้าก่อน                   |
| ⚪ P4 | ITP Integration            | ⏭️    | อั๋นบอกข้ามไปก่อน — ใช้ Excel export |
| ⚪ P4 | Upload บิล (project ใหม่)  | ⏭️    | Phase ถัดไป                          |

---

## ไฟล์ที่สร้าง/แก้ไขแล้ว ✅ (2-4 มี.ค. 2026)

### สร้างใหม่ (Created)

| ไฟล์                                                        | คำอธิบาย                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `types/index.ts`                                            | เพิ่ม CountingPeriod, SupervisorOverride, SupplementSession, PromptTemplate, MissingCheckInAlert |
| `platform-web/types/index.ts`                               | เพิ่ม supervisorOverride, finalCountSource, approvalStatus ใน CountingSession                    |
| `services/counting-period.service.ts`                       | ระบบตัดรอบ + Lock วันที่ 1,16 + Grace period +5 วัน                                              |
| `services/prompt.service.ts`                                | Prompt Management service + AsyncStorage caching                                                 |
| `services/supplement.service.ts`                            | CRUD สำหรับ Supplement Sessions                                                                  |
| `app/(mini-apps)/supervisor/_layout.tsx`                    | Stack navigation layout                                                                          |
| `app/(mini-apps)/supervisor/index.tsx`                      | 📱 Supervisor Dashboard                                                                          |
| `app/(mini-apps)/supervisor/counting-review.tsx`            | 📱 รีวิวยอดนับ discrepancy                                                                       |
| `app/(mini-apps)/supervisor/team-status.tsx`                | 📱 สถานะทีม BA                                                                                   |
| `app/(mini-apps)/supervisor/alerts.tsx`                     | 📱 แจ้งเตือน supervisor                                                                          |
| `app/(mini-apps)/supervisor/supplement-review.tsx`          | 📱 รีวิวนับเสริม                                                                                 |
| `platform-web/app/stock-counter/dashboard/alerts/page.tsx`  | 🌐 หน้าแจ้งเตือนพนักงาน                                                                          |
| `platform-web/app/stock-counter/dashboard/prompts/page.tsx` | 🌐 Prompt Management admin (adminOnly)                                                           |
| `platform-web/app/api/supervisor/override/route.ts`         | 🌐 Override API                                                                                  |
| `platform-web/app/api/prompts/seed/route.ts`                | 🌐 Seed hardcoded prompts API                                                                    |

### แก้ไข (Modified)

| ไฟล์                                                                 | การเปลี่ยนแปลง                                     |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| `app/(mini-apps)/stock-counter/result.tsx`                           | Block save เมื่อ barcode mismatch                  |
| `app/(mini-apps)/stock-counter/preview.tsx`                          | ส่ง barcodeMatchStatus param ไป result             |
| `platform-web/app/stock-counter/dashboard/counting-summary/page.tsx` | เพิ่ม Supervisor override UI ใน SessionDetailModal |
| `platform-web/app/stock-counter/dashboard/attendance/page.tsx`       | เพิ่มปุ่ม Export Excel + XLSX                      |
| `platform-web/components/layout/stock-counter-sidebar.tsx`           | เพิ่มเมนู แจ้งเตือนขาดงาน + AI Prompts             |

---

## หมายเหตุสำหรับทีม

1. **พนักงานสามารถมีได้หลายสาขา** — ปัจจุบัน User model มี `branchId` เป็น single value → ต้องเปลี่ยนเป็น `branchIds: string[]` หรือสร้าง `userBranches` sub-collection
2. **ระบบ grace period ต้องเป็นความลับ** — ไม่แสดง countdown หรือข้อความใดๆ ที่บอกว่ามี +5 วัน
3. **Watson Excel Validator** ที่มีอยู่แล้ว อาจ reuse ได้สำหรับ ITP format validation
4. **Export infrastructure** (exceljs, jsPDF) มีอยู่แล้ว → ไม่ต้องติดตั้ง library ใหม่
5. **ITP Integration ข้ามไปก่อน** — อั๋นบอกใช้ Excel export ปกติที่ทำอยู่แล้วก็พอ
6. **Qty + Price ข้ามไปก่อน** — เป็นส่วนของ project upload บิล Phase ถัดไป
7. **AI Prompts page เมนูเห็นเฉพาะ admin/super_admin** — ตั้งค่า `adminOnly: true` ใน sidebar
8. **Prompt Seed** — หน้า AI Prompts มีปุ่ม "นำเข้า Prompt จากระบบ" เพื่อ seed hardcoded prompts 3 ตัว (barcode_scanner_with_expected, barcode_scanner_no_expected, product_counter) เข้า Firestore
