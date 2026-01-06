# Project Structure - Super Fitt App

## 📋 Overview

Super App สำหรับหลายบริษัทในการนับสินค้าด้วย AI (Gemini) พร้อมระบบจัดการองค์กรแบบครบวงจร

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Super Fitt App                          │
│  (React Native/Expo - iOS & Android)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
│  (Authentication, Rate Limiting, Routing)                    │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Auth       │   │   Core API   │   │   AI Service │
│  Service     │   │   (NestJS)   │   │   (Gemini)   │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (PostgreSQL)                           │
│  - Multi-tenant architecture                                 │
│  - Companies, Users, Products, Stock, Audit Logs             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         Cloud Storage (AWS S3 / Google Cloud Storage)        │
│  - Product images                                            │
│  - QR codes                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Frontend Structure (React Native/Expo) - MVP Phase

```
app/
├── (auth)/                          # Authentication flows
│   ├── login.tsx                    # Login screen (Google only)
│   └── _layout.tsx                  # Auth layout
│
├── (app)/                           # Main app (after login)
│   ├── _layout.tsx                  # Bottom tabs navigation
│   │
│   ├── (home)/                      # Home - Product List
│   │   ├── index.tsx                # รายการสินค้าที่ต้องถ่าย (assigned products)
│   │   └── [productId].tsx          # Product detail
│   │
│   ├── (counting)/                  # Counting Flow
│   │   ├── camera.tsx               # Camera screen
│   │   ├── preview.tsx              # Preview photo before AI process
│   │   └── result.tsx               # AI counting result
│   │
│   ├── (history)/                   # History
│   │   ├── index.tsx                # Counting history list
│   │   └── [sessionId].tsx          # Session detail
│   │
│   └── (profile)/                   # Profile
│       └── index.tsx                # User profile & logout
│
├── _layout.tsx                      # Root layout
└── +not-found.tsx                   # 404 page

components/
├── auth/
│   ├── GoogleLoginButton.tsx
│   └── LineLoginButton.tsx          # (Future)
│
├── camera/
│   ├── ProductCamera.tsx            # Camera component
│   ├── QRScanner.tsx                # QR code scanner
│   └── ImagePreview.tsx             # Preview before submit
│
├── counting/
│   ├── CountingCard.tsx             # Display count result
│   ├── ProductGrid.tsx              # Product grid layout
│   └── CountAnimation.tsx           # Loading animation
│
├── charts/
│   ├── StockChart.tsx               # Stock level charts
│   ├── TrendChart.tsx               # Trend analysis
│   └── ComparisonChart.tsx          # Branch comparison
│
├── shared/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Loading.tsx
│   └── ErrorBoundary.tsx
│
└── ui/                              # Existing UI components
    └── ...

services/
├── api/
│   ├── auth.service.ts              # Authentication API calls
│   ├── product.service.ts           # Product API calls
│   ├── counting.service.ts          # Counting API calls
│   ├── employee.service.ts          # Employee API calls
│   └── report.service.ts            # Report API calls
│
├── ai/
│   └── gemini.service.ts            # Gemini AI integration
│
├── storage/
│   └── image-upload.service.ts      # Image upload to cloud
│
└── utils/
    ├── error-handler.ts
    └── api-client.ts                # Axios/Fetch wrapper

stores/                               # State management (Zustand/Redux)
├── auth.store.ts                    # User auth state
├── company.store.ts                 # Current company context
├── counting.store.ts                # Counting session state
└── product.store.ts                 # Product catalog cache

hooks/
├── useAuth.ts                       # Authentication hook
├── useCamera.ts                     # Camera permissions & control
├── useQRScanner.ts                  # QR scanner hook
├── useCounting.ts                   # Counting logic hook
└── useRolePermissions.ts            # Role-based access control

types/
├── auth.types.ts
├── company.types.ts
├── product.types.ts
├── counting.types.ts
├── employee.types.ts
└── api.types.ts

utils/
├── validation.ts                    # Form validations
├── formatting.ts                    # Data formatting
└── permissions.ts                   # Permission checks
```

---

## 🔧 Backend Structure (NestJS - Recommended)

