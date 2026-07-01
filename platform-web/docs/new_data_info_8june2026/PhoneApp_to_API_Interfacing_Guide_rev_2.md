PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

## PhoneApp to API Interfacing Guide 

## Simple Integration Rules - What PhoneApp Needs to Know 

**Version:** 2.0 (Revised) 

**Date:** April 27, 2026 

**Project:** Phone2Queue + PhoneApp Integration (Three-Form Message System) **Purpose:** PhoneApp perspective - Updated to include EOD data in login response **Status:** ✅ Aligned with Phone2QueueOffline_EOD.html implementation (Revision 2) 

## 📋 Quick Start 

Three Simple Steps 

1. **LOGIN** → Call LoginToken API 

Send: username/password 

Get: JWT token, user data, shops, products, reorders, **EOD data** ⭐ (NEW) 

2. **PREPARE** → Build JSON message using response data 

Generate UUID v4 GUID for SubmissionID 

Map form data to message structure 

**Use EOD data for Stockcount variance calculation** ⭐ (NEW) 

3. **SUBMIT** → Call Phone2Queue API with JWT token 

Send: JSON message + JWT token 

Get: Success/Partial/Error confirmation 

## 🔐 Step 1: LOGIN - Get Token & Data 

## **Endpoint:** `https://logintoken-{function-id}.australiasoutheast-` 

```
01.azurewebsites.net/api/login
```

## **Send:** 

```
{
  "username": "user_email@company.com",
  "password": "user_password"
}
```

## **Get Back (NOW INCLUDES EOD DATA):** 

1 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "username": "admin@example.com",
    "sales_person_id": "SP001",
    "sales_person_name": "John Smith"
  },
  "customerShops": [
    {"name": "Store A", "locationID": "ST062", "seller": "...", "sqlTable": "..."}
  ],
  "products": [
    {"name": "SK-001", "description": "Desc", "barcode": "123456"}
  ],
  "reorders": [
    {"transferNumber": "TR001", "location": "ST062", ...}
  ],
  "eodData": [
    {
      "location": "WS Tesco Changwattana(673)",
      "locationID": "WL 673",
      "item": "SK-C-103",
      "barcode": "8859109850038",
      "eodDate": "2026-04-26",
      "eodQty": 9
    },
    ...more EOD records for user's assigned shops...
  ]
}
```

## 🆕 **NEW in Rev 2:** **`eodData` Array** 

Contains End-of-Day inventory for **all user's assigned shops** 

- Includes data from **Today + Yesterday** (default) 

- Already filtered to user's shops - no authentication needed 

- **Cache this locally in your app** for offline capability 

## **Token Expiry:** 

|**Token**|**Expires**|**Purpose**|
|---|---|---|
|`access_token`|1 hour (3600 sec)|Use in all Phone2Queue API calls|
|`refresh_token`|4 hours (14400 sec)|Auto-renew access_token within work shift (no re-login needed)|
|Workflow|After 4 hours|User must log in again|



**Use This Data For:** 

2 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

|**From Response**|**Use For**|**Where**|
|---|---|---|
||Include in all Phone2Queue|`Authorization: Bearer`|
|`access_token`|requests|`{token}`|
|`user.sales_person_name`|`Header.UserName`|Message|
|`customerShops[].name`|`Header.ShopName`|Message|
|`customerShops[].locationID`|`Header.LocationID`|Message|
|`products[]`|Populate dropdown|Form UI|
|`reorders[]`|For RECEIVE form lookup|Form UI|
|**`eodData[]`**|**Cache & lookup for Stockcount**|**Form logic** ⭐|



## 📝 Step 2: BUILD MESSAGE - Create JSON 

For SHOP SALES & SHOP STOCKCOUNT 

Use this standard flow to build the message. 

## For SHOP STOCKCOUNT (Using EOD Data) 

**Updated Feature:** Use End-of-Day inventory data from login response to calculate quantity variance! 

## **Workflow (NOW SIMPLIFIED):** 

1. **Login** → Get `eodData` in response (no separate API call needed!) 

2. **Cache** **`eodData` locally** in your app memory 

3. When user selects shop → Filter `eodData` for that shop's `locationID` 

4. When user selects product for counting → Lookup from cached EOD 

5. Example: Item "SK-C-103" has `eodQty` = 9 

6. User enters Physical Count = 12 

7. **Calculate variance:** `Qty to Send = 12 - 9 = 3` 

8. Send message with the variance, not the physical count 

## ⭐ **KEY IMPROVEMENT (Rev 2):** 

- ✅ No more separate `/api/shop-eod` API calls 

- ✅ EOD data comes with login (single API call) 

- ✅ Instant offline-ready product lookups 

- ✅ Reduced API traffic 

- ✅ Better performance (cache-based, not API-based) 

## **Understanding EOD Data Structure (Local Cache):** 

Your app should structure the cached data like this: 

```
// After login, build a lookup index
const eodCache = {};
```

3 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
for (const record of loginResponse.eodData) {
const key = `${record.locationID}:${record.item}`;
    eodCache[key] = record;
}
// When user selects product for shop with locationID "WL 673"
const sku = "SK-C-103";
const lookupKey = `WL 673:${sku}`;
const eodRecord = eodCache[lookupKey];
if (eodRecord) {
console.log(`EOD Qty = ${eodRecord.eodQty}`);  // 9
} else {
console.log('Product not in EOD data');
}
```

