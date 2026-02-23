/**
 * update-seller-codes.ts
 * Match products in Firestore by barcode → update sellerCode only
 * Run: npx ts-node scripts/update-seller-codes.ts
 */

import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// Init Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(
    __dirname,
    "..",
    "fittbsa-798ba3e87223.json",
  );
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf-8"),
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    admin.initializeApp({
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
}

const databaseId = process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";
const db = admin.firestore();
if (databaseId !== "(default)") {
  db.settings({ databaseId });
}

interface ProductJSON {
  itemCode: string;
  description: string;
  barcode: string;
  sellerCode: string | null;
}

async function updateSellerCodes() {
  // Load JSON
  const jsonPath = path.join(
    __dirname,
    "..",
    "platform-web",
    "all_prod_2026.json",
  );
  const productsJSON: ProductJSON[] = JSON.parse(
    fs.readFileSync(jsonPath, "utf-8"),
  );

  // Build barcode → sellerCode map (trim whitespace)
  const barcodeMap = new Map<string, string | null>();
  for (const item of productsJSON) {
    const barcode = item.barcode?.trim();
    const sellerCode = item.sellerCode?.trim() || null;
    if (barcode) {
      // If barcode already in map, prefer non-null sellerCode
      if (!barcodeMap.has(barcode) || sellerCode) {
        barcodeMap.set(barcode, sellerCode);
      }
    }
  }

  console.log(`\n📦 Loaded ${barcodeMap.size} unique barcodes from JSON`);
  console.log(`🔄 Fetching all products from Firestore...`);

  // Fetch all products
  const snapshot = await db.collection("products").get();
  console.log(`📋 Found ${snapshot.size} products in Firestore\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  // Process in batches of 500 (Firestore batch limit)
  const BATCH_SIZE = 499;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const barcode = data.barcode?.trim();

    if (!barcode) {
      skipped++;
      continue;
    }

    if (!barcodeMap.has(barcode)) {
      console.log(
        `⚠️  No match in JSON for barcode: ${barcode} (${data.name?.substring(0, 40)})`,
      );
      notFound++;
      continue;
    }

    const sellerCode = barcodeMap.get(barcode);

    // Skip if already has the same sellerCode
    if (data.sellerCode === sellerCode) {
      skipped++;
      continue;
    }

    batch.update(docSnap.ref, {
      sellerCode: sellerCode,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    batchCount++;
    updated++;

    // Commit batch when limit reached
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   ✅ Committed batch of ${batchCount}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n📊 Done!`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped (already correct): ${skipped}`);
  console.log(`   ❓ Not found in JSON: ${notFound}`);
}

updateSellerCodes().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
