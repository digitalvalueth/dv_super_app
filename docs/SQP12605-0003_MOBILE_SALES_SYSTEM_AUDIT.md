# SQP12605-0003 — ระบบบันทึกยอดขาย (Mobile Application) — Audit & Gap Report

> สถานะเทียบ requirement 1.1–1.6 กับ codebase จริง ณ branch `feature/watson-daily-sales-sqp12605`
> วันที่ตรวจ: 2026-06-17 · วิธีตรวจ: สำรวจโค้ดจริง (Explore agents 4 ชุด) + ยืนยันด้วย grep
> เครื่องหมาย: ✅ เสร็จ · ⚠️ บางส่วน/ต้องปรับ · ❌ ยังไม่มี · 🐞 มีบั๊ก/เสี่ยง
>
> **อัปเดต 2026-06-17 (หลัง audit):** ปิดช่องว่าง P1 + P2 บางส่วนแล้ว —
> เพิ่ม role gate + branch scoping ให้รายงาน 1.3/1.5 (commit `da74b8e`),
> แก้ timezone โปรฝั่งมือถือ (commit `db775a6`). คงเหลือ **1.6** (รอไฟล์ rang/ranking)
> และงาน P2 ที่ติด WIP (inventory-report). ดูสถานะล่าสุดในแต่ละหัวข้อด้านล่าง

---

## สรุปภาพรวม (Executive summary)

| กลุ่ม | หัวข้อ | สถานะรวม |
|------|--------|----------|
| **1.1** | บันทึกยอดขายผ่านมือถือ (scan/ดึงสินค้า/จำนวน-วันที่/เช็คซ้ำ/save) | ✅ เสร็จครบ |
| **1.2** | ราคาตามช่วงโปรโมชั่น (มือถือ + หลังบ้าน) | ✅ เสร็จ (มีจุดเสี่ยง timezone + จำกัดเฉพาะ Watson) |
| **1.3** | รายงานยอดขายพนักงาน (filter/ยอด/บิล/ชิ้น/export) | ✅ เสร็จ + **เพิ่ม role/branch scoping แล้ว** (`da74b8e`) |
| **1.4** | รายงาน Supervisor (ภาพรวมทีม) | ✅ เสร็จครบ + scoping ถูกต้อง (เป็นตัวอย่างที่ดี) |
| **1.5** | รายงานทุกสาขา (รวม/เทียบสาขา/export) | ✅ by-store/by-product **เพิ่ม role gate แล้ว** + by-product PDF — ⚠️ inventory-report ยัง mock (ติด WIP) |
| **1.6** | **Report Management — Watson daily-sales file + เทียบ Watson vs มือถือ** | ❌ **ยังไม่มีเลย (ช่องว่างใหญ่สุด)** |

**บรรทัดเดียว:** ตัวบันทึก (1.1/1.2) และรายงาน (1.3/1.4/1.5) เกือบครบแล้ว — ที่ **ขาดจริง ๆ คือ 1.6 ทั้งหมด** (ยังไม่มี importer ไฟล์ยอดขายรายวันของ Watson และยังไม่มีหน้าเปรียบเทียบ Watson vs ยอดที่พนักงานบันทึกผ่านมือถือ) บวกกับ **ช่องว่างด้านสิทธิ์ (role/branch scoping)** ในรายงาน 1.3 และ 1.5

---

## 1.1 — เมนูบันทึกยอดขายผ่าน Mobile Application ✅

ไฟล์หลัก: `app/(mini-apps)/daily-sale/record.tsx`, `services/daily-sale.service.ts`, `services/daily-sale-duplicates.ts`

| ข้อกำหนด | สถานะ | หลักฐาน |
|----------|-------|---------|
| สแกน Barcode ผ่านกล้อง | ✅ | `record.tsx:1922-1928` (CameraView, รองรับ ean13/ean8/upc_a/code128/qr), `record.tsx:475-530` flow ขอสิทธิ์+อ่านบาร์โค้ด (debounce 1200ms) |
| ดึงข้อมูลสินค้าอัตโนมัติจาก DB + ราคาตามช่วงโปร | ✅ | `daily-sale.service.ts:166-194` `lookupProductByBarcode()` (อ่าน `products` ตาม barcode+companyId); ราคาโปรจาก `watson_promotion_data/current` ผ่าน `fetchActivePromoItems()` + `applyPromoToItem()` |
| บันทึกจำนวนขาย + ระบุวันที่ขาย | ✅ | จำนวน `record.tsx:1148-1169`; วันที่เลือกได้เองผ่าน CalendarPicker `record.tsx:861-900` (default วันนี้ แต่ย้อนหลัง/ล่วงหน้าได้) |
| ตรวจซ้ำก่อนบันทึก + แก้ไข/ลบก่อนยืนยัน | ✅ | ซ้ำในฟอร์ม `daily-sale-duplicates.ts:19-29`; ซ้ำใน DB (พนักงาน+วันเดียวกัน) `record.tsx:631-664`; แก้/ลบ `record.tsx:532-543`; review modal ก่อน save `record.tsx:1724-1878` |
| จัดเก็บเข้าฐานข้อมูลส่วนกลาง | ✅ | เขียน collection `dailySales` — `daily-sale.service.ts:708-723` `createDailySale()` / `692-701` `updateDailySale()` (named DB ตาม env) |

