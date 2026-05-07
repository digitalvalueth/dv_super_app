# 📋 สรุปงานที่ต้องทำ — จาก Feedback ทีมพิธาน (27 Apr 2025)

> เอกสารนี้สรุปจาก [27_Apr-2025_update_phithan.md](./27_Apr-2025_update_phithan.md) โดยเทียบกับสถานะปัจจุบันของระบบ (super-fitt)
> เพื่อใช้เป็น checklist สำหรับการพัฒนา

---

## 🎯 ภาพรวมสถานะ

| #   | หัวข้อ                              | สถานะปัจจุบัน                                                     | ต้องทำเพิ่ม                                  | Priority |
| --- | ----------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- | -------- |
| 1   | ฟอร์มเชิญผู้ใช้ (เพิ่มฟิลด์)        | ⚠️ มี email/role/branch แต่ขาดฟิลด์อื่น                           | เพิ่ม BA code, ชื่อ-สกุล, seller, supervisor | 🔴 High  |
| 2   | รอบนัด Stock (Auto vs Manual)       | ✅ มีครบแล้ว (Auto + Manual assign)                               | แค่อธิบาย/คู่มือให้ทีมพิธาน                  | 🟢 Done  |
| 3   | Bulk Import 300-400 คน + สาขา       | ⚠️ มีแค่ import สินค้า/promo                                      | สร้าง User & Branch CSV importer             | 🔴 High  |
| 4   | ตรวจรูปถ่ายตรงสาขา (Geofence Photo) | ⚠️ มี GPS+EXIF แล้ว แต่ไม่ได้เทียบกับสาขา                         | ผูก lat/lng สาขา + เปรียบเทียบ               | 🔴 High  |
| 5   | AI นับเฉพาะสินค้าที่ถูก barcode     | ✅ ทำแล้ว (filter by expectedBarcode)                             | ทดสอบ + ปรับ prompt เพิ่มเติม                | 🟢 Done  |
| 6   | จัดวางสินค้าให้ AI อ่านแม่น         | — เป็น Guideline ให้ผู้ใช้                                        | ทำคู่มือถ่ายรูป (1 หน้า)                     | 🟡 Med   |
| 7   | ห้าม BA ลบ account ตัวเอง           | ✅ มีปุ่ม (App Store บังคับ)                                      | ซ่อนปุ่มให้ลึกขึ้น / ใช้ text เล็ก           | 🟡 Med   |
| 8   | BA ยืน 2 สาขา ขึ้นแค่สาขาเดียวบนแอป | ✅ Schema รองรับ branchIds[] อยู่แล้ว                             | ตรวจ UI Mobile ว่าโชว์ครบทุกสาขา             | 🟡 Med   |
| 9   | Geofence Check-in (lat/lng สาขา)    | ❌ ไม่มี lat/lng/radius ใน Branch                                 | เพิ่ม schema + UI + validation               | 🔴 High  |
| 10  | คู่มือฟังก์ชัน                      | — ไม่มีเอกสาร                                                     | เขียนคู่มือเมนู/สิทธิ์แต่ละบทบาท             | 🟡 Med   |
| 11  | ลำดับตำแหน่งงาน                     | ✅ มี 5 roles ครบ (super_admin/admin/manager/supervisor/employee) | สรุปเป็นตารางสิทธิ์ใน docs                   | 🟢 Done  |

---

## 🛠️ รายละเอียดงานที่ต้องลงมือทำ

### 1️⃣ เพิ่มฟิลด์ในฟอร์มเชิญผู้ใช้ 🔴

**ไฟล์ที่ต้องแก้:**

- [platform-web/app/stock-counter/dashboard/invitations/page.tsx](../platform-web/app/stock-counter/dashboard/invitations/page.tsx)
- [platform-web/app/api/invitations/send/route.ts](../platform-web/app/api/invitations/send/route.ts)
- [platform-web/types/invitation.ts](../platform-web/types/invitation.ts)
- [app/invitation/[token].tsx](../app/invitation/[token].tsx) — รับค่ามาจาก invitation แล้วเขียนเข้า user

