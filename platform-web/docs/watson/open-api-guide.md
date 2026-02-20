# Watson Excel Validator - API Guide

## 🔐 API Keys

| Environment    | API Key                                       |
| -------------- | --------------------------------------------- |
| **Sandbox**    | `wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr` |
| **Production** | `wv_prod_sjKzqLJwaEnbNNBRmGdh4Fbh846kwLEm`    |

---

## 🌐 Base URLs

| Environment         | URL                           |
| ------------------- | ----------------------------- |
| **Sandbox (Local)** | `http://localhost:3000`       |
| **Sandbox**         | `https://uat-app.fittbsa.com` |
| **Production**      | `https://app.fittbsa.com`     |

---

## 📡 API Endpoints

### 1. List All Exports

```
GET /api/exports
```

**Query Parameters:**

| Parameter              | Type     | Description                                           |
| ---------------------- | -------- | ----------------------------------------------------- |
| `supplier_code`        | string   | Filter by supplier code                               |
| `status`               | string   | Filter by status: `draft` or `confirmed`              |
| `start_date`           | ISO date | Filter exports after this date (based on exportedAt)  |
| `end_date`             | ISO date | Filter exports before this date (based on exportedAt) |
| `confirmed_start_date` | ISO date | Filter exports confirmed after this date              |
| `confirmed_end_date`   | ISO date | Filter exports confirmed before this date             |
| `limit`                | number   | Number of results (default: 50, max: 100)             |
| `offset`               | number   | Offset for pagination                                 |

**Example - Get all confirmed exports (cURL):**

```bash
curl -X GET "https://uat-app.fittbsa.com/api/exports?status=confirmed" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr"
```

**Example - Get confirmed exports วันนี้ (today):**

```bash
# วันที่ 20 กุมภาพันธ์ 2026
curl -X GET "https://uat-app.fittbsa.com/api/exports?status=confirmed&confirmed_start_date=2026-02-20T00:00:00Z&confirmed_end_date=2026-02-20T23:59:59Z" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr"
```

**Example - Get confirmed exports ทั้งเดือนกุมภาพันธ์:**

```bash
curl -X GET "https://uat-app.fittbsa.com/api/exports?status=confirmed&confirmed_start_date=2026-02-01T00:00:00Z&confirmed_end_date=2026-02-28T23:59:59Z" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr"
```

**Example - Get confirmed exports เฉพาะ supplier ในช่วงวันที่:**

```bash
curl -X GET "https://uat-app.fittbsa.com/api/exports?status=confirmed&supplier_code=1087212501&confirmed_start_date=2026-02-20T00:00:00Z&confirmed_end_date=2026-02-20T23:59:59Z" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr"
```

> **หมายเหตุ:**
>
> - `confirmed_start_date` / `confirmed_end_date` → filter จาก **วันที่ confirm** (`confirmedAt`)
> - `start_date` / `end_date` → filter จาก **วันที่ export** (`exportedAt`)
> - ใช้ `status=confirmed` ร่วมกับ `confirmed_start_date` เสมอ เพื่อไม่ให้ Firestore query ช้า

**Example (JavaScript) - ดึง confirmed exports ของวันนี้:**

```javascript
// ดึง confirmed exports ของวันนี้
async function getTodayConfirmedExports() {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    status: "confirmed",
    confirmed_start_date: startOfDay.toISOString(),
    confirmed_end_date: endOfDay.toISOString(),
  });

  const response = await fetch(
    `https://uat-app.fittbsa.com/api/exports?${params}`,
    {
      headers: {
        "X-API-Key": "wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr",
      },
    },
  );
  const { data, meta } = await response.json();
  console.log(`พบ ${meta.total} รายการ`, data);
  return data;
}
```

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "id": "UTxIl6TNzzf8vyvvHQD2",
      "supplierCode": "1087212501",
      "supplierName": "1087212501",
      "reportDate": "26/01/2026 15:07:25",
      "exportedAt": "2026-02-16T04:11:10.779Z",
      "status": "confirmed",
      "confirmedAt": "2026-02-16T04:45:49.055Z",
      "rowCount": 12998,
      "passedCount": 12998,
      "lowConfidenceCount": 0,
      "summary": {
        "lowMatchItems": 0,
        "passedItems": 40,
        "notFoundItems": 0
      }
    }
  ],
  "meta": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 2. Get Export by ID

```
GET /api/exports/{id}
```

**Example (cURL):**

```bash
curl -X GET "https://uat-app.fittbsa.com/api/exports/UTxIl6TNzzf8vyvvHQD2" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr"
```

**Example (JavaScript):**

```javascript
const exportId = "UTxIl6TNzzf8vyvvHQD2";

