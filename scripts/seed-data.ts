import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config();

console.log("🔑 Initializing Firebase Admin SDK...");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Try to use service account file first
  const serviceAccountPath = path.join(
    __dirname,
    "..",
    "fittbsa-798ba3e87223.json",
  );

  if (fs.existsSync(serviceAccountPath)) {
    console.log("✅ Using service account file:", serviceAccountPath);
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf-8"),
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    // Fallback to environment variables
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined;

    if (!privateKey || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      console.log(
        "⚠️  No service account found. Using Application Default Credentials",
      );
      admin.initializeApp({
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  }
}

console.log("✅ Firebase Admin initialized");

// Initialize Firestore with specific database ID
const databaseId = process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";
console.log("🗄️  Using Firestore Database:", databaseId);

// Get Firestore instance with database ID
// Admin SDK v11+ supports named databases
const db = admin.firestore();
if (databaseId !== "(default)") {
  db.settings({ databaseId: databaseId });
  console.log(`✅ Connected to named database: ${databaseId}`);
}

interface Product {
  id: string;
  name: string;
  barcode: string;
  sellerCode: string | null;
  description: string;
  category: string;
  beforeCount: number;
  companyId: string;
  branchId: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductJSON {
  itemCode: string;
  description: string;
  barcode: string;
  sellerCode: string | null;
}

// Parse all_prod_2026.json
function parseProductsJSON(filePath: string): Product[] {
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
        category: itemCode.split("-")[0]?.trim() || "SK",
        beforeCount: 0,
        companyId: "super-company-001",
        branchId: "branch-001",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return products;
}

async function seedData() {
  try {
    console.log("🌱 Starting to seed data...");

    // Company and Branch data from employee file
    const companyData = {
      code: "PRIMA",
      name: "PrimaNest",
      address: "Thailand",
      phone: "02-xxx-xxxx",
      email: "contact@primanest.com",
      status: "active",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    // Branches data
    const branchesData = [
      {
        code: "966",
        name: "โรบินสันกาญจนบุรี",
        fullName: "WS Robinson Kanchanaburi(996)",
        address: "Kanchanaburi, Thailand",
      },
      {
        code: "458",
        name: "โลตัสท่ายาง",
        fullName: "WS Tesco Tayang(458)",
        address: "Tha Yang, Thailand",
      },
      {
        code: "603",
        name: "ฟิวเจอร์พาร์ค",
        fullName: "WS Future Park Rangsit FL2(603)",
        address: "Rangsit, Thailand",
      },
      {
        code: "774",
        name: "โลตัสรังสิต",
        fullName: "WS Tesco Rangsit(774)",
        address: "Rangsit, Thailand",
      },
      {
        code: "735",
        name: "โลตัสปทุมธานี",
        fullName: "WS Tesco PathumThani(735)",
        address: "Pathum Thani, Thailand",
      },
      {
        code: "673",
        name: "โลตัสแจ้งวัตนะ",
        fullName: "WS Tesco Changwattana(673)",
        address: "Chaengwattana, Thailand",
      },
    ];

    // Supervisor data
    const supervisorData = {
      email: "nawarat.onnorjun@gmail.com",
      name: "เนาวรัตน์ อ่อนนอจันทร์",
      nickname: "Kook",
      role: "supervisor",
    };

    // Employees data
    const employeesData = [
      {
        email: "Wantanee170336@icloud.com",
        name: "วันทนีย์ เจริญดี",
        branchCode: "966",
      },
      {
        email: "Monnatnoihiran1994@gmail.com",
        name: "มนต์ณัฐ น้อยหิรัญ",
        branchCode: "458",
      },
      {
        email: "Saifon.kaewsupa@gmail.com",
        name: "สายฝน แก้วสุพะ",
        branchCode: "603",
      },
      {
        email: "golfbbbb@gmail.com",
        name: "พศิณ ทัพมงคล",
        branchCode: "774",
      },
      {
        email: "Joy.sansanee1988@gmail.com",
        name: "ศันสนีย์ เขมันกสิกรรม",
        branchCode: "735",
      },
      {
        email: "nattawirot.juntaweeraporn@gmail.com",
        name: "ณัฐวิโรจน์ จันทวีราภรณ์",
        branchCode: "673",
      },
    ];

    // 1. Create Company
    console.log("\n📦 Creating company...");
    const companyRef = await db.collection("companies").add(companyData);
    const companyId = companyRef.id;
    console.log(
      "✅ Company created:",
      companyData.name,
      `(${companyData.code})`,
      "| companyId:",
      companyId,
    );

    // 2. Create Branches
    console.log("\n🏢 Creating branches...");
    const branchIds: { [key: string]: string } = {};

    for (const branch of branchesData) {
      const branchData = {
        companyId: companyId,
        code: branch.code,
        name: branch.name,
        address: branch.address,
        phone: "02-xxx-xxxx",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      const branchRef = await db.collection("branches").add(branchData);
      branchIds[branch.code] = branchRef.id;
      console.log(
        `✅ Branch created: ${branch.name} (${branch.code}) | branchId: ${branchRef.id}`,
      );
    }

    // 3. Create Supervisor (create document with email as ID for Firebase Auth compatibility)
    console.log("\n👨‍💼 Creating supervisor...");
    const supervisorId = `supervisor_${Date.now()}`;
    const supervisorDocData = {
      uid: supervisorId,
      email: supervisorData.email,
      name: supervisorData.name,
      displayName: supervisorData.nickname,
      role: supervisorData.role,
      companyId: companyId,
      companyCode: companyData.code,
      companyName: companyData.name,
      // Supervisor can see all branches
      managedBranchIds: Object.values(branchIds),
      status: "active",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    const supervisorRef = await db.collection("users").add(supervisorDocData);
    console.log(
      `✅ Supervisor created: ${supervisorData.name} (${supervisorData.email})`,
    );
    console.log(`   - Can manage ${Object.keys(branchIds).length} branches`);

    // 4. Create Employees
    console.log("\n👥 Creating employees...");
    const employeeIds: string[] = [];

    for (const employee of employeesData) {
      const branchId = branchIds[employee.branchCode];
      const branchInfo = branchesData.find(
        (b) => b.code === employee.branchCode,
      );

      const employeeId = `employee_${Date.now()}_${Math.random()}`;
      const employeeDocData = {
        uid: employeeId,
        email: employee.email,
        name: employee.name,
        role: "employee",
        companyId: companyId,
        companyCode: companyData.code,
        companyName: companyData.name,
        branchId: branchId,
        branchCode: employee.branchCode,
        branchName: branchInfo?.name || "",
        supervisorId: supervisorRef.id,
        supervisorName: supervisorData.name,
        status: "active",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      const employeeRef = await db.collection("users").add(employeeDocData);
      employeeIds.push(employeeRef.id);
      console.log(
        `✅ Employee created: ${employee.name} | Branch: ${branchInfo?.name} (${employee.branchCode})`,
      );
    }

    console.log(`\n📊 Users Summary:`);
    console.log(`   - Supervisors: 1`);
    console.log(`   - Employees: ${employeeIds.length}`);

    // 4. Parse and Create Products
    console.log("\n📦 Parsing products from all_prod_2026.json...");
    const productsPath = path.join(
      __dirname,
      "..",
      "admin-web",
      "all_prod_2026.json",
    );
    const products = parseProductsJSON(productsPath);

    console.log(`Found ${products.length} products`);
    console.log("\n📝 Creating products in Firestore...");

    let successCount = 0;
    let errorCount = 0;
    const productDocIds: string[] = [];

    for (const product of products) {
      try {
        // Products belong to company, not specific branch
        const productData: any = {
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          sellerCode: product.sellerCode,
          description: product.description,
          category: product.category,
          companyId: companyId, // Products at company level
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        };

        if (product.imageUrl) {
          productData.imageUrl = product.imageUrl;
        }

        const productRef = await db.collection("products").add(productData);
        productDocIds.push(productRef.id);
        successCount++;

        // Only log first 5 and last 5
        if (successCount <= 5 || successCount > products.length - 5) {
          console.log(
            `✅ Created product: ${product.id} - ${product.name.substring(0, 50)}...`,
          );
        } else if (successCount === 6) {
          console.log(
            `   ... creating ${products.length - 10} more products ...`,
          );
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to create product ${product.id}:`, error);
      }
    }

    console.log(`\n📊 Products Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    // 5. Create Assignments for ALL employees with ALL products
    console.log(
      "\n📋 Creating assignments (ALL products for ALL employees)...",
    );
    let assignmentCount = 0;

    for (const employeeId of employeeIds) {
      const assignmentData = {
        userId: employeeId,
        companyId: companyId,
        productIds: productDocIds, // Assign ALL products
        month: 2,
        year: 2026,
        status: "pending",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      await db.collection("assignments").add(assignmentData);
      assignmentCount++;
      console.log(`✅ Assignment created for employee ${assignmentCount}`);
    }

    console.log("\n🎉 Data seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Company: 1 (${companyData.name})`);
    console.log(`   - Branches: ${Object.keys(branchIds).length}`);
    console.log(`   - Supervisor: 1 (${supervisorData.name})`);
    console.log(`   - Employees: ${employeeIds.length}`);
    console.log(`   - Products: ${successCount}`);
    console.log(
      `   - Assignments: ${assignmentCount} (all products to all employees)`,
    );

    console.log("\n📝 Next Steps:");
    console.log(
      "   1. Have employees sign in with Firebase Auth using their emails",
    );
    console.log(
      "   2. Auth system will link their accounts to created user documents",
    );
    console.log(
      "   3. Supervisor can monitor all employees across all branches",
    );
    console.log("   4. All employees will see the same 112 products to count");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

// Run the seed script
seedData();
