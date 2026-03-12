import { auth, db } from "@/config/firebase";
import { User } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import {
  deleteUser,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

// Configure WebBrowser for better UX
WebBrowser.maybeCompleteAuthSession();

/**
 * Process Google Auth with Firebase (for native Google Sign-In)
 */
export const processGoogleAuth = async (
  idToken: string,
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

        // Log login activity
        await logLoginActivity(firebaseUser.uid);

        return userDoc.data() as User;
      }

      console.log("📝 Creating new user in Firestore...");
      // New user, create user document without company assignment
      // User will need admin approval to be assigned to company/branch
      const newUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "User",
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "users", firebaseUser.uid), newUser);
      console.log("✅ User created in Firestore");

      // Create pending access request for admin approval
      await createAccessRequest(firebaseUser.uid, firebaseUser.email || "");

      // Log login activity
      await logLoginActivity(firebaseUser.uid);

      return newUser;
    } catch (firestoreError: any) {
      console.warn(
        "⚠️ Firestore error (offline?), using Firebase Auth data:",
        firestoreError.message,
      );

      // Fallback: return user from Firebase Auth only
      const fallbackUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "User",
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      return fallbackUser;
    }
  } catch (error: any) {
    console.error("❌ Error processing Google Auth:", error);
    console.error("❌ Error Code:", error.code);
    console.error("❌ Error Message:", error.message);
    console.error("❌ Error Details:", JSON.stringify(error, null, 2));

    // แสดง error แบบละเอียดตาม Firebase error codes
    let friendlyMessage = error.message;
    if (error.code === "auth/invalid-credential") {
      friendlyMessage =
        "DEVELOPER_ERROR: Invalid OAuth credentials. Check SHA-1 fingerprint and Client IDs in Firebase Console.";
    } else if (error.code === "auth/account-exists-with-different-credential") {
      friendlyMessage =
        "This email is already associated with a different sign-in method.";
    } else if (error.code === "auth/operation-not-allowed") {
      friendlyMessage = "Google Sign-In is not enabled in Firebase Console.";
    }

    throw new Error(friendlyMessage || "Failed to authenticate with Firebase");
  }
};

// Note: Use processGoogleAuth directly with native GoogleSignin module
// expo-auth-session is not needed for React Native apps

/**
 * Process Apple Sign-In result and sync with Firestore
 */
export const processAppleAuth = async (
  firebaseUser: import("firebase/auth").User,
  displayName: string,
  email: string,
  isNewUser: boolean,
): Promise<User | null> => {
  try {
    // Try to get existing user from Firestore
    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

    if (userDoc.exists()) {
      await logLoginActivity(firebaseUser.uid);
      return userDoc.data() as User;
    }

    // New user — create Firestore document (omit undefined fields)
    const newUser: User = {
      uid: firebaseUser.uid,
      email: email || firebaseUser.email || "",
      name: displayName || firebaseUser.displayName || "Apple User",
      ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(doc(db, "users", firebaseUser.uid), newUser);
    await createAccessRequest(firebaseUser.uid, newUser.email);
    await logLoginActivity(firebaseUser.uid);

    return newUser;
  } catch (error: any) {
    console.error("❌ Error processing Apple Auth:", error);
    // Fallback to Firebase Auth data (also omit undefined photoURL)
    return {
      uid: firebaseUser.uid,
      email: email || firebaseUser.email || "",
      name: displayName || "Apple User",
      ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }
};

/**
 * Create access request for new user (to be approved by admin)
 */
const createAccessRequest = async (
  userId: string,
  userEmail: string,
): Promise<void> => {
  try {
    const accessRequest = {
      userId,
      userEmail,
      status: "pending", // pending | approved | rejected
      requestedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Add to access_requests collection
    const requestRef = doc(db, "access_requests", userId);
    await setDoc(requestRef, accessRequest);

    console.log("✅ Access request created for admin approval");
  } catch (error) {
    console.error("⚠️ Error creating access request:", error);
    // Don't throw error - user creation should succeed even if request fails
  }
};

/**
 * Log user login activity with device information
 */
const logLoginActivity = async (userId: string): Promise<void> => {
  try {
    // Get or create device identifier for this installation
    let deviceId = await AsyncStorage.getItem("device_id");
    if (!deviceId) {
      deviceId = `${Device.modelName}_${Date.now()}`;
      await AsyncStorage.setItem("device_id", deviceId);
    }

    const deviceInfo = {
      deviceId, // Unique identifier for this installation
      deviceName: Device.deviceName || "Unknown Device",
      modelName: Device.modelName || "Unknown Model",
      osName: Device.osName || "Unknown OS",
      osVersion: Device.osVersion || "Unknown Version",
      brand: Device.brand || "Unknown Brand",
      manufacturer: Device.manufacturer || "Unknown Manufacturer",
      deviceType: Device.deviceType,
      isDevice: Device.isDevice,
    };

    // Try to get location
    let locationData = null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // Get address from coordinates
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const address = addresses[0];
        locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          city: address?.city || null,
          region: address?.region || null,
          country: address?.country || null,
          address: [address?.city, address?.region, address?.country]
            .filter(Boolean)
            .join(", "),
        };
      }
    } catch (locationError) {
      console.log("⚠️ Could not get location:", locationError);
      // Continue without location
    }

    const loginLog = {
      userId,
      deviceInfo,
      location: locationData,
      loginAt: Timestamp.now(),
    };

    // Add to login_logs collection with auto-generated ID
    const loginLogsRef = doc(db, `users/${userId}/login_logs`, `${Date.now()}`);
    await setDoc(loginLogsRef, loginLog);

    console.log("✅ Login activity logged");
  } catch (error) {
    console.error("⚠️ Error logging login activity:", error);
    // Don't throw error, just log it - login should succeed even if logging fails
  }
};

