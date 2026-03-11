นี่คือเอกสารสรุปข้อมูลทางเทคนิคสำหรับการเชื่อมต่อ (Integration Documentation) ของโมดูล ShopReceive ตามที่ระบุไว้ในเอกสารครับ:

### **เอกสารระบบการเชื่อมต่อ (Integration Documentation) - ShopReceive Phone App**

การทำงานของแอปพลิเคชันจะแบ่งการเชื่อมต่อออกเป็น 2 ส่วนหลัก ได้แก่ การดึงข้อมูลจากฐานข้อมูล (Database) และ การส่งข้อมูลกลับไปยังระบบหลังบ้านผ่านคิว (Azure Queue)

---

#### **1. การเชื่อมต่อฐานข้อมูลหลัก (Database Connection)**

แอปพลิเคชันจะต้องเชื่อมต่อเพื่อดึงข้อมูลคำสั่งซื้อ (SR Orders) จากตาราง `Reorder` และข้อมูลพนักงานจากตาราง `Employee`

**ข้อมูลสำหรับการเข้าถึงฐานข้อมูล:**

- **ระบบฐานข้อมูล:** SQL Server บนระบบแพลตฟอร์ม Azure
- **Server Name:** `phithandata.database.windows.net`
- **Database Name:** `phithandata`
- **Authentication:** SQL Server Authentication
- **User Name:** `phithandataadmin`
- **Password:** `ph1than#admin`

**Connection String ที่รองรับ (ADO.NET):**

```connectionstrings
Data Source=phithandata.database.windows.net;Persist Security Info=True;User ID=phithandataadmin;Password=ph1than#admin;Pooling=False;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Application Name="SQL Server Management Studio";Command Timeout=0
```

_(อ้างอิงจากภาพการตั้งค่า Connection String ในเอกสาร)_

---

#### **2. การส่งข้อมูลกลับเข้าระบบ (Data Submission & Azure Queue)**

เมื่อพนักงานทำการนับสต็อกและกดยืนยันแล้ว ข้อมูล**จะไม่ถูกบันทึกลงฐานข้อมูลโดยตรง** แต่แอปพลิเคชันจะต้องส่งข้อมูลในรูปแบบ Message string ไปพักไว้ที่ Queue เพื่อให้ระบบอื่นทำงานต่อ

- **ช่องทางการส่งข้อมูล:** Azure Queue
- **ชื่อคิว (Queue Name):** `ShopReceiveQueue`
- **โครงสร้างข้อมูลที่ต้องส่งเขัา Queue (Data String Structure):**
  - _จุดเริ่มต้นของชุดข้อมูล:_ `Location` และ `TransferNumber` (ได้มาจาก QR Code)
  - _ข้อมูลผู้รับ:_ `ReceiverID` และ `ReceiverName`
  - _วันที่รับ:_ `ReceiveDate` (สร้างโดย Phone App)
  - _รายการสินค้าที่รับ (ส่งวนลูปตามจำนวน SKU):_ `ProductBarcode`, `Receive_SellQty` และ `Receive_TestQty`
  - _จุดสิ้นสุดของชุดข้อมูล:_ ปิดท้ายด้วย `SupervisorID`
- **การประมวลผลต่อ (Downstream Process):** หลังจากข้อมูลเข้า Queue แล้ว ITP จะใช้ Logic App และ Store Procedure ในการดึงข้อมูลแต่ละรายการไปประมวลผลการควบคุมสต็อกต่อไป

---

#### **3. ข้อกำหนดพิเศษสำหรับการเชื่อมต่อ (Important Connectivity Requirements)**

- **Offline Mode / Local Caching:** เนื่องจากสาขาปลายทางอาจมีปัญหาสัญญาณอินเทอร์เน็ตไม่ดี แอปพลิเคชัน**จำเป็นต้องมีระบบ Caching หรือ Retry logic** เพื่อให้พนักงานบันทึกข้อมูลแบบออฟไลน์ได้ และค่อยทำการอัปโหลด (Upload) เมื่อสัญญาณพร้อม
- **Hosting Recommendation:** ผู้พัฒนาระบบแนะนำให้ใช้แพลตฟอร์ม Azure ในการโฮสต์ (Host) ตัว Phone App ด้วย เพื่อให้สอดคล้องกับสถาปัตยกรรมระบบที่ใช้ Azure เป็น WebApp host อยู่แล้ว

---

#### **4. การเชื่อมต่อเข้าสู่ระบบแอปพลิเคชัน (App Log-in Mockup)**

สำหรับการพัฒนาและทดสอบหน้าจอ Log In เบื้องต้น เอกสารได้กำหนดค่าตั้งต้น (Default) ไว้ดังนี้:

- **User Name:** `[- DefaultSalesPerson]`
- **Password:** `[- DefaultSalesPersonID]`

