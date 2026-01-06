import { auth, db } from "@/config/firebase";
import { User } from "@/types";
import * as WebBrowser from "expo-web-browser";
import {
  signOut as firebaseSignOut,
  User as FirebaseUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

// Configure WebBrowser for better UX
WebBrowser.maybeCompleteAuthSession();

/**
 * Process Google Auth with Firebase (for native Google Sign-In)
 */
export const processGoogleAuth = async (
  idToken: string
): Promise<User | null> => {
  try {
    console.log("🔥 Creating Firebase credential...");
    // Create Firebase credential with Google ID token
    const credential = GoogleAuthProvider.credential(idToken);

    console.log("🔥 Signing in to Firebase...");
    // Sign in to Firebase with credential
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;

    console.log("✅ Firebase Auth Success:", firebaseUser.email);

    // Try to get user from Firestore (with offline handling)
    try {
      console.log("📄 Fetching user from Firestore...");
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

      if (userDoc.exists()) {
        console.log("✅ User found in Firestore");
        return userDoc.data() as User;
      }

      console.log("📝 Creating new user in Firestore...");
      // New user, create user document
      const newUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "User",
        companyId: "company-001",
        branchId: "branch-001",
        role: "employee",
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "users", firebaseUser.uid), newUser);
      console.log("✅ User created in Firestore");

      return newUser;
    } catch (firestoreError: any) {
      console.warn(
        "⚠️ Firestore error (offline?), using Firebase Auth data:",
        firestoreError.message
      );

      // Fallback: return user from Firebase Auth only
      const fallbackUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "User",
        companyId: "company-001",
        branchId: "branch-001",
        role: "employee",
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      return fallbackUser;
    }
  } catch (error: any) {
    console.error("❌ Error processing Google Auth:", error);
    throw new Error(error.message || "Failed to authenticate with Firebase");
  }
};

// Note: Use processGoogleAuth directly with native GoogleSignin module
// expo-auth-session is not needed for React Native apps

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error("Error signing out:", error);
    throw new Error(error.message || "Failed to sign out");
  }
};

/**
 * Get current user data from Firestore
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    return null;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

    if (userDoc.exists()) {
      return userDoc.data() as User;
    }

    return null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (
  callback: (user: FirebaseUser | null) => void
) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!auth.currentUser;
};
