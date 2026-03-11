# 🔥 Manual Firestore Rules Deployment

เนื่องจาก Firebase CLI version เก่าไม่รองรับ multiple databases deployment อย่างสมบูรณ์

## 📝 วิธีการ Deploy Rules แบบ Manual

### ขั้นตอนที่ 1: คัดลอกไฟล์ Rules

**ไฟล์**: [firestore.rules](firestore.rules)

### ขั้นตอนที่ 2: Deploy ผ่าน Firebase Console

#### สำหรับ Database: **fittsuperapp-dev**

1. ไปที่: https://console.firebase.google.com/project/fittbsa/firestore/databases/fittsuperapp-dev/rules
2. คลิกที่ tab **"Rules"**
3. ลบ rules เดิมทั้งหมด
4. คัดลอก rules จากไฟล์ `firestore.rules` ทั้งหมด
5. วาง (Paste) ลงใน editor
6. คลิก **"Publish"**

#### สำหรับ Database: **fittsuperapp-prod**

1. ไปที่: https://console.firebase.google.com/project/fittbsa/firestore/databases/fittsuperapp-prod/rules
2. คลิกที่ tab **"Rules"**
3. ลบ rules เดิมทั้งหมด
4. คัดลอก rules จากไฟล์ `firestore.rules` ทั้งหมด
5. วาง (Paste) ลงใน editor
6. คลิก **"Publish"**

---

## 🔗 Quick Links

### fittsuperapp-dev (Development)

**Direct Link**: https://console.firebase.google.com/project/fittbsa/firestore/databases/fittsuperapp-dev/rules

### fittsuperapp-prod (Production)

**Direct Link**: https://console.firebase.google.com/project/fittbsa/firestore/databases/fittsuperapp-prod/rules

---

## ✅ Checklist

- [ ] เปิดลิงก์ fittsuperapp-dev rules
- [ ] คัดลอกไฟล์ `firestore.rules` ทั้งหมด
- [ ] Paste ลงใน rules editor
- [ ] คลิก Publish
- [ ] ทำซ้ำกับ fittsuperapp-prod
- [ ] Verify rules ใช้งานได้

---

## 🔧 Alternative: อัพเดท Firebase CLI แล้วลองใหม่

```bash
# Clean npm cache
npm cache clean --force

# Update Firebase CLI
sudo npm install -g firebase-tools@latest

# Deploy again
firebase deploy --only firestore:rules
```

---

## 📋 Rules Content

Full rules content is in [firestore.rules](firestore.rules)

ตอนนี้ให้ทำแบบ manual ผ่าน Firebase Console ก่อนนะครับ เพราะ Firebase CLI version ที่ติดตั้งอยู่ยังไม่รองรับการ deploy ไปยัง multiple databases ได้ดี
