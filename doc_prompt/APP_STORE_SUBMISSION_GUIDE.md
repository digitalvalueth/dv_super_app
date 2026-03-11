# 📱 App Store Submission Guide - FITT BSA

> คู่มือการส่ง App ขึ้น App Store สำหรับ **FITT BSA**  
> Last Updated: January 28, 2026

---

## 📋 สารบัญ

1. [ข้อมูล App ปัจจุบัน](#ข้อมูล-app-ปัจจุบัน)
2. [Checklist ก่อน Submit](#checklist-ก่อน-submit)
3. [ขั้นตอนที่ 1: เตรียม Build](#ขั้นตอนที่-1-เตรียม-build)
4. [ขั้นตอนที่ 2: กรอกข้อมูลใน App Store Connect](#ขั้นตอนที่-2-กรอกข้อมูลใน-app-store-connect)
5. [ขั้นตอนที่ 3: Screenshots & App Preview](#ขั้นตอนที่-3-screenshots--app-preview)
6. [ขั้นตอนที่ 4: Age Rating](#ขั้นตอนที่-4-age-rating)
7. [ขั้นตอนที่ 5: App Privacy](#ขั้นตอนที่-5-app-privacy)
8. [ขั้นตอนที่ 6: Review Information](#ขั้นตอนที่-6-review-information)
9. [ขั้นตอนที่ 7: Submit for Review](#ขั้นตอนที่-7-submit-for-review)
10. [เอกสารที่ต้องเตรียม](#เอกสารที่ต้องเตรียม)
11. [FAQ & Common Rejection Reasons](#faq--common-rejection-reasons)

---

## 📱 ข้อมูล App ปัจจุบัน

| Field         | Value                         |
| ------------- | ----------------------------- |
| **App Name**  | FITT BSA                      |
| **Bundle ID** | com.itswatthachai.superfitt   |
| **SKU**       | EX1769589937955               |
| **Apple ID**  | 6758380268                    |
| **Company**   | DIGITAL VALUE COMPANY LIMITED |
| **Version**   | 1.0                           |
| **Status**    | Prepare for Submission        |

---

## ✅ Checklist ก่อน Submit

### 🔧 Technical Checklist

- [ ] **Build Version** - อัพโหลด build ผ่าน Xcode หรือ Transporter แล้ว
- [ ] **App Icon** - 1024x1024 PNG (ไม่มี transparency, ไม่มี rounded corners)
- [ ] **Launch Screen** - ใช้งานได้ปกติ
- [ ] **Info.plist** - กรอก usage descriptions ครบทุก permission
- [ ] **Test บน Real Device** - ทดสอบบน iPhone จริงแล้ว
- [ ] **Crash-free** - ไม่มี crash ที่พบได้ง่าย
- [ ] **Network Errors** - Handle network errors อย่างเหมาะสม

### 📝 Content Checklist

- [ ] **App Name** - ไม่เกิน 30 ตัวอักษร
- [ ] **Subtitle** - ไม่เกิน 30 ตัวอักษร
- [ ] **Description** - อธิบายฟีเจอร์ครบถ้วน
- [ ] **Keywords** - 100 ตัวอักษร คั่นด้วย comma
- [ ] **Screenshots** - ครบทุกขนาด device
- [ ] **Privacy Policy URL** - URL ที่เข้าถึงได้
- [ ] **Support URL** - URL ที่เข้าถึงได้

### 📋 Legal Checklist

- [ ] **Privacy Policy** - มี Privacy Policy ที่เผยแพร่แล้ว
- [ ] **Terms of Service** (ถ้ามี)
- [ ] **Age Rating** - กรอกแบบสอบถามครบ
- [ ] **Content Rights** - ยืนยันสิทธิ์ในเนื้อหา

---

## 🔧 ขั้นตอนที่ 1: เตรียม Build

### 1.1 อัพเดท app.json/app.config.js

```json
{
  "expo": {
    "name": "FITT BSA",
    "slug": "fitt-bsa",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.itswatthachai.superfitt",
      "buildNumber": "1",
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "แอปต้องการเข้าถึงกล้องเพื่อถ่ายรูปสินค้าและเช็คอิน",
        "NSPhotoLibraryUsageDescription": "แอปต้องการเข้าถึงรูปภาพเพื่อเลือกรูปสินค้า",
        "NSLocationWhenInUseUsageDescription": "แอปต้องการเข้าถึงตำแหน่งเพื่อยืนยันการเช็คอิน",
        "ITSAppUsesNonExemptEncryption": false
      }
    }
  }
}
```

### 1.2 Build สำหรับ Production

```bash
# ใช้ EAS Build
eas build --platform ios --profile production

# หรือ Build ใน Xcode
# 1. Open ios/superfitt.xcworkspace
# 2. Product > Archive
# 3. Distribute App > App Store Connect
```

### 1.3 Upload Build

**Option A: ใช้ EAS Submit**

```bash
eas submit --platform ios
```

**Option B: ใช้ Transporter App**

1. Download Transporter จาก Mac App Store
2. Sign in ด้วย Apple ID
3. Drag & Drop .ipa file
4. Click "Deliver"

**Option C: ใช้ Xcode**

1. Archive > Distribute App
2. เลือก "App Store Connect"
3. Upload

---

## 📝 ขั้นตอนที่ 2: กรอกข้อมูลใน App Store Connect

### 2.1 App Information (ข้อมูลหลัก)

| Field                | ค่าที่แนะนำ                  | หมายเหตุ                                      |
| -------------------- | ---------------------------- | --------------------------------------------- |
| **Name**             | `FITT BSA`                   | ชื่อที่แสดงบน App Store (ไม่เกิน 30 ตัวอักษร) |
| **Subtitle**         | `ระบบนับสต็อกสินค้าอัจฉริยะ` | คำอธิบายสั้นๆ (ไม่เกิน 30 ตัวอักษร)           |
| **Primary Language** | English (U.S.) หรือ Thai     | ภาษาหลักของ App                               |

### 2.2 Category (หมวดหมู่)

| Field                  | ค่าที่แนะนำ                    |
| ---------------------- | ------------------------------ |
| **Primary Category**   | `Business` หรือ `Productivity` |
| **Secondary Category** | `Utilities` (optional)         |

### 2.3 Version Information (สำหรับแต่ละเวอร์ชัน)

#### Promotional Text (ไม่บังคับ)

```
🆕 เวอร์ชันแรก! ระบบนับสต็อกสินค้าที่ใช้งานง่าย รวดเร็ว และแม่นยำ
```

#### Description (คำอธิบาย App)

```
FITT BSA - ระบบบริหารจัดการนับสต็อกสินค้าอัจฉริยะ

📦 ฟีเจอร์หลัก:
• นับสต็อกสินค้าด้วยกล้อง - ถ่ายรูปสินค้าพร้อมบันทึกจำนวน
• เช็คอิน-เช็คเอาท์ - บันทึกเวลาเข้า-ออกงานพร้อมตำแหน่ง GPS
• รับสินค้าจากผู้จัดส่ง - ตรวจรับสินค้าพร้อมถ่ายหลักฐาน
• รายงานแบบ Real-time - ดูสรุปผลการนับสินค้าได้ทันที
• ประวัติการทำงาน - ย้อนดูประวัติการนับและเช็คอินได้

👥 เหมาะสำหรับ:
• พนักงานคลังสินค้า
• ผู้จัดการสาขา
• เจ้าของธุรกิจค้าปลีก/ค้าส่ง

🔐 ความปลอดภัย:
• เข้าสู่ระบบด้วย Google Account
• ข้อมูลถูกเข้ารหัสและจัดเก็บอย่างปลอดภัย
• รองรับการใช้งานหลายสาขา

📱 ใช้งานง่าย:
• ออกแบบ UI สวยงาม ใช้งานง่าย
• รองรับ Dark Mode
• ทำงานได้แม้สัญญาณอินเทอร์เน็ตไม่เสถียร

ดาวน์โหลดฟรี เริ่มใช้งานได้ทันที!

---
© 2026 Digital Value Company Limited
```

#### Keywords (คำค้นหา - ไม่เกิน 100 ตัวอักษร)

```
stock,inventory,count,warehouse,checkin,barcode,scanner,business,management,retail
```

#### Support URL

```
https://digitalvalue.co.th/support
```

> ⚠️ ต้องเป็น URL ที่เข้าถึงได้จริง

#### Marketing URL (optional)

```
https://digitalvalue.co.th/fitt-bsa
```

#### What's New in This Version

```
🎉 เวอร์ชันแรก!

• นับสต็อกสินค้าด้วยกล้อง
• เช็คอิน-เช็คเอาท์พร้อม GPS
• รับสินค้าจากผู้จัดส่ง
• รายงานสรุปแบบ Real-time
• รองรับ Dark Mode
```

---

## 📸 ขั้นตอนที่ 3: Screenshots & App Preview

### 3.1 ขนาด Screenshots ที่ต้องการ

| Device                       | Size (pixels) | จำนวนขั้นต่ำ |
| ---------------------------- | ------------- | ------------ |
| **iPhone 6.9"** (15 Pro Max) | 1320 x 2868   | 1-10         |
| **iPhone 6.7"** (14 Pro Max) | 1290 x 2796   | 1-10         |
| **iPhone 6.5"** (11 Pro Max) | 1242 x 2688   | 1-10         |
| **iPhone 5.5"** (8 Plus)     | 1242 x 2208   | 1-10         |
| **iPad Pro 12.9"**           | 2048 x 2732   | 1-10         |
| **iPad Pro 11"**             | 1668 x 2388   | 1-10         |

### 3.2 Screenshots ที่แนะนำให้ทำ (5-8 รูป)

1. **หน้า Home** - แสดง Dashboard และสถิติ
2. **หน้า Stock Counter** - แสดงรายการสินค้าที่ต้องนับ
3. **หน้า Camera/Counting** - แสดงการถ่ายรูปสินค้า
4. **หน้า Check-in** - แสดงการเช็คอินพร้อมตำแหน่ง
5. **หน้า Delivery Receive** - แสดงการรับสินค้า
6. **หน้า History** - แสดงประวัติการนับ
7. **หน้า Profile** - แสดงโปรไฟล์ผู้ใช้
8. **Dark Mode** - แสดง UI ใน Dark Mode

### 3.3 เครื่องมือสร้าง Screenshots

- **Figma** - ออกแบบ frame สวยๆ
- **Screenshots Pro** - สร้าง mockup อัตโนมัติ
- **AppLaunchpad** - เว็บสร้าง screenshot ฟรี
- **Simulator** - ถ่าย screenshot จาก Xcode Simulator

### 3.4 App Preview Video (Optional)

| Device      | Resolution                  | Duration     |
| ----------- | --------------------------- | ------------ |
| All iPhones | 886 x 1920 หรือ 1080 x 1920 | 15-30 วินาที |

---

## 🔞 ขั้นตอนที่ 4: Age Rating

### 4.1 แบบสอบถาม Age Rating

ตอบคำถามต่อไปนี้ตามความเป็นจริง:

| หัวข้อ                          | คำถาม                       | คำตอบสำหรับ FITT BSA |
| ------------------------------- | --------------------------- | -------------------- |
| **Cartoon or Fantasy Violence** | มีความรุนแรงแบบการ์ตูน?     | ❌ None              |
| **Realistic Violence**          | มีความรุนแรงสมจริง?         | ❌ None              |
| **Prolonged Graphic Violence**  | มีความรุนแรงภาพชัดเจน?      | ❌ None              |
| **Sexual Content or Nudity**    | มีเนื้อหาทางเพศ?            | ❌ None              |
| **Graphic Sexual Content**      | มีเนื้อหาทางเพศชัดเจน?      | ❌ None              |
| **Profanity or Crude Humor**    | มีคำหยาบ?                   | ❌ None              |
| **Mature/Suggestive Themes**    | มีธีมสำหรับผู้ใหญ่?         | ❌ None              |
| **Horror/Fear Themes**          | มีธีมสยองขวัญ?              | ❌ None              |
| **Alcohol, Tobacco, Drugs**     | มีเนื้อหาเกี่ยวกับเหล้า/ยา? | ❌ None              |
| **Simulated Gambling**          | มีการพนันจำลอง?             | ❌ None              |
| **Real Gambling**               | มีการพนันจริง?              | ❌ None              |
| **Contests**                    | มีการแข่งขันชิงรางวัล?      | ❌ None              |
| **Unrestricted Web Access**     | เข้าถึงเว็บได้ไม่จำกัด?     | ❌ No                |
| **Medical/Treatment Info**      | มีข้อมูลทางการแพทย์?        | ❌ No                |

### 4.2 ผลลัพธ์ที่คาดหวัง

สำหรับ FITT BSA ควรได้:

- **Age Rating: 4+** (เหมาะสำหรับทุกวัย)

---

## 🔒 ขั้นตอนที่ 5: App Privacy

### 5.1 Privacy Policy URL

ต้องมี Privacy Policy ที่เผยแพร่แล้ว:

```
https://digitalvalue.co.th/privacy-policy
```

> ⚠️ **สำคัญ**: URL ต้องเข้าถึงได้และมีเนื้อหาจริง

### 5.2 Data Collection Questionnaire

ตอบคำถามเกี่ยวกับข้อมูลที่ App เก็บรวบรวม:

#### ข้อมูลที่ FITT BSA เก็บ:

| Data Type            | Collected? | Purpose           | Linked to User? |
| -------------------- | ---------- | ----------------- | --------------- |
| **Name**             | ✅ Yes     | App Functionality | ✅ Yes          |
| **Email Address**    | ✅ Yes     | App Functionality | ✅ Yes          |
| **Phone Number**     | ❌ No      | -                 | -               |
| **User ID**          | ✅ Yes     | App Functionality | ✅ Yes          |
| **Photos**           | ✅ Yes     | App Functionality | ✅ Yes          |
| **Precise Location** | ✅ Yes     | App Functionality | ✅ Yes          |
| **Coarse Location**  | ❌ No      | -                 | -               |
| **Crash Data**       | ✅ Yes     | Analytics         | ❌ No           |
| **Performance Data** | ✅ Yes     | Analytics         | ❌ No           |

### 5.3 ตัวอย่างการตอบ Privacy Questions

**Q: Does your app collect data?**

- ✅ Yes

**Q: Contact Info - Name**

- ✅ Yes, collected
- Purpose: App Functionality (ใช้แสดงชื่อผู้ใช้)
- Linked to Identity: Yes
- Tracking: No

**Q: Contact Info - Email Address**

- ✅ Yes, collected
- Purpose: App Functionality (ใช้สำหรับ login)
- Linked to Identity: Yes
- Tracking: No

**Q: Photos or Videos**

- ✅ Yes, collected
- Purpose: App Functionality (ถ่ายรูปสินค้า/เช็คอิน)
- Linked to Identity: Yes
- Tracking: No

**Q: Precise Location**

- ✅ Yes, collected
- Purpose: App Functionality (ยืนยันตำแหน่งเช็คอิน)
- Linked to Identity: Yes
- Tracking: No

---

## 📋 ขั้นตอนที่ 6: Review Information

### 6.1 Contact Information

| Field            | Value                         |
| ---------------- | ----------------------------- |
| **First Name**   | Watthachai                    |
| **Last Name**    | Taechalue                     |
| **Phone Number** | +66-XX-XXX-XXXX               |
| **Email**        | watthachai@digitalvalue.co.th |

### 6.2 Demo Account (สำคัญมาก!)

> ⚠️ **ต้องให้ demo account สำหรับ Apple Review Team**

| Field              | Value                     |
| ------------------ | ------------------------- |
| **Username/Email** | `demo@digitalvalue.co.th` |
| **Password**       | `DemoPassword123!`        |

**หมายเหตุ**:

- สร้าง demo account ที่ใช้งานได้จริง
- ต้องมีข้อมูลตัวอย่างให้ทดสอบ
- อย่าใช้ account จริงของพนักงาน

### 6.3 Notes for Reviewer

```
Thank you for reviewing FITT BSA!

This is a B2B inventory management app for retail businesses.

LOGIN INSTRUCTIONS:
1. Open the app
2. Tap "Sign in with Google"
3. Use the demo account provided above
4. OR use: demo@digitalvalue.co.th / DemoPassword123!

KEY FEATURES TO TEST:
1. Home Dashboard - View daily statistics
2. Stock Counter - Count products by taking photos
3. Check-in/Check-out - Record attendance with GPS location
4. Delivery Receive - Accept shipments with photo evidence
5. History - View past counting sessions

LOCATION PERMISSION:
The app requests location access only for check-in feature to verify employee presence at the workplace.

CAMERA PERMISSION:
Camera is used to take photos of products during stock counting and for attendance verification.

If you have any questions, please contact us at:
Email: watthachai@digitalvalue.co.th
Phone: +66-XX-XXX-XXXX

Thank you!
```

### 6.4 Attachment (ถ้าจำเป็น)

อัพโหลดไฟล์เพิ่มเติม ถ้า app มีฟีเจอร์พิเศษ:

- Video แสดงวิธีใช้งาน
- PDF คู่มือการใช้งาน

---

## 🚀 ขั้นตอนที่ 7: Submit for Review

### 7.1 Pre-submission Checklist

- [ ] Build uploaded และเลือกแล้ว
- [ ] App Information กรอกครบ
- [ ] Screenshots อัพโหลดครบทุกขนาด
- [ ] Age Rating ตั้งค่าแล้ว
- [ ] App Privacy กรอกครบ
- [ ] Review Information กรอกครบ (รวม demo account)
- [ ] Version Information กรอกครบ (Description, What's New)

### 7.2 Submit

1. ไปที่ **App Store Connect** > App > Version 1.0
2. ตรวจสอบว่าทุกส่วนมีเครื่องหมาย ✅
3. คลิก **"Add for Review"**
4. เลือก **"Submit to App Review"**

### 7.3 Review Timeline

| Status                        | เวลาโดยประมาณ      |
| ----------------------------- | ------------------ |
| **Waiting for Review**        | 0-24 ชั่วโมง       |
| **In Review**                 | 24-48 ชั่วโมง      |
| **Pending Developer Release** | รอคุณปล่อย         |
| **Ready for Sale**            | Live บน App Store! |

---

## 📄 เอกสารที่ต้องเตรียม

### Required Documents

1. **Privacy Policy** (บังคับ)
   - ต้องเป็น URL ที่เข้าถึงได้
   - อธิบายข้อมูลที่เก็บรวบรวม
   - อธิบายวิธีการใช้ข้อมูล
   - อธิบายการแชร์ข้อมูลกับ third party

2. **Terms of Service** (แนะนำ)
   - ข้อกำหนดการใช้งาน
   - ความรับผิดชอบของผู้ใช้

3. **Support Contact**
   - Email support
   - หรือ URL หน้า support

### Optional Documents

4. **App Encryption Documentation**
   - ถ้าใช้ encryption ที่ไม่ใช่ standard
   - สำหรับ FITT BSA ไม่ต้องใช้ (ใช้ Firebase ซึ่งเป็น standard)

---

## ❌ FAQ & Common Rejection Reasons

### เหตุผลที่ App ถูกปฏิเสธบ่อย

#### 1. **Guideline 2.1 - App Completeness**

❌ App ไม่สมบูรณ์หรือมี crash

✅ **วิธีแก้**: ทดสอบให้ละเอียด ไม่มี crash ไม่มีหน้าว่าง

#### 2. **Guideline 2.3 - Accurate Metadata**

❌ Screenshots ไม่ตรงกับ app จริง

✅ **วิธีแก้**: ใช้ screenshots จาก app version ล่าสุด

#### 3. **Guideline 4.2 - Minimum Functionality**

❌ App ไม่มี functionality เพียงพอ

✅ **วิธีแก้**: FITT BSA มีฟีเจอร์เพียงพอแล้ว

#### 4. **Guideline 5.1.1 - Data Collection and Storage**

❌ ไม่มี Privacy Policy หรือไม่ครบถ้วน

✅ **วิธีแก้**: สร้าง Privacy Policy ที่ครอบคลุมข้อมูลทั้งหมด

#### 5. **Sign in with Apple**

❌ มี social login แต่ไม่มี Sign in with Apple

✅ **วิธีแก้**: ถ้ามี Google Sign-in ต้องมี Apple Sign-in ด้วย

> ⚠️ **สำคัญสำหรับ FITT BSA**: ต้องเพิ่ม Sign in with Apple!

#### 6. **Demo Account Not Working**

❌ Demo account ใช้ไม่ได้

✅ **วิธีแก้**: ทดสอบ demo account ก่อน submit ทุกครั้ง

---

## 🔧 Action Items สำหรับ FITT BSA

### 🔴 ต้องทำก่อน Submit (Critical)

1. [ ] **เพิ่ม Sign in with Apple** (ถ้ายังไม่มี)
2. [ ] **สร้าง Privacy Policy URL** ที่เข้าถึงได้
3. [ ] **สร้าง Support URL** ที่เข้าถึงได้
4. [ ] **สร้าง Demo Account** สำหรับ reviewer
5. [ ] **ถ่าย Screenshots** ทุกขนาดที่ต้องการ

### 🟡 แนะนำให้ทำ (Recommended)

6. [ ] **เพิ่ม Info.plist** key: `ITSAppUsesNonExemptEncryption = NO`
7. [ ] **ทดสอบบน Device จริง** หลายรุ่น
8. [ ] **สร้าง App Preview Video** 15-30 วินาที

---

## 📞 Contact

**Developer**: Watthachai Taechalue  
**Company**: Digital Value Company Limited  
**Email**: watthachai@digitalvalue.co.th

---

## 📝 Changelog

| Date       | Update                |
| ---------- | --------------------- |
| 2026-01-28 | Initial guide created |
