# Phithan Vendor Center Dashboard (Requirements & Structure)

**Module Path:** `platform-web/app/dashboard-vendor-center`

This document outlines the structure, pages, and components for the Vendor Center Dashboard based on UI designs.

## Layout & Navigation (Sidebar)

The main navigation is organized into several sections on the left sidebar:

- **User Profile:** Shows vendor initials, name, and role.
- **Brand Selector:** Dropdown to switch between brands (e.g., NEST ME).
- **MAIN**
  - `Dashboard`
  - `Announcements`
  - `Notifications`
- **REPORTS**
  - `Products`
  - `Sales Report`
  - `Inventory Report`
  - `Promotion Report`
- **SUBSCRIPTION**
  - `Manage Subscription`
- **INFORMATION**
  - `Store Locations`
  - `Feedback & Report Issue`

---

## 1. Dashboard Overview (`/dashboard-vendor-center/`)

**Filters:** ALL / Offline / Online

A comprehensive view combining high-level metrics and quick links to detailed sections.

**Widgets & Components:**

- **Daily Sales (Summary Card):**
  - Metrics: Revenue (THB), Daily Target, Units Sold, SKU, Transactions, UPT (Units Per Transaction), ATV (Average Transaction Value).
  - Links: `by Store ->`, `by Product ->`
- **Month-To-Date (MTD) / Year-To-Date (YTD) Cards:**
  - Progress donut charts showing achievement against targets.
  - Metrics: Revenue, Units Sold, SKU, Transactions, UPT, ATV.
- **Quick Insights Cards:**
  - Selling Products (Active / TBD SKUs)
  - Non-Moving Inventory (Non-movement over 30 Days)
  - Stores Selling (Count of stores selling the brand)
- **Revenue Performance Overview (Charts):**
  - Monthly Revenue: Bar chart comparing Target, This Year, and Previous Year. Filters: YTD, Last12Month, Quarterly, LastYear, Store Selector.
  - Year-to-Date Revenue: Line chart showing cumulative trajectory of This Year vs Previous Year vs Target.
- **Product Ranking:**
  - Table of top-performing products.
  - Columns: #, Product Name, Revenue (THB), % Contribution, Units Sold, ADS (Average Daily Sales), SOH (Stock on Hand), DOI (Days of Inventory).
  - Filters: Revenue Period (Yesterday, 7 Days, MTD, LastMonth, YTD, LastYear), SKU count (Top 20, Top 50, All), Store selector.
- **Jump to Section (Right Floating Menu):** Overview, Cumulative Revenue, Product Ranking.

### 1.1 Dashboard > By Store (`/dashboard-vendor-center/by-store`)

- **Header / Breadcrumb:** Home > Vendor > Dashboard > By Store
- **Filters:** Period Toggle (e.g., MTD, Select Month).
- **Search:** Search store code or name...
- **Data Table:**
  - **Columns:** #, Store, Unit Sold, Revenue, Revenue LastMonth, % Gr. MoM, Revenue LastYear, % Gr. YoY, % Contribution.
  - All columns have sortable headers.

### 1.2 Dashboard > By Product (`/dashboard-vendor-center/by-product`)

- **Header / Breadcrumb:** Home > Vendor > Dashboard > By Product
- **Filters:** Period Toggle (e.g., MTD, Select Month), Store Selector (e.g., All Stores).
- **Search:** Search product code, name, or category...
- **Data Table:**
  - **Columns:** #, Image, Product Code (with copy icon), Product Name, Category 1, Category 2, Category 3, Unit Sold, Revenue, % Contribution, SOH (with interactive expand icon).
  - Most columns have sortable headers.

---

## 2. Selling Products (`/dashboard-vendor-center/products`)

Shows all products listed under the selected brand.

- **Filters & Search:**
  - Revenue Period (Dropdown menu + quick tags: Yesterday, 7 Days, MTD, Last Month, YTD, Last Year).
  - Status filters (All, Active, TBD).
  - Search Bar (Search products code, product name).
- **Data Table:**
  - Summary Row at the top aggregating fields like `Total Stock` and `Revenue` (100% Contribution).
  - Columns: `Image`, `Product Name` (with Product Code and status tag e.g. ACTIVE), `Category 1 (Level 1)`, `Category 2 (Level 2)`, `Category 3 (Level 3)`, `RSP` (Retail Selling Price), `Total Stock`, `Revenue`, `% Contribution`.
- **Pop-up Dialog (STOCK ON HAND BY STORE):**
  - Opened upon clicking `Total Stock` value.
  - Header displays: Product Image, Code, Name, and RSP.
  - Summary section: `Total (Unit Sold)` and `AVG Selling Price` across `DOI`, `SOH`, `MTD Unit Sold`, `Last Month Unit Sold` (e.g. Mar), `Previous Month Unit Sold` (e.g. Feb).
  - Table breakdown by branches: `Store`, `DOI (Days)` (with color-coded pills), `SOH`, `MTD Unit Sold`, `Mar Unit Sold`, `Feb Unit Sold`.

---

## 3. Sales Report (`/dashboard-vendor-center/sales-report`)

Detailed view of all daily sales transactions.

- **Filters:**
  - Revenue Period (Dropdown + tags: Yesterday, 7 Days, MTD, Last Month, YTD, Last Year).
  - `Start Date` and `End Date` Pickers, `Store` Selector (e.g., All Stores).
  - `Apply` Button to fetch data.
