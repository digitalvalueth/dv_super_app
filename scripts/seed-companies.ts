import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config();

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

// Company data
const companiesData = [
  {
    code: "PRIMA",
    name: "PrimaNest",
    address: "123 Business Street, Bangkok, Thailand",
    phone: "02-123-4567",
    email: "contact@primanest.com",
    status: "active",
  },
  {
    code: "FITT",
    name: "FITT Corporation",
    address: "456 Enterprise Avenue, Bangkok, Thailand",
    phone: "02-234-5678",
    email: "info@fitt.co.th",
    status: "active",
  },
];

async function seedCompanies() {
  try {
    console.log("\n📦 Starting to seed companies...\n");

    const createdCompanies: any[] = [];

    for (const company of companiesData) {
      // Check if company already exists
      const existingCompany = await db
        .collection("companies")
        .where("code", "==", company.code)
        .limit(1)
        .get();

      if (!existingCompany.empty) {
        const existingData = existingCompany.docs[0];
        console.log(
          `⚠️  Company already exists: ${company.name} (${company.code})`,
        );
        console.log(`   Document ID: ${existingData.id}`);
        createdCompanies.push({
          id: existingData.id,
          ...company,
        });
        continue;
      }

      // Create company
      const companyData = {
        ...company,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      const companyRef = await db.collection("companies").add(companyData);
      console.log(`✅ Company created: ${company.name} (${company.code})`);
      console.log(`   Document ID: ${companyRef.id}`);
      console.log(`   Phone: ${company.phone}`);
      console.log(`   Email: ${company.email}`);
      console.log("");

      createdCompanies.push({
        id: companyRef.id,
        ...company,
      });
    }

    console.log("\n🎉 Companies seeding completed!\n");
    console.log("📊 Summary:");
    console.log(`   Total companies: ${createdCompanies.length}`);
    console.log("\n📋 Company IDs (save these for branches and products):");

    createdCompanies.forEach((company) => {
      console.log(`   ${company.code}: ${company.id}`);
    });

    console.log("\n📝 Next steps:");
    console.log("   1. Copy the company ID you want to use");
    console.log("   2. Run: npm run seed:branches -- <company-id>");
    console.log("   3. Run: npm run seed:products -- <company-id>");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding companies:", error);
    process.exit(1);
  }
}

// Run the seed script
seedCompanies();