## **Pseudocode Example (Rev 2):** 

`# During LOGIN workflow: login_response = call_api_login(username, password) eod_data = login_response['eodData']  #` ⭐ `NEW: Already in response!` 

```
# Build cache (cache this in your app's memory)
eod_cache = {}
for record in eod_data:
    key = f"{record['locationID']}:{record['item']}"
    eod_cache[key] = record
# Later, during STOCKCOUNT form workflow:
# NO MORE SEPARATE API CALLS!
# When user selects shop (just use cached data)
shop_location_id = "WL 673"
shop_eod_records = [r for r in eod_data if r['locationID'] == shop_location_id]
# When user selects product (instant lookup, no API)
physical_count = 12# User enters
sku = "SK-C-103"
lookupKey = f"{shop_location_id}:{sku}"
eod_record = eod_cache.get(lookupKey)
if eod_record:
    eod_qty = eod_record['eodQty']  # = 9
    qty_to_send = physical_count - eod_qty  # = 3
else:
    qty_to_send = physical_count  # Fallback if not in cache
# Build message with variance
message['Products'].append({
"SelectedProduct": "SK-C-103",
"ProductBarcode": "8859109850038",
"SalesQty": qty_to_send,  # Send 3 (the variance), NOT 12
"TestQty": 0,
```