**โครงสร้างเอกสาร `dailySales`:** companyId, branchId/branchName, employeeId/baCode/employeeName, supervisorId/Name, seller, **saleDate (เลือกได้)**, items[] (barcode, productDescription, price, quantity, revenue, saleType, hasFreebie/freebie*, promotionRemark), totalItems, totalRevenue, createdAt/updatedAt

---

## 1.2 — ราคาตามช่วงโปรโมชั่น ✅ (มีจุดต้องระวัง)

### ฝั่งมือถือ (อ่าน + ใช้ราคา)
| ข้อกำหนด | สถานะ | หลักฐาน |
|----------|-------|---------|
| รองรับวันเริ่ม–สิ้นสุดโปร (resolve ตามวันที่) | ✅ | `daily-sale-promo.ts:45-52` `isPromoActiveOnDate()` (inclusive); filter ตาม window เดือนของ saleDate `daily-sale.service.ts:225-258` |
| ราคาปกติ + ราคาโปร | ✅ | ปกติ = `products.price`; โปร = `commPrice` จาก `watson_promotion_data` |
| เลือกราคาอัตโนมัติตามช่วงเวลา | ⚠️ | เลือกตาม **saleDate (ผู้ใช้เลือก)** ไม่ใช่ "เวลาปัจจุบัน" — เป็น design ที่ตั้งใจ (รองรับบันทึกย้อนหลัง) แต่ต่างจากถ้อยคำ spec "เวลาปัจจุบัน" |
| โปรหลายสินค้า | ✅ | `daily-sale-promo.ts:109-157` `selectBestPromo()` + UI เลือกโปรเมื่อมี >1 ตัว `record.tsx:1404-1512` (เลือก commPrice ต่ำสุดเป็น default) |
| แสดงราคาถูกต้องขณะบันทึก | ✅ | ราคา/รายได้อัปเดตสดเมื่อสแกน/เลือกโปร `record.tsx:1119-1184`, `428-436` |

### ฝั่งหลังบ้าน (กำหนดโปร)
| ข้อกำหนด | สถานะ | หลักฐาน |
|----------|-------|---------|
| กำหนดโปรผ่านระบบหลังบ้าน | ✅ | ตารางแก้ไขได้ + import/export Excel — `dashboard-vendor-center/promotion-report/page.tsx`, `stock-counter/dashboard/promotion-report/page.tsx` |
| วันเริ่ม–สิ้นสุดต่อโปร | ✅ | `types/watson/promotion.ts:12-13` + validation กันช่วงทับซ้อน `promo-validation.ts:47-54`, `promotion-report/page.tsx:428-468` |
| ราคาปกติ + ราคาโปร | ✅ | `stdPrice` vs `commPrice` — `types/watson/promotion.ts:7-10`; logic `promo-pricing.ts:29-56` |
| โปรหลายสินค้า | ✅ | ตารางไม่จำกัดจำนวน; key รวม `(barcode\|itemCode)\|start\|end\|remark` รองรับสินค้าเดิมหลายช่วง — `promo-merge.ts:31-36` |
| แหล่งเก็บ / source of truth | ✅ | Firestore `watson_promotion_data/current` (singleton, items[]) — `lib/watson-shared.ts:16`, `watson-firebase.ts:876`; mirror ไป `watson_current_pricelist/current` สำหรับ Validator — `promo-save.ts:44-54` |

### 🐞 / ⚠️ จุดต้องระวังของ 1.2
- 🐞 **Timezone โปร:** เทียบ `new Date(promoStart)` (UTC) กับ saleDate string (YYYY-MM-DD เวลาไทย) — `daily-sale.service.ts:226,250` มีโอกาส off-by ~7 ชม. ที่ขอบวันโปร ควรเทียบเป็น string `YYYY-MM-DD` ทั้งคู่
- ⚠️ **แก้ไขบิลเก่าไม่ re-resolve โปร:** `record.tsx:345-361` รายการที่โหลดมาแก้ยังถือราคา/remark เดิม ถ้าโปรเปลี่ยนหลังบันทึก ต้องสแกนใหม่ถึงจะอัปเดต
- ⚠️ **จำกัดเฉพาะ Watson:** บันทึกโปรได้เฉพาะ shop "Watson" — `promo-save.ts:31-34` (BigC/Lotus = preview เท่านั้น); โปรใช้ collection เดียวร่วมทุก shop (ไม่มี per-shop isolation)

