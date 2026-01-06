import { auth, db } from "@/config/firebase";
import { User } from "@/types";
import * as Google from "expo-auth-session/providers/google";
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

// Google OAuth Config
// Get these from Firebase Console -> Authentication -> Sign-in method -> Google -> Web SDK configuration
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

/**
 * Sign in with Google using expo-auth-session
 */
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const [request, response, promptAsync] = Google.useAuthRequest({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    });

    const result = await promptAsync();

    if (result.type !== "success") {
      throw new Error("Google sign in cancelled or failed");
    }

    const { id_token } = result.params;

    // Create Firebase credential with Google ID token
    const credential = GoogleAuthProvider.credential(id_token);

    // Sign in to Firebase with credential
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;

    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

    if (userDoc.exists()) {
      // User exists, return user data
      return userDoc.data() as User;
    } else {
      // New user, create user document
      const newUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "User",
        companyId: "company-001", // TODO: Get from registration flow
        branchId: "branch-001", // TODO: Get from registration flow
        role: "employee", // Default role
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "users", firebaseUser.uid), newUser);

      return newUser;
    }
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    throw new Error(error.message || "Failed to sign in with Google");
  }
};

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