4 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
"MarketingQty": 0
})
```

## **Advanced Option (Optional):** 

If you need **different date ranges** or **custom location filters** , the `/api/shop-eod` endpoint with JWT token still exists: 

```
GET /api/shop-eod?page=1&page_size=100
Authorization: Bearer {access_token}
POST /api/shop-eod
Authorization: Bearer {access_token}
{
  "page": 1,
  "page_size": 100,
  "date_from": "2026-04-08",
  "date_to": "2026-04-09",
  "location_filter": "ST062"
}
```

**But for most use cases, just use the** **`eodData` from login response!** 

## Message Structure (All Three Types) 

## ⚠ **IMPORTANT - Implementation Notes (Rev 2)** 

## **Header Structure (ALL FORMS):** 

```
{
  "SubmissionID": "550e8400-e29b-41d4-a716-446655440000",  // NEW UUID v4 each
time
  "FormType": "Shop Sales",  // OR "Shop Stockcount" OR "Shop StockReceive"
  "UserName": "User Name",  // From login response
  "ShopName": "Shop Name",  // From customerShops[].name
  "LocationID": "ST062",  // From customerShops[].locationID
  "Timestamp": "2026-04-08T14:30:00+07:00",  // ISO 8601 with timezone offset
  "Notes": "Optional notes"// User-entered, can be empty
}
```

## **SALES Form - Quantity Fields (SPECIAL):** 

```
{
  "SelectedProduct": "SK-PF-001",
  "ProductDescription": "Full description",
  "ProductBarcode": "8859109885246",
```

5 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
  "SSOLDQty": 10,      // SALES form uses SSOLDQty (Shop Sold)
  "SPSOLDQty": 2,      // SALES form uses SPSOLDQty (Special Sold)
  "MarketingQty": 1// All forms use MarketingQty
}
```

## **STOCKCOUNT & RECEIVE Forms - Quantity Fields (STANDARD):** 

```
{
  "SelectedProduct": "SK-PF-001",
  "ProductDescription": "Full description",
  "ProductBarcode": "8859109885246",
  "SalesQty": 10,      // Standard quantity field (use variance if using EOD)
  "TestQty": 2,        // Standard quantity field
  "MarketingQty": 1// All forms use MarketingQty
}
```

## Three Message Types 

## Type 1: SHOP SALES (💰) 

## **Complete Example:** 

```
{
  "Header": {
    "SubmissionID": "550e8400-e29b-41d4-a716-446655440000",
    "FormType": "Shop Sales",
    "UserName": "John Smith",
    "ShopName": "Store A",
    "LocationID": "ST062",
    "Timestamp": "2026-04-25T14:30:00+07:00",
    "Notes": "Morning batch"
  },
  "Products": [
    {
      "SelectedProduct": "SK-PF-001",
      "ProductDescription": "Paracetamol 500mg tablets",
      "ProductBarcode": "8859109885246",
      "SSOLDQty": 10,
      "SPSOLDQty": 2,
      "MarketingQty": 1
    }
  ]
}
```

## **Field Rules:** 

✅ Set `FormType` = "Shop Sales" 

6 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

- ✅ Use `SSOLDQty` for Qty1 (Shop Sold) 

- ✅ Use `SPSOLDQty` for Qty2 (Special Sold) 

- ✅ Use `MarketingQty` for Qty3 

- ✅ At least ONE quantity must be > 0 

## Type 2: SHOP STOCKCOUNT (📦) - With EOD Variance 

## **Complete Example (Using EOD Data):** 

`{ "Header": { "SubmissionID": "550e8400-e29b-41d4-a716-446655440000", "FormType": "Shop Stockcount", "UserName": "John Smith", "ShopName": "Store A", "LocationID": "ST062", "Timestamp": "2026-04-25T14:30:00+07:00", "Notes": "Shelf recount - Thursday" }, "Products": [ { "SelectedProduct": "SK-C-103", "ProductDescription": "Paracetamol 500mg tablets", "ProductBarcode": "8859109850038", "SalesQty": 3,        //` ⭐ `THIS IS THE VARIANCE (physical 12 - EOD 9 = 3) "TestQty": 0, "MarketingQty": 0 } ] }` 

## **Field Rules (with EOD):** 

- ✅ Set `FormType` = "Shop Stockcount" 

- ✅ Use `SalesQty` for variance: `Physical Count - EOD Qty` 

- ✅ `SalesQty` = 3 means: We counted 3 MORE than the EOD records 

- ✅ `SalesQty` = -5 would mean: We counted 5 LESS than the EOD records 

- ✅ Can use EOD data from login response for calculation 

- ✅ At least ONE quantity must be > 0 

## Type 3: SHOP STOCKRECEIVE (📥) 

## **Complete Example:** 

```
{
  "Header": {
    "SubmissionID": "550e8400-e29b-41d4-a716-446655440000",
```

7 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
    "FormType": "Shop StockReceive",
    "UserName": "John Smith",
    "ShopName": "Store A",
    "LocationID": "ST062",
    "TransferNumber": "SR-20260329-98",
    "Timestamp": "2026-04-25T14:30:00+07:00",
    "Notes": "Received from warehouse"
  },
  "Products": [
    {
      "SelectedProduct": "SK-PF-001",
      "ProductDescription": "Paracetamol 500mg tablets",
      "ProductBarcode": "8859109885246",
      "SalesQty": 50,
      "TestQty": 0,
      "MarketingQty": 0
    }
  ]
}
```

## **Field Rules:** 

- ✅ Set `FormType` = "Shop StockReceive" 

- ✅ Include `TransferNumber` (user-entered, must match a valid transfer) 

- ✅ Use `SalesQty` , `TestQty` , `MarketingQty` (standard names) 

- ✅ Usually only `SalesQty` is used (others = 0) 

- ✅ At least ONE quantity must be > 0 

- ✅ Products filtered from reorders matching TransferNumber 

## Important Rules 

- ✅ **SubmissionID** : Generate NEW UUID v4 every time (Python: `uuid.uuid4()` , JavaScript: 

`crypto.randomUUID()` ) 

- ✅ **ProductBarcode** : Always include, even if empty 

- ✅ **Timestamp** : Use ISO 8601 format with timezone offset (e.g., `2026-04-25T14:30:00+07:00` ) 

- ✅ **Notes** : User can leave empty or include text 

- ✅ **Thai characters** : JSON must be UTF-8 encoded 

- ✅ **ShopName** : From `customerShops[].name` (NOT `Name` ) 

- ✅ **EOD Caching** : Cache `eodData` from login response for offline capability 

## 📤 Step 3: SUBMIT MESSAGE - Send to Queue 

**Endpoint:** `https://phone2queue-{function-id}.australiasoutheast-` 

