import * as admin from "firebase-admin";

// Get database ID from environment
const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Support both naming conventions:
    // - FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY (local .env.local)
    // - FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (Dockerfile / Cloud Run --set-env-vars)
    const clientEmail =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL;
    const rawPrivateKey =
      process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = rawPrivateKey
      ? rawPrivateKey.replace(/\\n/g, "\n")
      : undefined;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    console.log(
      `🔧 Firebase Admin init — projectId: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}, storageBucket: ${storageBucket}, clientEmail: ${clientEmail ? clientEmail.slice(0, 20) + "..." : "NOT SET"}`,
    );

    if (!privateKey || !clientEmail) {
      console.warn(
        "⚠️ Firebase Admin service account credentials not found. Falling back to Application Default Credentials (ADC). " +
          "Ensure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are set in Cloud Run env vars.",
      );
      // Fallback to Application Default Credentials (works in Cloud Run with correct IAM permissions)
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket,
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail,
          privateKey,
        }),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket,
      });
      console.log(
        "✅ Firebase Admin initialized with service account credentials",
      );
    }

    // Configure Firestore with named database if specified
    const db = admin.firestore();
    if (databaseId !== "(default)") {
      db.settings({
        databaseId: databaseId,
      });
      console.log(`📊 Using Firestore database: ${databaseId}`);
    } else {
      console.log(`📊 Using default Firestore database`);
    }
  } catch (error) {
    console.error("❌ Error initializing Firebase Admin:", error);
    throw error;
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();

/**
 * Get the default Firebase Storage bucket (uses storageBucket from initializeApp).
 * Prefer this over adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
 * to avoid env var mismatches across environments.
 */
export function getAdminBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set. Cannot access Firebase Storage.",
    );
  }
  const bucket = adminStorage.bucket(bucketName);
  console.log(`\ud83e\udea3 Using Storage bucket: ${bucketName}`);
  return bucket;
}

export default admin;
