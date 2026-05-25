# Mobile OTA Update Guide

วันที่: 25 พฤษภาคม 2569

เอกสารนี้สรุปวิธีอัปเดต Mobile App ให้เร็วด้วย Expo OTA Update โดยใช้ flow `dev` ก่อน แล้วค่อยไป `main` สำหรับ production

## สถานะของโปรเจกต์ตอนนี้

- Mobile app ใช้ `expo-updates` แล้ว
- `app.config.js` ตั้งค่า `updates.url` เป็น EAS project `fc7bbd1e-59a8-4f4c-abe7-4ae3a73df297`
- `runtimeVersion.policy` เป็น `appVersion`
- เวอร์ชัน native ใน `app.config.js` ตอนนี้คือ `1.5.1`

ข้อสำคัญ: เพราะใช้ `runtimeVersion` ตาม `appVersion` ดังนั้น OTA จะส่งถึงเฉพาะเครื่องที่ติดตั้ง binary runtime เดียวกัน เช่น binary `1.5.1` จะรับ OTA ของ `1.5.1` ได้ แต่ถ้า bump native version เป็น `1.5.2` แล้ว publish OTA เครื่องที่ยังเป็น `1.5.1` จะไม่ได้รับ update นั้น

## อะไรอัปผ่าน OTA ได้

ใช้ OTA ได้กับงานที่เป็น JavaScript/TypeScript และ asset ใน bundle เช่น:

- แก้ UI, layout, wording, validation, route logic
- แก้ query Firestore, store, service, business logic ฝั่ง JS
- แก้รูป/icon/asset ที่ bundle ไปกับแอป
- แก้หน้าจอ Mobile เช่น Home, Profile, Stock Counter, Invitation

ใช้ OTA ไม่ได้ ต้องทำ EAS Build และส่ง TestFlight/App Store/Play Store ใหม่ เมื่อมีการเปลี่ยน:

- เพิ่ม/ลบ native dependency หรือ Expo plugin
- แก้ `ios/`, `android/`, permission, bundle id, package name, associated domains
- แก้ไฟล์ native Firebase เช่น `GoogleService-Info.plist`, `google-services.json`
- อัป Expo SDK, React Native, native module version
- เปลี่ยน `runtimeVersion` หรือ bump `app.config.js` version เพื่อ binary ใหม่

## Branch และ channel ที่แนะนำ

ใช้ Git branch ตาม release flow:

| ขั้น       | Git branch | EAS Update branch | ใช้กับ                    |
| ---------- | ---------- | ----------------- | ------------------------- |
| ทดสอบ      | `dev`      | `dev`             | internal tester / sandbox |
| Production | `main`     | `main`            | user จริง                 |

ถ้ายังไม่ได้ map EAS channel ให้ทำครั้งแรกก่อน:

```bash
eas channel:edit dev --branch dev
eas channel:edit production --branch main
```

ถ้าจะ build binary รอบใหม่ ควรกำหนด channel ใน `eas.json` ให้ชัดเจน:

```json
{
  "build": {
    "development": { "channel": "dev" },
    "preview": { "channel": "dev" },
    "production": { "channel": "production" }
  }
}
```

หมายเหตุ: เครื่องที่ติดตั้งแอปแล้วจะรับ OTA จาก channel ที่ฝังอยู่ใน binary ตอน build ดังนั้นถ้า binary เก่าใช้ channel อื่น ต้อง publish OTA ไปที่ branch/channel ที่ binary นั้นผูกอยู่ หรือออก binary ใหม่ที่ผูก channel ตามมาตรฐานนี้

## ขั้นตอนปล่อย OTA แบบเร็ว

### 1. ปล่อยไป dev ก่อน

หลัง merge/push code เข้า branch `dev` แล้ว publish OTA สำหรับ tester:

```bash
eas update --branch dev --message "v1.5.1.1 mobile/web fixes - dev"
```

ถ้าใช้ EAS Environment Variables แยก environment ให้ระบุ environment ให้ตรง:

```bash
eas update --branch dev --environment preview --message "v1.5.1.1 mobile/web fixes - dev"
```

ให้ tester ปิดแอปแล้วเปิดใหม่ 1 รอบ หรือเปิดใหม่หลัง update download เสร็จ เพื่อรับ bundle ล่าสุด

### 2. ทดสอบบนมือถือ

เช็กอย่างน้อย:

- Login และโหลด user profile ได้
- หน้า Home ไม่มีขอบขาวด้านล่างบน iOS
- เข้า Stock Counter ได้ตามสิทธิ์และสาขา
- Invitation link เปิดแอป/เว็บได้ถูกต้อง
- Firestore database เป็น sandbox/dev ตามที่ตั้งใจ ไม่หลุดไป production

ดูรายการ OTA ที่ publish แล้ว:

```bash
eas update:list --branch dev --limit 5
```

### 3. Merge ไป main แล้ว publish production OTA

เมื่อ dev ผ่านแล้ว merge code เข้า `main` แล้ว publish OTA ให้ user จริง:

```bash
eas update --branch main --message "v1.5.1.1 mobile/web fixes"
```

ถ้าใช้ EAS Environment Variables:

```bash
eas update --branch main --environment production --message "v1.5.1.1 mobile/web fixes"
```

ตรวจรายการ production update:

```bash
eas update:list --branch main --limit 5
```

## ทำให้ user ได้ update เร็วที่สุด

ค่า default ของ Expo Updates จะเช็ก update ตอนเปิดแอป โดยทั่วไป user จะได้ bundle ใหม่หลังปิดแล้วเปิดแอปอีกครั้ง

ถ้าต้องการให้เร็วกว่าเดิม สามารถเพิ่ม logic ในแอปให้เช็ก update ตอนเปิดแอปหรือกลับมา foreground:

```ts
import * as Updates from "expo-updates";

export async function checkForOtaUpdate() {
  if (__DEV__) return;

  const update = await Updates.checkForUpdateAsync();
  if (!update.isAvailable) return;

  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
}
```

แนวทางใช้งานจริง: เรียกหลัง login หรือเมื่อแอปกลับมา foreground โดยควร throttle ไม่ให้เช็กถี่เกินไป และแสดงข้อความสั้นๆ ก่อน reload เพื่อไม่ให้ user งง

## Checklist ก่อน publish OTA

- รัน lint/type check เฉพาะไฟล์ที่แก้ หรือทั้งหมดถ้าเป็น release ใหญ่
- ยืนยันว่าไม่มี native change ที่ต้องออก binary ใหม่
- ยืนยันว่าไม่ได้ bump `app.config.js` version ถ้าต้องการให้ binary เดิมรับ OTA
- ใช้ environment ให้ตรงกับ branch: `dev`/sandbox ก่อน, `main`/production หลังผ่านทดสอบ
- หลัง publish ให้ดู `eas update:list` และทดสอบจากเครื่องจริง
