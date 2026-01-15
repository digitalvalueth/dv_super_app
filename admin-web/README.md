# Super Fitt Admin Dashboard 🎯

ระบบจัดการ Admin Web Dashboard สำหรับ Super Fitt - AI Product Counting System

## 🌟 Features

### ✅ ระบบที่สร้างเสร็จแล้ว

- ✅ **Authentication** - เข้าสู่ระบบด้วย Email/Password และ Google OAuth
- ✅ **Dashboard** - แสดงสถิติและภาพรวมระบบ
- ✅ **Reports** - รายงานของหาย วิเคราะห์พนักงาน สาขา และสินค้า
- ✅ **Counting Management** - จัดการข้อมูลการนับ อนุมัติ/ปฏิเสธ
- ✅ **Invitations** - เชิญผู้ใช้เข้าบริษัท
- ✅ **Role-based Access** - ควบคุมสิทธิ์ Admin และ Manager เท่านั้น

### 📊 รายงานและวิเคราะห์

- รายงานของหายรวม
- พนักงานที่ทำหายเยอะสุด (Top 10)
- สาขาที่หายเยอะสุด (Top 10)
- สินค้าที่หายเยอะสุด (Top 10)
- Charts และ Graphs แบบ real-time

### 📋 จัดการข้อมูล

- ดูข้อมูลการนับที่พนักงานส่งมา
- ดูภาพถ่ายสินค้า
- อนุมัติหรือปฏิเสธการนับ
- กรองและค้นหาข้อมูล

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd admin-web
npm install
```

### 2. Setup Environment

คัดลอก `.env.local.example` เป็น `.env.local`:

```bash
cp .env.local.example .env.local
```

แก้ไขค่าใน `.env.local`:

```env
# Firebase Configuration (ใช้ค่าเดียวกับ mobile app)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 3. Run Development Server

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:3001](http://localhost:3001)

---

## 📁 Project Structure

```
admin-web/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx              # แดชบอร์ดหลัก
│   │   ├── reports/page.tsx      # รายงานของหาย
│   │   ├── counting/page.tsx     # จัดการข้อมูลการนับ
│   │   ├── invitations/page.tsx  # เชิญผู้ใช้
│   │   └── layout.tsx            # Layout พร้อม Sidebar
│   ├── login/page.tsx            # หน้า Login
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home (redirect)
├── components/
│   ├── guards/
│   │   └── auth-guard.tsx        # Auth protection
│   ├── layout/
│   │   ├── sidebar.tsx           # Sidebar navigation
│   │   └── header.tsx            # Top header
│   └── providers/
│       └── auth-provider.tsx     # Auth state provider
├── lib/
│   └── firebase.ts               # Firebase config
├── stores/
│   └── auth.store.ts             # Zustand auth store
├── types/
│   └── index.ts                  # TypeScript types
└── package.json
```

---

## 🎨 Tech Stack

| Technology    | Description                |
| ------------- | -------------------------- |
| **Framework** | Next.js 15 (App Router)    |
| **Language**  | TypeScript                 |
| **Styling**   | Tailwind CSS               |
| **Backend**   | Firebase (Firestore, Auth) |
| **State**     | Zustand                    |
| **Forms**     | React Hook Form + Zod      |
| **Charts**    | Recharts                   |
| **Icons**     | Lucide React               |
| **Toast**     | Sonner                     |
| **Date**      | date-fns                   |

---

## 📞 Support

หากมีปัญหาหรือคำถาม:

- ตรวจสอบ Console logs
- ดู Firestore data
- ติดต่อทีมพัฒนา

---

## 📄 License

**Private** - For Super Fitt Internal Use Only  
© 2026 Digital Value Co., Ltd.

---

**Built with ❤️ by Digital Value Team**
