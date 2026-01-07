import * as dotenv from "dotenv";
import { getApps, initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  getFirestore,
  Timestamp,
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config();

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log("🔑 Firebase Config:", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
});

// Initialize Firebase
const app = getApps().length === 0 
  ? initializeApp(firebaseConfig) 
  : getApps()[0];

// Initialize Firestore with specific database ID
const databaseId = process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";
console.log("🗄️  Using Firestore Database:", databaseId);
const db = getFirestore(app, databaseId);

interface Product {
  id: string;
  name: string;
  barcode: string;
  sellerCode: string;
  description: string;
  category: string;
  beforeCount: number;
  companyId: string;
  branchId: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Parse items.txt
function parseItemsFile(filePath: string): Product[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  const products: Product[] = [];

  // Skip header lines (first 8 lines)
  for (let i = 8; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split("\t");

    if (parts.length >= 5) {
      const itemCode = parts[0]?.trim();
      const description = parts[1]?.trim();
      const barcode = parts[2]?.trim();
      const sellerCode = parts[3]?.trim();
      const beforeCount = parseInt(parts[4]?.trim() || "0");

      if (itemCode && description && barcode) {
        products.push({
          id: itemCode,
          name: description,
          barcode: barcode,
          sellerCode: sellerCode,
          description: description,
          category: itemCode.split("-")[0] || "SK",
          beforeCount: beforeCount,
          companyId: "super-company-001",
          branchId: "branch-001",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  return products;
}

async function seedData() {
  try {
    console.log("🌱 Starting to seed data...");

    // 1. Create Company
    console.log("\n📦 Creating company...");
    const companyId = "super-company-001";
    const companyData = {
      companyId: companyId, // Add ID as field
      name: "Super Company",
      address: "Bangkok, Thailand",
      phone: "02-xxx-xxxx",
      email: "contact@supercompany.com",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Use addDoc to auto-generate document ID
    const companyRef = await addDoc(collection(db, "companies"), companyData);
    console.log(
      "✅ Company created:",
      companyData.name,
      "| Doc ID:",
      companyRef.id
    );

    // 2. Create Branch
    console.log("\n🏢 Creating branch...");
    const branchId = "branch-001";
    const branchData = {
      branchId: branchId, // Add ID as field
      companyId: companyId,
      name: "Main Branch",
      address: "Bangkok Branch, Thailand",
      phone: "02-xxx-xxxx",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Use addDoc to auto-generate document ID
    const branchRef = await addDoc(
      collection(db, "companies", companyRef.id, "branches"),
      branchData
    );
    console.log(
      "✅ Branch created:",
      branchData.name,
      "| Doc ID:",
      branchRef.id
    );

    // 3. Parse and Create Products
    console.log("\n📦 Parsing products from items.txt...");
    const itemsPath = path.join(__dirname, "..", "items.txt");
    const products = parseItemsFile(itemsPath);

    console.log(`Found ${products.length} products`);
    console.log("\n📝 Creating products in Firestore...");

    let successCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        // Add productId as field, document ID will be auto-generated
        const productData: any = {
          productId: product.id, // Add ID as field (e.g., SK-C-250)
          name: product.name,
          barcode: product.barcode,
          sellerCode: product.sellerCode,
          description: product.description,
          category: product.category,
          beforeCount: product.beforeCount,
          companyId: product.companyId,
          branchId: product.branchId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        // Only add imageUrl if it exists
        if (product.imageUrl) {
          productData.imageUrl = product.imageUrl;
        }

        // Use addDoc to auto-generate document ID
        const productRef = await addDoc(
          collection(db, "products"),
          productData
        );
        successCount++;
        console.log(
          `✅ Created product: ${product.id} - ${product.name} | Doc ID: ${productRef.id}`
        );
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to create product ${product.id}:`, error);
      }
    }

    console.log(`\n📊 Products Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    // 4. Create Sample User Assignment
    console.log("\n👤 Creating sample user assignment...");
    const assignmentId = "assignment-001";
    const assignmentData = {
      assignmentId: assignmentId, // Add ID as field
      userId: "sample-user-id", // Will be replaced when real user logs in
      companyId: companyId,
      branchId: branchId,
      productIds: products.slice(0, 10).map((p) => p.id), // Assign first 10 products
      month: 1,
      year: 2026,
      status: "pending",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Use addDoc to auto-generate document ID
    const assignmentRef = await addDoc(
      collection(db, "assignments"),
      assignmentData
    );
    console.log("✅ Sample assignment created | Doc ID:", assignmentRef.id);

    console.log("\n🎉 Data seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Companies: 1`);
    console.log(`   - Branches: 1`);
    console.log(`   - Products: ${successCount}`);
    console.log(`   - Assignments: 1`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

// Run the seed script
seedData();