- `01.azurewebsites.net/api/write-message` 

**Send:** 

8 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
Header: Content-Type: application/json
Header: Authorization: Bearer {access_token_from_login}
Body:
{
  "message": {
    "Header": { ... },
    "Products": [ ... ]
  }
}
```

## **Get Back (Success):** 

```
{
  "success": true,
  "write_status": "COMPLETE",
  "queue_write_results": {
    "primary": {
      "success": true,
      "queue_name": "shopsales-source-queue",
      "message_id": "f57d7d5f-5ce9-42ed-83cd-7eebc9e656a7",
      "timestamp": "2026-04-25T14:30:15Z"
    },
    "secondary": {
      "success": true,
      "queue_name": "phithanlife-queue",
      "message_id": "0768f051-d9ce-496b-8633-144154e16bad",
      "timestamp": "2026-04-25T14:30:15Z"
    }
  }
}
```

Response Codes to Handle 

- ✅ **success = true, write_status = "COMPLETE"** → Both queues got it ✓ 

✅ **success = true, write_status = "PARTIAL"** → At least one queue got it ✓ 

❌ **success = false, error = "JWT token has expired"** → Use refresh token to get new access token; if refresh also expired, call /api/login 

❌ **success = false, error = "..."** → Check message format, retry 

## 🔑 Code Examples 

Python (Rev 2 - With EOD Cache) 

```
import requests
import uuid
```

9 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
from datetime import datetime, timezone
```

```
LOGIN_URL = "https://logintoken-function.azurewebsites.net/api/login"
QUEUE_URL = "https://phone2queue-function.azurewebsites.net/api/write-message"
```

`# Step 1: Login login_response = requests.post(LOGIN_URL, json={ "username": "user@example.com", "password": "password" }).json() access_token = login_response["access_token"] user = login_response["user"] shops = login_response["customerShops"] products = login_response["products"] eod_data = login_response.get("eodData", [])  #` ⭐ `NEW: Cache EOD data` 

```
# Build EOD lookup cache
eod_cache = {}
for record in eod_data:
    key = f"{record['locationID']}:{record['item']}"
    eod_cache[key] = record
```

```
# Step 2: Build message for STOCKCOUNT form with EOD variance
now = datetime.now(timezone.utc).astimezone().isoformat()
```

```
# User selects shop and counts products
shop = shops[0]
physical_count = 12# User counted this
product = products[0]  # user selected
```

```
# Look up EOD qty from cache
lookup_key = f"{shop['locationID']}:{product['name']}"
eod_record = eod_cache.get(lookup_key)
eod_qty = eod_record['eodQty'] if eod_record else0
```