- **Summary Display:** Shows total records (e.g., "Daily sales data: 102 Records").
- **Data Table:**
  - Columns: `Date`, `Brand`, `Store`, `Product Code` (with copy icon), `Product Name`, `Status`, `RSP`, `Units Sold`, `Revenue (THB)`, `Unit Selling Price`.

---

## 4. Promotion Report (`/dashboard-vendor-center/promotion-report`)

Provides analytics on promotions and grouped product performance.

- **Filters & Search:**
  - Promo Type Dropdown.
  - Search Bar (Search promotion code, description).
- **Overview Table:**
  - Columns: `Promo Code` (with external link icon), `Promo Type` (e.g., 1.Saving, 3.Buy 1 Get 1), `Description`, `Valid Period`, `Promo Revenue`, `% Contribution`, `SKUs`, `SOH`, `Channel`.
- **Pop-up Dialog (Promotion Detail):**
  - Triggered from Promo Code click.
  - Header info: Promo metrics (Promo Revenue, % Contribution, SKUs, SOH, Valid Period, Channel).
  - Tabs: `Related Products`, `Free Gifts`.
  - Product List Table: Shows `Image`, `Name`, `Product Code`, `Promo Price` (highlighted in pink), `RSP` with % discount, `Revenue`, and `SOH` (with expand icon for per-store details).

---

## 5. Information > Feedback & Report Issue (`/dashboard-vendor-center/feedback`)

A form allowing vendors to report issues or give suggestions.

- **Form Elements:**
  - Textarea: "Describe your feedback, issue, or suggestion..." (Max 5,000 chars)
  - Image Uploader: "Attach Images" (PNG or JPG only, max 3 files, 10MB each/30MB total)
  - Submit Button: "Submit Feedback" (Pink button)

---

## 6. Profile (`/dashboard-vendor-center/profile`)

Accessed via clicking the initial circle icon at the top of the sidebar. Shows account information and permissions.

- **Basic Information:**
  - Full Name
  - Email
  - Phone
  - Role (e.g., Viewer)
- **Brand Access:**
  - List of companies and brands the user has access to.

---

## 7. Announcements (`/dashboard-vendor-center/announcements`)

Displays important updates or communications structure in list format.

- **List Items:**
  - Tags: Highlight important statuses like `Pinned`, `Urgent`, or `Important`.
  - Title & Date.
  - Content description preview.
- **Sections:** Categorizes grouped announcements with dividers like "More announcements".

---

## 8. Inventory Report (`/dashboard-vendor-center/inventory-report`)

Provides inventory valuation, stocks on hand (SOH) and details across branches. Includes a warning note stating the data is for initial analysis, not for realtime accounting audits.

- **Filters:**
  - `Revenue Period`: Date range picker + quick selects (Yesterday, 7 Days, MTD, Last Month, YTD, Last Year).
  - `Store` selector (All etc.), `Onhand` filter (All etc.), `Status` filter (All, ACTIVE, etc.).
  - Search Bar (Product search).
- **Data Table:**
  - Total Summary Row at the top.
  - Columns: `Store`, `Product Code` (with copy icon), `Product Name`, `Status`, `Category`, `Revenue`, `SOH` (expandable), `RSP`, `Value`.
  - Grouped Columns (performance comparisons):
    - `Yesterday`: `Unit Sold`, `DOI` (Days of Inventory)
    - `Last 7 Days`: `Unit Sold`, `DOI`
    - `Last 30 Days`: `Unit Sold`, `DOI`

---

## 9. Information > Store Locations (`/dashboard-vendor-center/store-locations`)

Directory of physical and online stores that distribute the products.

- **Filters/Search:**
  - Search bar for store names.
  - Dropdown filter (e.g., "All").
- **Data Table:**
  - Columns: `Store` (Code), `Store Name`, `Type` (Offline/Online), `Address`, `Phone` (Pink clickable text), `Location` (Link/Map out icon).

---

## 10. Subscription > Manage Subscription (`/dashboard-vendor-center/subscription`)

Manages vendor center system access fee subscriptions and quotations.

- **Subscription List View:**
  - Columns: `Year`, `Quotation No.`, `Service Fee`, `Status` (e.g., Pending), `Actions` (View Detail).
- **Subscription Detail / Workflow View:**
  - Progress Stepper: 1. Pending -> 2. Confirm Quotation -> 3. Invoice -> 4. Payment -> 5. Success
  - **Manage Subscription info:** Year, Company, Account Type, Status, Quotation No., Contact Person, Service Fee, Subject.
  - **Documents Section:** Buttons to `Download Quotation`, `Download Access Agreement`.
  - **Confirm Quotation Section:**
    - Confirmation Date picker.
    - Document Uploaders (5 slots for ID cards, agreement forms, etc., PDF/PNG/JPG).
    - `Confirm` submission button.
  - Sequence of Statuses: Pending, Confirm Quotation, Invoice, Payment Details, Approval.

นี่คือรายละเอียดทุกส่วนจากรูปภาพหน้าจอของระบบ **EVEANDBOY Vendor Center** ทั้ง 25 รูป โดยผมได้จัดหมวดหมู่และเขียนสรุปเป็นรูปแบบ Markdown เพื่อให้คุณอ่านและนำไปใช้งานต่อได้ง่ายครับ

