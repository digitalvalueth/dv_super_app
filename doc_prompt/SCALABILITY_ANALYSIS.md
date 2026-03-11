# 📊 Scalability Analysis - FITT BSA App

> **สำหรับ:** 800 พนักงาน × 400 สาขา  
> **เป้าหมาย Deploy:** ภายในเดือนนี้ (มกราคม 2026)

---

## 📈 Current System Overview

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Native  │────▶│    Firebase     │────▶│   Cloud         │
│   Expo App      │     │   Firestore     │     │   Functions     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐
│  AsyncStorage   │     │ Firebase Storage│
│  (Local Cache)  │     │   (Images)      │
└─────────────────┘     └─────────────────┘
```

### Key Collections & Estimated Documents

| Collection       | Documents/Month (Est.) | Read/Write Pattern      |
| ---------------- | ---------------------- | ----------------------- |
| users            | 800                    | Low write, Medium read  |
| products         | ~10,000                | Low write, High read    |
| countingSessions | 800 × 30 = 24,000      | High write, Medium read |
| assignments      | 400 × 30 = 12,000      | Medium write/read       |
| checkIns         | 800 × 2 × 30 = 48,000  | High write, Low read    |
| shipments        | 400 × 10 = 4,000       | Medium write/read       |

---

## 🔴 Current Bottlenecks & Complexity

### 1. Real-time Listeners (⚠️ High Risk)

**ปัญหา:**

```typescript
// ❌ ปัจจุบัน: ทุก user ฟัง real-time ทั้ง company
onSnapshot(
  query(
    collection(db, "countingSessions"),
    where("companyId", "==", companyId),
  ),
);
```

**Complexity:** O(n) per user × 800 users = **800 concurrent listeners**

**ผลกระทบ:**

- Firebase จะต้อง fan-out updates ไปทุก listener
- ค่าใช้จ่าย reads จะสูงมาก
- Network traffic สูง

**แนะนำก่อน Deploy:**

```typescript
// ✅ แก้ไข: Filter by branchId หรือ userId ก่อน
onSnapshot(
  query(
    collection(db, "countingSessions"),
    where("branchId", "==", userBranchId),
    where("status", "==", "pending"),
  ),
);
```

---

### 2. Home Screen Dashboard (⚠️ Medium Risk)

**ปัญหา:**

```typescript
// ❌ ดึงข้อมูล 50 records ทุกครั้งที่เปิด Home
const sessionsQuery = query(
  collection(db, "countingSessions"),
  where("companyId", "==", companyId),
  limit(50),
);
```

**ผลกระทบ:**

- 800 users × 50 reads = **40,000 reads** ทุกครั้งที่เปิดแอป

**แนะนำก่อน Deploy:**

```typescript
// ✅ Option 1: Cache locally + refresh interval
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ✅ Option 2: Aggregate ข้อมูลใน Cloud Functions
// สร้าง collection "branchStats" ที่ pre-compute ไว้
```

---

### 3. Products List Loading (⚠️ Medium Risk)

**ปัญหา:**

```typescript
// ❌ โหลด products ทั้งหมดของ company
where("companyId", "==", companyId);
```

**10,000 products × 800 users = ปัญหาใหญ่**

**แนะนำก่อน Deploy:**

```typescript
// ✅ Pagination ด้วย cursor
const first = query(
  collection(db, "products"),
  where("branchId", "==", branchId), // Filter by branch!
  orderBy("name"),
  limit(20),
);

// Load more
const next = query(
  collection(db, "products"),
  where("branchId", "==", branchId),
  orderBy("name"),
  startAfter(lastVisible),
  limit(20),
);
```

---

### 4. Image Storage (⚠️ Low Risk)

**ปัญหา:**

- ภาพ counting sessions อาจมี 24,000 ภาพ/เดือน
- ประมาณ 500KB × 24,000 = **12GB/เดือน**

**แนะนำ:**

```typescript
// ✅ Compress before upload
import * as ImageManipulator from "expo-image-manipulator";

const compressed = await ImageManipulator.manipulateAsync(
  uri,
  [{ resize: { width: 800 } }],
  { compress: 0.7, format: "jpeg" },
);
```

---

## 🟢 สิ่งที่ดีอยู่แล้ว

| Feature                      | Status | Note                         |
| ---------------------------- | ------ | ---------------------------- |
| Composite Indexes            | ✅     | มีครบตาม queries ที่ใช้      |
| Real-time for Inbox          | ✅     | Filter by companyId + status |
| AsyncStorage for recent apps | ✅     | ลด reads                     |
| useFocusEffect               | ✅     | ไม่ fetch ซ้ำโดยไม่จำเป็น    |

---

## 🚀 Quick Wins (ทำก่อน Deploy)

### Priority 1: ลด Firestore Reads

#### 1.1 เพิ่ม branchId filter ทุก query

```typescript
// ไฟล์: app/(tabs)/home/index.tsx
// เปลี่ยนจาก:
where("companyId", "==", companyId);
// เป็น:
where("branchId", "==", user.branchId);
```

#### 1.2 เพิ่ม Local Cache

```typescript
// services/cache.service.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "cache_";
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export const getCached = async <T>(key: string): Promise<T | null> => {
  const data = await AsyncStorage.getItem(CACHE_PREFIX + key);
  if (!data) return null;

  const { value, expiry } = JSON.parse(data);
  if (Date.now() > expiry) {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
    return null;
  }
  return value;
};