!!! อันนี้มันมีข้อมูลที่ จะสามารเอาไปเทียบกับ ของขาดของหายไหมครับ แล้วบอกว่าข้อมูลล่าสุดว่า data base นี้อัปเดทล่าสุดวันไหน

Original text

https://lh3.googleusercontent.com/notebooklm/ANHLwAx-28VPPfRef2t4WbNFFvm2KHv8MyqtR1E457UW9SskPfA9FprAWtf0uwfos0oqUH97GDkzJ_PUXZZM4n6FarF27okhgVT2NIY-MZ0LpPgum1Y3X5Td37G-msCfbkK1XCqE4R5I=w302-h791-v0
PhoneApp – ShopReceive module specification rev 01
The intention of the ShopReceive module in the Phone App is to provide the facility for the Shop
associate to enter Stock quantity which arrives at the shop via the SR procedures.
The main manual tasks for the Shop associate would be

1. Identify the SKU
2. Count the SKU
3. Enter the Counted qty into the Phone App
   The resources that are available within ITP to support the Phone App are:-
4. Reorder table – access to the details of the SR Orders
5. Employee table – access to the Name/ID of Shop Associate
   These two Table resides in the “phithandata database” within Azure. The Table data are updated nightly
   from the Operational DB. We can increase the frequency if required.
   https://lh3.googleusercontent.com/notebooklm/ANHLwAxmaIArlPZ8M4CMbcNjQ2xrd5EcoqlNf2zui1AMXYTFldXYUbCTDJ-iMO2ZKmNygdUu_5a_gLjPOrwM3r5L5B2_b1we7HONelffohCBoZpgd7V4VUJT-7sSHNMhVsTXLYRZlYbAYA=w643-h320-v0
   https://lh3.googleusercontent.com/notebooklm/ANHLwAw3SjA42rL7JM1MWNRXwkP6GqPP_jDZf34OdM7_Xly3WFyA14sC1a0Xah1wGt5yhCqwbwtLjbkyejrum-loadwAxhPlmLWdh9zLh35iGzCNbEQw0UOOlLReJKiQhBLGxwUhE1LM-w=w358-h563-v0
   https://lh3.googleusercontent.com/notebooklm/ANHLwAxmcgh-RH-LPEHerJhNQzAM07azRnFA0bYXbxEIJP_ShH7RJ5uHBxwKolVpGgQmqI7I07l5rkwd63ek7PqH4kgupmk9s2Jzz1nrh5jmzexujej-p0m7eCfZDwiXMVd0cXtpxgzIoQ=w564-h596-v0
   https://lh3.googleusercontent.com/notebooklm/ANHLwAzymnysS2vwsHkswczL0P5jmWc61OdHSbABV5T5jQlY94nOAdGiZuIFB1as_LFxas6yXR6cuMCHRwSq5-4tGCbl_UQrT03IewwzIjWfaDzGQX48CdSbIUkF40GCS_0RttXf1-bVVg=w547-h564-v0
   https://lh3.googleusercontent.com/notebooklm/ANHLwAx_9HHo6kg0u71p06gatLBcsCv1el4OHW-K1mK7RQKjwZvq7r4_RSPtHMulkT_poc9ErGqm6v5WED64yjsNjNAQVR1atHHTf9pj8VKokVwpKSjz1m6N7qS7ulJQlivubYHuMGYXDA=w358-h563-v0
   Operational requirements:-
   ◼ PhithanLife will be using a Phone app to accept (RECEIVE) stocks sent from the main warehouse to
   each of the 1000 remote shops.
   ◼ The Stock receive task will happen once a day. The most twice a day.
   ◼ There is a QR code which contain the original Shop Restocking (SR) request ID on the delivery
   docket.
   ◼ Each SR is unique per request and it will be part of the delivery docket contents.
   ◼ Each SR will contain no more than 50 different SKU types.
   ◼ Any SR request is stored in the “Restock“Table in a DB Server in Azure and the upstream “Restock
   “process in currently handled by a Web-app.
   ◼ There should be only one RECEIVER record for each SR Order per shop to avoid duplicate
   submissions. ◼ Add offline mode or local caching in the phone app for poor connectivity scenarios.
   Potential issues to consider:
   Connectivity: Remote shops may have poor internet. If the phone app depends on live DB calls, will need offline caching and/or retry logic. Offline data entry/save feature is required before upload.
   Duplicate submissions: If two staff scan the same SR, we could get multiple uploads.
   Validation: If quantities entered don’t match expected delivery, will need optional validation
   rules.
   Error handling: Invalid QR codes or missing SR IDs must be handled gracefully.
   Suggested Phone App logic flow would be:-
6. Scan the SR QR code on the delivery docket
7. The Phone App will use the SR ID and retrieve the all the details of the SR from the “Restock
   “Table in a DB Server in Azure.