---

## 1.3 — รายงานยอดขายพนักงาน ✅ (⚠️ ไม่มี scoping)

ไฟล์: `dashboard-vendor-center/sales-report/page.tsx`

| ข้อกำหนด | สถานะ | หลักฐาน |
|----------|-------|---------|
| ค้นหาตามช่วงวันที่ / สาขา / พนักงาน | ✅ | มี preset (เมื่อวาน/7วัน/MTD/เดือนก่อน/YTD/ปีก่อน) + filter สาขา + filter พนักงาน + ค้นหาชื่อ/รหัสสินค้า |
| ยอดขายรวม / จำนวนบิล / จำนวนสินค้า | ✅ | แสดงครบ + ตารางรายรายการ |
| Export Excel / PDF | ✅ | Excel `:423` (XLSX), PDF `:526` (jsPDF+autoTable, มี Thai font) |
| อ่านข้อมูลจากยอดที่มือถือบันทึก | ✅ | อ่าน `dailySales` `:149-154` |
| **สิทธิ์/ขอบเขตข้อมูล** | ⚠️ **❌ ไม่มี** | ไม่มี role check — ผู้ใช้ที่ login ใด ๆ เห็นข้อมูลทุกคนทุกสาขา (grep ยืนยันไม่พบ ELEVATED_ROLES/role check) |

---

## 1.4 — รายงาน Supervisor (ภาพรวมทีม) ✅ (เป็นตัวอย่างที่ดี)

ไฟล์: `dashboard-vendor-center/supervisor-sales-report/page.tsx`, `lib/.../supervisor-scope.ts`

| ข้อกำหนด | สถานะ | หลักฐาน |
|----------|-------|---------|
| ยอดแยกตามสาขา / พนักงาน + filter ช่วงเวลา | ✅ | ตาราง by-branch + by-employee + preset วันที่ |
| ยอดรวมทีม + สถิติรายสาขา | ✅ | การ์ดสรุป (รายได้/ชิ้น/บิล/จำนวนสาขา/จำนวนพนักงาน) |
| เปรียบเทียบยอดแต่ละสาขา | ✅ | แถบ % เทียบสาขา |
| Export Excel / PDF | ✅ | Excel 2 ชีต (By Branch + By Employee) `:408-469`; PDF `:472-584` |
| **Role gate + branch scoping** | ✅ | `ELEVATED_ROLES` `:85`; ปฏิเสธ role ต่ำ `:112-138`; supervisor เห็นเฉพาะ `managedBranchIds` (fallback `branchId`), manager เห็น union ของทีม, admin เห็นทั้งหมด — `supervisor-scope.ts:51-61`, ใช้จริง `:228-232` |

> 👉 ใช้ pattern scoping ของหน้านี้ไปอุดช่องว่างสิทธิ์ของ 1.3 และ 1.5 ได้เลย

---

## 1.5 — รายงานทุกสาขา ⚠️

| รายงาน | สถานะ | หลักฐาน / หมายเหตุ |
|--------|-------|--------------------|
| **By-Store** (`dashboard-vendor-center/by-store/page.tsx`) | ⚠️ | รวมยอดรายสาขา + เทียบ growth% + Excel `:293` + PDF `:330` — แต่ **ไม่มี role gate** (ใครก็เปิดได้) |
| **By-Product** (`.../by-product/page.tsx`) | ⚠️ | แตกตามสินค้า + breakdown รายสาขา + Excel `:306` — **ไม่มี PDF**, ไม่มี role gate |
| **Inventory Report** (`.../inventory-report/page.tsx`) | ⚠️🐞 | Excel/CSV เท่านั้น (ไม่มี PDF) + **ใช้ mock data ไม่ได้ดึง dailySales จริง** |
| Daily-sale by-branch (`stock-counter/dashboard/daily-sale/page.tsx`) | ✅ | สรุปยอดรายวันแยกสาขาจาก `dailySales` จริง + export CSV |

ข้อสังเกต: ยังไม่มีหน้า "สรุปทุกสาขาสำหรับ admin/super_admin โดยเฉพาะ" ที่ล็อกสิทธิ์ — by-store ทำหน้าที่นี้ได้ถ้าเพิ่ม role gate

---

## 1.6 — Report Management ❌ (ช่องว่างใหญ่สุด — ยังไม่มีเลย)

