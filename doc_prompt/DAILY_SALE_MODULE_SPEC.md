# Daily Sale Module — Product Specification

**วันที่ร่าง:** 5 พฤษภาคม 2026  
**ระบบอ้างอิง:** Phone2Queue Mobile Offline / FITT BSA Super App  
**เป้าหมายหลัก:** ลดระยะเวลาการตรวจสอบรายงานยอดขายเพื่อคำนวณค่าคอมมิชชั่นให้รวดเร็วและแม่นยำ

---

## 1. ภาพรวมระบบ (System Overview)

ระบบบันทึกยอดขายรายวัน (Daily Sale) แบ่งการเข้าถึงออกเป็น **3 เมนูหลัก** ตาม Role ของผู้ใช้งาน:

| เมนู           | Role                 | คำอธิบาย                                               |
| -------------- | -------------------- | ------------------------------------------------------ |
| บันทึกยอดขาย   | Employee             | บันทึกข้อมูลยอดขายรายวัน รองรับสแกนบาร์โค้ด            |
| รายงานส่วนตัว  | Employee             | ดูรายงานยอดขายเฉพาะตัวเองตามช่วงเวลา                   |
| สรุปยอดรายสาขา | Supervisor / Manager | ภาพรวมยอดขายทุกสาขาที่ดูแล พร้อมเปรียบเทียบกับ Watsons |

---

## 2. โครงสร้างข้อมูล (Data Fields)

### 2.1 ข้อมูลทั่วไป / Header

| Field             | Type      | Required | หมายเหตุ                                              |
| ----------------- | --------- | -------- | ----------------------------------------------------- |
| `timestamp`       | Timestamp | ✅       | เวลาที่บันทึกข้อมูล (auto)                            |
| `saleDate`        | Date      | ✅       | วันที่ขาย (พนักงานเลือกได้)                           |
| `employeeId`      | string    | ✅       | รหัสพนักงาน (BA Code)                                 |
| `employeeName`    | string    | ✅       | ชื่อ-นามสกุลจริง                                      |
| `branchId`        | string    | ✅       | รหัสสาขา                                              |
| `branchName`      | string    | ✅       | ชื่อสาขา                                              |
| `supervisorId`    | string    | ✅       | รหัส Supervisor ที่ดูแล                               |
| `supervisorName`  | string    | -        | ชื่อ Supervisor (auto จาก supervisorId)               |
| `seller`          | string    | -        | ยี่ห้อ/Seller ที่รับผิดชอบ เช่น SK-II                 |
| `saleType`        | enum      | ✅       | `"normal"` \| `"promotion"` (ขายราคาปกติ / โปรโมชั่น) |
| `workDescription` | string    | -        | สถานะการทำงาน เช่น ลากิจ ลาป่วย หรือหมายเหตุอื่น      |
| `imageUrl`        | string    | -        | URL รูปภาพหลักฐาน (ใบเสร็จ / รูปถ่าย)                 |

---

### 2.2 รายการสินค้าที่ขาย (Sale Items — Array)

หนึ่ง transaction อาจมีหลาย item (multi-product sale)

| Field                | Type    | Required | หมายเหตุ                                       |
| -------------------- | ------- | -------- | ---------------------------------------------- |
| `barcode`            | string  | ✅       | บาร์โค้ดสินค้า (สแกนได้)                       |
| `productDescription` | string  | ✅       | ชื่อ/รายละเอียดสินค้า (auto-fill จาก barcode)  |
| `price`              | number  | ✅       | ราคาต่อชิ้น                                    |
| `quantity`           | number  | ✅       | จำนวนที่ขาย                                    |
| `revenue`            | number  | ✅       | `price × quantity` (auto-calculate)            |
| `hasFreebie`         | boolean | -        | มีสินค้าแถมหรือไม่                             |
| `freebieBarcode`     | string  | -        | บาร์โค้ดสินค้าที่แถม (ถ้า `hasFreebie = true`) |
| `freebieDescription` | string  | -        | ชื่อสินค้าแถม (auto-fill)                      |

---

### 2.3 สรุปต่อ Transaction

| Field          | Type   | หมายเหตุ                          |
| -------------- | ------ | --------------------------------- |
| `totalItems`   | number | รวมจำนวนชิ้นทั้งหมดใน transaction |
| `totalRevenue` | number | รวมยอดเงินทั้งหมดใน transaction   |
| `companyId`    | string | รหัสบริษัท (auto จาก user)        |

---

## 3. หน้าจอและ UX Flow

### 3.1 เมนูบันทึกยอดขาย (Employee)

