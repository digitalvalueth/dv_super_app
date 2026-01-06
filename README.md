# Super Fitt - AI Product Counting App 📦🤖

ระบบนับสินค้าหน้าร้านด้วย AI สำหรับบริษัท พิธานไลฟ์ จำกัด

## 🎯 Features

- ✅ **Google Authentication** - เข้าสู่ระบบด้วย Google
- ✅ **รายการสินค้า** - รายการสินค้าที่ต้องนับประจำเดือน
- ✅ **AI Counting** - ถ่ายภาพและนับสินค้าด้วย Gemini AI
- ✅ **ประวัติการนับ** - ดูประวัติการนับย้อนหลัง
- ✅ **โปรไฟล์** - จัดการข้อมูลผู้ใช้งาน

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Firebase

1. สร้าง Firebase Project ที่ [Firebase Console](https://console.firebase.google.com)
2. เปิดใช้งาน:
   - **Authentication** (Google)
   - **Firestore Database**
   - **Cloud Storage**
3. คัดลอก Firebase Config และใส่ใน `.env`

**📖 ดูรายละเอียดเต็มใน [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**

### 3. Setup Gemini AI

1. รับ API Key จาก [Google AI Studio](https://makersuite.google.com/app/apikey)
2. ใส่ใน `.env`: `EXPO_PUBLIC_GEMINI_API_KEY=xxx`

### 4. Configure Environment

สร้างไฟล์ `.env` จาก `.env.example`:

```bash
cp .env.example .env
```

แก้ไขค่าใน `.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-key
```

### 5. Run App

```bash
# Start Expo Dev Server
npx expo start

# Run on iOS Simulator
npx expo start --ios

# Run on Android Emulator
npx expo start --android

# Run on Web
npx expo start --web
```

---

## 📁 Project Structure

```
super-fitt/
├── app/
│   ├── (auth)/              # 🔐 Authentication
│   │   ├── login.tsx        # Login with Google
│   │   └── _layout.tsx
│   ├── (app)/               # 📱 Main App
│   │   ├── index.tsx        # Product list (home)
│   │   ├── camera.tsx       # Camera screen
│   │   ├── preview.tsx      # Photo preview
│   │   ├── result.tsx       # AI result
│   │   ├── history.tsx      # Counting history
│   │   ├── profile.tsx      # User profile
│   │   └── _layout.tsx      # Tab navigation
│   └── _layout.tsx          # Root layout
├── config/
│   └── firebase.ts          # 🔥 Firebase config
├── services/
│   ├── auth.service.ts      # Authentication
│   ├── product.service.ts   # Products & assignments
│   ├── counting.service.ts  # Counting sessions
│   └── gemini.service.ts    # 🤖 AI counting
├── stores/
│   ├── auth.store.ts        # Auth state
│   ├── product.store.ts     # Product state
│   └── counting.store.ts    # Counting state
├── types/
│   └── index.ts             # TypeScript types
└── components/
    └── ...
```

---

## 🗄️ Database Schema (Firebase)

### Firestore Collections:

- `users` - ข้อมูลผู้ใช้งาน
- `companies` - บริษัท
- `branches` - สาขา
- `products` - รายการสินค้า
- `userAssignments` - สินค้าที่ user ต้องนับ
- `countingSessions` - ผลการนับ
- `users/{userId}/countingHistory` - ประวัติการนับ (subcollection)

**📊 ดู Schema เต็มใน [DATABASE_OPTIONS.md](./DATABASE_OPTIONS.md)**

---

## 📱 User Flow

```
1. 🔐 Login → เข้าสู่ระบบด้วย Google
2. 📋 Product List → เห็นรายการสินค้าที่ต้องนับ (assigned)
3. ✅ Select Product → เลือกสินค้าที่ต้องการนับ
4. 📸 Take Photo → ถ่ายภาพสินค้าบนชั้นวาง
5. 🤖 AI Processing → Gemini AI นับสินค้าอัตโนมัติ
6. 📝 Review Result → ตรวจสอบและแก้ไขได้
7. 💾 Save → บันทึกผลการนับ
8. 📊 History → ดูประวัติการนับย้อนหลัง
```

---

## 🛠️ Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| **Frontend**   | Expo (React Native)                 |
| **Language**   | TypeScript                          |
| **Backend**    | Firebase (Firestore, Auth, Storage) |
| **AI**         | Google Gemini 1.5 Flash             |
| **State**      | Zustand                             |
| **Navigation** | Expo Router (File-based)            |
| **Forms**      | React Hook Form + Zod               |

---

## 📝 Next Steps (Roadmap)

### Phase 1 - MVP (Current)

- [x] Project setup
- [x] Firebase configuration
- [x] Authentication (Google)
- [x] Product list UI
- [x] Basic navigation
- [ ] **Camera implementation** 📸
- [ ] **AI counting integration** 🤖
- [ ] **History screen** 📊

### Phase 2 - Features

- [ ] QR/Barcode scanner
- [ ] Photo preview & retake
- [ ] Manual count adjustment
- [ ] Remarks functionality
- [ ] Offline support
- [ ] Push notifications

### Phase 3 - Admin

- [ ] Web dashboard
- [ ] Employee management
- [ ] Product management
- [ ] Analytics & reports
- [ ] Export Excel/PDF

---

## 📖 Documentation

| Document                                       | Description                        |
| ---------------------------------------------- | ---------------------------------- |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | โครงสร้างโปรเจกต์ฉบับเต็ม          |
| [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)       | คู่มือตั้งค่า Firebase แบบละเอียด  |
| [DATABASE_OPTIONS.md](./DATABASE_OPTIONS.md)   | เปรียบเทียบ PostgreSQL vs Firebase |
| [brief.txt](./brief.txt)                       | โจทย์โปรเจกต์จากลูกค้า             |
| [items.txt](./items.txt)                       | รายการสินค้าตัวอย่าง (58 SKUs)     |

---

## 🐛 Troubleshooting

### ไม่สามารถ Login ได้

1. ตรวจสอบว่าเปิด Google Authentication ใน Firebase Console
2. ตรวจสอบ `.env` มี Firebase Config ครบ
3. ลอง restart Expo dev server: `npx expo start -c`

### ไม่เห็นรายการสินค้า

1. ตรวจสอบว่ามี data ใน Firestore Collections:
   - `companies`
   - `products`
   - `userAssignments`
2. ตรวจสอบ userId ใน `userAssignments` ตรงกับ Firebase Auth UID

### AI ไม่ทำงาน

1. ตรวจสอบ `EXPO_PUBLIC_GEMINI_API_KEY` ใน `.env`
2. ตรวจสอบ quota ของ Gemini API
3. ดู error logs ใน console

---

## 🤝 Contributing

โปรเจกต์นี้เป็น private repository สำหรับ Super Fitt เท่านั้น

---

## 📞 Support

หากมีปัญหาหรือคำถาม:

1. ✅ ตรวจสอบ [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
2. 🔍 ดู Console logs ใน Terminal
3. 🔥 ตรวจสอบ Firebase Console
4. 📧 ติดต่อทีมพัฒนา

---

## 📄 License

**Private** - For Super Fitt Internal Use Only  
© 2026 Digital Value Co., Ltd.

---

**Built with ❤️ by Digital Value Team**