const response = await fetch(
  `https://uat-app.fittbsa.com/api/exports/${exportId}`,
  {
    method: "GET",
    headers: {
      "X-API-Key": "wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr",
    },
  },
);
const data = await response.json();
console.log(data);
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "id": "9HUMsMmviSK8A2pQQxCw",
    "supplierCode": "1087212501",
    "supplierName": "1087212501 - PHITHANLIFE COMPANY LIMITED",
    "reportDate": "26/01/2026 15:07:25",
    "exportedAt": "2026-02-20T04:08:28.891Z",
    "status": "confirmed",
    "confirmedAt": "2026-02-20T04:08:36.290Z",
    "confirmedBy": null,
    "rowCount": 161,
    "passedCount": 161,
    "lowConfidenceCount": 0,
    "summary": {
      "notFoundItems": 0,
      "passedItems": 29,
      "lowMatchItems": 0
    },
    "data": [
      {
        "Supplier": 1087212501,
        "Supplier Name": "1087212501 - PHITHANLIFE COMPANY LIMITED",
        "Invoice No.": 12481811,
        "Currency": "THB",
        "Store": "256 - Patong Phuket",
        "Date": "05-JAN-0026",
        "Item Code": 268166,
        "Item Description": "#PrimaNestBNTotalProtSPF50 30ml(Consign)",
        "Qty": 1,
        "GP%": 38,
        "Total Cost Exclusive VAT": 520.23,
        "QtyBuy1": "1",
        "PriceBuy1_Invoice_Formula": "520.23",
        "PriceBuy1_Com_Calculate": "999.00",
        "QtyPro": "0",
        "PricePro_Invoice_Formula": "",
        "PricePro_Com_Calculate": "",
        "Remark": "buy 1",
        "FMProductCode": "SK-C-126",
        "ReportRunDateTime": "26/01/2026 15:07:25"
      }
    ]
  }
}
```

---

### 3. Fetch All Data for Multiple Exports (Daily Batch)

วิธีดึงข้อมูลทุก row จาก **ทุก export ที่ confirmed ในวันเดียวกัน** — pattern นี้ใช้สำหรับ cron job หรือ daily sync ครับ

**cURL - Step 1: ดึงรายการ confirmed exports ของวันนี้:**

```bash
curl -X GET "https://uat-app.fittbsa.com/api/exports?status=confirmed&confirmed_start_date=2026-02-20T00:00:00Z&confirmed_end_date=2026-02-20T23:59:59Z" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr"
```

**cURL - Step 2: ดึงข้อมูล row ทั้งหมดของแต่ละ export:**

```bash
# เอา id จาก step 1 มาใส่
curl -X GET "https://uat-app.fittbsa.com/api/exports/9HUMsMmviSK8A2pQQxCw" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr"
```

**JavaScript - Batch fetch ทุก export พร้อมกัน (แนะนำ):**

```javascript
const API_KEY = "wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr";
const BASE_URL = "https://uat-app.fittbsa.com";

async function fetchAllConfirmedDataForDate(date = new Date()) {
  // Step 1: ดึงรายการ confirmed exports ของวันที่กำหนด
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    status: "confirmed",
    confirmed_start_date: startOfDay.toISOString(),
    confirmed_end_date: endOfDay.toISOString(),
  });

  const listRes = await fetch(`${BASE_URL}/api/exports?${params}`, {
    headers: { "X-API-Key": API_KEY },
  });
  const { data: exportList, meta } = await listRes.json();

  console.log(`พบ ${meta.total} export ที่ confirmed วันนี้`);

  if (exportList.length === 0) return [];

  // Step 2: ดึงข้อมูล row ทั้งหมดพร้อมกันทุก export (parallel)
  const detailPromises = exportList.map((exp) =>
    fetch(`${BASE_URL}/api/exports/${exp.id}`, {
      headers: { "X-API-Key": API_KEY },
    }).then((r) => r.json()),
  );

  const detailResults = await Promise.all(detailPromises);

  // Step 3: รวม rows ทุก export เป็น array เดียว
  const allRows = [];
  for (const result of detailResults) {
    const exp = result.data;
    console.log(`Export ${exp.id}: ${exp.rowCount} rows (${exp.supplierCode})`);

    for (const row of exp.data) {
      allRows.push({
        exportId: exp.id,
        supplierCode: exp.supplierCode,
        confirmedAt: exp.confirmedAt,
        ...row, // ข้อมูลแต่ละ row จาก invoice
      });
    }
  }

  console.log(`รวมทั้งหมด ${allRows.length} rows`);
  return allRows;
}