/**
 * Delete the current user's account permanently.
 * Removes ALL personal data: Firestore docs/subcollections, local AsyncStorage,
 * and finally the Firebase Auth account.
 * Throws auth/requires-recent-login if the session is too old —
 * caller should sign the user out, have them sign back in, then retry.
 */
export const deleteAccount = async (): Promise<void> => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error("No authenticated user");

  const uid = firebaseUser.uid;

  // Helper: delete all docs returned by a query using batched writes
  const deleteQueryResults = async (q: ReturnType<typeof query>) => {
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  // Helper: delete all docs in a Firestore subcollection
  const deleteSubcollection = async (path: string) => {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  // 1. Delete Firestore subcollections under users/{uid}
  try {
    await deleteSubcollection(`users/${uid}/countingHistory`);
  } catch (err) {
    console.warn("⚠️ countingHistory:", err);
  }
  try {
    await deleteSubcollection(`users/${uid}/login_logs`);
  } catch (err) {
    console.warn("⚠️ login_logs:", err);
  }

  // 2. Delete users/{uid} document
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch (err) {
    console.warn("⚠️ users doc:", err);
  }

  // 3. Delete access_requests/{uid}
  try {
    await deleteDoc(doc(db, "access_requests", uid));
  } catch (err) {
    console.warn("⚠️ access_requests doc:", err);
  }

  // 4. Delete notifications where userId == uid
  try {
    await deleteQueryResults(
      query(collection(db, "notifications"), where("userId", "==", uid)),
    );
  } catch (err) {
    console.warn("⚠️ notifications:", err);
  }

  // 5. Delete checkIns where userId == uid
  try {
    await deleteQueryResults(
      query(collection(db, "checkIns"), where("userId", "==", uid)),
    );
  } catch (err) {
    console.warn("⚠️ checkIns:", err);
  }

  // 6. Clear all local AsyncStorage data for this user
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter(
      (k) =>
        k.includes(uid) ||
        k.startsWith("cache_") ||
        k === "onboarding_completed" ||
        k === "device_id",
    );
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }
  } catch (err) {
    console.warn("⚠️ AsyncStorage clear:", err);
  }

  // 7. Revoke Google OAuth / Apple token & re-authenticate before delete
  const appleProvider = firebaseUser.providerData.find(
    (p) => p.providerId === "apple.com",
  );
  const googleProvider = firebaseUser.providerData.find(
    (p) => p.providerId === "google.com",
  );

  if (appleProvider) {
    // Apple requires re-authentication + token revocation before account deletion
    try {
      const AppleAuthentication = await import("expo-apple-authentication");
      const Crypto = await import("expo-crypto");
      const rawNonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (credential.identityToken) {
        const provider = new OAuthProvider("apple.com");
        const oAuthCredential = provider.credential({
          idToken: credential.identityToken,
          rawNonce,
        });
        await reauthenticateWithCredential(firebaseUser, oAuthCredential);
      }
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") {
        throw new Error("ERR_REQUEST_CANCELED");
      }
      console.warn("⚠️ Apple re-auth:", err);
    }
  } else if (googleProvider) {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (err) {
      console.warn("⚠️ Google revoke:", err);
    }
  }

  // 8. Delete Firebase Auth account — may throw auth/requires-recent-login
  await deleteUser(firebaseUser);
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
  callback: (user: FirebaseUser | null) => void,
) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!auth.currentUser;
};