```
# Calculate variance
qty_to_send = physical_count - eod_qty
message = {
"Header": {
"SubmissionID": str(uuid.uuid4()),
"FormType": "Shop Stockcount",
"UserName": user["sales_person_name"],
"ShopName": shop["name"],
"LocationID": shop["locationID"],
"Timestamp": now,
"Notes": ""
    },
"Products": [
        {
"SelectedProduct": product["name"],
"ProductDescription": product["description"],
"ProductBarcode": product["barcode"],
```

10 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
"SalesQty": qty_to_send,  # Send variance, not physical count!
"TestQty": 0,
"MarketingQty": 0
        }
    ]
}
# Step 3: Submit
response = requests.post(
    QUEUE_URL,
    headers={
"Content-Type": "application/json",
"Authorization": f"Bearer {access_token}"
    },
    json={"message": message}
).json()
print(f"Success: {response['success']}")
print(f"Status: {response.get('write_status')}")
```

## JavaScript (Rev 2 - With EOD Cache) 

`const LOGIN_URL = "https://logintoken-function.azurewebsites.net/api/login"; const QUEUE_URL = "https://phone2queue-function.azurewebsites.net/api/writemessage"; async function main() { // Step 1: Login const loginResp = await fetch(LOGIN_URL, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username: "user@example.com", password: "password"}) }).then(r => r.json()); const {access_token, user, customerShops, products, eodData} = loginResp;  //` ⭐ `NEW: eodData // Build EOD lookup cache const eodCache = {}; for (const record of eodData) { const key = `${record.locationID}:${record.item}`; eodCache[key] = record; } // Step 2: Build message for STOCKCOUNT with EOD variance function getTimestamp() { const date = new Date(); const pad = (n) => String(n).padStart(2, '0'); const offset = -date.getTimezoneOffset(); const sign = offset >= 0 ? '+' : '-'; const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');` 

11 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
return`${date.getFullYear()}-${pad(date.getMonth() +
1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad
(date.getSeconds())}${sign}${hours}:${minutes}`;
    }
```

```
// User input
const shop = customerShops[0];
const product = products[0];
const physicalCount = 12;  // User entered
// Look up EOD qty
const lookupKey = `${shop.locationID}:${product.name}`;
const eodRecord = eodCache[lookupKey];
const eodQty = eodRecord ? eodRecord.eodQty : 0;
```

```
// Calculate variance
const qtyToSend = physicalCount - eodQty;
const message = {
Header: {
SubmissionID: crypto.randomUUID(),
FormType: "Shop Stockcount",
UserName: user.sales_person_name,
ShopName: shop.name,
LocationID: shop.locationID,
Timestamp: getTimestamp(),
Notes: ""
        },
Products: [
            {
SelectedProduct: product.name,
ProductDescription: product.description,
ProductBarcode: product.barcode,
SalesQty: qtyToSend,  // Send variance!
TestQty: 0,
MarketingQty: 0
            }
        ]
    };
