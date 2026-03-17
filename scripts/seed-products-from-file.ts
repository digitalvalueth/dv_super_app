import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const companyId = process.argv[2];
const productListPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(__dirname, "..", "doc_prompt", "products.txt");
const databaseId =
  process.argv[4] ||
  process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID ||
  "fittsuperapp-dev";

if (!companyId) {
  console.error("❌ Please provide company ID as argument");
  console.log(
    "\nUsage: npm run seed:products:file -- <company-id> [products-file] [database-id]",
  );
  console.log(
    "\nExample: npm run seed:products:file -- W7GjlYrhQRAay97D3JjT doc_prompt/products.txt fittsuperapp-prod",
  );
  process.exit(1);
}

if (!fs.existsSync(productListPath)) {
  console.error(`❌ Products list file not found: ${productListPath}`);
  process.exit(1);
}

const serviceAccountPath = path.join(
  __dirname,
  "..",
  "fittbsa-798ba3e87223.json",
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account file not found: ${serviceAccountPath}`);
  process.exit(1);
}

console.log("🔑 Initializing Firebase Admin SDK...");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf-8"),
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "fittbsa",
  });
}

const db = admin.firestore();
db.settings({ databaseId });

interface ProductListEntry {
  productId: string;
  barcode: string;
  description: string;
}

interface CatalogEntry {
  itemCode: string;
  description: string;
  barcode: string;
  sellerCode: string | null;
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProductList(filePath: string): ProductListEntry[] {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    const raw = JSON.parse(
      fs.readFileSync(filePath, "utf-8"),
    ) as ProductListEntry[];
    const entries = new Map<string, ProductListEntry>();

    for (const item of raw) {
      const productId = normalizeText(item.productId || "");
      const barcode = normalizeText(item.barcode || "").replace(/_/g, "");
      const description = normalizeText(item.description || "");

      if (!productId || !barcode || !description) {
        continue;
      }

      if (!entries.has(productId)) {
        entries.set(productId, { productId, barcode, description });
      }
    }

    return Array.from(entries.values());
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const entries = new Map<string, ProductListEntry>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = normalizeText(rawLine)
      .replace(/Untitled folder/g, "")
      .trim();

    if (!line) {
      continue;
    }

    const match = line.match(/^(SK-[A-Z]+-\d+)(?:_|\s+)([0-9_]+)\s+(.+)$/i);

    if (!match) {
      console.log(`⚠️  Skipping unrecognized line: ${rawLine}`);
      continue;
    }

    const productId = normalizeText(match[1]).replace(/_+$/g, "");
    const barcode = normalizeText(match[2]).replace(/_/g, "");
    const description = normalizeText(match[3]);

    if (!entries.has(productId)) {
      entries.set(productId, { productId, barcode, description });
    }
  }

  return Array.from(entries.values());
}

function getCatalogMap() {
  const catalogPath = path.join(
    __dirname,
    "..",
    "platform-web",
    "all_prod_2026.json",
  );

  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Catalog file not found: ${catalogPath}`);
  }

  const catalog = JSON.parse(
    fs.readFileSync(catalogPath, "utf-8"),
  ) as CatalogEntry[];

  return new Map(
    catalog.map((item) => [normalizeText(item.itemCode), item] as const),
  );
}

async function seedProductsFromFile() {
  try {
    console.log(`✅ Connected to database: ${databaseId}`);
    console.log(`🏢 Company ID: ${companyId}`);
    console.log(`📄 Product list: ${productListPath}`);

    const companyDoc = await db.collection("companies").doc(companyId).get();

    if (!companyDoc.exists) {
      console.error("❌ Company not found!");
      process.exit(1);
    }

    const companyData = companyDoc.data();
    console.log(
      `✅ Found company: ${companyData?.name || "Unknown"} (${companyData?.code || "-"})`,
    );

    const requestedProducts = parseProductList(productListPath);
    const catalogMap = getCatalogMap();

    if (requestedProducts.length === 0) {
      console.error("❌ No valid products found in file");
      process.exit(1);
    }

    console.log(
      `📦 Parsed ${requestedProducts.length} unique products from file`,
    );

    const existingSnapshot = await db
      .collection("products")
      .where("companyId", "==", companyId)
      .get();

    const existingProductIds = new Set(
      existingSnapshot.docs.map((doc) =>
        String(doc.data().productId || "").trim(),
      ),
    );

    let createdCount = 0;
    let skippedCount = 0;
    let fallbackCount = 0;
    const missingFromCatalog: string[] = [];
    const batchSize = 400;

    for (let i = 0; i < requestedProducts.length; i += batchSize) {
      const batch = db.batch();
      const slice = requestedProducts.slice(i, i + batchSize);
      let batchWrites = 0;

      for (const entry of slice) {
        if (existingProductIds.has(entry.productId)) {
          skippedCount++;
          continue;
        }

        const catalogEntry = catalogMap.get(entry.productId);
        if (!catalogEntry) {
          missingFromCatalog.push(entry.productId);
          fallbackCount++;
        }

        const name = normalizeText(
          catalogEntry?.description || entry.description,
        );
        const barcode = normalizeText(catalogEntry?.barcode || entry.barcode);
        const sellerCode = catalogEntry?.sellerCode?.trim() || null;

        const productData = {
          productId: entry.productId,
          name,
          barcode,
          sellerCode,
          description: name,
          category: entry.productId.split("-")[0]?.trim() || "UNKNOWN",
          companyId,
          companyCode: companyData?.code || "",
          companyName: companyData?.name || "",
          status: "active",
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        };

        const productRef = db.collection("products").doc();
        batch.set(productRef, productData);
        batchWrites++;
      }

      if (batchWrites > 0) {
        await batch.commit();
        createdCount += batchWrites;
      }
    }

    console.log("\n🎉 Product import completed\n");
    console.log(`Requested unique products : ${requestedProducts.length}`);
    console.log(`Created                  : ${createdCount}`);
    console.log(`Skipped existing         : ${skippedCount}`);
    console.log(`Fallback from text file  : ${fallbackCount}`);

    if (missingFromCatalog.length > 0) {
      console.log("\n⚠️  Missing from master catalog:");
      for (const productId of missingFromCatalog) {
        console.log(`   - ${productId}`);
      }
    }
  } catch (error) {
    console.error("❌ Error seeding products from file:", error);
    process.exit(1);
  }
}

seedProductsFromFile();