```
[เลือก SaleDate] → [เลือกประเภทการขาย: ปกติ/โปรโมชั่น]
    ↓
[สแกนบาร์โค้ดสินค้า] → [แสดง Description อัตโนมัติ]
    ↓
[กรอก Price + Quantity] → [แสดง Revenue อัตโนมัติ]
    ↓
[เลือก "มีแถมหรือไม่"] → [ถ้ามี: สแกนบาร์โค้ดของแถม]
    ↓
[กด "+ เพิ่มสินค้า"] → วนซ้ำได้หลายรายการ
    ↓
[ถ่ายรูปหลักฐาน (optional)]
    ↓
[Review & Submit] → [ยืนยัน] → [Success + Submission ID]
```

**Validation Rules:**

- `saleDate` ต้องไม่เกินวันปัจจุบัน
- `price` และ `quantity` ต้อง > 0
- อย่างน้อย 1 sale item ก่อน submit ได้
- ไม่สามารถเพิ่มสินค้าซ้ำใน batch เดียวกัน (ให้ปรับ quantity แทน)

---

### 3.2 เมนูรายงานส่วนตัว (Employee)

- กรองตาม `employeeId` ของตัวเอง
- เลือกช่วงวันที่ (date range picker)
- แสดง: รายการ sale แต่ละ transaction, จำนวนชิ้นรวม, ยอดเงินรวม
- Export เป็น CSV ได้ (optional)

---

### 3.3 เมนูสรุปยอดรายสาขา (Supervisor / Manager)

- แสดงสาขาทั้งหมดที่ดูแล (`supervisorId` หรือ `branchIds`)
- เลือกช่วงวันที่
- ตารางสรุปรายสาขา:

| สาขา         | พนักงาน | จำนวนชิ้น | ยอดขายรวม |
| ------------ | ------- | --------- | --------- |
| Siam Paragon | 3 คน    | 125       | ฿45,200   |

- Drill-down ดูรายบุคคลและรายวันได้
- **การเปรียบเทียบ Watsons:** Export ข้อมูลออกมาในรูปแบบที่ตรงกับ Watsons Report (จำนวนชิ้น + ยอดขาย แยกตาม barcode / สาขา / วันที่)

---

## 4. Offline Capability

ระบบต้องรองรับการใช้งาน offline (อ้างอิง Phone2Queue Mobile Offline):

| สถานะ         | พฤติกรรม                                   |
| ------------- | ------------------------------------------ |
| Online        | บันทึกตรงสู่ Firestore ทันที               |
| Offline       | บันทึกลง Local Storage / IndexedDB รอ sync |
| กลับมา Online | Auto-sync ข้อมูลที่ค้างอยู่ทั้งหมด         |

**ข้อกำหนด:**

- ต้อง login อย่างน้อย 1 ครั้งขณะ online เพื่อ cache ข้อมูลสินค้า/สาขา
- ข้อมูล product catalog (barcode → description) ต้อง pre-cache ไว้ใน device

---

## 5. Integration กับ Watsons Report

เป้าหมายหลักของ module นี้คือให้ Supervisor สามารถ **cross-check ยอดขายกับ Watsons** ได้:

- สรุป **จำนวนชิ้นที่ขาย** แยกตาม barcode
- สรุป **ยอดเงิน** แยกตาม saleType (ปกติ / โปรโมชั่น)
- แยกตาม **สาขา** และ **ช่วงวันที่**
- รองรับ Export CSV/Excel เพื่อนำไปเปรียบเทียบ

---

## 6. Security & Permissions

| Role       | บันทึกยอด         | ดูยอดตัวเอง | ดูยอดรายสาขา     |
| ---------- | ----------------- | ----------- | ---------------- |
| Employee   | ✅ (สาขาตัวเอง)   | ✅          | ❌               |
| Supervisor | ✅                | ✅          | ✅ (สาขาที่ดูแล) |
| Manager    | ✅                | ✅          | ✅ (ทุกสาขา)     |
| Admin      | ❌ (ดูอย่างเดียว) | -           | ✅ (ทุกสาขา)     |

---

## 7. Firestore Collection Design (ข้อเสนอ)

```
/dailySales/{saleId}
  - timestamp
  - saleDate
  - employeeId
  - employeeName
  - branchId
  - branchName
  - supervisorId
  - supervisorName
  - seller
  - companyId
  - saleType: "normal" | "promotion"
  - workDescription
  - imageUrl
  - items: [
      {
        barcode, productDescription,
        price, quantity, revenue,
        hasFreebie, freebieBarcode, freebieDescription
      }
    ]
  - totalItems
  - totalRevenue
  - createdAt
  - updatedAt
```

**Indexes แนะนำ:**

- `companyId` + `saleDate` (for branch summary)
- `employeeId` + `saleDate` (for personal report)
- `branchId` + `saleDate` (for supervisor view)

---

## 8. อ้างอิง

- `doc_prompt/new_module.txt` — ขอบเขตโครงการและตัวอย่างข้อมูล
- `Phone2QueueMobileOffline_USER_MANUAL.md` — UX pattern สำหรับ offline mobile form
- `types/index.ts` — User/Branch/Company interfaces ที่มีอยู่แล้วในระบบ
