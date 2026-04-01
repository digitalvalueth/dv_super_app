---------- Forwarded message ---------
จาก: paulleong paulleong <paulleong@phithanlife.com>
Date: พฤหัส 19 มี.ค. 2026 เวลา 13:46
Subject: Fwd: Draft 'PAShopCount' schemer
To: thitareec thitareec <thitareec@phithanlife.com>
Cc: Wayne Zhou <waynezhou@eitsystems.com.au>

Hi Muay :

For the Shop Stock Count process, we will need the following data sets to enter into ITP. These data will be enter by the PhoneApp AI Agent into the SQL Table 'PAShopCount'

     "SubmissionID": "7f23c2c2-6a0c-4f9e-b1f7-1d66a12e6c8b",
     "LocationID": " WL 749 ",

    "CounterID": "C00049",
    "CounterName": "น.ส. จิราพัชร ขุนสิทธิ์",
    "CountDate": "2024-05-21T15:20:00Z",


    "Item" : "SK-Test"                       ------     from the AI Agent.
    "Barcode" : "177658935452"     ------     from the AI Agent.
    "Total Qty" : 6,                            ------     from the AI Agent.

     "SellQty" : 2                                ------     Placeholder
     "TestQty" : 4                               ------     Placeholder

'PAShopCount' Table schemer

SubmissionID VARCHAR(50) PRIMARY KEY,

    LocationID                                 NVARCHAR(100) NOT NULL,



    CounterID                                 NVARCHAR(50),

    CounterName                          NVARCHAR(100),

    CountDate                                DATETIME NOT NULL,



    Item                                              VARCHAR(50) NOT NULL,  ----   from AI Agent

    Barcode                                       VARCHAR(50) NOT NULL, ----   from AI Agent

    PATotalQty                                  INT NOT NULL,                         ----   from AI Agent

    PASellQty                                    INT,  ------ Place holder

    PATestQty                                    INT ------ Place holder

ITP will process these data sets and update a ShopCountStaging Table for the Phone App to display . The Phone app will display these data sets via a PhoneApp page.
The ShopCountStaging Table will contain data for a rolling two-month period.

ITEM
EOD -- EOD is a function of Daily Entry SSOLD which a nightly process updates, so it cannot be a dynamic calculation.The Table will be updated nightly, provided there is no Daily SSOLD to process on the days before the Shop Stock Count event.
TotalQty
SellQty
TestQty
Variance
Location
Date

There will be a new page to replace the existing Stock Count tab in Daily Entry.

image.png

Regards

Paul Leong

--
Best regards,

Thitaree Chaiphatrattana (Muay)
Tel : 02-6520511 Fax : 02-6520522
Mobile : 093-3969782

www.primanest.com