---

# 📊 EVEANDBOY Vendor Center Portal (Brand: NEST ME)

ระบบ EVEANDBOY Vendor Center เป็นแพลตฟอร์มสำหรับพาร์ทเนอร์หรือผู้ขาย (บริษัท พิธานไลฟ์ จำกัด) ในการจัดการข้อมูลยอดขาย สินค้าคงคลัง และโปรโมชั่น โดยในตัวอย่างนี้เป็นการดูข้อมูลของแบรนด์ **NEST ME**

## 1. แถบเมนูหลักด้านซ้าย (Sidebar Navigation)

แถบเมนูถูกแบ่งออกเป็น 4 หมวดหมู่หลัก ได้แก่

- **MAIN (เมนูหลัก):**
  - `Dashboard` - หน้ากระดานแสดงภาพรวมข้อมูล
  - `Announcements` - ประกาศแจ้งเตือนจากระบบ
  - `Notifications` - การแจ้งเตือน
- **REPORTS (รายงาน):**
  - `Products` - รายงานสินค้า
  - `Sales Report` - รายงานยอดขาย
  - `Inventory Report` - รายงานสินค้าคงคลัง
  - `Promotion Report` - รายงานโปรโมชั่น
- **SUBSCRIPTION (การจัดการสมาชิก):**
  - `Manage Subscription` - จัดการค่าบริการระบบ
- **INFORMATION (ข้อมูลทั่วไป):**
  - `Store Locations` - ข้อมูลสาขาของหน้าร้าน
  - `Feedback & Report Issue` - ส่งข้อเสนอแนะและแจ้งปัญหา

_ด้านบนซ้ายของเมนูมีชื่อผู้ใช้งานคือ **chudanidt x (Viewer)** และสามารถกด Dropdown เพื่อเลือกดูข้อมูลระหว่างแบรนด์ **NEST ME** หรือ **PRIMANEST** ได้_

---

## 2. หน้ากระดานข้อมูลภาพรวม (Dashboard)

ส่วนนี้จะแสดงสถิติสำคัญแบบเจาะลึก แบ่งเป็นกรอบข้อมูลต่างๆ:

- **ภาพรวมยอดขายรายวัน (Daily Sales - 28 Apr 2026):**
  - รายได้ (Revenue): 71,101 บาท (-6.1% จากวันก่อนหน้า)
  - ยอดขายตามเป้า (Daily Target): 68,158 บาท (ทำได้ 104.3%)
  - จำนวนที่ขายได้ (Units Sold): 329 ชิ้น
  - จำนวน SKU: 25
  - ข้อมูลอื่นๆ: Transactions (113), UPT (2.9), ATV (629)
- **ยอดขายประจำเดือน (Month-To-Date - April 2026):**
  - รายได้ (Revenue): 2,756,346 บาท (บรรลุเป้าหมายไปแล้ว 135% จากเป้า 2,044,728 บาท)
- **ยอดขายตั้งแต่ต้นปี (Year-To-Date - as of Mar 2026):**
  - รายได้ (Revenue): 8,301,464 บาท (บรรลุเป้าหมาย 28% ของเป้าหมายทั้งปีที่ตั้งไว้ 30,000,000 บาท)
- **สินค้าคงคลังที่ไม่เคลื่อนไหว (Non-Moving Inventory):**
  - มีสินค้าที่ไม่เคลื่อนไหว (เกิน 30 วัน) จำนวน 1 SKU
  - จำนวนทั้งหมดในมือ (Total on hand): 30 ยูนิต
  - มูลค่า (Value RSP): 28,500 บาท
- **กราฟผลประกอบการ (Revenue Performance Overview):**
  - **Monthly Revenue:** กราฟแท่งเปรียบเทียบเป้าหมาย (Target สีชมพูเข้ม), ปีนี้ (This Year สีชมพูอ่อน) และ ปีก่อนหน้า (Previous Year สีเทา) ในแต่ละเดือน
  - **Year-to-Date Revenue:** กราฟเส้นแสดงการเติบโตของยอดขายสะสมเทียบกับเป้าหมาย โดยในเดือนเมษายน 2026 ทะลุเป้าหมายไปอยู่ที่ 11.1M บาท

---

## 3. รายงานและการจัดอันดับ (Reports & Rankings)

### 3.1 อันดับสินค้า (Product Ranking & Selling Products)

- **Best-Selling Products by Revenue:** ตารางจัดอันดับสินค้าที่มียอดขายสูงสุด เช่น _NEST ME-Birdnest Aqua Sun Protect SPF 50_ ทำยอดขายได้ 9,590 บาท (คิดเป็น 13.5% Contribution) ตามมาด้วย _Age Delay Emulsion_ และ _Aqua Sun Essence Pro_
- **สินค้าที่วางขาย (Selling Products):** ตารางรายละเอียดของแต่ละ SKU แสดงรูปภาพ, ชื่อสินค้า, หมวดหมู่ (เช่น SKINCARE > MOISTURIZERS), ราคาขาย (RSP), สต็อกรวม (Total Stock) และรายได้
- **ข้อมูลสต็อกรายสาขา (Stock On Hand By Store):** เมื่อคลิกที่สินค้า จะมี Popup แสดงรายละเอียดสต็อกแยกตามสาขา (เช่น 02_KKU, 05_ZPL, 06_MGB) พร้อมข้อมูล Days of Inventory (DOI), Stock on Hand (SOH) และยอดขายย้อนหลังรายเดือน