// ใช้งาน
const rows = await fetchAllConfirmedDataForDate(new Date("2026-02-20"));
console.log(rows[0]); // ดู row แรก
```

**ผลลัพธ์ที่ได้ใน `allRows`:**

```json
[
  {
    "exportId": "9HUMsMmviSK8A2pQQxCw",
    "supplierCode": "1087212501",
    "confirmedAt": "2026-02-20T04:08:36.290Z",
    "Supplier": 1087212501,
    "Supplier Name": "1087212501 - PHITHANLIFE COMPANY LIMITED",
    "Invoice No.": 12481811,
    "Item Code": 268166,
    "Item Description": "#PrimaNestBNTotalProtSPF50 30ml(Consign)",
    "Qty": 1,
    "Total Cost Exclusive VAT": 520.23,
    "QtyBuy1": "1",
    "PriceBuy1_Com_Calculate": "999.00",
    "FMProductCode": "SK-C-126"
  }
]
```

---

### 4. Confirm/Unconfirm Export

```
PATCH /api/exports/{id}
```

**Request Body:**

| Field         | Type   | Required | Description                  |
| ------------- | ------ | -------- | ---------------------------- |
| `action`      | string | Yes      | `confirm` หรือ `unconfirm`   |
| `confirmedBy` | string | No       | ชื่อหรือ ID ของคนที่ confirm |

**Example - Confirm an export:**

```bash
curl -X PATCH "https://uat-app.fittbsa.com/api/exports/UTxIl6TNzzf8vyvvHQD2" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr" \
  -H "Content-Type: application/json" \
  -d '{"action": "confirm", "confirmedBy": "admin@company.com"}'
```

**Example - Unconfirm (revert to draft):**

```bash
curl -X PATCH "https://uat-app.fittbsa.com/api/exports/UTxIl6TNzzf8vyvvHQD2" \
  -H "X-API-Key: wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr" \
  -H "Content-Type: application/json" \
  -d '{"action": "unconfirm"}'
```

**Example (JavaScript):**

```javascript
const exportId = "UTxIl6TNzzf8vyvvHQD2";

// Confirm export
const response = await fetch(
  `https://uat-app.fittbsa.com/api/exports/${exportId}`,
  {
    method: "PATCH",
    headers: {
      "X-API-Key": "wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "confirm",
      confirmedBy: "admin@company.com",
    }),
  },
);
const data = await response.json();
console.log(data);
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "id": "UTxIl6TNzzf8vyvvHQD2",
    "status": "confirmed",
    "confirmedAt": "2026-02-16T04:45:49.055Z",
    "confirmedBy": "admin@company.com",
    "message": "Export confirmed successfully"
  }
}
```

---

## 🔧 Using with Postman

1. **Import Collection** - Create new request
2. **Set Headers:**
   - Key: `X-API-Key`
   - Value: `wv_sandbox_ATyq62lN6bCPamLGR2PE6Ii4Vcaap0pr`
3. **Set URL:** `https://uat-app.fittbsa.com/api/exports`
4. **Send Request**

---

## 📋 Export Status Workflow

**Status Flow:**

```
Upload → Validate → Calculate → Export → Confirm
                                  ↓         ↓
                               [draft]  [confirmed]
```

| Status      | Description                                            |
| ----------- | ------------------------------------------------------ |
| `draft`     | Export created but not yet confirmed. Can be modified. |
| `confirmed` | Export is finalized and ready for API consumption.     |

**How to change status:**

```
PATCH /api/exports/{id}
Body: {"action": "confirm"}
```

> **Best Practice:** ระบบอื่นควรเรียกเฉพาะ exports ที่มี `status: "confirmed"` เท่านั้น

---

## 📊 Data Fields Reference

