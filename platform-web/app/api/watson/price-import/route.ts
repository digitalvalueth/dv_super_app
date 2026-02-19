import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { PriceListItem } from "@/types/watson/pricelist";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// Helper to sanitize object keys
const sanitizeKeys = (row: any): any => {
  const newRow: any = {};
  Object.keys(row).forEach((key) => {
    const cleanKey = key.trim().replace(/\u00a0/g, " ");
    newRow[cleanKey] = row[key];
  });
  return newRow;
};

// Helper: safe number parsing
const safeNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[฿$,\s]/g, "").trim();
    if (!cleaned) return 0;
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Helper: Excel date parsing
const parseExcelDate = (dateVal: any): string => {
  if (!dateVal) return "";
  if (typeof dateVal === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateVal * 86400000);
    return date.toISOString();
  } else if (typeof dateVal === "string" && dateVal.trim()) {
    const trimmed = dateVal.trim();
    const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
      ).toISOString();
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return "";
};

// Helper to find value with variants
const findVal = (row: any, ...variants: string[]): any => {
  for (const v of variants) {
    if (row[v] !== undefined && row[v] !== null) return row[v];
  }
  const normalize = (s: string) =>
    s.toLowerCase().replace(/\s+/g, "").replace(/%/g, "pct");
  const rowKeys = Object.keys(row);
  for (const v of variants) {
    const nv = normalize(v);
    for (const k of rowKeys) {
      if (normalize(k) === nv) return row[k];
    }
  }
  return undefined;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const uploaderJson = formData.get("uploader") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const uploader = uploaderJson ? JSON.parse(uploaderJson) : undefined;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read as 2D array first to find the header row
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    // Find header row index by scanning for known keywords
    let headerRowIndex = 0;
    const itemCodeKeywords = [
      "Item Code",
      "ItemCode",
      "Material",
      "Piece",
      "Piece No",
      "Part Number",
      "Watson Code",
      "Barcode",
    ];

    for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
      const hasKeyword = itemCodeKeywords.some((kw) =>
        rawRows[i].some((cell: any) =>
          String(cell).toLowerCase().includes(kw.toLowerCase()),
        ),
      );
      if (hasKeyword) {
        headerRowIndex = i;
        console.log(`Found header at row ${i}:`, rawRows[i]);
        break;
      }
    }

    // Convert to objects using the found header row
    const rawData = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });

    // DEBUG: Log headers of first parsed row
    if (rawData.length > 0) {
      console.log(
        "Price Import Debug - First Row Keys:",
        Object.keys(rawData[0] as object),
      );
    }

    // Process data
    const priceListItems: PriceListItem[] = rawData
      .map((rawRow: any, index: number) => {
        const row = sanitizeKeys(rawRow);

        const itemCode = String(
          findVal(
            row,
            "Item Code",
            "ItemCode",
            "Material",
            "Piece",
            "Piece No",
            "Part Number",
            "Watson Code",
            "Barcode",
          ) ?? "",
        ).trim();
        const prodCode = String(
          findVal(row, "Product Code", "ProdCode", "Article", "Prod Code") ??
            "",
        ).trim();
        const prodName = String(
          findVal(
            row,
            "Description",
            "Item Name",
            "Material Description",
            "ItemName",
            "itemName",
            "prodName",
            "Prod Name",
            "ProdName",
          ) ?? "",
        ).trim();

        // Dates
        const priceStartDate = parseExcelDate(
          findVal(
            row,
            "Valid From",
            "Start Date",
            "StartDate",
            "ValidFrom",
            "Start",
          ),
        );
        const priceEndDate = parseExcelDate(
          findVal(row, "Valid To", "End Date", "EndDate", "ValidTo", "End"),
        );

        // Prices
        const standardPriceIncV = safeNumber(
          findVal(
            row,
            "Standard Price (Inc.V)",
            "Std Price Inc",
            "price",
            "Price",
            "StandardPriceIncV",
            "Standard Price IncV",
            "Standard Price",
          ),
        );
        const commPriceIncV = safeNumber(
          findVal(
            row,
            "Comm. Price (Inc.V)",
            "Comm Price Inc",
            "Comm Price IncV",
            "CommPriceIncV",
            "Comm Price",
            "priceIncVat",
            "Price Inc VAT",
          ),
        );
        const invoice62IncV = safeNumber(
          findVal(
            row,
            "Invoice 62% (Inc.V)",
            "Invoice 62% IncV",
            "Invoice 62%  IncV",
            "Invoice62IncV",
            "Invoce62% IncV",
          ),
        );
        const invoice62ExcV = safeNumber(
          findVal(
            row,
            "Invoice 62% ExcV",
            "Incoice 62% ExV",
            "Invoice 62%  ExcV",
            "Invoice62ExcV",
            "Invoice 62% ExV",
          ),
        );

        const remark = String(
          findVal(row, "Remark", "remark", "Remark1") ?? "",
        );
        const remark2 = String(findVal(row, "remarki2", "Remark2") ?? "");

        // Logic from PriceListSidebar
        const priceIncVat = commPriceIncV || standardPriceIncV;
        // Fallback calculation if ExcV is missing: IncV / 1.07
        const priceExtVat = invoice62ExcV || priceIncVat / 1.07;

        const item: PriceListItem = {
          itemCode,
          prodCode,
          prodName,
          priceStartDate,
          priceEndDate,
          qty: safeNumber(findVal(row, "qty", "Qty", "QTY")) || 1,
          price: standardPriceIncV,
          discamti: safeNumber(findVal(row, "discamti", "Discount")),
          priceIncVat,
          priceExtVat,
          priceExtVatSt: safeNumber(findVal(row, "priceExtVatSt")),
          remarki1: remark,
          remarki2: remark2,
          standardPriceIncV,
          commPriceIncV,
          invoice62IncV,
          invoice62ExcV,
        };

        // DEBUG: Log first 3 rows to see what's being parsed
        if (index < 3) {
          console.log(`Row ${index} parsing:`, {
            itemCode,
            priceExtVat,
            priceIncVat,
          });
        }

        return item;
      })
      .filter(
        (item) =>
          item.itemCode && (item.priceExtVat > 0 || item.priceIncVat > 0),
      );

    if (priceListItems.length === 0) {
      console.log(
        "ALL ROWS FAILED VALIDATION. Total raw rows:",
        rawData.length,
      );
      return NextResponse.json(
        { error: "No valid price items found" },
        { status: 400 },
      );
    }

    // Save to Firebase Storage (JSON) using Admin SDK
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return NextResponse.json(
        { error: "Storage bucket not configured" },
        { status: 500 },
      );
    }

    const timestamp = Date.now();
    const dateStr = new Date().toISOString().split("T")[0];
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    const storagePath = `watson-price-imports/${dateStr}/${timestamp}_${fileNameWithoutExt}.json`;

    const bucket = adminStorage.bucket(bucketName);
    const storageFile = bucket.file(storagePath);
    const jsonString = JSON.stringify({ data: priceListItems });

    await storageFile.save(jsonString, {
      contentType: "application/json",
      metadata: { contentType: "application/json" },
    });

    const storageUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;

    // Save metadata to Firestore using Admin SDK
    const docRef = await adminDb
      .collection(COLLECTIONS.PRICE_IMPORT_HISTORY)
      .add({
        fileName: file.name,
        importedAt: new Date().toISOString(),
        itemCount: priceListItems.length,
        source: "excel",
        storagePath,
        storageUrl,
        uploader: uploader ?? null,
        createdAt: Timestamp.now(),
      });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      itemCount: priceListItems.length,
      data: priceListItems,
    });
  } catch (error) {
    console.error("Error processing price list upload:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
