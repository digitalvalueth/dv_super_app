# BigC Promotion Import (.xlsb) — Mapping & Status

> ไฟล์โปรโมชั่นจาก BigC เป็นฟอร์ม **"PROMOTION ITEM REQUISITION / PRO.01"** (`.xlsb`) — โครงสร้างต่างจาก Watson price list โดยสิ้นเชิง (เป็นฟอร์มขอจัดโปร ไม่ใช่ตารางสะอาด)

## สถานะ (รอบนี้ = preview only)
- ✅ Parser: `lib/watson/bigc-promo-parser.ts` (pure `parseBigCSheet` + xlsx wrapper `parseBigCFile`) + unit tests
- ✅ Preview UI: `components/watson/BigCImportPreview.tsx` (เลือกไฟล์ → แสดงตารางที่ map + period + warnings) — **ยังไม่เขียนลง Firestore**
- ✅ Mount: ปุ่ม "นำเข้า BigC (Preview)" ในหน้า `stock-counter/dashboard/promotion-report`
- ⏳ ยังไม่ทำ: เขียนจริงลง **collection แยกต่อ retailer** (ตามที่ตกลง — BigC/Lotus/Watson แยกกัน)

## Mapping (BigC → PromotionItem)
| ช่องของเรา | มาจาก BigC | หมายเหตุ |
| --- | --- | --- |
| `barcode` | คอลัมน์ Barcode (~col 3, merged 3–6 ใช้ค่าแรก) | item ต้องมี barcode (digits ≥ 8) เท่านั้น |
| `itemName` | Product Name (~col 7, merged 7–13) | |
| `stdPrice` | ราคาขายสินค้า **Normal** (~col 24) | ไม่ใช่ราคาต้นทุน (col 18/21) |
| `commPrice` | ราคาขายสินค้า **Promotion** (~col 27) | |
| `promoStart/End` | แถว "Promotion Cost Price" (DD/MM/YY) + fallback ชื่อไฟล์ | 1 ไฟล์ = 1 period ใช้กับทุก item |
| `remark` | Promotion พิเศษ (~col 39) | เช่น "2 For 1198", "3 For 999" |
| `itemCode` | = barcode | BigC ไม่มี Watson Code |

## Gotchas ที่ parser จัดการแล้ว
- ตรวจหา header table/คอลัมน์แบบ dynamic (ตาม text) ไม่ hardcode
- **แถว "Promotion Sell Price" มีวันที่ template เก่า (ปี 2021) → ไม่ใช้** ใช้แถว Cost Price แทน (มี warning แจ้ง)
- ข้ามแถวเปล่าที่มีแค่เลข No (ฟอร์มมีช่องว่างเผื่อ) และหยุดที่แถว footer ("***", "หมายเหตุ", "TOTAL")
- ทุก variant (skincare / food supplement / Nestme) ใช้ parser เดียว

## ตรวจกับไฟล์จริงแล้ว
| ไฟล์ | items | period |
| --- | --- | --- |
| skincare Bro.1 | 50 | 2026-01-05 → 2026-01-28 |
| Food Supplement Bro1 | 4 | 2026-01-05 → 2026-01-28 |
| Bro.5 Nestme | 45 | 2026-04-23 → 2026-05-20 |

## ขั้นต่อไป (เมื่อพร้อม)
1. ออกแบบ collection แยกต่อ retailer (เช่น `bigc_promotion_data` หรือ `promotion_data` + field `retailer`)
2. เพิ่มปุ่ม "ยืนยันบันทึก" ในหน้า preview → เขียนลง collection นั้น (+ กันซ้ำตาม period/barcode)
3. ตัดสินใจว่าราคาโปร BigC จะมีผลกับการคิดราคาตอนบันทึกขายหรือไม่ (daily-sale ปัจจุบันเป็น Watson)
