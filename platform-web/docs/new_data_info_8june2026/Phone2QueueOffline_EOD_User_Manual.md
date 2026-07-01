Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## Phone2Queue Mobile Offline - EOD User Manual 

## Updated Version with Queue Status, Message Tracking & EOD Inventory 

This manual documents the latest version of Phone2Queue Mobile Offline with End-of-Day (EOD) inventory support for accurate stockcount variance tracking. 

## What is Phone2Queue Mobile Offline? 

Phone2Queue Mobile Offline is a simple, easy-to-use app for recording shop sales, inventory counts, and stock receipts. The best part? **It works even when you don't have internet!** 

## **Version Features:** 

- ✅ Three-form data collection (Sales, Stockcount, Receive) 

- ✅ Offline capability with automatic sync 

- ✅ Login information tracking 

- ✅ **NEW: End-of-Day (EOD) inventory data for Stockcount accuracy** ⭐ 

- ✅ Queue Status page for message troubleshooting 

- ✅ Real-time message preview (JSON format) 

- ✅ Queue response tracking from both PhithanData and PhithanLife 

## What's New: EOD Inventory Support 🆕 

## What is EOD Qty? 

**EOD Qty** = Yesterday's End-of-Day inventory for each product. 

When you use the **Shop Stockcount form** , the system automatically shows you what was in stock at the end of yesterday. This helps you calculate the **variance** (the difference) when you count inventory today. 

## How Does It Help? 

## **Example:** 

Yesterday's EOD: 10 units of Paracetamol 

- Today you count: 12 units in the shop 

- Variance: +2 units (you have 2 more than expected) 

- **What you send:** 2 (the variance), NOT 12 (the physical count) 

This way, the backend system can track whether products are being added, removed, or lost. 

## How is it Populated? 

1. ✅ You log in → The EOD data comes automatically from the server 

2. ✅ You select your shop → The system filters EOD for that shop 

3. ✅ You select a product → The EOD Qty auto-fills (read-only) 

1 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## 4. ✅ It's completely offline after login (no additional internet needed!) 

## Getting Started 

## Accessing the App 

1. **Open your phone's web browser** (Chrome, Safari, Firefox, Edge, etc.) 

2. **Go to the URL provided by your manager** (example: `https://phone2queue.azurewebsites.net` ) 

3. The app will load on your screen - **no installation required!** 

- 💡 **Tip:** Bookmark this URL in your browser for quick access next time 

## How to Login 

## Step 1: Enter Your Username 

- Tap the **Username** field 

- Type your username (provided by your manager) 

## Step 2: Enter Your Password 

- Tap the **Password** field 

- Type your password 

## Step 3: Click Login 

- Tap the **Login** button 

- Wait a moment while the system verifies your credentials 

- **Behind the scenes:** EOD data for your shops is also being loaded 

## Step 4: Select Your Shop 

- A dropdown menu will appear asking you to **"Select Your Shop"** 

- Tap the dropdown and choose your shop from the list 

- **Note:** You cannot change shops between forms, so choose carefully 

- **Behind the scenes:** EOD data is filtered for this specific shop 

## Step 5: View Login Information (NEW!) 

After successful shop selection, a **Login Info display** will appear showing: 

- ⏱ **Token Valid:** 3600 seconds (time your session is valid) 

- 🏪 **Shops:** Total number of shops available 

- 📦 **Products:** Total number of products in your system 

- 📥 **Reorders:** Total number of pending reorders 

- 🆕 **EOD Data:** Pre-cached for instant offline lookups ⭐ 

This helps you confirm that you're logged in and have access to the right data. 

2 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## Using the Three Forms 

After you select your shop, you'll see three buttons: 

## 💰 Shop Sales Form 

Use this form when **selling products to the shop** 

## 📦 Shop Stockcount Form 

Use this form when **counting inventory in the shop** (NOW WITH EOD DATA!) 

## 📥 Shop StockReceive Form 

Use this form when **receiving stock from a reorder** 

## Form 1: Shop Sales (💰) 

## When to Use 

When you're selling products from the shop 

## Step-by-Step Instructions 

## **1. Select the Shop Sales Form** 

Tap the 💰 **Shop Sales** button 

## **2. Add Products** 

**Select a Product:** Tap the dropdown and choose a product 

