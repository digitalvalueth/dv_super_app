import { auth } from "@/config/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  getAdditionalUserInfo,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
} from "firebase/auth";

// AsyncStorage key prefix — keyed by Apple's stable user ID so multiple
// Apple accounts on the same device each keep their own name
const appleNameKey = (appleUserId: string) => `apple_name_${appleUserId}`;

/**
 * Check if Apple Sign In is available (iOS 13+)
 */
export const isAppleSignInAvailable = async (): Promise<boolean> => {
  return await AppleAuthentication.isAvailableAsync();
};

/**
 * Sign in with Apple and return Firebase credential result
 */
export const signInWithApple = async () => {
  // Generate secure nonce
  const rawNonce = Math.random().toString(36).substring(2, 10);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  // Request Apple credentials
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-In did not return an identity token");
  }

  // Create Firebase OAuth credential
  const provider = new OAuthProvider("apple.com");
  const oAuthCredential = provider.credential({
    idToken: credential.identityToken,
    rawNonce,
  });

  // Sign in to Firebase
  const result = await signInWithCredential(auth, oAuthCredential);
  const firebaseUser = result.user;

  // Apple only provides name on very first sign-in ever.
  // After account deletion + re-login, Apple sends no name again.
  // Solution: persist the name in AsyncStorage keyed by Apple's stable user ID.
  const appleUserId = credential.user; // Apple's stable user ID (survives app reinstall)
  const fullName = credential.fullName;
  const appleDisplayName =
    fullName?.givenName || fullName?.familyName
      ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim()
      : null;

  // Save to AsyncStorage whenever Apple sends the name (first login)
  if (appleDisplayName) {
    await AsyncStorage.setItem(
      appleNameKey(appleUserId),
      appleDisplayName,
    ).catch(() => {});
  }

  // Resolve name: Apple credential → AsyncStorage (survives delete+re-login) → Firebase Auth → fallback
  const storedName =
    appleDisplayName ?? (await AsyncStorage.getItem(appleNameKey(appleUserId)));
  const displayName = storedName || firebaseUser.displayName || "Apple User";

  // Also persist to Firebase Auth profile for convenience
  if (appleDisplayName && !firebaseUser.displayName) {
    await updateProfile(firebaseUser, { displayName: appleDisplayName }).catch(
      () => {},
    );
  }

  return {
    firebaseUser,
    displayName,
    email: credential.email || firebaseUser.email || "",
    isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false,
  };
};
