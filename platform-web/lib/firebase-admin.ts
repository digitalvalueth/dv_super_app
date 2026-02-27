import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Get database ID from environment — MUST match Firestore named database
const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";

// Initialize Firebase Admin SDK
let _adminApp: admin.app.App;

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
      `🔧 Firebase Admin init — projectId: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}, databaseId: ${databaseId}, storageBucket: ${storageBucket}, clientEmail: ${clientEmail ? clientEmail.slice(0, 20) + "..." : "NOT SET"}`,
    );

    if (!privateKey || !clientEmail) {
      console.warn(
        "⚠️ Firebase Admin service account credentials not found. Falling back to Application Default Credentials (ADC). " +
          "Ensure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are set in Cloud Run env vars.",
      );
      // Fallback to Application Default Credentials (works in Cloud Run with correct IAM permissions)
      _adminApp = admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket,
      });
    } else {
      _adminApp = admin.initializeApp({
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

    console.log(`📊 Using Firestore named database: "${databaseId}"`);
  } catch (error) {
    console.error("❌ Error initializing Firebase Admin:", error);
    throw error;
  }
} else {
  _adminApp = admin.apps[0]!;
}

export const adminAuth = admin.auth();

// ✅ Use getFirestore(app, databaseId) — the correct v12+ API for named databases.
// DO NOT use admin.firestore().settings({ databaseId }) — that approach is unreliable
// in v12+ and may silently fall back to the (default) database.
export const adminDb = getFirestore(_adminApp, databaseId);

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
  console.log(`🪣 Using Storage bucket: ${bucketName}`);
  return bucket;
}

export default admin;