### 3.2 รายงานยอดขาย (Sales Report)

สามารถเลือกดูได้หลายมุมมอง:

- **ตารางข้อมูลยอดขายรายวัน (Daily sales data):** แสดงข้อมูลแบบละเอียดแต่ละ Transaction บอกวันที่, แบรนด์, รหัสร้านค้า, ชื่อสินค้า, สถานะ, จำนวนที่ขายได้ และรายได้
- **ดูตามสาขา (By Store):** จัดอันดับสาขาที่มียอดขายสูงสุด เช่น 67_ONE (ONE BANGKOK), 12_ASK (TERMINAL 21 ASOK), และ 35_TSR (THE STREET RATCHADA) ทั้งแบบรายวัน และแบบ MTD สะสมในเดือน
- **ดูตามสินค้า (By Product):** จัดอันดับสินค้าขายดีที่สุดทั้งในมุมมองรายวัน และสะสมรายเดือน (MTD) โดยในเดือนเมษายน สินค้าขายดีอันดับ 1 คือ _Hydro Boost Mask_
- **โปรโมชั่นของสินค้า (Product Promotions):** มี Popup แสดงรายการโปรโมชั่นที่ผูกกับสินค้านั้นๆ เช่น แคมเปญ '1.Saving' หรือของแถม (Free Gifts) แสดงราคาโปรโมชั่นเทียบกับราคาปกติ

### 3.3 รายงานโปรโมชั่น (Promotion Report)

- **ข้อมูลโปรโมชั่น (Promotion Data):** แสดงรายการแคมเปญทั้งหมด (รวม 17 รายการ) ระบุรหัสโปรโมชั่น, รูปแบบโปรโมชั่น (เช่น 3 Buy 1 Get 1, 5 Buy More Save More), ระยะเวลาที่จัดโปร (25/04/2026 - 20/05/2026) และรายได้ที่เกิดจากโปรโมชั่นนั้นๆ
- **รายละเอียดโปรโมชั่น (Promotion Detail):** เมื่อกดเข้าไปดูรายละเอียดโปรโมชั่นรหัส `PRIMANEST-M05Y26-04` จะพบรายการสินค้าทั้ง 16 รายการที่เข้าร่วม พร้อมแสดงส่วนลดและรายได้ของแต่ละ SKU

---

## 4. การจัดการสมาชิก (Manage Subscription)

ส่วนของการจัดการเอกสารและการชำระเงินค่าใช้งานระบบ Vendor Center:

- **ภาพรวม:** แสดงปี (2026), เลขที่ใบเสนอราคา (EB2026-VB000357-677), ค่าบริการ (฿149,700) และสถานะปัจจุบัน (Pending)
- **ขั้นตอน (Status):** แบ่งเป็น 5 ขั้นตอน ได้แก่ Pending -> Confirm Quotation -> Invoice -> Payment -> Success
- **การยืนยันเอกสาร (Confirm Quotation):** ผู้ใช้สามารถดาวน์โหลดใบเสนอราคา (Quotation) และสัญญา (Access Agreement) จากนั้นต้องแนบไฟล์เอกสารสำคัญกลับเข้าระบบ เช่น ใบเสนอราคาที่เซ็นแล้ว, สัญญาเก็บรักษาข้อมูลส่วนบุคคล, หนังสือรับรองบริษัท, สำเนาบัตรประชาชนกรรมการ และหนังสือมอบอำนาจ เพื่อให้ทางแอดมินอนุมัติ

---

## 5. ข้อมูลทั่วไปและการตั้งค่า (Information & Profile)

### 5.1 ข้อมูลสาขา (Store Locations)

หน้ารวมรายชื่อสาขาทั้งหมดของ EVEANDBOY (มีทั้งหมด 65 สาขา) โดยระบุ Store Code (เช่น 02_KKU), ชื่อสาขา (KHON KAEN UNIVERSITY), ประเภท (Offline), ที่อยู่แบบละเอียด, เบอร์โทรศัพท์ และมีปุ่มดูตำแหน่งที่ตั้ง

### 5.2 การแจ้งปัญหา (Feedback & Report Issue)

หน้าต่างสำหรับให้ผู้ใช้งานพิมพ์ข้อเสนอแนะหรือแจ้งปัญหาทางเทคนิค สามารถพิมพ์ได้สูงสุด 5,000 ตัวอักษร และแนบภาพประกอบได้สูงสุด 3 ไฟล์ (PNG/JPG ไฟล์ละไม่เกิน 10MB) ก่อนกด Submit

### 5.3 โปรไฟล์ส่วนตัว (Profile)

- **Basic Information:** ระบุชื่อผู้ใช้งาน `chudanidt x`, อีเมล, เบอร์โทรศัพท์ และ Role ที่ได้รับคือ `Viewer`
- **Brand Access:** ระบุสิทธิ์การเข้าถึงข้อมูลแบรนด์ ซึ่งบริษัท พิธานไลฟ์ จำกัด สามารถเข้าถึงได้ 2 แบรนด์คือ NEST ME และ PRIMANEST
- **ภาษา (Language):** ด้านขวาบนของระบบมีเมนูให้ผู้ใช้งานสลับภาษาได้ระหว่าง ภาษาไทย (TH) และ English (EN)