// Step 3: Submit
const response = awaitfetch(QUEUE_URL, {
        method: "POST",
        headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${access_token}`
        },
        body: JSON.stringify({message})
    }).then(r => r.json());
console.log(`Success: ${response.success}`);
console.log(`Status: ${response.write_status}`);
}
```

12 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

```
main();
```

## ⚠ Error Checklist 

|⚠Error Checklist||
|---|---|
|**Problem**|**Check**|
|401 Unauthorized|Is Bearer token in Authorization header? Is it from recent login?|
|400 Bad Request|Does message have all required Header fields? Is FormType exact match?|
|ProductBarcode||
|undefined|Did you include ProductBarcode for every product?|
|Wrong<br>currency/location|Did you get data from loginResponse (not hardcoded)?|
|Thai characters broken|Is JSON UTF-8 encoded?|
|SubmissionID conflicts|Using NEW UUID each message (not reusing same ID)?|
|Unknown field error|For SALES: using`SSOLDQty`/`SPSOLDQty`? For STOCKCOUNT/RECEIVE: using|
||`SalesQty`/`TestQty`?|
|Header field mismatch|Using`ShopName`(not`Name`)? Using`Notes`(not`AdditionalNotes`)?|
|EOD lookup failing|Did you build the cache correctly? Check`locationID`and`item`match?|



## ✨ Revision History 

## Version 2.0 (Rev 2) - April 27, 2026 

## **Major Changes from v1.1:** 

- ✅ **NEW:** LoginToken now returns `eodData` in login response (no separate API calls needed!) 

- ✅ **CHANGED:** EOD data fetched during login (Today + Yesterday by default) 

- ✅ **SIMPLIFIED:** Apps cache `eodData` locally for instant offline product lookups 

- ✅ **IMPROVED:** Reduced API traffic (one login call instead of multiple shop-eod calls) 

- ✅ **PERFORMANCE:** Stockcount form now uses cached EOD data (no network overhead) 

- ✅ Updated code examples to show EOD cache building and variance calculation 

- ✅ Clarified Stockcount message should contain variance, not physical count 

- ✅ Added optional `/api/shop-eod` reference for advanced date/location filtering 

## Version 1.1 (Rev 1) - April 25, 2026 

## **Changes from v1.0:** 

- ✅ Updated Header fields to match implementation: `ShopName` instead of `Name` , `Notes` instead of `AdditionalNotes` 

- ✅ Removed unimplemented fields: `UserID` , `QueueName` , `Location` 

- ✅ **CRITICAL:** SALES form now documents `SSOLDQty` and `SPSOLDQty` (Shop Sold, Special Sold) 

13 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

- ✅ STOCKCOUNT and RECEIVE forms use standard `SalesQty` , `TestQty` 

- ✅ Updated all code examples to use correct field names 

- ✅ Clarified field name differences by form type 

## Version 1.0 - April 8, 2026 

Initial version based on specification 

**Last Updated:** April 27, 2026 

**Document Version:** 2.0 (Revised - EOD Data in Login Response) **Audience:** PhoneApp development team & third-party integrators **Status:** ✅ Aligned with LoginToken function_app.py v2.0 

## 📌 Key Takeaway - What's New in Rev 2? 

## **Before (Rev 1):** 

Login → get token, shops, products, reorders 

- Third-party apps → make separate `/api/shop-eod` API calls Problem: Multiple API calls, CORS complexity, not offline-ready 

## **Now (Rev 2):** 

Login → get token, shops, products, reorders, **eodData** ⭐ 

- Third-party apps → cache `eodData` locally 

- Benefit: Single login call, no additional API traffic, instant offline lookups, simple integration! 

## **For Stockcount Forms:** 

Cache EOD data at login 

- When user selects product → lookup from cache (instant, no API) 

- Calculate: `Qty to Send = Physical Count - EOD Qty` 

- Send the variance to the queue (not the physical count) 

## Notes 

## **KEY DIFFERENCE - SALES Form Quantity Fields:** 

SALES form uses: `SSOLDQty` , `SPSOLDQty` , `MarketingQty` 

- STOCKCOUNT form uses: `SalesQty` , `TestQty` , `MarketingQty` (where `SalesQty` = variance) RECEIVE form uses: `SalesQty` , `TestQty` , `MarketingQty` 

**This is intentional** - The SALES form represents "Shop Sold" and "Special Sold" quantities, which are semantically different from "Sales Qty" used in stock counting. 

**EOD Caching Strategy:** For best performance and offline capability: 

1. Cache `eodData` array immediately after login 

2. Build a lookup index: `{locationID}:{item}` → record 

14 / 15 

PhoneApp_to_API_Interfacing_Guide_rev_2.md 

2026-04-27 

3. Filter on shop selection (filter cached array by locationID) 

4. Lookup on product selection (instant, no API calls) 

5. No network dependency after login ✅ 

**Alignment Reference:** Matches `get_eod_data()` function in LoginToken function_app.py (v2.0) 

15 / 15 

