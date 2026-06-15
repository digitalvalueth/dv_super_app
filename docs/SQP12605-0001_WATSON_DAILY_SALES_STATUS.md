# สถานะงาน & Task — ระบบบันทึกยอดขายรายวันสาขา Watson (SQP12605-0001)

> **อ้างอิงใบเสนอราคา:** SQP12605-0001 ลงวันที่ 11/05/2569 — "Mobile Application ระบบบันทึกยอดขายรายวันสาขา Watson และรายงานยอดขายสินค้า"
> **มูลค่า:** 260,000 บาท · **ระยะเวลาพัฒนา:** 90 วัน
> **วันที่ตรวจสอบโค้ด:** 15 มิ.ย. 2026 (branch `dev`)
> **วิธีตรวจ:** อ่านโค้ดจริงทีละไฟล์ (ไม่ได้เดาจากชื่อไฟล์) — ทุกข้อมี file:line อ้างอิง

## ✅ ความคืบหน้า (อัปเดต 15 มิ.ย. 2026 — branch `feature/watson-daily-sales-sqp12605`)

ทำกลุ่ม **A + B + C + D** เสร็จ (E-2e ตีความว่า "มีโปรหลายตัวพร้อมกัน" = เสร็จแล้ว ไม่ต้องทำเพิ่ม) — ทุก task ผ่าน review (spec + quality) และ `tsc --noEmit` สะอาด

| Commit | งาน |
| --- | --- |
| `fix(firestore)` | **P0 แก้แล้ว + deploy ทั้ง dev+prod** — เพิ่ม rule `dailySales` (ยอดขายเขียน production ได้แล้ว) |
| `feat(daily-sale)` | B1 duplicate check · B2 edit/delete · B3 review screen · B4 กติกาโปรซ้อน (ส่วนลดสูงสุดชนะ) |
| `feat(sales-report)` | C1 filter พนักงานขาย · C2 นับจำนวนบิล · C3 PDF export |
| `feat(reports)` | C4 by-store/by-product อ่าน `dailySales` จริง + เทียบ period + Excel/PDF |
| `chore(vendor-center)` | commit `brand-context.tsx` + `useActivityLogger.ts` (dependency ของหน้า report — เดิม untracked) |
| `feat(supervisor-report)` | **D** หน้า `supervisor-sales-report` ใหม่: scope ตามสาขาที่ดูแล (supervisor/manager/admin) + สรุปทีม + ตารางรายสาขา/รายคน + เทียบสาขา + Excel/PDF |

