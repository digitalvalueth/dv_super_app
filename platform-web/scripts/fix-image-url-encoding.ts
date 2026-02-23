/**
 * Migration script to fix Firebase Storage URL encoding
 * Converts unencoded URLs like /o/products/abc/file.jpg
 * to properly encoded /o/products%2Fabc%2Ffile.jpg
 *
 * Run this from admin-web directory:
 * npx tsx scripts/fix-image-url-encoding.ts
 */

import { config } from "dotenv";
import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

// Fix Firebase Storage URL encoding
function fixFirebaseStorageUrl(url: string): string {
  if (!url) return url;

  // Check if URL is already properly encoded
  if (url.includes("%2F")) {
    return url;
  }

  // Fix unencoded URLs by replacing / with %2F in the path segment
  // Example: /o/products/abc/file.jpg -> /o/products%2Fabc%2Ffile.jpg
  const match = url.match(/\/o\/([^?]+)/);
  if (match) {
    const path = match[1];
    const encodedPath = path.split("/").map(encodeURIComponent).join("%2F");
    const fixedUrl = url.replace(/\/o\/[^?]+/, `/o/${encodedPath}`);
    return fixedUrl;
  }

  return url;
}

async function fixImageUrlEncoding() {
  console.log("🔄 Starting migration: Fix image URL encoding");
  console.log("━".repeat(60));

  try {
    // Initialize Firebase with environment variables
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const app = initializeApp(firebaseConfig);
    const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;

    if (!databaseId) {
      throw new Error(
        "NEXT_PUBLIC_FIRESTORE_DATABASE_ID is not set in .env.local"
      );
    }

    console.log(`📊 Using Firestore database: ${databaseId}`);
    const db = getFirestore(app, databaseId);

    // Get all products
    const productsRef = collection(db, "products");
    const snapshot = await getDocs(productsRef);

    console.log(`📦 Found ${snapshot.size} products to check\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const productDoc of snapshot.docs) {
      const data = productDoc.data();
      const productId = data.productId || productDoc.id;

      if (!data.imageUrl) {
        console.log(`⏭️  ${productId}: No image URL`);
        skipped++;
        continue;
      }

      const originalUrl = data.imageUrl;
      const fixedUrl = fixFirebaseStorageUrl(originalUrl);

      // Check if URL needs fixing
      if (originalUrl === fixedUrl) {
        console.log(`✅ ${productId}: Already correct`);
        skipped++;
        continue;
      }

      try {
        console.log(`🔧 ${productId}:`);
        console.log(`   Before: ${originalUrl}`);
        console.log(`   After:  ${fixedUrl}`);

        await updateDoc(doc(db, "products", productDoc.id), {
          imageUrl: fixedUrl,
        });

        console.log(`   ✓ Updated successfully\n`);
        updated++;
      } catch (error) {
        console.error(`   ✗ Error updating:`, error);
        errors++;
      }
    }

    console.log("\n" + "━".repeat(60));
    console.log("📊 Migration Summary:");
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    if (errors > 0) {
      console.log(`  ❌ Errors:  ${errors}`);
    }
    console.log("━".repeat(60));

    if (errors > 0) {
      throw new Error(`Migration completed with ${errors} error(s)`);
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
if (require.main === module) {
  fixImageUrlEncoding()
    .then(() => {
      console.log("\n✨ Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed with error:", error);
      process.exit(1);
    });
}

export { fixImageUrlEncoding };