- **Barcode:** This auto-fills automatically - no action needed 

- **Description:** Shows product details - read only 

- **Enter Quantities:** You can enter quantities in three fields: 

   - SSOLD Qty (Shop Sold) 

   - SPSOLD Qty (Special Sold) 

   - Mkt Qty (Marketing Quantity) 

_At least ONE quantity must be greater than 0_ 

## **3. Add the Product to Your List** 

## Tap ➕ **Add Product** 

The product appears in the "Products in Batch" section Repeat to add more products 

## **4. Remove a Product (if needed)** 

Find the product in the "Products in Batch" section 

- Tap the ✕ button next to it 

- The product is removed 

3 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## **5. Add Notes (Optional)** 

Tap the **Notes** field 

Type any notes about this batch (e.g., "Rush order" or "Quality check needed") 

## **6. Adjust Timestamp (Optional)** 

Tap the ☰ menu button in the top-right 

- Tap the timestamp field if you need to change the date/time Default is current date and time 

## **7. Review and Submit** 

Tap **Review & Submit →** button 

- Check that all information is correct 

- Tap 📤 **Submit to Queue** button 

- A success message will appear with your Submission ID 

## Form 2: Shop Stockcount (📦) - WITH EOD QTY 

## When to Use 

When you're counting product inventory in the shop 

## NEW Feature: EOD Qty Column 🆕 

The Stockcount form now displays **4 columns** instead of 3: 

|**Column**|**What It Shows**|**Can You Edit?**|**Purpose**|
|---|---|---|---|
|**Sales Qty**|What you're entering|✏YES (You enter)|Your physical count or variance|
|**Test Qty**|What you're entering|✏YES (You enter)|Testing/QA count|
|**Mkt Qty**|What you're entering|✏YES (You enter)|Marketing/promo count|
|**EOD Qty**|Yesterday's inventory|🔒NO (Read-only)|System auto-fills for reference|



## Step-by-Step Instructions 

## **1. Select the Shop Stockcount Form** 

Tap the 📦 **Shop Stockcount** button 

## **2. Select a Product** 

**Select a Product:** Tap the dropdown and choose a product 

- **Barcode:** Auto-fills automatically 

- **Description:** Shows product details 

- ⭐ **EOD Qty Field:** AUTOMATICALLY POPULATES with yesterday's end-of-day quantity! Shows the exact number (e.g., "25") 

   - Or "N/A" if not found in EOD data 

4 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## This is **read-only** - you cannot edit it 

## **3. Understanding the EOD Qty** 

## **Example Workflow:** 

```
Step 1: Select Product "Paracetamol 500mg"
→ EOD Qty auto-fills: 25 units (that's what was in stock yesterday)
```

```
Step 2: Count physical inventory today
→ You count: 23 units actually in the shop
```

```
Step 3: Calculate variance
→ Variance = 23 (physical) - 25 (EOD) = -2 units
→ You're 2 units short (maybe 2 were sold/lost)
```

```
Step 4: Enter quantities
→ Sales Qty: -2 (you enter the variance)
→ Test Qty: 0
→ Mkt Qty: 0
```

## **4. Enter Your Quantities** 

Now you understand what happened, enter your quantities: 

**Sales Qty:** Enter the **variance** (not the physical count!) 

   - Positive number = more than expected (+ stock added somewhere) 

   - Negative number = less than expected (- stock sold or lost) Zero = same as EOD (no change) 

- **Test Qty:** Testing/QA count (if applicable) 

- **Mkt Qty:** Marketing/promo count (if applicable) 

_At least ONE quantity must be greater than 0 OR less than 0_ 

## **5. Add Product to Batch** 

## Tap ➕ **Add Product** 

Repeat to add more products 

The EOD Qty auto-fills for each product you select 

## **6. Remove a Product (if needed)** 

Tap the ✕ button next to the product 

## **7. Add Notes (Optional)** 

Type any observations (e.g., "Shelf damaged in aisle 3" or "Found 2 units in back room") This notes field is helpful for explaining variances 

## **8. Adjust Timestamp (Optional)** 

Tap the ☰ menu button if needed to change date/time 

5 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## **9. Review and Submit** 

Tap **Review & Submit →** 

- **IMPORTANT:** Verify all variance calculations are correct! 