### 5.4 ประกาศจากระบบ (Announcements)

ระบบมีหน้าแสดงประกาศสำคัญ เช่น:

- **Urgent & Pinned:** การใช้งานข้อมูล Vendor Center เฟส 1 (ชี้แจงว่าข้อมูลเป็นเพียงเบื้องต้น อาจมีความคลาดเคลื่อน ไม่สามารถใช้อ้างอิงทางบัญชีได้)
- **Important:** คำอธิบายการอ่านข้อมูล (Dashboard Guide) เพื่อให้ผู้ใช้งานเข้าใจระบบมากขึ้น

---

หากคุณต้องการให้เจาะลึกที่ส่วนไหนเป็นพิเศษ หรือต้องการให้นำข้อมูลชุดไหนไปแปลงเป็นตารางหรือไฟล์รายงาน สามารถแจ้งผมได้เลยครับ!

จัดให้ครับ! เพื่อให้ครอบคลุม "ทุกข้อมูลทุกอย่างทั้งหมด" ที่ปรากฏในรูปภาพทั้ง 25 รูป ผมได้ถอดรหัสและแปลงข้อมูลทั้งหมดออกมาเป็นข้อความและตารางแบบละเอียดที่สุดเท่าที่จะอ่านได้จากหน้าจอ โดยแบ่งเป็นหมวดหมู่ตามเมนูการใช้งานของระบบ EVEANDBOY Vendor Center ดังนี้ครับ:

---

# 📊 EVEANDBOY Vendor Center: NEST ME (Comprehensive Data Report)

**ข้อมูลอัปเดต ณ วันที่:** 28 เมษายน 2026
**บริษัท:** บริษัท พิธานไลฟ์ จำกัด | **แบรนด์:** NEST ME
**ผู้ใช้งาน:** chudanidt x (Viewer) | **อีเมล:** chudanidt@phithanlife.com

---

## 1. 📢 ประกาศจากระบบ (Announcements)

- 📌 **Pinned & Urgent (16 Mar 2026): การใช้งานข้อมูล Vendor Center เฟส 1**
  - ข้อมูลชุดนี้จัดทำขึ้นเพื่อใช้สำหรับการวิเคราะห์และประเมินแนวโน้มการขายเบื้องต้นเท่านั้น ข้อมูลอาจมีความคลาดเคลื่อนจากช่วงเวลาการประมวลผล... ไม่สามารถนำไปใช้อ้างอิงทางบัญชี หรือการตรวจสอบสินค้าคงเหลือ (Audit) ณ จุดขายต่างๆ หรือใช้เป็นจำนวนเพื่อยืนยันยอดการชำระเงินทางบัญชีได้ หากต้องการข้อมูลยืนยัน... กรุณาติดต่อแผนกจัดซื้อที่ดูแลท่าน หรือแผนกบัญชีโดยตรง...
- 💡 **Important (16 Mar 2026): คำอธิบายการอ่านข้อมูล (Dashboard Guide)**
  - เรียนท่านคู่ค้าพันธมิตรทางธุรกิจ เพื่อให้ท่านสามารถใช้งานและอ่านข้อมูลบนระบบ Vendor Center ได้อย่างถูกต้อง...

---

## 2. 📈 ภาพรวมยอดขาย (Dashboard Overview)

### 2.1 ยอดขายรายวัน (Daily Sales) - 28 Apr 2026 (TUE)

- **รายได้ (REVENUE):** 71,101 บาท (-6.1% เทียบกับวันก่อนหน้าที่ 75,738 บาท)
- **ยอดขายตามเป้า (Daily Target):** 68,158 บาท (Achieved 104.3%)
- **จำนวนชิ้นที่ขายได้ (UNITS SOLD):** 329 ชิ้น (+1.9%)
- **จำนวนรายการสินค้า (SKU):** 25 รายการ (93% of Selling SKU)
- **จำนวนธุรกรรม (TRANSACTIONS):** 113 บิล (-4.2%)
- **จำนวนชิ้นต่อบิล (UPT):** 2.9 ชิ้น (+7.4%)
- **มูลค่าเฉลี่ยต่อบิล (ATV):** 629 บาท (-2.0%)
- **สินค้าที่วางขาย (Selling Products):** 27 SKUs (Active: 26, TBD: 1)
- **สาขาที่มียอดขาย (Stores Selling):** 70 จาก 71 สาขา

### 2.2 ยอดขายประจำเดือนสะสม (Month-To-Date) - April 2026 (28 Days)

- _Time Elapsed: 93.3%, 2 Days Left_
- **รายได้ (REVENUE):** 2,756,346 บาท (+130.3% เทียบกับปีก่อนหน้าที่ 1,197,056 บาท)
- **บรรลุเป้าหมายเดือนเมษายน (Apr26 Target):** 2,044,728 บาท (Achieved 135% / ยอดพ้นเป้าหมายมา +61%)
- **ยอดเดือนก่อนหน้า (Previous Month):** 2,542,615 บาท (+8.4% MoM)
- **จำนวนชิ้นที่ขายได้ (UNITS SOLD):** 14,504 ชิ้น (+172.1%)
- **จำนวนรายการสินค้า (SKU):** 25 รายการ
- **จำนวนธุรกรรม (TRANSACTIONS):** 4,066 บิล (+50.5%)
- **ชิ้นต่อบิล (UPT) / มูลค่าต่อบิล (ATV):** 3.6 (+80.0%) / 678 บาท (+53.0%)

