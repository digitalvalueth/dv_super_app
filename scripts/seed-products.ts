import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config();

// Get company ID from command line arguments
const companyId = process.argv[2];

if (!companyId) {
  console.error("❌ Please provide company ID as argument");
  console.log("\nUsage: npm run seed:products -- <company-id>");
  console.log("\nExample:");
  console.log("  npm run seed:products -- abc123xyz789");
  process.exit(1);
}

console.log("🔑 Initializing Firebase Admin SDK...");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccountPath = path.join(
    __dirname,
    "..",
    "fittbsa-798ba3e87223.json",
  );

  if (fs.existsSync(serviceAccountPath)) {
    console.log("✅ Using service account file");
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf-8"),
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    console.error("❌ Service account file not found!");
    process.exit(1);
  }
}

// Initialize Firestore with named database
const databaseId = process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";
const db = admin.firestore();
if (databaseId !== "(default)") {
  db.settings({ databaseId: databaseId });
  console.log(`✅ Connected to database: ${databaseId}`);
}

interface Product {
  id: string;
  name: string;
  barcode: string;
  sellerCode: string | null;
  description: string;
  category: string;
  companyId: string;
  imageUrl?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface ProductJSON {
  itemCode: string;
  description: string;
  barcode: string;
  sellerCode: string | null;
}

// Parse products JSON file
function parseProductsJSON(filePath: string, companyId: string): Product[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Products file not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const productsJSON: ProductJSON[] = JSON.parse(content);

  const products: Product[] = [];

  for (const item of productsJSON) {
    const itemCode = item.itemCode?.trim();
    const description = item.description?.trim();
    const barcode = item.barcode?.trim();
    const sellerCode = item.sellerCode?.trim() || null;

    if (itemCode && description && barcode) {
      products.push({
        id: itemCode,
        name: description,
        barcode: barcode,
        sellerCode: sellerCode,
        description: description,
        category: itemCode.split("-")[0]?.trim() || "UNKNOWN",
        companyId: companyId,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
  }

  return products;
}

async function seedProducts() {
  try {
    console.log("\n📦 Starting to seed products...");
    console.log(`🏢 Company ID: ${companyId}\n`);

    // Verify company exists
    const companyDoc = await db.collection("companies").doc(companyId).get();

    if (!companyDoc.exists) {
      console.error("❌ Company not found!");
      console.log("\nPlease run: npm run seed:companies");
      console.log("Then use the company ID from the output");
      process.exit(1);
    }

    const companyData = companyDoc.data();
    console.log(
      `✅ Found company: ${companyData?.name} (${companyData?.code})\n`,
    );

    // Parse products from JSON
    const productsPath = path.join(
      __dirname,
      "..",
      "platform-web",
      "all_prod_2026.json",
    );

    console.log(`📄 Reading products from: all_prod_2026.json`);
    const products = parseProductsJSON(productsPath, companyId);

    if (products.length === 0) {
      console.error("❌ No products found in JSON file!");
      process.exit(1);
    }

    console.log(`✅ Found ${products.length} products to import\n`);

    // Check for existing products
    console.log("🔍 Checking for existing products...");
    const existingProducts = await db
      .collection("products")
      .where("companyId", "==", companyId)
      .get();

    const existingProductIds = new Set(
      existingProducts.docs.map((doc) => doc.data().productId),
    );

    console.log(`   Found ${existingProductIds.size} existing products`);
    console.log(
      `   Will create ${products.length - existingProductIds.size} new products\n`,
    );

    // Create products
    console.log("📝 Creating products in Firestore...\n");

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const batchSize = 500; // Firestore batch write limit

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = db.batch();
      const batchProducts = products.slice(i, i + batchSize);
      let batchAddCount = 0;

      for (const product of batchProducts) {
        // Skip if already exists
        if (existingProductIds.has(product.id)) {
          skippedCount++;
          continue;
        }

        const productData: any = {
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          sellerCode: product.sellerCode,
          description: product.description,
          category: product.category,
          companyId: companyId,
          companyCode: companyData?.code || "",
          companyName: companyData?.name || "",
          status: "active",
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        };

        if (product.imageUrl) {
          productData.imageUrl = product.imageUrl;
        }

        const productRef = db.collection("products").doc();
        batch.set(productRef, productData);
        batchAddCount++;
      }

      if (batchAddCount > 0) {
        try {
          await batch.commit();
          successCount += batchAddCount;

          // Log progress
          const progress = Math.min(i + batchSize, products.length);
          const percentage = Math.round((progress / products.length) * 100);
          console.log(
            `   Progress: ${progress}/${products.length} (${percentage}%) - Created: ${successCount}`,
          );
        } catch (error) {
          errorCount += batchAddCount;
          console.error(`❌ Batch write failed:`, error);
        }
      }
    }

    console.log("\n🎉 Products seeding completed!\n");
    console.log("📊 Summary:");
    console.log(`   Company: ${companyData?.name} (${companyData?.code})`);
    console.log(`   ✅ Created: ${successCount}`);
    console.log(`   ⏭️  Skipped (already exists): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total in file: ${products.length}`);

    // Show category breakdown
    const categories = products.reduce(
      (acc, product) => {
        acc[product.category] = (acc[product.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log("\n📊 Products by category:");
    Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} products`);
      });

    console.log("\n📝 Products are ready to be assigned to employees!");
    console.log("   Next: Create assignments in the admin dashboard");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding products:", error);
    process.exit(1);
  }
}

// Run the seed script
seedProducts();
