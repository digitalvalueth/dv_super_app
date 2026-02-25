import * as admin from "firebase-admin";

// Get database ID from environment
const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Use service account credentials from environment variables
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined;

    if (!privateKey || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      console.error(
        "❌ Firebase Admin credentials not found in .env.local",
        "\nPlease ensure FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY are set",
      );
      // Fallback to Application Default Credentials (works in Cloud Run)
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.warn(
        "⚠️ Using Application Default Credentials - this may fail in local development",
      );
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.log(
        "✅ Firebase Admin initialized with environment variables from .env.local",
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

export default admin;