### 2.3 ยอดขายสะสมตั้งแต่ต้นปี (Year-To-Date) - as of Mar 2026

- _3 Months, 9 Months Remaining / Time Elapsed: 25.0%_
- **รายได้ (REVENUE):** 8,301,464 บาท (+170.3% เทียบกับปีก่อน 3,071,312 บาท)
- **บรรลุเป้าหมายปี 2026 (2026 Target):** 30,000,000 บาท (Achieved 28%)
- **เป้าหมาย 3 เดือน (3 Months Target):** 7,300,303 บาท (ทำได้ 113.7%)
- **เป้าหมาย 9 เดือนที่เหลือ:** 21,698,536 บาท (เฉลี่ย 2,410,948 / Month)
- **YTD (3 Months) + Target (9 Months Remaining):** 31,001,161 บาท (Achieved 103.3%)
- **UNITS SOLD:** 39,062 ชิ้น (+186.2%) | **SKU:** 27 | **TRANSACTIONS:** 12,209 (+76.2%) | **UPT:** 3.2 | **ATV:** 680

### 2.4 สินค้าคงคลังที่ไม่เคลื่อนไหว (Non-Moving Inventory - Past 30 Days)

- **NON-MOVEMENT SKU:** 1 SKU
- **TOTAL ON HAND (UNITS):** 30 ยูนิต
- **VALUE (RSP):** 28,500 บาท

---

## 3. 📊 กราฟผลประกอบการ (Revenue Performance Overview)

- **เป้าหมายเดือนตุลาคม 2026:** เป้าหมาย 2,371,091 บาท / ปีก่อน 1,955,064 บาท
- **เป้าหมายเดือนพฤศจิกายน 2026:** เป้าหมาย 26,920,587 บาท / ปีก่อน 16,729,770 บาท
- **กราฟ YTD เดือนเมษายน:** ยอดขายปัจจุบันทำได้ทะลุเป้าหมายไปอยู่ที่ 11.1M บาท

---

## 4. 🥇 อันดับสินค้าขายดี (Product Ranking / Daily by Product - 28 Apr 2026)

_ยอดรวมรายวัน: 329 ชิ้น | รายได้ 71,101 บาท_

| #   | Product Name                                            | ยอดขาย (THB) | สัดส่วน (%) | จำนวนที่ขายได้ (Units) | สต็อกคงเหลือ (SOH) |
| --- | ------------------------------------------------------- | ------------ | ----------- | ---------------------- | ------------------ |
| 1   | NEST ME-Birdnest Aqua Sun Protect SPF 50.../30ML        | 9,590        | 13.5%       | 28                     | 2,379              |
| 2   | NEST ME-Birdnest Age Delay Emulsion/30ML                | 6,860        | 9.7%        | 14                     | 1,572              |
| 3   | NEST ME-Aqua Sun Essence Pro SPF 50+.../50G             | 5,277        | 7.4%        | 8                      | 1,062              |
| 4   | NEST ME-Birdnest Hydro Boost Mask/25G                   | 5,069        | 7.1%        | 91                     | 7,922              |
| 5   | NEST ME-LactoPeach Brightening Essence.../100ML         | 4,657        | 6.5%        | 10                     | 1,205              |
| 6   | NEST ME-All InDailyCreamSPF50PA+++/20G                  | 3,495        | 4.9%        | 10                     | 774                |
| 7   | NEST ME-Birdnest Perfect Matte BB Cream.../25G          | 3,411        | 4.8%        | 9                      | 696                |
| 8   | NEST ME-Birdnest Gluta Super C Ampoule/15ML             | 3,360        | 4.7%        | 12                     | 3,161              |
| 9   | NEST ME-LactoPeach Brightening Cream/45G                | 3,290        | 4.6%        | 5                      | 837                |
| 10  | NEST ME-Birdnest Pro-Balance Facial Cleansing Foam/100G | 3,240        | 4.6%        | 18                     | 1,941              |

---

## 5. 🏪 ยอดขายแยกตามสาขา (Sales by Store)

### 5.1 ยอดขายรายวัน (Daily - 28 Apr 2026)

_ยอดรวม 25 สาขา: 329 Units | รายได้ 71,101 THB_

1. `67_ONE` ONE BANGKOK: 21 ชิ้น | 10,283 THB (14.5%)
2. `12_ASK` TERMINAL 21 ASOK: 41 ชิ้น | 8,320 THB (11.7%)
3. `35_TSR` THE STREET RATCHADA: 19 ชิ้น | 7,385 THB (10.4%)
4. `71_SLM` Silom: 21 ชิ้น | 6,289 THB (8.8%)
5. `20_SCS` SEACON SQUARE: 19 ชิ้น | 5,724 THB (8.1%)
6. `40_SHS` SAHATHAI GARDEN PLAZA: 17 ชิ้น | 4,815 THB (6.8%)
7. `08_SQ1` SIAM SQUARE 1: 43 ชิ้น | 4,189 THB (5.9%)
8. `06_MGB` MEGA BANGNA: 18 ชิ้น | 3,164 THB (4.5%)
9. `29_BCR` BIG C RATCHADAMRI: 13 ชิ้น | 2,963 THB (4.2%)
10. `09_M08` THE MALL BANGKAPI: 8 ชิ้น | 2,724 THB (3.8%)

