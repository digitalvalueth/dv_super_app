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
  console.log("\nUsage: npm run seed:branches -- <company-id>");
  console.log("\nExample:");
  console.log("  npm run seed:branches -- abc123xyz789");
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

// Branches data
const branchesData = [
  {
    code: "966",
    name: "โรบินสันกาญจนบุรี",
    fullName: "WS Robinson Kanchanaburi (996)",
    address: "Robinson Department Store, Kanchanaburi, Thailand",
    phone: "034-512-345",
    region: "West",
  },
  {
    code: "458",
    name: "โลตัสท่ายาง",
    fullName: "WS Tesco Lotus Tha Yang (458)",
    address: "Tesco Lotus, Tha Yang, Phetchaburi, Thailand",
    phone: "032-456-789",
    region: "West",
  },
  {
    code: "603",
    name: "ฟิวเจอร์พาร์ค",
    fullName: "WS Future Park Rangsit FL2 (603)",
    address: "Future Park Rangsit, Floor 2, Pathum Thani, Thailand",
    phone: "02-958-5678",
    region: "Central",
  },
  {
    code: "774",
    name: "โลตัสรังสิต",
    fullName: "WS Tesco Lotus Rangsit (774)",
    address: "Tesco Lotus Rangsit, Pathum Thani, Thailand",
    phone: "02-959-6789",
    region: "Central",
  },
  {
    code: "735",
    name: "โลตัสปทุมธานี",
    fullName: "WS Tesco Lotus Pathum Thani (735)",
    address: "Tesco Lotus, Pathum Thani, Thailand",
    phone: "02-501-2345",
    region: "Central",
  },
  {
    code: "673",
    name: "โลตัสแจ้งวัตนะ",
    fullName: "WS Tesco Lotus Chaengwattana (673)",
    address: "Tesco Lotus Chaengwattana, Bangkok, Thailand",
    phone: "02-573-4567",
    region: "Central",
  },
];

async function seedBranches() {
  try {
    console.log("\n🏢 Starting to seed branches...");
    console.log(`📦 Company ID: ${companyId}\n`);

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

    const createdBranches: any[] = [];

    for (const branch of branchesData) {
      // Check if branch already exists
      const existingBranch = await db
        .collection("branches")
        .where("companyId", "==", companyId)
        .where("code", "==", branch.code)
        .limit(1)
        .get();

      if (!existingBranch.empty) {
        const existingData = existingBranch.docs[0];
        console.log(
          `⚠️  Branch already exists: ${branch.name} (${branch.code})`,
        );
        console.log(`   Document ID: ${existingData.id}`);
        createdBranches.push({
          id: existingData.id,
          ...branch,
        });
        continue;
      }

      // Create branch
      const branchData = {
        companyId: companyId,
        companyCode: companyData?.code || "",
        companyName: companyData?.name || "",
        code: branch.code,
        name: branch.name,
        fullName: branch.fullName,
        address: branch.address,
        phone: branch.phone,
        region: branch.region,
        status: "active",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      const branchRef = await db.collection("branches").add(branchData);
      console.log(`✅ Branch created: ${branch.name} (${branch.code})`);
      console.log(`   Document ID: ${branchRef.id}`);
      console.log(`   Phone: ${branch.phone}`);
      console.log(`   Region: ${branch.region}`);
      console.log("");

      createdBranches.push({
        id: branchRef.id,
        ...branch,
      });
    }

    console.log("\n🎉 Branches seeding completed!\n");
    console.log("📊 Summary:");
    console.log(`   Company: ${companyData?.name} (${companyData?.code})`);
    console.log(`   Total branches: ${createdBranches.length}`);
    console.log("\n📋 Branch IDs:");

    createdBranches.forEach((branch) => {
      console.log(`   ${branch.code} - ${branch.name}: ${branch.id}`);
    });

    console.log("\n📝 Next steps:");
    console.log(`   Run: npm run seed:products -- ${companyId}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding branches:", error);
    process.exit(1);
  }
}

// Run the seed script
seedBranches();