### Export Summary (List View)

| Field                | Type     | Description                                   |
| -------------------- | -------- | --------------------------------------------- |
| `id`                 | string   | Unique export ID                              |
| `supplierCode`       | string   | Supplier code                                 |
| `supplierName`       | string   | Supplier name                                 |
| `reportDate`         | string   | Report date from source file                  |
| `exportedAt`         | ISO date | When the export was created                   |
| `status`             | string   | `draft` or `confirmed`                        |
| `confirmedAt`        | ISO date | When the export was confirmed (null if draft) |
| `rowCount`           | number   | Total number of rows                          |
| `passedCount`        | number   | Rows that passed validation                   |
| `lowConfidenceCount` | number   | Rows with low match confidence                |
| `summary`            | object   | Summary counts                                |

### Export Detail (Single View)

Includes all summary fields plus:

| Field         | Type   | Description                       |
| ------------- | ------ | --------------------------------- |
| `data`        | array  | Full array of row data            |
| `confirmedBy` | string | Who confirmed the export (if any) |

### Row Data Fields

| Field              | Type   | Description                       |
| ------------------ | ------ | --------------------------------- |
| `Item Code`        | string | Product item code                 |
| `Item Description` | string | Product description               |
| `Qty`              | number | Quantity from invoice             |
| `Unit Price`       | number | Price per unit                    |
| `Amount`           | number | Total amount                      |
| `Std Qty`          | string | Standard quantity (calculated)    |
| `Promo Qty`        | string | Promotional quantity (calculated) |
| `Match Confidence` | number | 0-1 confidence score              |
| `Calc Log`         | string | Calculation details/logs          |

---

## 🔄 Auto-Fetch Confirmed Exports (Cron Job Example)

```javascript
// Fetch exports confirmed today
async function fetchTodayConfirmedExports() {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  const response = await fetch(
    `https://app.fittbsa.com/api/exports?status=confirmed&confirmed_start_date=${startOfDay}&confirmed_end_date=${endOfDay}`,
    {
      method: "GET",
      headers: {
        "X-API-Key": "wv_prod_sjKzqLJwaEnbNNBRmGdh4Fbh846kwLEm",
      },
    },
  );

  const { data: exports } = await response.json();

  for (const exp of exports) {
    // Fetch full data for each export
    const detail = await fetch(
      `https://app.fittbsa.com/api/exports/${exp.id}`,
      {
        headers: { "X-API-Key": "wv_prod_sjKzqLJwaEnbNNBRmGdh4Fbh846kwLEm" },
      },
    );
    const { data } = await detail.json();

    // Process data...
    console.log(`Processing export ${exp.id} with ${data.rowCount} rows`);
  }
}

// Run daily at 8 AM
// cron.schedule('0 8 * * *', fetchTodayConfirmedExports);
```

---

## ⚠️ Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "error": "Unauthorized",
    "message": "Missing API Key. Please provide X-API-Key header.",
    "code": "AUTH_MISSING_KEY"
  }
}
```

### 401 Invalid API Key

```json
{
  "success": false,
  "error": {
    "error": "Unauthorized",
    "message": "Invalid or inactive API Key.",
    "code": "AUTH_INVALID_KEY"
  }
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": {
    "error": "Not Found",
    "message": "Export not found",
    "code": "EXPORT_NOT_FOUND"
  }
}
```

### 400 Validation Error

```json
{
  "success": false,
  "error": {
    "error": "Bad Request",
    "message": "Invalid action. Must be 'confirm' or 'unconfirm'",
    "code": "VALIDATION_ERROR"
  }
}
```

---

## 📞 Support

หากมีปัญหาในการใช้งาน API กรุณาติดต่อผู้ดูแลระบบ

---

## 📝 Changelog

| Version | Date       | Changes                                                                                                                          |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1.3.0   | 2026-02-20 | Fixed PATCH body: field is `action: confirm/unconfirm` (not `status`)                                                            |
| 1.2.0   | 2026-02-16 | Added `status`, `confirmedAt`, `confirmed_start_date`, `confirmed_end_date` filters. Added PATCH endpoint for confirm/unconfirm. |
| 1.1.0   | 2026-02-14 | Added date range filters (`start_date`, `end_date`)                                                                              |
| 1.0.0   | 2026-02-01 | Initial API release                                                                                                              |