**ยังเหลือ:**
- validate โปรซ้อนทับช่วงวันที่ในหน้าหลังบ้าน (P2 #8 — promotion-report มี WIP ของคุณค้างอยู่ ยังไม่แตะ)
- ทดสอบจริงบนอุปกรณ์/เว็บ (repo ไม่มี test suite — verify ด้วย tsc + review เท่านั้น)

> ⚠️ **หมายเหตุ branch:** ฟีเจอร์นี้ build บน WIP เดิมของคุณใน vendor-center จึงมีการ commit ไฟล์ infra ที่ฟีเจอร์ต้องพึ่ง (`brand-context.tsx`, `useActivityLogger.ts`) และ `layout.tsx` (ซึ่งพ่วง notification bell + ลิงก์ Activity Logs ที่ route ยังไม่ commit → ลิงก์นั้นจะ 404 จนกว่าจะ commit งาน activity-logs) — ตอน merge เข้า `dev` ให้ดูจุดนี้

## เกณฑ์สถานะ

| สัญลักษณ์ | ความหมาย |
| --- | --- |
| ✅ | ทำเสร็จ ใช้งานได้ |
| 🟡 | ทำบางส่วน / ใช้ได้แต่ไม่ครบสเปก |
| ❌ | ยังไม่ได้ทำ |
| 🐞 | มีบัค (รายละเอียดในส่วน "บัคที่ต้องแก้") |

## สรุปภาพรวมความครบถ้วนตามสเปก

| ฟีเจอร์ | หัวข้อในใบเสนอราคา | สถานะเดิม (ตอนตรวจ) | สถานะหลังแก้ |
| --- | --- | --- | --- |
| 1 | บันทึกยอดขายผ่าน Mobile App | 🟡 ~60% (บัคขวาง production) | ✅ แก้บัค + เพิ่ม duplicate/edit/delete/review |
| 2 | ราคาตามช่วงโปรโมชั่น | 🟡 ~75% | ✅ (2e = "มีโปรหลายตัวพร้อมกัน" ตามที่ลูกค้ายืนยัน) + แก้กติกาโปรซ้อน |
| 3 | รายงานยอดขายของพนักงานขาย | 🟡 ~55% | ✅ เพิ่ม filter พนักงาน + จำนวนบิล + PDF |
| 4 | รายงานยอดขายของ Supervisor | ❌ 0% | ✅ สร้างหน้าใหม่ครบ 4a–4d |
| 5 | รายงานยอดขายทุกสาขา | 🟡 ~30% (mock) | ✅ ต่อข้อมูลจริง + เทียบสาขา + Excel/PDF |

> ~~ประเด็นที่ต้องรีบที่สุด: ฟีเจอร์ 1 บันทึกยอดขายบน production ไม่ได้~~ → **แก้แล้ว** (deploy rule ทั้ง dev+prod)
> เหลือ: validate โปรซ้อนทับวันที่ในหน้าหลังบ้าน (P2 #8) + ทดสอบจริงก่อน merge

---

## ฟีเจอร์ 1 — บันทึกยอดขายสินค้าผ่าน Mobile Application

ไฟล์หลัก: `app/(mini-apps)/daily-sale/record.tsx`, `services/daily-sale.service.ts`, type `DailySale` ใน `types/index.ts`

| # | สเปก | สถานะ | หลักฐาน / หมายเหตุ |
| --- | --- | --- | --- |
| 1a | สแกน Barcode ผ่านกล้องมือถือ | ✅ | `record.tsx:1634` รองรับ EAN13/EAN8/UPC-A/Code128/QR · ฟังก์ชัน `handleBarcodeScanned()` (`record.tsx:455`) |
| 1b | ดึงข้อมูลสินค้า + ราคาโปรอัตโนมัติ | ✅ | lookup สินค้า `daily-sale.service.ts:107` · ดึงโปร `fetchActivePromoItems()` `daily-sale.service.ts:154` |
| 1c | บันทึกจำนวนขาย + ระบุวันที่ขาย | ✅ | จำนวน `record.tsx:1027` · ปฏิทินเลือกวันที่ `record.tsx:92` (default = วันนี้) |
| 1d | ตรวจสอบข้อมูลซ้ำก่อนบันทึก | ❌ 🐞 | ไม่มี logic เช็คซ้ำทั้งฝั่ง client (`handleSubmit` `record.tsx:503`) และ service (`createDailySale` `daily-sale.service.ts:22`) |
| 1e | แก้ไข/ลบข้อมูลก่อนยืนยัน | 🟡 | ลบรายการ **ก่อน submit** ได้ (`removeItem` `record.tsx:498`) แต่ **หลังบันทึกแล้วแก้/ลบไม่ได้** — ไม่มี `updateDailySale`/`deleteDailySale` และไม่มีหน้า review สรุปก่อน save |
| 1f | จัดเก็บเข้าฐานข้อมูลส่วนกลาง | 🟡 🐞 | เขียนลง collection `dailySales` (`daily-sale.service.ts:25`) แต่ถูก **Firestore rules บล็อก** (ดูบัค #1) |

---

## ฟีเจอร์ 2 — ราคาตามช่วงโปรโมชั่น

ไฟล์หลัก: `platform-web/app/dashboard-vendor-center/promotion-report/page.tsx`, `platform-web/types/watson/promotion.ts`, `platform-web/lib/watson-firebase.ts`, `services/daily-sale.service.ts`
ที่เก็บข้อมูล: collection `watson_promotion_data` doc `current` (เก็บ array `items` แบบ 1 แถว = 1 สินค้า)

| # | สเปก | สถานะ | หลักฐาน / หมายเหตุ |
| --- | --- | --- | --- |
| 2a | กำหนดโปรผ่านระบบหลังบ้าน | 🟡 | มีหน้า CRUD `promotion-report/page.tsx:104` แต่ไม่มี validate ช่วงวันที่ซ้อนทับ + ไม่มี bulk |
| 2b | รองรับวันเริ่ม–สิ้นสุดโปร | ✅ | `promotion.ts:12` (`promoStart`/`promoEnd`) เก็บเป็น Timestamp `watson-firebase.ts:878` |
| 2c | รองรับราคาปกติ + ราคาโปร | ✅ | `promotion.ts:7` (`stdPrice` + `commPrice`) |
| 2d | เลือกราคาตามช่วงเวลาอัตโนมัติ | ✅ | กรองตามวันที่ `daily-sale.service.ts:195` + `record.tsx:342` (ระดับ **วัน** ไม่มีระดับชั่วโมง) |
| 2e | รองรับโปรหลายสินค้า | ❌ | โครงสร้างเป็น 1-ต่อ-1 (`promotion.ts`) — ทำโปรแบบ "ซื้อ A+B" ไม่ได้ |
| 2f | แสดงราคาที่ถูกต้องขณะบันทึกขาย | ✅ | `record.tsx:466` + badge สถานะโปร `record.tsx:1179` |

> หมายเหตุ 2e: คำว่า "รองรับโปรโมชั่นหลายสินค้า" ในใบเสนอราคาอาจตีความได้ 2 แบบ — (ก) "มีโปรหลายตัวในระบบพร้อมกัน" = ทำได้แล้ว, (ข) "โปร 1 ตัวผูกหลายสินค้า/บันเดิล" = **ยังไม่มี** ควร**ยืนยันกับลูกค้า**ว่าหมายถึงแบบไหนก่อนประเมินงานเพิ่ม

---

## ฟีเจอร์ 3 — รายงานสรุปยอดขายของพนักงานขาย (แยกตามสาขา + ช่วงเวลา)

ไฟล์หลัก: `platform-web/app/dashboard-vendor-center/sales-report/page.tsx` (อ่านจาก collection `dailySales` จริง `:119`)

| # | สเปก | สถานะ | หลักฐาน / หมายเหตุ |
| --- | --- | --- | --- |
| 3a | ค้นหาตามช่วงวันที่ / สาขา / พนักงานขาย | 🟡 | วันที่ ✅ (`:219`) · สาขา ✅ (`storeFilter :87,:309`) · **พนักงานขาย ❌ ไม่มี filter** (ข้อมูลมี `employeeName` `:39` แต่ไม่มี UI กรอง) |
| 3b | แสดงยอดขายรวม / จำนวนรายการ / จำนวนสินค้า | 🟡 | มียอดขายรวม + Units Sold แต่ตารางเป็นระดับ "รายการสินค้า" ไม่มีตัวเลข "จำนวนบิล/transaction" แยกชัด |
| 3c | Export Excel / PDF | 🟡 | Excel ✅ (`XLSX.writeFile :387`) · **PDF ❌ ไม่มี** (มี `jspdf` ใน package แต่หน้านี้ไม่ได้ใช้) |

---

## ฟีเจอร์ 4 — รายงานสรุปยอดขายของ Supervisor (ภาพรวมทีมที่รับผิดชอบ)

| # | สเปก | สถานะ | หลักฐาน / หมายเหตุ |
| --- | --- | --- | --- |
| 4a | ดูยอดขายตามสาขา/พนักงาน + กรองช่วงเวลา | ❌ | ไม่มีหน้ารายงานเฉพาะ supervisor · `sales-report` ไม่มี scope ตาม `managedBranchIds`/ทีม |
| 4b | ยอดรวมทีม + สถิติรายสาขา | ❌ | ยังไม่มี |
| 4c | เปรียบเทียบยอดขายระหว่างสาขา | ❌ | ยังไม่มี |
| 4d | Export Excel / PDF | ❌ | ยังไม่มี (เพราะฟีเจอร์ยังไม่ถูกสร้าง) |

> **ฟีเจอร์นี้ยังไม่ได้เริ่มทำเลย** — เป็นช่องว่างใหญ่สุดในงานนี้

---

## ฟีเจอร์ 5 — รายงานสรุปยอดขายทุกสาขา Watsons

ไฟล์: `platform-web/app/dashboard-vendor-center/by-store/page.tsx`, `by-product/page.tsx`

| # | สเปก | สถานะ | หลักฐาน / หมายเหตุ |
| --- | --- | --- | --- |
| 5a | ยอดรวมทุกสาขา + เปรียบเทียบรายสาขา | 🟡 🐞 | หน้า by-store มี layout/ตารางเปรียบเทียบ แต่ใช้ **ข้อมูลปลอม (mock)** `const rows: Row[]` (`by-store/page.tsx:26` ข้อมูลเป็น "EVEANDBOY..." ไม่ใช่ Watson, **ไม่มี import firebase เลย**) |
| 5b | Export Excel / PDF | ❌ | ไม่มีปุ่ม export ในหน้า by-store / by-product |

---

## 🐞 บัค / ปัญหาที่ต้องแก้ (เรียงตามความรุนแรง)

### P0 — ขวาง production (ต้องแก้ทันที)
1. **`dailySales` เขียนไม่ได้บน production** — `firestore.rules` ไม่มี `match /dailySales/{...}` จึงตกไป DEFAULT DENY (`firestore.rules` บล็อกท้ายไฟล์) ทำให้ `createDailySale()` ล้มเหลวด้วย permission error บน prod (dev เปิดหมดเลยไม่เจอ)
   - **แก้:** เพิ่ม rule `dailySales` (อ่าน/เขียนตาม company + role, จำกัดให้เจ้าของเขียนของตัวเอง) แล้ว deploy ทั้ง `fittsuperapp-dev` และ `-prod`

### P1 — ผิดสเปกชัดเจน
2. **ไม่มีการตรวจสอบข้อมูลซ้ำก่อนบันทึก** (สเปก 1d) — ขายสินค้าเดิม วันเดิม พนักงานเดิม บันทึกซ้ำได้ไม่จำกัด
3. **แก้ไข/ลบหลังบันทึกไม่ได้** (สเปก 1e) — ขาดทั้ง service และหน้า UI
4. **หน้า by-store / by-product เป็น mock data** (สเปก 5a) — ต้องต่อ Firestore `dailySales` จริง
5. **ขาด PDF export** ทุกหน้ารายงาน (สเปก 3c, 4d, 5b)
6. **ขาด filter ตามพนักงานขาย** ในรายงาน (สเปก 3a)
7. **ฟีเจอร์ Supervisor (4) ทั้งหมดยังไม่มี**

### P2 — เสี่ยงเชิงตรรกะ
8. **โปรซ้อนทับช่วงวันที่ได้** ไม่มี validate (สเปก 2a) — ถ้ามีโปร >1 ตัวบน barcode เดียววันเดียว ระบบเลือกตัวแรก/ให้ผู้ใช้เลือกเอง เสี่ยงคิดราคาผิด (`record.tsx:354`)
9. **โปรไม่มีระดับเวลา (ชั่วโมง)** — รองรับแค่ระดับวัน (ถ้าลูกค้าไม่ต้องการ flash sale รายชั่วโมง ถือว่าไม่เป็นปัญหา)

---

## ✅ Task List (สิ่งที่ต้องทำต่อ)

### กลุ่ม A — Production blocker (ทำก่อน)
- [x] เพิ่ม Firestore security rule สำหรับ `dailySales` + deploy ทั้ง 2 database *(บัค #1)* ✅

### กลุ่ม B — Mobile บันทึกยอดขาย (ฟีเจอร์ 1)
- [x] เพิ่มเช็คข้อมูลซ้ำก่อนบันทึก (barcode + วันที่ + พนักงาน/สาขา) *(1d)* ✅
- [x] เพิ่มหน้า/ฟังก์ชันแก้ไขและลบรายการที่บันทึกแล้ว (`updateDailySale` / `deleteDailySale`) *(1e)* ✅
- [x] เพิ่มหน้าสรุปทบทวนรายการ (review/confirm) ก่อนกดยืนยัน *(1e)* ✅
- [x] กำหนดกติกาเมื่อมีโปรหลายตัวบน barcode เดียว (ส่วนลดสูงสุดชนะ = commPrice ต่ำสุด) *(บัค #8 ฝั่งมือถือ)* ✅

### กลุ่ม C — รายงาน (ฟีเจอร์ 3, 5)
- [x] เพิ่ม filter "พนักงานขาย" ใน sales-report *(3a)* ✅
- [x] เพิ่มตัวเลข "จำนวนบิล/transaction" แยกจากจำนวนสินค้า *(3b)* ✅
- [x] เพิ่ม PDF export (`jspdf` + `jspdf-autotable`) ใน sales-report / by-store / by-product *(3c, 5b)* ✅
- [x] เปลี่ยนหน้า by-store / by-product จาก mock เป็นอ่าน `dailySales` จริง + เปรียบเทียบรายสาขา *(5a)* ✅

### กลุ่ม D — รายงาน Supervisor (ฟีเจอร์ 4 — สร้างใหม่ทั้งหมด)
- [x] สร้างหน้ารายงานยอดขายของทีมที่ supervisor ดูแล (scope ตาม `managedBranchIds`/ลูกทีม) *(4a)* ✅
- [x] แสดงยอดรวมทีม + สถิติรายสาขา + เปรียบเทียบระหว่างสาขา *(4b, 4c)* ✅
- [x] เพิ่ม Excel/PDF export ของรายงาน supervisor *(4d)* ✅

### กลุ่ม E — โปรโมชั่น (ฟีเจอร์ 2)
- [ ] **ยืนยันกับลูกค้า**ว่า "โปรหลายสินค้า" (2e) หมายถึงบันเดิลจริงหรือไม่ → ถ้าใช่ ออกแบบ schema โปรแบบผูกหลายสินค้า
- [ ] เพิ่ม validate ช่วงวันที่โปรซ้อนทับในหน้าหลังบ้าน *(บัค #8)*

---

## ✅ สิ่งที่ทำเสร็จแล้ว (ของที่ใช้ได้จริง)
- สแกน barcode + ดึงข้อมูลสินค้า/ราคาโปรอัตโนมัติ บนมือถือ (1a, 1b)
- บันทึกจำนวน + วันที่ขาย (1c)
- ระบบโปรโมชั่น: วันเริ่ม-สิ้นสุด, ราคาปกติ/โปร, เลือกราคาตามวันที่อัตโนมัติ, แสดงราคาขณะบันทึก (2b, 2c, 2d, 2f)
- หน้าจัดการโปรหลังบ้าน CRUD พื้นฐาน (2a บางส่วน)
- รายงานพนักงานขาย: filter วันที่/สาขา + Excel export (3a/3c บางส่วน) อ่านจาก `dailySales` จริง