```
backend/
├── src/
│   ├── main.ts                      # Application entry point
│   │
│   ├── auth/                        # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── strategies/
│   │       ├── google.strategy.ts
│   │       └── line.strategy.ts     # (Future)
│   │
│   ├── companies/                   # Multi-tenant companies
│   │   ├── companies.module.ts
│   │   ├── companies.controller.ts
│   │   ├── companies.service.ts
│   │   └── entities/
│   │       └── company.entity.ts
│   │
│   ├── employees/                   # Employee management
│   │   ├── employees.module.ts
│   │   ├── employees.controller.ts
│   │   ├── employees.service.ts
│   │   └── entities/
│   │       └── employee.entity.ts
│   │
│   ├── branches/                    # Branch management
│   │   ├── branches.module.ts
│   │   ├── branches.controller.ts
│   │   ├── branches.service.ts
│   │   └── entities/
│   │       └── branch.entity.ts
│   │
│   ├── products/                    # Product catalog
│   │   ├── products.module.ts
│   │   ├── products.controller.ts
│   │   ├── products.service.ts
│   │   └── entities/
│   │       └── product.entity.ts
│   │
│   ├── counting/                    # AI counting module
│   │   ├── counting.module.ts
│   │   ├── counting.controller.ts
│   │   ├── counting.service.ts
│   │   ├── ai/
│   │   │   └── gemini-ai.service.ts
│   │   └── entities/
│   │       ├── count-session.entity.ts
│   │       └── count-result.entity.ts
│   │
│   ├── reports/                     # Reporting module
│   │   ├── reports.module.ts
│   │   ├── reports.controller.ts
│   │   ├── reports.service.ts
│   │   └── generators/
│   │       ├── excel.generator.ts
│   │       └── pdf.generator.ts
│   │
│   ├── audit/                       # Audit logging
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts
│   │   └── entities/
│   │       └── audit-log.entity.ts
│   │
│   ├── notifications/               # Push notifications
│   │   ├── notifications.module.ts
│   │   └── notifications.service.ts
│   │
│   ├── storage/                     # File storage
│   │   ├── storage.module.ts
│   │   └── storage.service.ts
│   │
│   ├── analytics/                   # AI analytics
│   │   ├── analytics.module.ts
│   │   ├── analytics.controller.ts
│   │   └── analytics.service.ts
│   │
│   └── shared/                      # Shared utilities
│       ├── decorators/
│       │   ├── roles.decorator.ts
│       │   └── company.decorator.ts
│       ├── filters/
│       │   └── http-exception.filter.ts
│       ├── interceptors/
│       │   └── tenant.interceptor.ts
│       └── pipes/
│           └── validation.pipe.ts
│
├── prisma/                          # Prisma ORM
│   ├── schema.prisma                # Database schema
│   └── migrations/
│
├── test/
│   ├── unit/
│   └── e2e/
│
├── .env
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🗄️ Database Schema (Prisma)

```prisma
// prisma/schema.prisma

// ========== Multi-tenant Core ==========

