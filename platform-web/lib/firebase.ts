import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Initialize Firestore with specific database. The emulator only serves the
// "(default)" database, so use the default instance in that case.
const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";
export const db =
  databaseId === "(default)"
    ? getFirestore(app)
    : getFirestore(app, databaseId);

export const storage = getStorage(app);

// ── Local Firebase Emulator (E2E / Cypress) ──────────────────────────────────
// When NEXT_PUBLIC_USE_FIREBASE_EMULATOR=1, point the client SDKs at the local
// emulator suite instead of real Firebase. This lets Cypress sign in for real
// and read/write seeded data without touching production. No-op otherwise.
// Guarded so it connects exactly once per browser session.
if (
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1" &&
  typeof window !== "undefined"
) {
  const w = window as typeof window & { __emulatorsConnected?: boolean };
  if (!w.__emulatorsConnected) {
    w.__emulatorsConnected = true;
    const host =
      process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, host, 8080);
    connectStorageEmulator(storage, host, 9199);
  }
}

export default app;
