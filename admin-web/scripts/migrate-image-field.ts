/**
 * Migration script to rename imageURL to imageUrl in Firestore
 * Run this from admin-web or a Node.js environment with proper Firebase credentials
 */

import {
  collection,
  doc,
  getDocs,
  getFirestore,
  updateDoc,
} from "firebase/firestore";

// Initialize Firebase (use your config from admin-web)
// This script should be run from the admin-web directory with proper credentials

async function migrateProductImages() {
  console.log("🔄 Starting migration: imageURL -> imageUrl");

  try {
    const db = getFirestore();

    // Get all products
    const productsRef = collection(db, "products");
    const snapshot = await getDocs(productsRef);

    console.log(`📦 Found ${snapshot.size} products`);

    let updated = 0;
    let skipped = 0;

    for (const productDoc of snapshot.docs) {
      const data = productDoc.data();

      // Check if has imageURL but not imageUrl
      if (data.imageURL && !data.imageUrl) {
        console.log(`✏️ Migrating ${productDoc.id} (${data.productId})`);

        await updateDoc(doc(db, "products", productDoc.id), {
          imageUrl: data.imageURL, // Copy to new field
          // Optionally remove old field: imageURL: deleteField()
        });

        updated++;
      } else if (data.imageUrl) {
        console.log(`✅ Already migrated: ${productDoc.id}`);
        skipped++;
      } else {
        console.log(`⏭️ No image: ${productDoc.id}`);
        skipped++;
      }
    }

    console.log("\n📊 Migration complete!");
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️ Skipped: ${skipped}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
if (require.main === module) {
  migrateProductImages()
    .then(() => {
      console.log("\n✨ Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Error:", error);
      process.exit(1);
    });
}

export { migrateProductImages };