model Company {
  id          String     @id @default(uuid())
  name        String
  code        String     @unique  // Company code for QR
  logoUrl     String?
  status      CompanyStatus @default(ACTIVE)

  branches    Branch[]
  employees   Employee[]
  products    Product[]
  countSessions CountSession[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("companies")
}

model Branch {
  id          String     @id @default(uuid())
  companyId   String
  company     Company    @relation(fields: [companyId], references: [id])

  name        String
  code        String     // Branch code for QR
  address     String?
  phone       String?

  employees   Employee[]
  countSessions CountSession[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([companyId, code])
  @@map("branches")
}

// ========== User Management ==========

model Employee {
  id          String     @id @default(uuid())
  companyId   String
  company     Company    @relation(fields: [companyId], references: [id])

  branchId    String
  branch      Branch     @relation(fields: [branchId], references: [id])

  email       String     @unique
  name        String
  phone       String?
  role        EmployeeRole

  // OAuth
  googleId    String?    @unique
  lineId      String?    @unique

  status      EmployeeStatus @default(ACTIVE)

  countSessions CountSession[]
  auditLogs   AuditLog[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("employees")
}

// ========== Product Management ==========

model Product {
  id          String     @id @default(uuid())
  companyId   String
  company     Company    @relation(fields: [companyId], references: [id])

  sku         String
  name        String
  description String?
  category    String?
  imageUrl    String?

  // QR Code for scanning
  qrCode      String     @unique

  countResults CountResult[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([companyId, sku])
  @@map("products")
}

// ========== Counting System ==========

model CountSession {
  id          String     @id @default(uuid())
  companyId   String
  company     Company    @relation(fields: [companyId], references: [id])

  branchId    String
  branch      Branch     @relation(fields: [branchId], references: [id])

  employeeId  String
  employee    Employee   @relation(fields: [employeeId], references: [id])

  sessionDate DateTime   @default(now())
  status      SessionStatus @default(IN_PROGRESS)

  // Photos uploaded
  imageUrls   String[]

  results     CountResult[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("count_sessions")
}

model CountResult {
  id          String     @id @default(uuid())
  sessionId   String
  session     CountSession @relation(fields: [sessionId], references: [id])

  productId   String
  product     Product    @relation(fields: [productId], references: [id])

  // AI Detection results
  detectedCount Int
  confidence  Float      // AI confidence score (0-1)

  // Manual verification
  verifiedCount Int?
  verifiedBy  String?
  verifiedAt  DateTime?

  // AI metadata
  aiModel     String     // "gemini-pro-vision"
  processingTime Int     // milliseconds

  imageUrl    String
  boundingBoxes Json?    // AI bounding boxes data

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("count_results")
}

// ========== Audit & Analytics ==========

model AuditLog {
  id          String     @id @default(uuid())
  employeeId  String
  employee    Employee   @relation(fields: [employeeId], references: [id])

  action      String     // "CREATE", "UPDATE", "DELETE", "LOGIN"
  entity      String     // "PRODUCT", "COUNT_SESSION", etc.
  entityId    String?

  changes     Json?      // Before/After data
  ipAddress   String?
  userAgent   String?

  createdAt   DateTime   @default(now())

  @@map("audit_logs")
}

// ========== Enums ==========

enum CompanyStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum EmployeeRole {
  SUPER_ADMIN      // Multi-company admin
  ADMIN            // Company admin
  SUPERVISOR       // Branch supervisor
  EMPLOYEE         // Regular employee
}

enum EmployeeStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum SessionStatus {
  IN_PROGRESS
  COMPLETED
  VERIFIED
  REJECTED
}
```

---

## 🔐 Authentication Flow

```
1. User opens app
2. Selects login method (Google / LINE)
3. OAuth flow completes
4. Backend checks if user exists
   - New user → Show company registration/selection
   - Existing user → Load company context
5. User selects company (if multiple)
6. JWT token issued with company context
7. App loads with role-based navigation
```

---

## 📸 Counting Flow (MVP)

````
1. User logs in with Google
2. App shows list of assigned products (monthly stock check)
   - Product name, SKU, barcode
   - Previous count (BEFORE COUNT QTY)
   - Status: Not Started / In Progress / Completed
3. User selects product to count
4. User can choose:
   a) Scan QR/Barcode → Auto open camera
   b) Skip QR → Open camera directly
5. Takes photo of products on shelf
6. Preview photo → Confirm or Retake
7. Image uploaded to cloud storage
8. Backend sends image to Gemini AI with prompt:
   "Count the number of [Product Name] in this image"
9. AI returns:
   - Detected product count (CURRENT COUNT QTY)
   - Confidence score
10. Result shown to user:
    - AI Count vs Previous Count
    - MVP Features (Mobile App Only)

### ✅ Phase 1 - Core Features
- ✅ Google Login authentication
- ✅ View assigned product list for monthly counting
- ✅ Select product to count
- ✅ Optional QR/Barcode scanning
- ✅ Camera integration
- ✅ Photo preview & retake
- ✅ Gemini AI counting
- ✅ Manual count adjustment
- ✅ Add remarks
- ✅ Save counting results
- ✅ View counting history
- ✅ Calculate variance (Before vs Current count)
- ✅ User profile & logout

### 🔮 Phase 2 - Future (Web Dashboard)
- 📊 Admin dashboard
- 👥 Employee management
- 📦 Product management
- 📈 Analytics & reports
- ✅ Verify employee counts
- 📤 Export Excel/PDFs
- ✅ Manage all employees
- ✅ Manage products & SKUs
- ✅ Export reports (Excel/PDF)
- ✅ Company settings
- ❌ Cannot manage other companies

### 🌟 Super Admin (SUPER_ADMIN)
- ✅ All features across all companies
- ✅ Manage companies
- ✅ System-wide analytics

---

## 🚀 Technology Stack

### Frontend (Mobile App)
- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **State Management**: Zustand
- **Navigation**: Expo Router (File-based)
- **UI Library**: React Native Paper / NativeWind
- **Camera**: expo-camera
- **QR Scanner**: expo-barcode-scanner
- **HTTP Client**: Axios
- **Forms**: React Hook Form + Zod
- **Charts**: Victory Native

### Backend (API)
- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: Passport.js (JWT, Google OAuth)
- **File Upload**: Multer + AWS S3 / Google Cloud Storage
- **AI Integration**: Google Gemini API
- **Report Generation**: ExcelJS + PDFKit
- **Validation**: class-validator
- **Documentation**: Swagger

### Infrastructure
- **Cloud**: AWS / Google Cloud
- **Database**: PostgreSQL (RDS / Cloud SQL)
- **Storage**: S3 / Cloud Storage
- **Caching**: Redis
- **Queue**: Bull (for async AI processing)
- **Monitoring**: Sentry
- **Analytics**: Mixpanel / Firebase Analytics

---

## 📦 Environment Variables

### Frontend (.env)
```env
EXPO_PUBLIC_API_URL=https://api.superfitt.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxx
EXPO_PUBLIC_LINE_CLIENT_ID=xxx
EXPO_PUBLIC_SENTRY_DSN=xxx
````

### Backend (.env)

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/superfitt"

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

LINE_CHANNEL_ID=xxx
LINE_CHANNEL_SECRET=xxx
LINE_CALLBACK_URL=http://localhost:3000/auth/line/callback

# Google Gemini AI
GEMINI_API_KEY=xxx

# Cloud Storage
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=superfitt-images

# Redis
REDIS_URL=redis://localhost:6379
```

---

MVP Development Plan

### Week 1: Setup & Authentication

- [ ] Setup Expo project structure
- [ ] Setup Firebase project
- [ ] Configure Google OAuth
- [ ] Create login screen
- [ ] Test authentication flow

### Week 2: Product List & Database

- [ ] Design Firestore schema
- [ ] Create product list screen
- [ ] Implement product selection
- [ ] Setup Gemini AI API
- [ ] Test database operations

### Week 3: Camera & AI Integration

- [ ] Implement camera screen
- [ ] Add photo preview
- [ ] Integrate Gemini AI counting
- [ ] Show AI results
- [ ] Manual adjustment UI

### Week 4: History & Polish

- [ ] Counting history screen
- [ ] Profile screen
- [ ] Calculate variance
- [ ] Add remarks functionality
- [ ] UI/UX polish
- [ ] Testing
- [ ] Deploy to TestFlight/Play Store Betaion
- [ ] Deployment

---

## ❓ Questions to Consider

1. **จำนวน SKU**: มีสินค้าประมาณกี่ SKU ต่อบริษัท? (เพื่อประเมิน AI training)
2. **Concurrent Users**: มีพนักงานใช้งานพร้อมกันประมาณกี่คน?
3. **Image Quality**: มีข้อกำหนดเรื่องคุณภาพภาพหรือไม่? (resolution, lighting)
4. **Offline Support**: ต้องการให้ทำงาน offline ได้ไหม?
5. **QR Code Format**: ใช้ QR code format แบบไหน? (URL, JSON, Custom)
6. **Notification**: ต้องการ push notification แบบไหนบ้าง?
7. **Report Schedule**: รายงานอัตโนมัติรายวัน/รายสัปดาห์/รายเดือน?

---

## 💡 Recommendations

1. **เริ่มจาก MVP**: ทำ core features ก่อน (Auth → Scan → Count → Basic Report)
2. **Gemini API**: ใช้ `gemini-1.5-flash` สำหรับ cost-effective หรือ `gemini-1.5-pro` สำหรับ accuracy สูง
3. **Image Optimization**: Compress ภาพก่อนส่ง AI เพื่อลดค่าใช้จ่าย
4. **Caching**: Cache product catalog ในแอปเพื่อลด API calls
5. **Queue System**: ใช้ Bull Queue สำหรับ AI processing เพื่อไม่ให้ block requests
6. **Testing**: Test กับสินค้าจริงเร็วที่สุด เพื่อปรับ AI prompt

---

ถ้า structure นี้โอเค ผมจะเริ่มสร้างโค้ดเบสให้เลยครับ! 🚀
