/**
 * Clear specified Firestore collections in production (fittbsa)
 * Run: node scripts/clear-prod-collections.js
 */
const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(
  path.join(__dirname, "../fittbsa-798ba3e87223.json"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "fittbsa",
});

const db = admin.firestore();
db.settings({ databaseId: "fittsuperapp-prod" });

const COLLECTIONS_TO_CLEAR = [
  "access_requests",
  "account_deletion_requests",
  "assignments",
  "attendanceSettings",
  "branches",
  "checkIns",
  "countingPeriods",
  "countingSessions",
  "countingUploadOverrides",
  "invitations",
  "notifications",
  "shipments",
  "shopCountConfirmed",
  "skippedProducts",
  "supplementSessions",
];

async function deleteCollection(collectionName) {
  const collRef = db.collection(collectionName);
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collRef.limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.docs.length;
    process.stdout.write(
      `  ${collectionName}: ลบไปแล้ว ${totalDeleted} docs...\r`,
    );
  }

  console.log(`✅ ${collectionName}: ลบทั้งหมด ${totalDeleted} docs`);
}

async function main() {
  console.log("🗑️  เริ่มล้างข้อมูล production (fittbsa)...\n");
  for (const col of COLLECTIONS_TO_CLEAR) {
    await deleteCollection(col);
  }
  console.log("\n✅ เสร็จสิ้น");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
