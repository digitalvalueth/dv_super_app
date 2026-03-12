import { auth } from "@/config/firebase";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  getAdditionalUserInfo,
  OAuthProvider,
  signInWithCredential,
} from "firebase/auth";

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

  // Apple only provides name on very first sign-in
  const fullName = credential.fullName;
  const displayName =
    fullName?.givenName || fullName?.familyName
      ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim()
      : firebaseUser.displayName || "Apple User";

  return {
    firebaseUser,
    displayName,
    email: credential.email || firebaseUser.email || "",
    isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false,
  };
};