- Check that negative numbers show correctly (if you're short) 

- Tap 📤 **Submit to Queue** 

## How EOD Qty Works (Behind the Scenes) 

## Login → EOD Cache 

When you log in: 

1. The system fetches EOD data for all shops you can access 

2. This data is **cached locally on your phone** 

3. No additional API calls are needed 

## Shop Selection → Filter 

When you select your shop: 

1. The system filters the cached EOD data for that specific shop 

2. All products in that shop have EOD data available 

## Product Selection → Instant Lookup 

When you select a product in Stockcount: 

1. The system instantly looks up that product in the filtered cache 

2. The EOD Qty field auto-fills (no internet needed!) 

3. You see yesterday's inventory immediately 

## Offline Ready ✅ 

After login, the entire Stockcount process is **100% offline capable** : 

- ✅ Select shop (cached data) 

- ✅ Add products (cached data) 

- ✅ See EOD Qty (cached data) 

- ✅ Fill quantities (local app) 

- ✅ View/edit before submit (local) 

- ⚠ Submit (needs internet) 

## Form 3: Shop StockReceive (📥) 

## When to Use 

When you're receiving stock from a reorder/transfer 

Step-by-Step Instructions 

6 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## **1. Select the Shop StockReceive Form** 

Tap the 📥 **Shop StockReceive** button 

## **2. Enter Transfer Number** 

- **Transfer Number Field:** Type the transfer number (TN#) from your reorder document Press Enter or click outside the field 

- The **Shop Location** should auto-fill 

- If it shows an error, double-check the transfer number 

## **3. Select Products to Receive** 

Only products in this transfer will appear in the dropdown 

- **Select a Product:** Tap the dropdown 

- **Barcode:** Auto-fills 

- **Description:** Shows product details 

## **Enter Quantities:** 

Sales Qty 

- Test Qty Mkt Qty 

_At least ONE quantity must be greater than 0_ 

## **4. Add Product to Batch** 

Tap ➕ **Add Product** 

You can add multiple products from the same transfer 

Once added, that product can't be added again (no duplicates) 

## **5. Remove a Product (if needed)** 

Tap the ✕ button 

## **6. Add Notes (Optional)** 

Example: "Damaged items: 2 boxes" or "Short 5 units" 

## **7. Review and Submit** 

Tap **Review & Submit →** 

- Check all information 

Tap 📤 **Submit to Queue** 

## 📊 Queue Status Page 

## What is the Queue Status Page? 

After submitting a form, you can tap the 📊 **QUEUE** button to see detailed information about: 

The exact message that was submitted (in JSON format) 

- Whether the message reached PhithanData queue 

7 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

- Whether the message reached PhithanLife queue Technical configuration details 

## **This is useful for troubleshooting submission issues!** 

## Accessing Queue Status 

## **From Review Screen:** 

- After completing a form, tap **Review & Submit →** 

- Tap the 📊 **QUEUE** button to see status 

## **From Form Selection Screen:** 

After any submission, go back to form selection 

Tap the 📊 **QUEUE** button in the top area 

## Queue Status Page Layout 

The page displays four sections that you can expand/collapse: 

## **1.** 📋 **Message Preview (DEFAULT OPEN)** 

Shows the EXACT JSON message that was submitted to the queues. 

## **What to look for:** 

- ✅ All your products are listed correctly 

- ✅ Quantities match what you entered 

- ✅ **For Stockcount: Variance values are correct** ⭐ (check negative signs!) 

- ✅ Shop name is correct 

- ✅ Timestamp is reasonable 

- ✅ Notes are included (if you added any) 

## **Stockcount Example with EOD:** 

`{ "Header": { "SubmissionID": "SUB-2026-04-27-001", "FormType": "Shop Stockcount", "UserName": "john.smith", "ShopName": "Store A", "LocationID": "LOC-123", "Timestamp": "2026-04-27T14:30:00Z", "Notes": "Shelf recount - found 2 units in back room" }, "Products": [ { "SelectedProduct": "Paracetamol 500mg", "ProductDescription": "500mg tablets, 100 pack", "ProductBarcode": "1234567890001", "SalesQty": -2,        //` ⭐ `VARIANCE (Physical 23 - EOD 25 = -2)` 

8 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

```
      "TestQty": 0,
      "MarketingQty": 0
    }
  ]
}
```

## **What the variance numbers mean:** 

- **Positive number (e.g., +5)** = You have 5 MORE units than EOD showed 

- **Negative number (e.g., -2)** = You have 2 FEWER units than EOD showed 

- **Zero** = Exactly matches EOD (no change) 

## **If it says "No message prepared yet":** 

- A message hasn't been submitted yet 

- Submit a form first, then check Queue Status 

## **2.** 🔄 **PhithanData Response (COLLAPSIBLE)** 

Shows whether your message successfully reached the **PhithanData queue** . 

## **What to look for:** 

## ✅ **SUCCESS response shows:** 

- Queue name (e.g., `shopcount-source-queue` for Stockcount) 

- Message ID (unique identifier for this submission) 

- Timestamp (when it was queued) 

## **Example:** 

✅ `Success Queue: shopcount-source-queue Message ID: msg-789abc456def123 Timestamp: 2026-04-27T14:30:15Z` 

## ❌ **ERROR response shows:** 

Error message explaining what went wrong 

Common errors: 

- "Invalid authentication" - Your login expired 

- "Queue not available" - Service is temporarily down 

- "Message format error" - Something wrong with the data 

## **Action if ERROR:** 

1. Check that you're still logged in (Login Info should show valid data) 

2. You might need to logout and login again 

9 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

3. Resubmit the form 

4. If error persists, contact your manager with the error message 

## **3.** 💊 **PhithanLife Response (COLLAPSIBLE)** 

Shows whether your message successfully reached the **PhithanLife queue** . 

## **What to look for:** 

   - ✅ **Success indicator** - Message was queued successfully 

   - ❌ **Error indicator** - Something went wrong with this queue 

- **Note:** Some organizations only use PhithanData queue, so PhithanLife might show "No response received yet" - that's normal if not configured. 

## **4.** ⚙ **Queue Configuration (COLLAPSIBLE - At Bottom)** 

Technical configuration details for troubleshooting. 

## **What you'll see:** 

- **Storage Account:** Where messages are being stored 

- **Queue Name:** The specific queue for this form type 

   - Sales: `shopsales-source-queue` 

   - Stockcount: `shopcount-source-queue` (receives EOD variance data) 

   - Receive: `shopreceive-source-queue` 

- **Authentication:** `JWT Bearer Token` (your login token is being used) 

- **Form Type:** The type of form you submitted 

**This section is mostly for IT support** - if your messages aren't going through, this info helps diagnose the problem. 

## ⏱ Timeout Settings 

## Token Validity 

Your login token is valid for **3600 seconds (1 hour)** 

- After 1 hour of inactivity, you'll be automatically logged out 

- The app will show a warning 5 minutes before timeout 

- Simply login again to continue 

## Inactivity Timer 

The app tracks your activity on each page 

- After 60 minutes of no activity, you're automatically logged out 

- This is for security on shared devices 

10 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## Important Rules 

## ⚠ Quantity Requirements 

- **ALL THREE quantity fields must NOT be zero at the same time** (for Sales Qty & below) 

- At least one must have a number greater than 0 (or less than 0 for variance) 

- If you try to add with all zeros, you'll see: "❌ At least one quantity must be greater than 0" 

## ⚠ Understanding EOD Qty (Read-Only) 

**You CANNOT edit the EOD Qty field** - it's read-only (grayed out) 

- EOD Qty is for **reference only** (to help you calculate variance) 

- Use it to determine what to enter in the **Sales Qty** field 

- EOD Qty shows yesterday's end-of-day inventory 

## ⚠ Variance Accuracy (Stockcount) 

**Always verify the variance is correct** before submitting 

- If you counted more than EOD → enter positive number 

- If you counted less than EOD → enter negative number 

- If someone questions your counts, you have proof (EOD data) 

## ⚠ Switching Between Forms 

- If you have products in your batch and switch forms, **all unsaved products will be deleted** 

- A confirmation popup will ask you to confirm 

- Always submit before switching to another form 

## ⚠ Transfer Number (Receive Form Only) 

Must be exact match 

- Must belong to your selected shop 

If wrong, you'll see an error and need to try again 

## What Happens When You Submit? 

## Before Submission 

1. You review all details on the Review screen 

2. You can see a preview of the message (JSON format) 

3. **For Stockcount:** Verify the variance values are correct (check negative signs!) 

4. You tap 📤 **Submit to Queue** 

## During Submission 

- The app sends your message to the queue 

- Wait for confirmation (usually 2-5 seconds) 

## Success ✅ 

11 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

- You'll see a **green success message** with your Submission ID 

- The Submission ID format: `SUB-2026-MM-DD-###` 

- Your data has been sent to the queue 

- You can now: 

   - ↩ **Back to Form Selection** - to fill out another form 

   - 🚪 **Back to Login** - to logout 

   - 📊 **QUEUE** - to see detailed queue status 

## After Successful Submission 

Your product list **automatically clears** 

- Your notes **clear** 

You're ready to create a new batch 

## Offline Capability (The Best Feature! 📡❌ → ✅) 

## What is Offline Mode? 

When you don't have internet, the app still works! You can: 

- ✅ Fill out forms 

- ✅ Add products 

- ✅ See EOD Qty from cache (instant, no internet!) 

- ✅ Enter quantities and variance 

- ✅ Write notes 

## What Happens When You're Offline? 

- The app will **cache your login data + EOD data** the first time you login online 

- When offline, you can **use the app normally** , including viewing EOD Qty 

- When internet returns, your submitted messages **will be sent automatically** 

- Queue Status page will update once messages are confirmed queued 

## ⚠ Important Offline Notes 

**You must login at least once while online** for offline mode to work 

- Your **initial login requires internet** to verify credentials 

- Once logged in, you can work offline for several sessions 

- Keep your browser open - don't clear cache 

- **EOD Qty lookups work completely offline** (cached at login time) 

- When back online, submitted messages will automatically sync 

## Logging Out 

## To Logout: 

1. Tap the 🚪 **Logout** button (appears in most screens) 

2. Confirm "Are you sure?" popup 

12 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

3. Your session ends 

4. You'll return to the login screen 

## What Gets Cleared on Logout: 

- ✅ Your current batch (unsaved products) 

- ✅ Your notes 

- ✅ Your session token 

- ✅ Your temporary session data 

**Note:** Your cached data (EOD data) remains for offline use if you login again 

## Common Questions & Troubleshooting 

## Q: What if I see "❌ Authentication failed"? 

## **A:** 

Check username and password spelling 

Make sure CAPS LOCK is off 

Ask manager to verify credentials 

Try again in 30 seconds 

## Q: How do I know what Qty to enter in Stockcount? 

## **A:** (NEW with EOD!) 

1. Look at the **EOD Qty field** (automatically filled) 

2. Count what's actually in the shop 

3. **Calculate variance:** Physical Count - EOD Qty 

4. Enter the variance in **Sales Qty** field 

5. Example: You have 12, EOD shows 10 → Enter 2 

## Q: What if the EOD Qty shows "N/A"? 

## **A:** 

The product might not have been in stock yesterday 

- Or it's a new product added after yesterday's EOD You can still count it - just note in the Notes field Enter your physical count as the Sales Qty The backend system will track it appropriately 

## Q: What if EOD Qty seems wrong? 

## **A:** 

Look at the EOD data as-is (it came from yesterday's system) 

13 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

- The backend might have had a data issue 

- Still enter the variance based on what you count today 

- Add a note explaining the discrepancy (e.g., "EOD showed 50, but only found 5") 

- Your manager can investigate 

## Q: What if I made a mistake entering a product? 

## **A:** 

Tap the ✕ button next to the product in "Products in Batch" 

- Add the correct product instead 

- Re-enter quantities correctly 

- Submit again 

## Q: What if I accidentally submitted with wrong data? 

## **A:** 

The data has already been sent to the queue 

- **Contact your manager immediately** with your Submission ID 

- They can help correct it in the backend system 

Your Submission ID is shown in the success message 

## Q: What if the Queue Status page shows PhithanData "No response received yet"? 

## **A:** 

Your message was submitted but hasn't been processed yet 

- Wait a few seconds and refresh the page 

- The queue processes messages in order 

- If still no response after 1 minute, it might be stuck 

- Take a screenshot and contact your manager 

## Q: What if the Queue Status shows an ERROR in PhithanData? 

## **A:** 

Your message format might be invalid 

Your authentication token might have expired 

- The queue service might be down 

## **Try:** 

1. Logout completely 

2. Login again (this refreshes your token and EOD data) 

3. Resubmit the form 

4. If still failing, contact your manager with the error message 

14 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## Q: What does the Submission ID mean? 

## **A:** 

Unique identifier for each batch you submit 

Format: `SUB-YYYY-MM-DD-###` (date and sequence number) 

Save this ID if there are problems 

Use it when contacting support 

Helps track your batch through the system 

## Q: Why do I see different queues (PhithanData vs PhithanLife)? 

## **A:** 

Your data is sent to multiple systems for redundancy 

PhithanData is one inventory system 

PhithanLife is another inventory system 

Both should show success for complete processing 

If one fails, your manager will see it in the admin panel 

## Q: What if I lose internet mid-way through a form? 

## **A:** 

## **Don't refresh the page** 

Keep filling out the form with cached data 

You can still see EOD Qty (it's cached!) 

When internet returns, the submit button will work 

Your data will be queued 

You can then check Queue Status once back online 

## Q: What if I select the wrong shop? 

## **A:** 

Tap the **← Back** button (appears in form selection or data entry screens) You'll return to the login page 

Tap the **Shop dropdown** to select a different shop 

- Choose the correct shop 

No need to logout! 

The EOD data will automatically re-filter for the new shop 

## Q: Can I work on multiple forms at once? 

## **A:** 

**No** - only one form type at a time 

15 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

Finish and submit one form completely 

- Then go back and select a different form 

- Switching forms deletes unsaved products 

## Q: What do the Login Info display numbers mean? 

## **A:** 

- **Token Valid:** How many seconds your login is still valid (typically 3600 = 1 hour) 

- **Shops:** How many shops you have access to 

- **Products:** Total products in the system 

- **Reorders:** How many pending reorder transfers exist 

These numbers help confirm you have the right permissions 

- **EOD Cache:** Pre-calculated and ready for use 

## Q: Is my data secure? 

## **A:** 

- ✅ Login requires authentication 

- ✅ Data is encrypted in transit 

- ✅ Service worker caches only locally on your phone 

- ✅ EOD data is cached locally (not transmitted repeatedly) 

- ✅ Logout clears your session 

- ⚠ Don't share your password 

- ⚠ Logout when done if using shared device 

## Q: What if the page freezes or becomes unresponsive? 

## **A:** 

Close the browser tab 

- Reopen the URL 

- Login again 

Your unsaved batch will be lost, but cached data (EOD) is intact 

- Start fresh 

If it keeps freezing, contact your manager 

## Q: Can I use EOD Qty with Sales or Receive forms? 

## **A:** 

**No** - EOD Qty is only for **Stockcount form** 

Sales and Receive forms don't use EOD data 

Only Stockcount benefits from variance calculation with EOD 

16 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## Tips for Success 🎯 

## Before You Start 

1. **Have your shop name ready** 

2. **Gather all product information** (barcodes, quantities) 

3. **For StockReceive: Have transfer number available** 

4. **Ensure good internet connection** for initial login 

## During Data Entry 

1. **Check the EOD Qty first** (before entering your physical count) 

2. **Count carefully** - accuracy matters for inventory tracking 

3. **Calculate variance correctly** - use the formula: Physical - EOD = Variance 

4. **Double-check signs** - negative numbers show shortages! 

5. **Use the quantity validation** - it prevents mistakes 

6. **Add notes for anything unusual** - helps the team explain variances 

7. **Submit as soon as batch is complete** - don't wait 

## For EOD Stockcount (NEW!) 

## 1. **Understanding Variance:** 

   - More than EOD? → Enter positive number 

   - Less than EOD? → Enter negative number Same as EOD? → Enter 0 

2. **The EOD Qty field is read-only** - you can't edit it 

3. **Use EOD Qty as a reference** to calculate what to enter 

4. **Keep the Notes field updated** with explanations for large variances 

5. **Always verify before submitting** - check negative signs! 

## For Queue Troubleshooting 

1. **Check Queue Status page** after every submission 

2. **Verify Message Preview is correct** (for Stockcount: check variance numbers) 

3. **Look for negative signs** in the JSON preview (if you had shortages) 

4. **Save your Submission ID** from the success message 

5. **When both PhithanData and PhithanLife show Success** ✅ - you're all set 

6. **If you see any ERROR** - logout/login and resubmit 

## Best Practices 

1. **Login to the app once per shift** (on a device with internet) 

2. **Work offline as much as possible** - no data fees 

3. **Check Queue Status** for peace of mind after important submissions 

4. **Save your Submission IDs** - for tracking 

5. **Report errors immediately** to your manager 

6. **Logout at end of day** - especially on shared devices 

7. **Verify EOD Qty matches your expectations** - if it seems wrong, note it 

17 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## Emergency Support 

## If Something Goes Wrong: 

## 1. **Check the Queue Status page first:** 

Is the Message Preview correct? 

- For Stockcount: Are the variance numbers correct? 

- What do the PhithanData and PhithanLife responses say? 

## 2. **If Queue Status shows errors:** 

Try logging out and back in (refreshes EOD cache) 

- Resubmit the form 

Check Queue Status again 

## 3. **If problems persist, contact your manager with:** 

Your Submission ID (from success message) 

- Screenshot of the error message 

- Screenshot of Queue Status if showing errors 

- For Stockcount: Screenshot of the variance values entered 

- What form you were using 

- What step you were on 

- The date and time it happened 

- Whether you were online or offline 

## Summary of Three Forms 

|**Form**|**When**|**Main Fields**|**Quantities**|**EOD Qty**|**Transfer #**|
|---|---|---|---|---|---|
|**Shop Sales** 💰|Selling from<br>shop|Product, Barcode,<br>Desc|SSOLD, SPSOLD,<br>Mkt|N/A|N/A|
|**Shop Stockcount**<br>📦|Counting<br>inventory|Product, Barcode,<br>Desc|Sales (Variance),<br>Test, Mkt|✅<br>AUTO-<br>FILL|N/A|
|**Shop**<br>**StockReceive** 📥|Receiving<br>reorder|Transfer #,<br>Product, Barcode|Sales, Test, Mkt|N/A|✅<br>REQUIRED|



## Technical Details (For Advanced Users) 

## Message Format 

Your submission is automatically converted to JSON format with: 

**Header:** Metadata about your submission (user, shop, timestamp, etc.) 

- **Products:** Array of products with quantities 

18 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

## Queue Types 

- **shopsales-source-queue:** Receives Shop Sales form submissions 

- **shopcount-source-queue:** Receives Shop Stockcount form submissions (with variance from EOD) **shopreceive-source-queue:** Receives Shop StockReceive form submissions 

## EOD Data Structure 

EOD data cached at login contains: 

```
{
  "location": "WS Tesco Changwattana(673)",
  "locationID": "WL 673",
  "item": "SK-C-103",
  "barcode": "8859109850038",
  "eodDate": "2026-04-26",
  "eodQty": 9
}
```

## Variance Calculation 

```
Variance = Physical Count (what you counted) - EOD Qty (yesterday's inventory)
Examples:
- Counted 15, EOD was 12 → Variance = 15 - 12 = +3 (3 extra units)
- Counted 10, EOD was 12 → Variance = 10 - 12 = -2 (2 short)
- Counted 12, EOD was 12 → Variance = 12 - 12 = 0 (no change)
```

**Last Updated:** April 27, 2026 **Document Version:** 1.0 (With EOD Support) **Audience:** Phone2Queue End-Users 

**Features:** Three forms + Queue Status + EOD Inventory Support 

## Key Differences from Previous Version 

- ✅ **NEW:** EOD Qty field automatically populated in Stockcount form 

- ✅ **NEW:** Understanding variance calculation with EOD data 

- ✅ **NEW:** Offline capability for EOD lookups (completely cached at login) 

- ✅ **UPDATED:** Stockcount section expanded to explain EOD workflow 

- ✅ **UPDATED:** Quantity rules now include variance (positive/negative numbers) 

- ✅ **UPDATED:** Message Preview section shows variance examples 

- ✅ **UPDATED:** Troubleshooting section includes EOD FAQ 

For questions or issues, contact your manager with your **Submission ID** and one of the following: 

19 / 20 

Phone2QueueOffline_EOD_User_Manual.md 

2026-04-27 

- Screenshot of the Queue Status page 

- Screenshot of the error message 

- Description of what went wrong Date, time, and which form you were using 

20 / 20 

