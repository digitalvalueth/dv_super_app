# Firebase Setup Guide

## 🔥 ขั้นตอนการตั้งค่า Firebase

### 1. สร้าง Firebase Project

1. ไปที่ [Firebase Console](https://console.firebase.google.com)
2. คลิก "Add project" หรือ "เพิ่มโปรเจกต์"
3. ตั้งชื่อโปรเจกต์: **Super Fitt** (หรือชื่อที่ต้องการ)
4. ปิด Google Analytics (ถ้าไม่ต้องการ) หรือเปิดไว้
5. คลิก "Create project"

---

### 2. เพิ่ม Web App

1. ที่หน้า Project Overview
2. คลิกไอคอน **Web** (`</>`)
3. ตั้งชื่อ App: **Super Fitt App**
4. ✅ เช็ค "Also set up Firebase Hosting" (optional)
5. คลิก "Register app"
6. **คัดลอก Firebase Config** ที่ได้มา

```javascript
// จะได้ config แบบนี้
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "super-fitt.firebaseapp.com",
  projectId: "super-fitt",
  storageBucket: "super-fitt.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc...",
};
```

7. นำค่าเหล่านี้ไปใส่ใน `.env` file

---

### 3. เปิดใช้งาน Authentication (Google Login)

1. ไปที่ **Authentication** ในเมนูซ้าย
2. คลิก "Get started"
3. ไปที่แท็บ **Sign-in method**
4. คลิก **Google**
5. เปิด Enable
6. เลือก **Project support email**
7. คลิก "Save"

#### 📱 สำหรับ Expo/React Native:

**iOS:**

1. ต้องมี `REVERSED_CLIENT_ID` จาก `GoogleService-Info.plist`
2. ดาวน์โหลด config file จาก Firebase Console
3. เพิ่ม URL scheme ใน `app.json`

**Android:**

1. ดาวน์โหลด `google-services.json`
2. ใส่ SHA-1 fingerprint ใน Firebase Console:
   ```bash
   # Get SHA-1 for debug
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

---

### 4. เปิดใช้งาน Firestore Database

1. ไปที่ **Firestore Database**
2. คลิก "Create database"
3. เลือก **Start in production mode** (เราจะตั้งค่า rules เอง)
4. เลือก Location: **asia-southeast1** (Singapore) หรือใกล้ที่สุด
5. คลิก "Enable"

#### ตั้งค่า Security Rules:

คลิกไปที่แท็บ **Rules** และใส่:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }

    // Companies collection (read only for authenticated users)
    match /companies/{companyId} {
      allow read: if isAuthenticated();
      allow write: if false; // Only admin can write via Firebase Console
    }

    // Branches collection
    match /branches/{branchId} {
      allow read: if isAuthenticated();
      allow write: if false; // Only admin
    }

    // Products collection
    match /products/{productId} {
      allow read: if isAuthenticated();
      allow write: if false; // Only admin
    }

    // User Assignments (assigned products)
    match /userAssignments/{assignmentId} {
      allow read: if isAuthenticated() &&
                     resource.data.userId == request.auth.uid;
      allow write: if isAuthenticated() &&
                      resource.data.userId == request.auth.uid;
    }

    // Counting Sessions
    match /countingSessions/{sessionId} {
      allow read: if isAuthenticated() &&
                     resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() &&
                       request.resource.data.userId == request.auth.uid;
      allow update: if isAuthenticated() &&
                       resource.data.userId == request.auth.uid;
      allow delete: if false;
    }

    // User History (subcollection)
    match /users/{userId}/countingHistory/{sessionId} {
      allow read, write: if isAuthenticated() && userId == request.auth.uid;
    }
  }
}
```

---

### 5. เปิดใช้งาน Cloud Storage

1. ไปที่ **Storage**
2. คลิก "Get started"
3. เลือก **Start in production mode**
4. เลือก Location: **asia-southeast1** (เดียวกับ Firestore)
5. คลิก "Done"

#### ตั้งค่า Security Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Counting images
    match /counting/{userId}/{sessionId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                      request.auth.uid == userId &&
                      request.resource.size < 10 * 1024 * 1024 && // Max 10MB
                      request.resource.contentType.matches('image/.*');
    }

    // Profile images
    match /profiles/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                      request.auth.uid == userId &&
                      request.resource.size < 5 * 1024 * 1024 && // Max 5MB
                      request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

### 6. สร้าง Cloud Function (สำหรับเรียก Gemini AI)

เราจะสร้าง Cloud Function ทีหลัง แต่ตอนนี้เตรียมไว้ก่อน:

1. ไปที่ **Functions**
2. คลิก "Get started"
3. ตั้งค่า billing (ต้องมี billing account ถึงจะใช้ Cloud Functions ได้)
4. เลือก plan: **Blaze (Pay as you go)** - ฟรี 2 ล้าน invocations/เดือน

---

### 7. เพิ่ม Sample Data ใน Firestore

#### สร้าง Collection: `companies`

```javascript
// Document ID: company-001
{
  id: "company-001",
  name: "บริษัท พิธานไลฟ์ จำกัด",
  code: "PITHANLIVE",
  logoUrl: "",
  status: "active",
  createdAt: [Current Timestamp]
}
```

#### สร้าง Collection: `branches`

```javascript
// Document ID: branch-001
{
  id: "branch-001",
  companyId: "company-001",
  name: "สาขาสำนักงานใหญ่",
  code: "HQ001",
  address: "Bangkok, Thailand",
  createdAt: [Current Timestamp]
}
```

#### สร้าง Collection: `products` (นำข้อมูลจาก items.txt)

```javascript
// Document ID: SK-C-250
{
  id: "SK-C-250",
  companyId: "company-001",
  sku: "SK-C-250",
  name: "NestMe Birdnest All In Daily cream SPF 50 PA+++ 30 g.",
  barcode: "8859109851509",
  sellerCode: "299857",
  imageUrl: "",
  category: "skincare",
  createdAt: [Current Timestamp]
}

// เพิ่มสินค้าอื่นๆ ตาม items.txt
```

#### เมื่อ User Login ครั้งแรก → สร้าง Document ใน `users`

```javascript
// Document ID: [User UID from Auth]
{
  uid: "google-user-id-xxx",
  email: "user@example.com",
  name: "John Doe",
  companyId: "company-001",
  branchId: "branch-001",
  role: "employee",
  photoURL: "https://...",
  createdAt: [Current Timestamp],
  updatedAt: [Current Timestamp]
}
```

#### สร้าง Collection: `userAssignments` (สินค้าที่ user ต้องนับ)

```javascript
// Document ID: assignment-001
{
  id: "assignment-001",
  userId: "[User UID]",
  companyId: "company-001",
  branchId: "branch-001",
  productId: "SK-C-250",
  assignedDate: [Timestamp],
  dueDate: [End of Month Timestamp],
  beforeCountQty: 15,
  status: "pending", // pending, in_progress, completed
  countedAt: null,
  createdAt: [Current Timestamp]
}

// สร้างให้ครบทุกสินค้าที่ user ต้องนับ
```

---

### 8. ดาวน์โหลด Config Files (สำหรับ Native Apps)

#### iOS - `GoogleService-Info.plist`

1. ไปที่ Project Settings (⚙️)
2. เลือก iOS app
3. ดาวน์โหลด `GoogleService-Info.plist`
4. วางไฟล์ใน project ตาม Expo docs

#### Android - `google-services.json`

1. ไปที่ Project Settings (⚙️)
2. เลือก Android app
3. ดาวน์โหลด `google-services.json`
4. วางไฟล์ตาม Expo docs

---

## 📦 Install Dependencies

```bash
# Install Firebase SDK
npm install firebase

# Install Expo packages
npx expo install expo-camera expo-image-picker expo-barcode-scanner

# Install state management
npm install zustand

# Install other utilities
npm install react-hook-form zod @hookform/resolvers
npm install date-fns
```

---

## ⚙️ Update `.env` File

คัดลอกค่าจาก Firebase Config มาใส่ใน `.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=super-fitt.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=super-fitt
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=super-fitt.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...

EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-key
EXPO_PUBLIC_APP_ENV=development
```

---

## 🧪 Test Firebase Connection

สร้างไฟล์ `test-firebase.ts` เพื่อทดสอบ:

```typescript
import { auth, db } from "./config/firebase";
import { collection, getDocs } from "firebase/firestore";

// Test Firestore connection
async function testFirestore() {
  try {
    const companiesRef = collection(db, "companies");
    const snapshot = await getDocs(companiesRef);
    console.log("✅ Firestore connected!");
    console.log("Companies:", snapshot.size);
  } catch (error) {
    console.error("❌ Firestore error:", error);
  }
}

// Test Auth
function testAuth() {
  console.log("Auth initialized:", !!auth);
  console.log("Current user:", auth.currentUser?.email || "Not logged in");
}

testAuth();
testFirestore();
```

---

## 🔑 Google Gemini AI Setup

1. ไปที่ [Google AI Studio](https://makersuite.google.com/app/apikey)
2. คลิก "Get API Key"
3. คัดลอก API Key
4. ใส่ใน `.env`: `EXPO_PUBLIC_GEMINI_API_KEY=xxx`

---

## ✅ Checklist

- [ ] สร้าง Firebase Project แล้ว
- [ ] เปิด Google Authentication แล้ว
- [ ] สร้าง Firestore Database แล้ว
- [ ] ตั้งค่า Security Rules แล้ว
- [ ] เปิด Cloud Storage แล้ว
- [ ] เพิ่ม Sample Data (companies, branches, products)
- [ ] อัพเดท `.env` file แล้ว
- [ ] ติดตั้ง dependencies แล้ว
- [ ] ได้ Gemini API Key แล้ว

---

## 🚀 พร้อมแล้ว!

เมื่อทำครบทุกขั้นตอน พร้อมรัน:

```bash
npm install
npx expo start
```

---

**หมายเหตุ:** อย่าลืม commit `.env.example` แต่ **อย่า commit `.env`** ที่มี API keys จริง!