**ฟิลด์ที่ต้องเพิ่ม:**

```ts
interface Invitation {
  // ...existing
  baCode?: string; // 1.1 รหัส BA
  fullName?: string; // 1.2 ชื่อ-นามสกุล (TH)
  seller?: string; // 1.3 seller / ยี่ห้อ
  supervisorId?: string; // 1.4 supervisor (ผู้ดูแล)
}
```

**Acceptance:**

- [ ] ฟอร์มเชิญมีฟิลด์ครบ 4 อย่าง (baCode, fullName, seller, supervisor dropdown)
- [ ] ตอน accept invitation → เขียน 4 ฟิลด์นี้ลง user document
- [ ] หน้า users list แสดง baCode + fullName

---

### 2️⃣ Bulk Import Users & Branches (300-400 คน) 🔴

**สถานะ:** มี Excel uploader สำหรับสินค้า/promo อยู่แล้ว แต่ยังไม่มีของ user/branch

**ไฟล์อ้างอิง (reuse):**

- [platform-web/components/watson/upload/FileUploader.tsx](../platform-web/components/watson/upload/FileUploader.tsx)
- [platform-web/hooks/watson/useExcelUpload.ts](../platform-web/hooks/watson/useExcelUpload.ts)

**ต้องสร้างใหม่:**

1. หน้า `/stock-counter/dashboard/import-users` — อัปโหลด CSV/Excel
   - คอลัมน์: `email, fullName, baCode, role, branchCode, supervisorEmail, seller`
2. หน้า `/stock-counter/dashboard/import-branches`
   - คอลัมน์: `name, code, address, latitude, longitude, radiusMeters`
3. Cloud Function / API route validate + bulk create:
   - Email/branchCode ซ้ำ → reject
   - สร้าง invitation token รายคน (หรือสร้าง user เลย ถ้าใช้ Google SSO)
4. Template CSV ดาวน์โหลดได้

**Acceptance:**

- [ ] อัปโหลด 400 แถวได้ภายใน <30 วิ
- [ ] รายงาน error เป็นแถว (row 12: email ซ้ำ)
- [ ] ส่งอีเมล invitation อัตโนมัติ (optional)

---

### 3️⃣ Branch Coordinates + Geofence (รวมข้อ 4 และ 9) 🔴

**สถานะ:** Branch ยังไม่มี lat/lng — ทำให้ตรวจรูป/check-in นอกสาขาไม่ได้

**ไฟล์ที่ต้องแก้:**

- Schema: [platform-web/types/index.ts](../platform-web/types/index.ts) (interface `Branch`)
- Schema mobile: [types/index.ts](../types/index.ts)
- Branch admin UI: [platform-web/app/stock-counter/dashboard/branches/page.tsx](../platform-web/app/stock-counter/dashboard/branches/page.tsx)
- Photo verification: [utils/watermark.ts](../utils/watermark.ts) + [app/(mini-apps)/stock-counter/preview.tsx](<../app/(mini-apps)/stock-counter/preview.tsx>)
- Check-in (ถ้ามีแยก): ค้นในแอป mobile

**Schema:**

```ts
interface Branch {
  // ...existing
  latitude?: number;
  longitude?: number;
  radiusMeters?: number; // default 200
}
```

**Helper ที่ต้องสร้าง:**

```ts
// utils/geofence.ts
export function haversineDistance(a: LatLng, b: LatLng): number;
export function isWithinBranch(
  loc: LatLng,
  branch: Branch,
): { ok: boolean; distance: number };
```

**Acceptance:**

- [ ] Admin set lat/lng ผ่าน map picker หรือ "ใช้ตำแหน่งปัจจุบัน"
- [ ] รองรับ bulk import lat/lng (ดูข้อ 2)
- [ ] ตอน BA upload รูป → ถ้านอก radius → แสดง warning (ไม่ block)
- [ ] ตอน check-in → ถ้านอก radius → แสดง warning + log ไว้
- [ ] รายงาน admin เห็นว่ามีรูปถ่ายนอกพื้นที่

---