export const setCache = async (key: string, value: any, ttl = DEFAULT_TTL) => {
  await AsyncStorage.setItem(
    CACHE_PREFIX + key,
    JSON.stringify({
      value,
      expiry: Date.now() + ttl,
    }),
  );
};
```

#### 1.3 Limit real-time listeners

```typescript
// เปลี่ยน onSnapshot เป็น getDocs สำหรับ data ที่ไม่ต้อง real-time
// เช่น: products, history

// ❌ ไม่จำเป็นต้อง real-time
onSnapshot(query(...), callback);

// ✅ ใช้ getDocs แทน
const snapshot = await getDocs(query(...));
```

---

### Priority 2: Pagination

```typescript
// hooks/usePaginatedQuery.ts
import { useState, useCallback } from "react";
import {
  query,
  collection,
  getDocs,
  limit,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";

export function usePaginatedQuery(
  collectionName: string,
  constraints: any[],
  pageSize = 20,
) {
  const [data, setData] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    let q = query(
      collection(db, collectionName),
      ...constraints,
      limit(pageSize),
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    setData((prev) => [...prev, ...docs]);
    setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
    setHasMore(snapshot.docs.length === pageSize);
    setLoading(false);
  }, [lastDoc, hasMore, loading]);

  return { data, loadMore, hasMore, loading };
}
```

---

## 📊 Firebase Pricing Estimate

### Current Usage (800 users, 400 branches)

| Operation | Daily Estimate | Monthly   | Free Tier  | Overage Cost |
| --------- | -------------- | --------- | ---------- | ------------ |
| Reads     | 100,000        | 3,000,000 | 50,000/day | ~$0.36/100K  |
| Writes    | 25,000         | 750,000   | 20,000/day | ~$0.18/100K  |
| Storage   | +400MB         | 12GB      | 1GB        | $0.026/GB    |

**Estimated Monthly Cost:** ~$50-150 USD (ถ้าไม่ optimize)  
**After Optimization:** ~$20-50 USD

---

## 🔮 Future Improvements (หลัง Deploy)

### Phase 1: Cloud Functions for Aggregation

```typescript
// functions/src/aggregateStats.ts
// Trigger เมื่อมี countingSession ใหม่
export const onSessionCreate = functions.firestore
  .document("countingSessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const session = snap.data();

    // Update branch stats
    await db
      .collection("branchStats")
      .doc(session.branchId)
      .set(
        {
          totalCounted: FieldValue.increment(1),
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  });
```

### Phase 2: Offline Support

```typescript
// Enable offline persistence
import { enableIndexedDbPersistence } from "firebase/firestore";

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open
  } else if (err.code === "unimplemented") {
    // Browser doesn't support
  }
});
```

### Phase 3: Background Sync

```typescript
// ใช้ expo-background-fetch สำหรับ sync ข้อมูล
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

TaskManager.defineTask("SYNC_DATA", async () => {
  // Sync pending data
  return BackgroundFetch.BackgroundFetchResult.NewData;
});
```

---

## ✅ Pre-Deploy Checklist

### Security Rules

- [ ] ตรวจสอบ Firestore rules ว่า user อ่านได้เฉพาะ branch ตัวเอง
- [ ] ตรวจสอบ Storage rules

### Performance

- [ ] เพิ่ม branchId filter ทุก query ที่จำเป็น
- [ ] ใช้ pagination สำหรับ products list
- [ ] Compress images ก่อน upload
- [ ] เปลี่ยน onSnapshot → getDocs สำหรับ data ที่ไม่ต้อง real-time

### Indexes

- [ ] ตรวจสอบ composite indexes ครบ
- [ ] ลบ indexes ที่ไม่ใช้

### Monitoring

- [ ] เปิด Firebase Performance Monitoring
- [ ] เปิด Crashlytics
- [ ] ตั้ง Budget Alerts ใน Firebase Console

---

## 📞 Summary

| Aspect              | Current State   | Risk Level | Action Needed          |
| ------------------- | --------------- | ---------- | ---------------------- |
| Firestore Reads     | High            | 🔴 High    | Add branchId filters   |
| Real-time Listeners | Too many        | 🔴 High    | Reduce scope           |
| Pagination          | Not implemented | 🟡 Medium  | Add for products       |
| Image Storage       | No compression  | 🟡 Medium  | Compress before upload |
| Caching             | Partial         | 🟢 Low     | Improve TTL cache      |
| Indexes             | Complete        | 🟢 Low     | Maintain               |

### สรุป:

สำหรับ **800 พนักงาน × 400 สาขา** ระบบปัจจุบันสามารถรองรับได้ แต่ควรทำ **Priority 1** ก่อน deploy เพื่อลดค่าใช้จ่ายและเพิ่มประสิทธิภาพ

**เวลาที่ต้องใช้ในการแก้ไข:**

- Priority 1 (Quick Wins): 2-3 วัน
- Priority 2 (Pagination): 1-2 วัน

---

_Document created: January 27, 2026_