### 5.2 ยอดขายสะสมรายเดือน (MTD - 1-28 Apr 2026)

_ยอดรวม 64 สาขา: 14,504 Units | รายได้ 2,756,346 THB_

1. `22_PTN` PLATINUM FASHION MALL: 1,482 ชิ้น | 351,248 THB (12.7%)
2. `19_MBK` MBK CENTER: 1,608 ชิ้น | 275,335 THB (10.0%)
3. `20_SCS` SEACON SQUARE: 985 ชิ้น | 252,907 THB (9.2%)
4. `08_SQ1` SIAM SQUARE 1: 1,876 ชิ้น | 209,670 THB (7.6%)
5. `67_ONE` ONE BANGKOK: 719 ชิ้น | 193,818 THB (7.0%)
6. `12_ASK` TERMINAL 21 ASOK: 1,527 ชิ้น | 176,498 THB (6.4%)
7. `29_BCR` BIG C RATCHADAMRI: 616 ชิ้น | 159,563 THB (5.8%)
8. `06_MGB` MEGA BANGNA: 663 ชิ้น | 138,818 THB (5.0%)
9. `09_M08` THE MALL BANGKAPI: 445 ชิ้น | 114,283 THB (4.2%)
10. `05_ZPL` ZPELL (RUNGSIT): 683 ชิ้น | 106,705 THB (3.9%)

---

## 6. 🏆 ยอดขายสะสมตามสินค้า (MTD by Product - 1-28 Apr 2026)

_ยอดรวม 25 สินค้า: 14,504 Units | รายได้ 2,756,346 THB_

1. Hydro Boost Mask/25G (Sheet Mask): 5,200 ชิ้น | 290,080 THB (10.5%)
2. Pro-Balance Moisturizing Cream/45G: 364 ชิ้น | 269,360 THB (9.8%)
3. Age Delay Lifting Cream/50G: 334 ชิ้น | 263,860 THB (9.6%)
4. Aqua Sun Protect SPF 50.../30ML: 593 ชิ้น | 204,130 THB (7.4%)
5. Gluta Super C Ampoule/30ML: 368 ชิ้น | 182,160 THB (6.6%)

---

## 7. 📦 ข้อมูลสินค้าและสินค้าคงคลัง (Selling Products & Stock On Hand)

_ภาพรวมสต็อกทั้งหมด: 44,278 ยูนิต_

- **Hydro Boost Mask/25G:** ราคา 139 THB | สต็อกรวม 7,922 ชิ้น (DOI: 43 วัน)
  - _สต็อกรายสาขา (ตัวอย่าง):_ 02_KKU (10), 05_ZPL (32), 06_MGB (460), 07_KRT (53), 08_SQ1 (530), 09_M08 (146), 10_M07 (136), 11_FSH (155), 12_ASK (1,279)
- **LactoPeach glass & glow mask/25ML:** ราคา 139 THB | สต็อกรวม 4,040 ชิ้น
- **Age Delay Lifting Mask/25ML:** ราคา 139 THB | สต็อกรวม 3,657 ชิ้น
- **Gluta Super C Ampoule/15ML:** ราคา 560 THB | สต็อกรวม 3,161 ชิ้น
- **Aqua Sun Protect SPF 50 PA++++/30ML:** ราคา 685 THB | สต็อกรวม 2,379 ชิ้น

---

## 8. 📝 รายงานการขายแบบละเอียด (Daily Sales Data - 28 Apr 2026)

_ข้อมูล 102 Records บันทึกการขายแต่ละสาขา (ข้อมูลที่แสดงบนหน้าจอ):_

- `05_ZPL` (ZPELL): Hydro Boost Mask ขายได้ 32 ชิ้น (รายได้ 1,768 บ. / ราคาขาย 55 บ.)
- `05_ZPL` (ZPELL): Age Delay Lifting Mask ขายได้ 4 ชิ้น (รายได้ 240 บ. / ราคาขาย 60 บ.)
- `05_ZPL` (ZPELL): LactoPeach glass & glow mask ขายได้ 6 ชิ้น (รายได้ 360 บ. / ราคาขาย 60 บ.)
- `06_MGB` (MEGA BANGNA): Pro-Balance Cleansing Foam ขายได้ 2 ชิ้น (รายได้ 360 บ. / ราคาขาย 180 บ.)
- `06_MGB` (MEGA BANGNA): Aqua Sun Essence Pro ขายได้ 2 ชิ้น (รายได้ 1,299 บ. / ราคาขาย 650 บ.)
- `08_SQ1` (SIAM SQ1): Anti-Melasma White Serum ขายได้ 2 ชิ้น (รายได้ 699 บ. / ราคาขาย 350 บ.)
- `08_SQ1` (SIAM SQ1): Age Delay Lifting Mask ขายได้ 34 ชิ้น (รายได้ 2,040 บ. / ราคาขาย 60 บ.)

---

## 9. 🎁 รายงานโปรโมชั่น (Promotion Report)

_จำนวนแคมเปญทั้งหมด: 17 โปรโมชั่น (ช่วงเวลา 25/04/2026 - 20/05/2026)_