### 4️⃣ ปรับปุ่ม "ลบบัญชี" ให้ลึกขึ้น 🟡

**ไฟล์ที่ต้องแก้:** [app/(tabs)/settings/index.tsx](<../app/(tabs)/settings/index.tsx>)

**แนวทาง:**

- ย้ายไปอยู่ใน `Settings → ความเป็นส่วนตัว → ลบบัญชี` (sub-screen)
- เปลี่ยนเป็น text link เล็กสีเทา ไม่ใช่ปุ่มสีแดงเด่น
- เพิ่ม confirmation 2 ขั้น (พิมพ์ "DELETE" หรือ email ตัวเอง)

**Acceptance:**

- [ ] ไม่เห็นปุ่มทันทีในหน้า Settings หลัก
- [ ] ผ่าน 2 step confirmation
- [ ] ยังคง compliant กับ App Store / Play

---

### 5️⃣ ตรวจการแสดงสาขาบนแอป (Multi-Branch) 🟡

**สถานะ:** Backend รองรับ `branchIds[]` แล้ว แต่ทีมพิธานบอกว่าแอปขึ้นสาขาเดียว

**ต้องตรวจ:**

- [app/(tabs)/settings/index.tsx](<../app/(tabs)/settings/index.tsx>) — แสดงครบทุก branchName หรือยัง?
- หน้านับ stock / camera selector — มี dropdown เลือกสาขาเมื่อมี >1 ไหม?
- หน้า assignments — query โดย `branchIds array-contains userId` หรือดึงทุก branch ของ user

**Acceptance:**

- [ ] BA ที่ถูก assign 2 สาขา เห็น 2 ชื่อสาขาในแอป
- [ ] เลือกสาขาก่อนถ่ายรูปได้ (ถ้ามี >1)
- [ ] Assignment list แสดงงานจากทุกสาขา

---

### 6️⃣ คู่มือ + เอกสาร (Non-code) 🟡

**ไฟล์ใหม่ที่ต้องเขียน (ใส่ใน `/doc_prompt/` หรือ `/docs/`):**

1. **`docs/PHITHAN_USER_MANUAL.md`** — คู่มือใช้งาน
   - รายเมนูบนเว็บ (เชิญผู้ใช้, จัดการสาขา, มอบหมายงาน, รายงาน)
   - แต่ละเมนูใครใช้ได้บ้าง

2. **`docs/PHITHAN_ROLES_MATRIX.md`** — ตารางสิทธิ์

   ```
   | Action          | super_admin | admin | manager | supervisor | employee |
   ```

3. **`docs/PHOTO_GUIDELINE.md`** — วิธีถ่ายรูปให้ AI อ่านแม่น
   - วาง 1 ชั้น ไม่ซ้อน
   - แสงพอ, มุมตรง
   - ปุ่มขอบส้ม = แก้ตัวเลขเองถ้า AI ผิด

---

## ⏱️ ลำดับการทำ (แนะนำ)

**Sprint 1 (เร่งด่วน, 1-2 สัปดาห์):**

1. ข้อ 1 — เพิ่มฟิลด์ invite (baCode, fullName, seller, supervisor)
2. ข้อ 3 — Branch lat/lng + geofence validation (รูปถ่าย + check-in)
3. ข้อ 5 — ตรวจ multi-branch display

**Sprint 2 (ถัดไป, 1-2 สัปดาห์):** 4. ข้อ 2 — Bulk import users + branches (พร้อม template) 5. ข้อ 4 — ซ่อนปุ่มลบบัญชี

**Sprint 3 (เอกสาร):** 6. ข้อ 6 — คู่มือ 3 ไฟล์

---

## 📌 หมายเหตุ

- ✅ = ของเดิมมีอยู่แล้ว ไม่ต้องทำเพิ่ม
- ⚠️ = มีบางส่วน ต้องเพิ่มเติม
- ❌ = ยังไม่มี ต้องสร้างใหม่
- ข้อที่ทีมพิธานต้องส่งข้อมูลให้: **lat/lng ของทุกสาขา** (ใช้ Google Maps คลิกขวา → Copy coordinates)
