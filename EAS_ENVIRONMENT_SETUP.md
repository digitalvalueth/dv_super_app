# 🔐 EAS Environment Variables Setup Guide

> คู่มือการตั้งค่า Environment Variables สำหรับ EAS Build  
> **Project**: FITT BSA  
> **Date**: January 29, 2026  
> **Author**: Development Team

---

## 📋 สารบัญ

1. [บทนำ](#บทนำ)
2. [ปัญหาที่เกิดขึ้น](#ปัญหาที่เกิดขึ้น)
3. [สาเหตุของปัญหา](#สาเหตุของปัญหา)
4. [วิธีแก้ไข](#วิธีแก้ไข)
5. [ขั้นตอนการตั้งค่า EAS Environment Variables](#ขั้นตอนการตั้งค่า-eas-environment-variables)
6. [รายการ Environment Variables](#รายการ-environment-variables)
7. [การ Build และ Deploy](#การ-build-และ-deploy)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## 📖 บทนำ

เอกสารนี้อธิบายการตั้งค่า **Environment Variables** สำหรับ **Expo Application Services (EAS)** ซึ่งเป็นวิธีที่ปลอดภัยและถูกต้องในการจัดการ API Keys และ Secrets สำหรับ Production Build

### เหตุผลที่ต้องใช้ EAS Environment Variables

| วิธีการ                       | ความปลอดภัย                                  | เหมาะสำหรับ          |
| ----------------------------- | -------------------------------------------- | -------------------- |
| `.env` file                   | ❌ ไม่ปลอดภัย (ไม่ถูก include ใน production) | Development เท่านั้น |
| Hardcode ใน `eas.json`        | ❌ ไม่ปลอดภัย (ขึ้น GitHub)                  | ไม่แนะนำ             |
| **EAS Environment Variables** | ✅ ปลอดภัย                                   | **Production** ✓     |

---

## ❌ ปัญหาที่เกิดขึ้น

### อาการ

- App ถูก build และ upload ขึ้น TestFlight สำเร็จ
- เมื่อเปิด App จาก TestFlight แล้ว **App Crash ทันที**
- ไม่สามารถเข้าสู่หน้า Login ได้

### Screenshot ของปัญหา

```
"FITT BSA" Crashed
Do you want to share additional information with the developer?
[No Thanks] [Share]
```

---

## 🔍 สาเหตุของปัญหา

### Root Cause Analysis

1. **Local Development** ใช้ไฟล์ `.env` เก็บ Environment Variables:

   ```bash
   # .env (Local)
   EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=fittbsa
   # ... และอื่นๆ
   ```

2. **ไฟล์ `.env` อยู่ใน `.gitignore`** (ถูกต้อง เพื่อความปลอดภัย):

   ```gitignore
   # .gitignore
   .env
   .env.local
   ```

3. **เมื่อ EAS Build บน Cloud**:
   - EAS ไม่มีไฟล์ `.env` (เพราะไม่ได้ upload ขึ้น GitHub)
   - `process.env.EXPO_PUBLIC_*` ทุกตัวเป็น `undefined`
   - Firebase `initializeApp()` ล้มเหลว
   - **App Crash ทันที**

### Crash Flow

```
App Start
    ↓
Load Firebase Config
    ↓
firebaseConfig = {
  apiKey: undefined,      ← ❌ ไม่มีค่า
  authDomain: undefined,  ← ❌ ไม่มีค่า
  projectId: undefined,   ← ❌ ไม่มีค่า
  ...
}
    ↓
initializeApp(firebaseConfig)
    ↓
💥 CRASH - Invalid Firebase Config
```

---

## ✅ วิธีแก้ไข

### Solution: ใช้ EAS Environment Variables

**EAS Environment Variables** คือระบบจัดการ Environment Variables ของ Expo ที่:

- เก็บค่าบน Expo Server อย่างปลอดภัย
- ถูก inject เข้า build process โดยอัตโนมัติ
- ไม่ต้อง commit secrets ขึ้น GitHub
- รองรับหลาย environments (development, preview, production)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    EAS Cloud                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Environment Variables Store            │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │ EXPO_PUBLIC_FIREBASE_API_KEY = ***      │    │   │
│  │  │ EXPO_PUBLIC_FIREBASE_PROJECT_ID = ***   │    │   │
│  │  │ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ***  │    │   │
│  │  │ ...                                     │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              EAS Build Process                   │   │
│  │  1. Pull code from GitHub                        │   │
│  │  2. Inject Environment Variables                 │   │
│  │  3. Build iOS/Android App                        │   │
│  │  4. Upload to TestFlight/Play Store              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │    TestFlight/        │
              │    App Store          │
              │    ─────────────      │
              │    App with valid     │
              │    Firebase config    │
              └───────────────────────┘
```

---

## 🛠 ขั้นตอนการตั้งค่า EAS Environment Variables

### Prerequisites

- ติดตั้ง EAS CLI: `npm install -g eas-cli`
- Login เข้า Expo account: `eas login`
- มี project ที่ link กับ EAS แล้ว

### Step 1: ตรวจสอบ EAS CLI Version

```bash
eas --version
# ต้องเป็น version >= 16.28.0
```

### Step 2: สร้าง Environment Variables

#### คำสั่งพื้นฐาน

```bash
eas env:create \
  --name VARIABLE_NAME \
  --value "value" \
  --environment production \
  --visibility plaintext \
  --non-interactive
```

#### Parameters อธิบาย

| Parameter           | คำอธิบาย             | ค่าที่เป็นไปได้                             |
| ------------------- | -------------------- | ------------------------------------------- |
| `--name`            | ชื่อ variable        | ต้องเป็น `EXPO_PUBLIC_*` สำหรับ client-side |
| `--value`           | ค่าของ variable      | string                                      |
| `--environment`     | environment ที่จะใช้ | `development`, `preview`, `production`      |
| `--visibility`      | ระดับความลับ         | `plaintext`, `sensitive`, `secret`          |
| `--non-interactive` | ไม่ถาม prompt        | -                                           |

#### Visibility Levels

| Level       | คำอธิบาย                           | ใช้สำหรับ                        |
| ----------- | ---------------------------------- | -------------------------------- |
| `plaintext` | เห็นได้ใน EAS Dashboard            | ค่าทั่วไป เช่น Project ID        |
| `sensitive` | ซ่อนใน Dashboard แต่ดูได้ด้วย flag | API Keys ที่ไม่ sensitive มาก    |
| `secret`    | ซ่อนทั้งหมด ดูไม่ได้               | ❌ ใช้กับ `EXPO_PUBLIC_*` ไม่ได้ |

### Step 3: สร้าง Variables ทั้งหมด

```bash
# Firebase Configuration
eas env:create --name EXPO_PUBLIC_FIREBASE_API_KEY \
  --value "AIzaSy..." \
  --environment production \
  --visibility sensitive \
  --non-interactive

eas env:create --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN \
  --value "fittbsa.firebaseapp.com" \
  --environment production \
  --visibility plaintext \
  --non-interactive

eas env:create --name EXPO_PUBLIC_FIREBASE_PROJECT_ID \
  --value "fittbsa" \
  --environment production \
  --visibility plaintext \
  --non-interactive

eas env:create --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET \
  --value "fittbsa.firebasestorage.app" \
  --environment production \
  --visibility plaintext \
  --non-interactive

eas env:create --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
  --value "1095128507689" \
  --environment production \
  --visibility plaintext \
  --non-interactive

eas env:create --name EXPO_PUBLIC_FIREBASE_APP_ID \
  --value "1:1095128507689:web:..." \
  --environment production \
  --visibility plaintext \
  --non-interactive

# Google OAuth
eas env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID \
  --value "1095128507689-....apps.googleusercontent.com" \
  --environment production \
  --visibility plaintext \
  --non-interactive

eas env:create --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID \
  --value "1095128507689-....apps.googleusercontent.com" \
  --environment production \
  --visibility plaintext \
  --non-interactive

# Gemini AI
eas env:create --name EXPO_PUBLIC_GEMINI_API_KEY \
  --value "AIzaSy..." \
  --environment production \
  --visibility sensitive \
  --non-interactive

# App Configuration
eas env:create --name EXPO_PUBLIC_APP_ENV \
  --value "production" \
  --environment production \
  --visibility plaintext \
  --non-interactive
```

### Step 4: ตรวจสอบ Variables ที่สร้างแล้ว

```bash
eas env:list --environment production
```

### ผลลัพธ์ที่ควรได้

```
Environment: production
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_FIREBASE_API_KEY=***** (sensitive)
EXPO_PUBLIC_FIREBASE_APP_ID=1:1095128507689:web:...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=fittbsa.firebaseapp.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1095128507689
EXPO_PUBLIC_FIREBASE_PROJECT_ID=fittbsa
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=fittbsa.firebasestorage.app
EXPO_PUBLIC_GEMINI_API_KEY=***** (sensitive)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=1095128507689-...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1095128507689-...
```

---

## 📋 รายการ Environment Variables

### Production Environment

| Variable Name                              | Description              | Visibility | Required |
| ------------------------------------------ | ------------------------ | ---------- | -------- |
| `EXPO_PUBLIC_FIREBASE_API_KEY`             | Firebase Web API Key     | Sensitive  | ✅       |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase Auth Domain     | Plaintext  | ✅       |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase Project ID      | Plaintext  | ✅       |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Firebase Storage Bucket  | Plaintext  | ✅       |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID            | Plaintext  | ✅       |
| `EXPO_PUBLIC_FIREBASE_APP_ID`              | Firebase App ID          | Plaintext  | ✅       |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`         | Google OAuth Web Client  | Plaintext  | ✅       |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`         | Google OAuth iOS Client  | Plaintext  | ✅       |
| `EXPO_PUBLIC_GEMINI_API_KEY`               | Google Gemini AI API Key | Sensitive  | ✅       |
| `EXPO_PUBLIC_APP_ENV`                      | App Environment          | Plaintext  | ✅       |

---

## 🚀 การ Build และ Deploy

### Build สำหรับ iOS (TestFlight)

```bash
# Build production
eas build --platform ios --profile production

# Submit to App Store Connect (TestFlight)
eas submit --platform ios --latest
```

### Build สำหรับ Android (Play Store)

```bash
# Build production
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android --latest
```

### eas.json Configuration

```json
{
  "cli": {
    "version": ">= 16.28.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

> **หมายเหตุ**: ไม่ต้องใส่ `env` ใน `eas.json` เพราะ EAS จะดึงจาก Environment Variables Store อัตโนมัติ

---

## ✨ Best Practices

### 1. ไม่ Commit Secrets ขึ้น GitHub

```gitignore
# .gitignore
.env
.env.local
.env.production
```

### 2. ใช้ Visibility ที่เหมาะสม

| ประเภทข้อมูล         | Visibility ที่แนะนำ              |
| -------------------- | -------------------------------- |
| Project ID, Domain   | `plaintext`                      |
| API Keys             | `sensitive`                      |
| Private Keys, Tokens | `secret` (ไม่ใช้กับ EXPO_PUBLIC) |

### 3. แยก Environment ตามการใช้งาน

```bash
# Development
eas env:create --name EXPO_PUBLIC_APP_ENV --value "development" --environment development

# Preview (สำหรับ QA Testing)
eas env:create --name EXPO_PUBLIC_APP_ENV --value "preview" --environment preview

# Production
eas env:create --name EXPO_PUBLIC_APP_ENV --value "production" --environment production
```

### 4. ตรวจสอบก่อน Build

```bash
# ดู variables ทั้งหมด
eas env:list --environment production

# ดูรวม sensitive values
eas env:list --environment production --include-sensitive
```

### 5. Backup Environment Variables

```bash
# Export เก็บไว้ในที่ปลอดภัย (ไม่ใช่ GitHub)
eas env:list --environment production --include-sensitive > secrets-backup.txt
```

---

## 🔧 Troubleshooting

### ปัญหา: Variable already exists

```bash
# Error
Variable EXPO_PUBLIC_FIREBASE_API_KEY already exists on this project.

# Solution: ลบแล้วสร้างใหม่
eas env:delete --name EXPO_PUBLIC_FIREBASE_API_KEY --environment production --non-interactive
eas env:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "new-value" --environment production
```

### ปัญหา: Cannot use secret visibility with EXPO*PUBLIC*\*

```bash
# Error
Variables prefixed with "EXPO_PUBLIC_" should never be considered as secret.

# Solution: ใช้ sensitive แทน
eas env:create --name EXPO_PUBLIC_API_KEY --value "..." --visibility sensitive
```

### ปัญหา: App ยังคง Crash หลัง Build ใหม่

1. ตรวจสอบว่า build ใช้ `--profile production`
2. ตรวจสอบว่า variables ครบทุกตัว
3. ลอง clear cache และ build ใหม่:
   ```bash
   eas build --platform ios --profile production --clear-cache
   ```

### ปัญหา: Variables ไม่ถูก inject

```bash
# ตรวจสอบ build logs
eas build:view

# หรือดูใน EAS Dashboard
# https://expo.dev/accounts/[account]/projects/[project]/builds
```

---

## 📊 Summary

| Before                         | After                              |
| ------------------------------ | ---------------------------------- |
| ❌ ใช้ `.env` file             | ✅ ใช้ EAS Environment Variables   |
| ❌ App Crash บน TestFlight     | ✅ App ทำงานได้ปกติ                |
| ❌ ไม่มี secrets บน production | ✅ Secrets ถูก inject อัตโนมัติ    |
| ❌ Hardcode ใน eas.json        | ✅ เก็บบน Expo Server อย่างปลอดภัย |

---

## 📞 Contact

หากมีคำถามเพิ่มเติม ติดต่อ:

- **Development Team**: watthachai@digitalvalue.co.th
- **EAS Documentation**: https://docs.expo.dev/eas/environment-variables/

---

## 📝 Changelog

| Date       | Update                                                |
| ---------- | ----------------------------------------------------- |
| 2026-01-29 | Initial document - แก้ไขปัญหา App Crash บน TestFlight |

---

© 2026 Digital Value Company Limited
