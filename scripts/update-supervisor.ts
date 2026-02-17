/**
 * Update Supervisor Script
 * Updates an existing user to supervisor role with managed branches
 */

import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Initialize Firebase Admin SDK
console.log("🔑 Initializing Firebase Admin SDK...");

const serviceAccountPath = path.resolve(
  __dirname,
  "../fittbsa-798ba3e87223.json",
);

if (fs.existsSync(serviceAccountPath)) {
  console.log(`✅ Using service account file: ${serviceAccountPath}`);
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8"),
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
} else {
  console.error("❌ Service account file not found:", serviceAccountPath);
  process.exit(1);
}

console.log("✅ Firebase Admin initialized");

// Get database ID from environment
const databaseId =
  process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID || "fittsuperapp-dev";
console.log(`🗄️  Using Firestore Database: ${databaseId}`);

// Initialize Firestore
const db = admin.firestore();
if (databaseId !== "(default)") {
  db.settings({ databaseId: databaseId });
  console.log(`✅ Connected to named database: ${databaseId}`);
}

async function updateSupervisor() {
  try {
    const targetUid = "945q6V8eIyVzOFnabF14c63h5r83";
    const targetEmail = "watthachai@digitalvalue.co.th";

    console.log("\n🔍 Finding user...");
    console.log(`   Email: ${targetEmail}`);
    console.log(`   UID: ${targetUid}`);

    // Find user document by UID
    const usersSnapshot = await db
      .collection("users")
      .where("uid", "==", targetUid)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log("❌ User not found, creating new document...");

      // Get company and all branches
      const companySnapshot = await db.collection("companies").limit(1).get();
      if (companySnapshot.empty) {
        console.error("❌ No company found. Please run seed-data.ts first.");
        process.exit(1);
      }

      const companyDoc = companySnapshot.docs[0];
      const companyData = companyDoc.data();
      const companyId = companyDoc.id;

      // Get all branches
      const branchesSnapshot = await db
        .collection("branches")
        .where("companyId", "==", companyId)
        .get();

      const branchIds = branchesSnapshot.docs.map((doc) => doc.id);

      // Create new supervisor document
      const newUserData = {
        uid: targetUid,
        email: targetEmail,
        name: "Watthachai (Supervisor)",
        displayName: "Watthachai",
        role: "supervisor",
        companyId: companyId,
        companyCode: companyData.code,
        companyName: companyData.name,
        managedBranchIds: branchIds,
        status: "active",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      await db.collection("users").add(newUserData);
      console.log("✅ Created new supervisor user");
      console.log(`   - Role: supervisor`);
      console.log(`   - Managed branches: ${branchIds.length}`);
    } else {
      // Update existing user
      const userDoc = usersSnapshot.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();

      console.log(`✅ Found user: ${userData.name || userData.email}`);
      console.log(`   Current role: ${userData.role}`);

      // Get companyId
      let companyId = userData.companyId;
      let companyCode = userData.companyCode;
      let companyName = userData.companyName;

      if (!companyId) {
        console.log("⚠️  User has no companyId, assigning from database...");
        const companySnapshot = await db.collection("companies").limit(1).get();
        if (companySnapshot.empty) {
          console.error("❌ No company found. Please run seed-data.ts first.");
          process.exit(1);
        }
        const companyDoc = companySnapshot.docs[0];
        const companyData = companyDoc.data();
        companyId = companyDoc.id;
        companyCode = companyData.code;
        companyName = companyData.name;
      }

      // Get all branches for this company
      const branchesSnapshot = await db
        .collection("branches")
        .where("companyId", "==", companyId)
        .get();

      const branchIds = branchesSnapshot.docs.map((doc) => doc.id);

      console.log(`\n📝 Updating to supervisor...`);
      await db.collection("users").doc(userId).update({
        role: "supervisor",
        companyId: companyId,
        companyCode: companyCode,
        companyName: companyName,
        managedBranchIds: branchIds,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log("✅ User updated successfully!");
      console.log(`   - New role: supervisor`);
      console.log(`   - Can manage ${branchIds.length} branches`);
    }

    // Update all employees to have this supervisor
    console.log("\n👥 Updating employees...");
    const supervisorDocSnapshot = await db
      .collection("users")
      .where("uid", "==", targetUid)
      .limit(1)
      .get();

    if (!supervisorDocSnapshot.empty) {
      const supervisorDocId = supervisorDocSnapshot.docs[0].id;
      const supervisorData = supervisorDocSnapshot.docs[0].data();

      const employeesSnapshot = await db
        .collection("users")
        .where("role", "==", "employee")
        .get();

      const batch = db.batch();
      let updateCount = 0;

      employeesSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          supervisorId: supervisorDocId,
          supervisorName: supervisorData.name || supervisorData.email,
          updatedAt: admin.firestore.Timestamp.now(),
        });
        updateCount++;
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Updated ${updateCount} employees with supervisor info`);
      } else {
        console.log("ℹ️  No employees to update");
      }
    }

    console.log("\n✅ All updates completed!");
    console.log("\n🎉 You can now login and access /dashboard/supervisor");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

updateSupervisor();