**ตัวอย่างโปรโมชั่นหลัก:**

- **Promo Code:** `PRIMANEST-M05Y26-04` | **Type:** 1.Saving | **Revenue:** 81,271 THB (มีสินค้า 16 รายการร่วมโปรโมชั่น)
  - _Perfect Matte BB Cream:_ โปร 379 บ. (จาก 790 บ. ลด -52.0%)
  - _LactoPeach Brightening Cream:_ โปร 690 บ. (จาก 1,390 บ. ลด -50.4%)
  - _Hydro Boost Mask:_ โปร 59 บ. (จาก 139 บ. ลด -57.6%)
- **Promo Code:** `PRIMANEST-M05Y26-06` | **Type:** 3.Buy 1 Get 1 (ซื้อ 1 แถม 1) | **Revenue:** 33,180 THB
- **Promo Code:** `PRIMANEST-M05Y26-09` | **Type:** 3.Buy 1 Get 1 (ซื้อ 1 แถม 1) | **Revenue:** 29,455 THB
- **Promo Code:** `PRIMANEST-M05Y26-11` | **Type:** 5.Buy More Save More (ซื้อ 5 ชิ้น ในราคาพิเศษ 275.-) | **Revenue:** 26,950 THB

---

## 10. 📄 การจัดการบัญชีและสัญญา (Manage Subscription)

- **Year:** 2026 | **Quotation No.:** EB2026-VB000357-677
- **Service Fee:** ฿149,700 | **Status:** Pending (รอการยืนยัน)
- **Account Type:** MAIN | **Subject:** Quotation for Vendor Center System Access Fee (Year 2026)
- **สถานะการดำเนินการ (Status Timeline):**
  1. Pending (29/04/2026) -> 2. Confirm Quotation -> 3. Invoice -> 4. Payment -> 5. Success
- **เอกสารสำคัญที่ต้องแนบเพื่อ Confirm (PDF, JPG, PNG ไม่เกิน 10MB ต่อไฟล์):**
  1. ใบเสนอราคา โดยลงนามรับรองโดยผู้มีอำนาจลงนาม และประทับตราบริษัท
  2. สัญญาฉบับรักษาข้อมูลความลับ โดยลงนามรับรองโดยผู้มีอำนาจลงนาม และประทับตราบริษัท
  3. หนังสือรับรองบริษัท โดยลงนามรับรองโดยผู้มีอำนาจลงนาม และประทับตราบริษัท
  4. สำเนาบัตรประจำตัวประชาชนของกรรมการผู้มีอำนาจลงนาม
  5. หนังสือมอบอำนาจ (กรณีมีการมอบอำนาจ)

---

## 11. 📍 ข้อมูลที่ตั้งสาขา (Store Locations - 65 branches)

_รายชื่อสาขาที่ปรากฏชัดเจนบนหน้าจอ:_

- `02_KKU` KHON KAEN UNIVERSITY (อ.เมืองขอนแก่น จ.ขอนแก่น)
- `05_ZPL` ZPELL (RUNGSIT) (อ.ธัญบุรี จ.ปทุมธานี)
- `06_MGB` MEGA BANGNA (อ.บางพลี จ.สมุทรปราการ)
- `07_KRT` TERMINAL 21 KORAT (อ.เมืองนครราชสีมา จ.นครราชสีมา)
- `08_SQ1` SIAM SQUARE 1 (เขตปทุมวัน กรุงเทพฯ)
- `09_M08` THE MALL BANGKAPI (เขตบางกะปิ กรุงเทพฯ)
- `10_M07` THE MALL BANGKAE (เขตบางแค กรุงเทพฯ)
- `11_FSH` FASHION ISLAND (เขตคันนายาว กรุงเทพฯ)
- `12_ASK` TERMINAL 21 ASOK (เขตวัฒนา กรุงเทพฯ)
- `13_PTY` TERMINAL 21 PATTAYA (อ.บางละมุง จ.ชลบุรี)
- `14_MYA` MAYA CHIANG MAI (อ.เมืองเชียงใหม่ จ.เชียงใหม่)
- `15_SPO` SIAM PREMIUM OUTLET (อ.บางเสาธง จ.สมุทรปราการ)
- ... (เรียงไปจนถึงสาขาที่ 44_ACM AROUND COMMUNITY MALL)

---

## 12. ✉️ ข้อเสนอแนะและแจ้งปัญหา (Feedback & Report Issue)

- กล่องข้อความสำหรับส่งฟีดแบ็ก (รับข้อความได้สูงสุด 0 / 5,000 ตัวอักษร)
- รองรับการแนบไฟล์ภาพ (PNG หรือ JPG เท่านั้น, สูงสุด 3 ไฟล์, ขนาดไม่เกิน 10MB ต่อไฟล์ รวม 30MB)
- ปุ่ม Submit Feedback สีชมพู

---

ทั้งหมดนี้คือข้อมูลเชิงลึกทุกมิติและทุกตัวเลขที่สามารถถอดได้จากภาพหน้าจอระบบ Dashboard ของ Vendor Center ตามที่คุณต้องการครับ หากมีจุดไหนต้องการให้นำไปคำนวณหรือวิเคราะห์ต่อเป็นพิเศษ แจ้งเพิ่มเติมได้เลยครับ