| ข้อกำหนด | สถานะ | หลักฐาน |
|----------|-------|---------|
| รายงานสรุปยอดขายรายวันจาก **file rang Watson** แยกตามสาขา | ❌ | `app/api/watson/` มีแค่ `import-price-list`, `price-import(-history)`, `invoice-upload/history`, `promotion-upload-history` — **ไม่มี daily-sales importer/parser/type เลย** (grep ยืนยัน) |
| รายงาน **เปรียบเทียบยอดรายวันรายสาขา: Watson file vs ยอดที่พนักงานบันทึกผ่านมือถือ** | ❌ | ฝั่งมือถือมีข้อมูล (`dailySales`) แต่ **ไม่มี** importer ฝั่ง Watson และ **ไม่มีหน้า side-by-side/variance** |

**ของที่มีอยู่แล้วและใช้ต่อยอด 1.6 ได้:**
- Pattern เปรียบเทียบ 2 แหล่ง: `app/api/phithan/stock-comparison/route.ts` (เทียบ Firestore vs Phithan SQL พร้อม difference/status/summary) — เปลี่ยนแหล่งจาก Phithan SQL → ไฟล์ Watson ก็ได้รูปแบบนี้
- Branch code normalization: `app/api/phithan-eod/route.ts:17-21`
- Parser Excel: `lib/watson/excel-parser.ts`, `watson-pro-parser.ts`
- Export Excel/PDF/CSV: มีพร้อมในหน้ารายงานอื่น

**สิ่งที่ต้องสร้างเพื่อปิด 1.6:**
1. Type `types/watson/daily-sales.ts` (branchCode, saleDate, items: barcode/qty/amount …)
2. Parser ไฟล์ยอดขายรายวัน Watson (ต้องได้ตัวอย่างไฟล์ "rang watson" จริงก่อน)
3. API `POST /api/watson/daily-sales-import` → เก็บลง collection ใหม่ (เช่น `watson_daily_sales`)
4. หน้า report เทียบ `watson_daily_sales` vs `dailySales` match ด้วย branchCode+saleDate แสดง variance + export
5. firestore.rules สำหรับ collection ใหม่

---

## 🎯 "ขาดอะไรอีก" — รายการที่ต้องทำต่อ (เรียงตามความสำคัญ)

### P0 — ขาดจริงตาม spec
- [ ] **1.6 ทั้งหมด** — importer ไฟล์ยอดขายรายวัน Watson แยกสาขา + หน้าเปรียบเทียบ Watson vs มือถือ (รายสาขา/รายวัน + variance + export)
  - ⛳ **ติดอยู่ที่:** ต้องการ **ตัวอย่างไฟล์ "rang watson" จริง** เพื่อรู้ชื่อคอลัมน์/รูปแบบสาขา ก่อนเขียน parser

### P1 — ช่องว่างด้านสิทธิ์ (ความถูกต้อง/ความปลอดภัยของข้อมูล) ✅ เสร็จแล้ว
- [x] เพิ่ม **role gate + branch scoping** ให้รายงาน **1.3 (sales-report)** — ใช้ helper ใหม่ `lib/reports/load-scoped-branches.ts` (`da74b8e`)
- [x] เพิ่ม **role gate + scoping** ให้รายงาน **1.5 (by-store / by-product)** (`da74b8e`)

### P2 — ความครบถ้วน/คุณภาพ
- [x] 🐞 แก้ **timezone โปรโมชั่น** ฝั่งมือถือ — `isPromoActiveOnDate` เทียบ calendar-date string + regression test (`db775a6`)
- [x] **by-product** Export PDF (จัดให้ใช้ cached Thai-font pattern เดียวกับ 1.4) (`da74b8e`)
- [ ] **inventory-report** เปลี่ยนจาก mock data → ดึงข้อมูลจริง + เพิ่ม PDF — ⚠️ **ติด WIP ของผู้ใช้** (ยังไม่แตะ)
- [ ] (ถ้าต้องรองรับหลาย retailer) เปิดบันทึกโปรของ BigC/Lotus + per-shop isolation (`promo-save.ts:31-34`)
- [ ] แก้ไขบิลเก่าให้ re-resolve โปรล่าสุด (optional)

---

## ภาคผนวก — collection & ไฟล์สำคัญ
- ยอดขายมือถือ: Firestore `dailySales`
- โปรโมชั่น (master): `watson_promotion_data/current` → mirror `watson_current_pricelist/current`
- บันทึก: `app/(mini-apps)/daily-sale/{record,index,history}.tsx`, `services/daily-sale*.ts`
- หลังบ้านโปร: `app/.../promotion-report/page.tsx`, `lib/watson/*`
- รายงาน: `dashboard-vendor-center/{sales-report,supervisor-sales-report,by-store,by-product}/page.tsx`, `stock-counter/dashboard/daily-sale/page.tsx`
- Pattern เทียบ 2 แหล่ง (สำหรับ 1.6): `app/api/phithan/stock-comparison/route.ts`