8. Populate the Receive form in the Phone App with all the requested SKU types.
9. The shop user will do the actual count of the delivered stock and enter the Qty for each of the
   received SKU accordingly.
10. After final check and confirmation, the Phone app will upload the entered Qty data via a
    message format to an AZURE Queue (ShopReceiveQueue) .These data will be processed
    via a Logic App with a Store Procedure for the Stock Control requirements.
    https://lh3.googleusercontent.com/notebooklm/ANHLwAzSYYipJQ0WrD9iuPRMBnXSlKJQwOCxtn0IYMt2qDnJV9GQg3e72Fdn2u95JtvaV6wN4p_4HosyIiCJi3b3eCwfh_FN8dEk9ITd59m7ixZrWu2xlch7muHnfWu8VRt16f3rYfCv=w542-h435-v0
    The output of the Phone app is to be deposited as a message into the Azure Queue
    (ShopReceiveQueue)
    Summery :-
    The requirement is for the PhoneApp to handle all the required functionalities and upload each events
    to an Azure Queue.
    ITP will extract the Queue records and process each record individually for any of the downstream
    processes.
    It would be good if you could use an Azure free account to do some prototyping with the PhoneApp and
    see if there are any issues with the proposed integration architecture.
    As we are already using Azure as our WebApp host, the preferred option would be the same to use
    Azure to host the PhoneApp.
    https://lh3.googleusercontent.com/notebooklm/ANHLwAxI6iH3Nh9wLShtCmUyGCZZJ4k8ZO83KxjubdgS0Sg_OyiQdP0WTO_hpdTQ64pU6Dkn7YsYxmDTn85KHGd4DUUEYN1TnV7CGJGWqd7n9yz1rTOsJ6NrsexRvSomcUJr_V9c6RWeuQ=w531-h645-v0
    Others :
    Last year we developed some Web pages to clarify the basic required data sets from a PhoneApp that
    we will need for both Shop Daily Sales and the Shop Stock Receive processes.
    You might find these helpful.
    https://lh3.googleusercontent.com/notebooklm/ANHLwAz5tKn1X4XrFioR56T9OoOMoeB_U6ytDqsPvC3Jl3KXO8dwfWhT_6vt6sql86HJ_tUaQtR9xf82FHqihwm74VBpV8gDK42wymHyHxrHmQe7wCKwoEy8Dq3O9iLwDvATYCclYa5s=w557-h841-v0
    https://lh3.googleusercontent.com/notebooklm/ANHLwAw_3-pTMt_J3dfMmKOye2i7CyTIHtcF9rQhE0LIIFLy1wFj6HnMTWWY1ZoZLndbBDE744FdICEN0dmgC-mpBDA-65yNdY7gssW-JHvMMgQppf0WyYX015CoYcNxo5RC3bVw_NJNyQ=w562-h850-v0
    https://lh3.googleusercontent.com/notebooklm/ANHLwAzLX9oD7izrgCNjiuATwmHUmBgtJrFaktJFaGmSOVitdq7S5rbzaNKUa8tEPhM4fWD443zNQZ2XEfYPVWW0dWUh2J4h76FhrzK8Ru4Js1EUwAuEW3fj5FtW4LYhXHksnu2unYZyZA=w761-h697-v0

รับสินค้า
จัดการการรับสินค้าและติดตามพัสดุ

สร้าง Mock Shipment
0

พัสดุทั้งหมด

0

รอรับ

0

รับวันนี้

0

รับทั้งหมด

รายการรับสินค้า
พัสดุทั้งหมด
วันที่

04/03/2026
ค้นหา
ค้นหา Tracking, สาขา...
Tracking สาขา ผู้รับ จำนวน เวลา ดำเนินการ
ไม่พบข้อมูลการรับสินค้า

หน้านี้อาจจะมีส่วนเกี่ยวข้องครับในการรับของเข้าคลังที่พนักงานสาขานั้นได้รับมอบหมาย และจะมีอีกส่วนนึงคือข้อมูลตอนนี้ไม่รู้ว่ามีไหมครับที่ เราจะเอาไปเทียบสินค้า มีแอปไหนที่คุณสามารถทำให้ลองเชื่อมต่อ เพื่อดูให้คุณก่อนไหมครับว่ามีข้อมูลที่จะเอามาใช้อะไรกับแอปเราได้บ้างและต้องทำตามตามที่เขาแนะนำไหมครับ

ที่เป็น เปรียบเทียบสต็อก
เทียบกับระบบ ERP ภายนอก
http://localhost:3000/stock-counter/dashboard/reports/stock-comparison ทีี่จะเชื่อมไป ลองช่วยทีครับว่าเราจะต้องทำอะไรบ้างแล้วถ้ามันเยอะ ไปสร้างไฟล์เป็น part ไปก็ได้ครับ
