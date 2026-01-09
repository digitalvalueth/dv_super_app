import { auth, db } from "@/config/firebase";
import { User } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Location from "expo-location";
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
        firestoreError.message
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
    throw new Error(error.message || "Failed to authenticate with Firebase");
  }
};

// Note: Use processGoogleAuth directly with native GoogleSignin module
// expo-auth-session is not needed for React Native apps

/**
 * Create access request for new user (to be approved by admin)
 */
const createAccessRequest = async (
  userId: string,
  userEmail: string
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
