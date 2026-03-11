import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/prompts/seed
 * Seed the promptTemplates collection with hardcoded prompts from gemini.service.ts
 * Only admin/super_admin can call this.
 */

const SEED_PROMPTS = [
  {
    name: "barcode_scanner",
    description:
      "สแกนบาร์โค้ดจากรูปภาพ — รองรับทั้งแบบมีและไม่มี expected barcode (unified prompt)",
    prompt: `You are a barcode scanner, NOT a product counter.

Your ONLY task is to detect PHYSICAL barcode stickers visible in the image.

{{expectedBarcodeSection}}

STRICT RULES:
1. Count ALL physical barcode stickers visible in the image. Report the total as "count".
2. Even if all barcodes show the SAME digits, count them all and list unique values only.
3. DO NOT estimate. DO NOT guess hidden items.
4. DO NOT count boxes without visible barcode stickers.
5. DO NOT assume grid patterns or infer hidden products.
6. Only include stickers that are PHYSICALLY VISIBLE in the image.
7. If part of a barcode is visible but clearly a real sticker, include it.
8. {{matchRule}}
9. barcodeMatch = false if showing a screen/monitor (FRAUD).

CRITICAL: If unsure whether something is a barcode sticker, DO NOT include it.

Return ONLY valid JSON:
{
  "barcodeMatch": true,
  "matchedBarcode": "<matched digits or empty string if no match>",
  "count": <total number of barcode stickers visible as integer>,
  "detectedBarcodes": ["<unique barcode value(s) found>"]
}`,
    modelId: "gemini-3-flash-preview",
    category: "barcode",
    platform: "mobile",
    variables: ["expectedBarcodeSection", "matchRule"],
  },
  {
    name: "product_counter",
    description:
      "นับจำนวนสินค้าจากรูปภาพ — ใช้สำหรับ countProductsInImage (web/backup)",
    prompt: `You are an expert product counter. Count the total number of "{{productName}}" products visible in this image.

{{productDescriptionLine}}

Instructions:
1. Count ALL visible items of this specific product
2. Count items that are partially visible or stacked
3. Do NOT count different products, only "{{productName}}"
4. Be accurate and precise

Return ONLY the total count as a number. If you cannot count or there are no products, return 0.

Example response: "15" or "0"`,
    modelId: "gemini-2.5-flash",
    category: "counting",
    platform: "all",
    variables: ["productName", "productDescriptionLine"],
  },
];

export async function POST(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Check role
    const db = adminDb;
    let userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      const snap = await db
        .collection("users")
        .where("uid", "==", uid)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      userDoc = snap.docs[0];
    }

    const userData = userDoc.data();
    if (!userData || !["super_admin", "admin"].includes(userData.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if already seeded
    const existing = await db.collection("promptTemplates").limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({
        message: "Prompts already exist. Use the admin UI to manage them.",
        count: (await db.collection("promptTemplates").get()).size,
      });
    }

    // Seed prompts
    const batch = db.batch();
    const results: string[] = [];

    for (const seed of SEED_PROMPTS) {
      const ref = db.collection("promptTemplates").doc();
      batch.set(ref, {
        name: seed.name,
        description: seed.description,
        prompt: seed.prompt,
        modelId: seed.modelId,
        version: 1,
        isActive: true,
        platform: seed.platform,
        category: seed.category,
        variables: seed.variables,
        createdBy: uid,
        createdByName: userData.displayName || userData.email || "Admin",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      results.push(seed.name);
    }

    await batch.commit();

    return NextResponse.json({
      message: `Seeded ${results.length} prompt templates`,
      prompts: results,
    });
  } catch (error: any) {
    console.error("Error seeding prompts:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
