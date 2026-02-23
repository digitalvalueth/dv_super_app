/**
 * Script to copy branches and products from (default) dev database
 * to fittsuperapp-prod production database.
 *
 * Usage:
 *   npm run copy:prod                        # copy everything
 *   npm run copy:prod -- <companyId>         # copy only specific company
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const companyId = process.argv[2] || null;

console.log("🔑 Initializing Firebase Admin SDK...");

const serviceAccountPath = path.join(
  __dirname,
  "..",
  "fittbsa-798ba3e87223.json",
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Service account file not found:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

// App 1 → read from fittsuperapp-dev database
const devApp = admin.initializeApp(
  { credential: admin.credential.cert(serviceAccount), projectId: "fittbsa" },
  "dev",
);
const devDb = admin.firestore(devApp);
devDb.settings({ databaseId: "fittsuperapp-dev" });

// App 2 → write to fittsuperapp-prod named database
const prodApp = admin.initializeApp(
  { credential: admin.credential.cert(serviceAccount), projectId: "fittbsa" },
  "prod",
);
const prodDb = admin.firestore(prodApp);
prodDb.settings({ databaseId: "fittsuperapp-prod" });

console.log(
  "✅ Connected to dev (fittsuperapp-dev) and prod (fittsuperapp-prod)",
);
if (companyId) {
  console.log(`📌 Filtering by companyId: ${companyId}`);
} else {
  console.log("📌 Copying all companies");
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function copyCollection(collectionName: string) {
  console.log(`\n📂 Copying collection: ${collectionName}`);

  let query: admin.firestore.Query = devDb.collection(collectionName);
  if (companyId) {
    query = query.where("companyId", "==", companyId);
  }

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log(`   ⚠️  No documents found in ${collectionName}`);
    return 0;
  }

  console.log(`   📄 Found ${snapshot.size} documents`);

  // Write in batches of 400 (Firestore limit is 500)
  const BATCH_SIZE = 400;
  let count = 0;
  let batch = prodDb.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const destRef = prodDb.collection(collectionName).doc(doc.id);
    batch.set(destRef, doc.data());
    batchCount++;
    count++;

    if (batchCount === BATCH_SIZE) {
      await batch.commit();
      console.log(`   ✅ Committed batch (${count} docs so far...)`);
      batch = prodDb.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✅ Done — ${count} documents copied to prod`);
  return count;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const branchCount = await copyCollection("branches");
    const productCount = await copyCollection("products");

    console.log("\n🎉 Copy complete!");
    console.log(`   branches : ${branchCount} docs`);
    console.log(`   products : ${productCount} docs`);
  } catch (err) {
    console.error("❌ Error during copy:", err);
    process.exit(1);
  }
}

main();
