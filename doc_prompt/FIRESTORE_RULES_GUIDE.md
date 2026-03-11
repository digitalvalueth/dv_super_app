# 🔐 Firestore Security Rules Deployment Guide

## สรุป Firestore Security Rules

ไฟล์ `firestore.rules` ที่สร้างขึ้นมีการกำหนดสิทธิ์ตาม **Role-Based Access Control (RBAC)** สำหรับทุก collection ในระบบ

---

## 🎭 User Roles & Permissions

| Role                        | Permissions                   |
| --------------------------- | ----------------------------- |
| **super_admin**             | เข้าถึงได้ทุกอย่างในระบบ      |
| **admin** (เจ้าของบริษัท)   | จัดการข้อมูลในบริษัทของตนเอง  |
| **manager** (ผู้จัดการสาขา) | จัดการข้อมูลในสาขาของตนเอง    |
| **supervisor** (หัวหน้างาน) | ดูและแก้ไขข้อมูลที่เกี่ยวข้อง |
| **employee** (พนักงาน)      | ดูและแก้ไขข้อมูลของตนเอง      |

---

## 📋 Collections & Access Rules

### 1. **users** - ข้อมูลผู้ใช้

- ✅ อ่านได้: ตนเอง, Admin (ในบริษัทเดียวกัน), Super Admin
- ✅ สร้าง/แก้ไข/ลบ: Admin (ในบริษัทเดียวกัน), Super Admin
- ✅ แก้ไขตนเอง: ได้ (เฉพาะบางฟิลด์)

### 2. **companies** - ข้อมูลบริษัท

- ✅ อ่านได้: พนักงานในบริษัทเดียวกัน, Super Admin
- ✅ สร้าง/ลบ: Super Admin เท่านั้น
- ✅ แก้ไข: Admin (เฉพาะบางฟิลด์), Super Admin

### 3. **branches** - ข้อมูลสาขา

- ✅ อ่านได้: พนักงานในบริษัทเดียวกัน
- ✅ สร้าง/แก้ไข/ลบ: Admin, Super Admin

### 4. **products** - ข้อมูลสินค้า

- ✅ อ่านได้: พนักงานในบริษัทเดียวกัน
- ✅ สร้าง/แก้ไข: Admin, Manager, Super Admin
- ✅ ลบ: Admin, Super Admin เท่านั้น

### 5. **counting_sessions** - บันทึกการนับสินค้า

- ✅ อ่านได้: พนักงานในบริษัทเดียวกัน
- ✅ สร้าง: ทุกคนที่ authenticated
- ✅ แก้ไข: เจ้าของ session หรือ Manager/Admin/Super Admin
- ✅ ลบ: Admin, Super Admin เท่านั้น

### 6. **delivery_records** - บันทึกการรับส่งสินค้า

- ✅ อ่านได้: พนักงานในบริษัทเดียวกัน
- ✅ สร้าง: ทุกคนที่ authenticated
- ✅ แก้ไข: เจ้าของ record หรือ Manager/Admin/Super Admin
- ✅ ลบ: Admin, Super Admin เท่านั้น

### 7. **checkins** - บันทึกการเช็คอิน

- ✅ อ่านได้: พนักงานในบริษัทเดียวกัน
- ✅ สร้าง: ทุกคนที่ authenticated
- ✅ แก้ไข: เจ้าของ checkin หรือ Manager/Admin/Super Admin

### 8. **notifications** - การแจ้งเตือน

- ✅ อ่านได้: เฉพาะของตนเอง
- ✅ สร้าง: ทุกคนที่ authenticated
- ✅ แก้ไข/ลบ: เฉพาะของตนเอง

### 9. **access_requests** - คำขอเข้าใช้งาน

- ✅ สร้าง: ทุกคน (สำหรับสมัครสมาชิก)
- ✅ อ่าน/แก้ไข/ลบ: Admin, Super Admin

### 10. **invitations** - คำเชิญเข้าร่วม

- ✅ อ่านได้: ผู้ที่ถูกเชิญ (ตาม email)
- ✅ สร้าง: Admin, Super Admin
- ✅ แก้ไข/ลบ: Admin, Super Admin

### 11. **watson\_\*** - Watson Excel Validator

- ✅ อ่าน/เขียน: ทุกคนที่ authenticated

---

## 🚀 Deploy Firestore Rules

### สำหรับ Development Database (fittsuperapp-dev):

```bash
firebase deploy --only firestore:rules --project fittbsa --database fittsuperapp-dev
```

### สำหรับ Production Database (fittsuperapp-prod):

```bash
firebase deploy --only firestore:rules --project fittbsa --database fittsuperapp-prod
```

### Deploy ทั้ง 2 databases พร้อมกัน:

```bash
# Deploy to dev
firebase deploy --only firestore:rules --project fittbsa --database fittsuperapp-dev

# Deploy to prod
firebase deploy --only firestore:rules --project fittbsa --database fittsuperapp-prod
```

---

## 🔧 Testing Rules

### ทดสอบใน Firebase Console:

1. ไปที่ [Firebase Console](https://console.firebase.google.com)
2. เลือก Project: **fittbsa**
3. ไปที่ **Firestore Database** → เลือก database (dev/prod)
4. คลิกที่ **Rules** tab
5. คลิก **Rules Playground** เพื่อทดสอบ

### ทดสอบด้วย Firebase Emulator:

```bash
# Start emulator
firebase emulators:start --only firestore

# Run tests
npm run test:firestore-rules
```

---

## ⚠️ สิ่งสำคัญ

### 1. กำหนด Database ตอน Deploy:

```bash
# ต้องระบุ --database flag เสมอ
firebase deploy --only firestore:rules --database fittsuperapp-dev
```

### 2. ตรวจสอบหลัง Deploy:

```bash
# ดู rules ที่ใช้งานอยู่
firebase firestore:rules --project fittbsa
```

### 3. Backup Rules ก่อน Deploy:

```bash
# Download current rules
firebase firestore:rules get --database fittsuperapp-prod > firestore.rules.backup
```

---

## 📝 Important Notes

1. **Default Deny**: ทุก collection ที่ไม่ได้กำหนด rules จะถูก deny โดยอัตโนมัติ
2. **Authentication Required**: ส่วนใหญ่ต้อง login ก่อนเข้าใช้งาน
3. **Company Isolation**: ข้อมูลแต่ละบริษัทแยกกันอย่างชัดเจน
4. **Role-Based**: สิทธิ์ขึ้นอยู่กับ role ของผู้ใช้

---

## 🐛 Troubleshooting

### Error: "Missing or insufficient permissions"

**สาเหตุ**:

- User ไม่ได้ login
- User ไม่มีสิทธิ์เข้าถึง resource นั้น
- Rules ยังไม่ได้ deploy

**วิธีแก้**:

1. ตรวจสอบว่า user login แล้ว
2. ตรวจสอบ role ของ user ใน collection `users`
3. Deploy rules ใหม่

### Error: "Database not found"

**สาเหตุ**:

- Database ID ไม่ถูกต้อง
- Database ยังไม่ถูกสร้าง

**วิธีแก้**:

1. ตรวจสอบ `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` ใน `.env`
2. ตรวจสอบว่า database มีอยู่จริงใน Firebase Console

---

## 📚 Reference

- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Role-Based Access Control](https://firebase.google.com/docs/firestore/security/rules-conditions#access_other_documents)
- [Testing Security Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)

---

**Created**: February 17, 2026  
**Version**: 1.0.0
