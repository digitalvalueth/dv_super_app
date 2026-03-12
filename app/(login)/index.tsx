import { useTranslation } from "@/constants/i18n";
import {
  isAppleSignInAvailable,
  signInWithApple,
} from "@/services/apple-auth.service";
import {
  processAppleAuth,
  processGoogleAuth,
  signInWithDemo,
} from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Google OAuth Config
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export default function LoginScreen() {
  const setUser = useAuthStore((state) => state.setUser);
  const setError = useAuthStore((state) => state.setError);
  const { colors, isDark } = useTheme();
  const t = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Check Apple Sign-In availability (iOS 13+)
  useEffect(() => {
    if (Platform.OS === "ios") {
      isAppleSignInAvailable().then(setAppleAvailable);
    }
  }, []);

  // Configure Google Sign In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      offlineAccess: true,
    });

    console.log("🔧 Google Sign-In Configured");
    console.log("📱 iOS Client ID:", GOOGLE_IOS_CLIENT_ID);
    console.log("🤖 Android Client ID:", GOOGLE_ANDROID_CLIENT_ID);
    console.log("🌐 Web Client ID:", GOOGLE_WEB_CLIENT_ID);
  }, []);

  const handleDemoLogin = async () => {
    try {
      setIsLoading(true);
      const user = await signInWithDemo();
      if (user) {
        setUser(user);
        router.replace("/(tabs)/home");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithApple();
      if (!result) return; // user cancelled

      const user = await processAppleAuth(
        result.firebaseUser,
        result.displayName,
        result.email,
        result.isNewUser,
      );

      if (user) {
        setUser(user);
        const onboardingCompleted = await AsyncStorage.getItem(
          "onboarding_completed",
        );
        if (onboardingCompleted === "true") {
          router.replace("/(tabs)/home");
        } else {
          router.replace("/onboarding");
        }
      }
    } catch (error: any) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        console.error("❌ Apple Sign-In Error:", error);
        setError(error.message || "Apple Sign-In failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      console.log("🔐 Starting Google Sign-In...");

      // Check if Google Play Services is available (Android only)
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // Sign in with Google
      const response = await GoogleSignin.signIn();
      console.log("✅ Google Sign-In Success:", response);

      // Get ID Token from response
      const idToken = response.data?.idToken;

      if (!idToken) {
        throw new Error("ไม่สามารถรับ ID Token จาก Google");
      }

      console.log("🎫 Got ID Token, authenticating with Firebase...");

      // Authenticate with Firebase
      const user = await processGoogleAuth(idToken);

      if (user) {
        console.log("✅ Firebase Auth Success:", user.email);
        setUser(user);

        // Check if onboarding is completed
        const onboardingCompleted = await AsyncStorage.getItem(
          "onboarding_completed",
        );

        if (onboardingCompleted === "true") {
          console.log("✅ Onboarding completed, redirecting to home");
          router.replace("/(tabs)/home");
        } else {
          console.log("⚠️ Onboarding not completed, redirecting to onboarding");
          router.replace("/onboarding");
        }
      }
    } catch (error: any) {
      console.error("❌ Google Sign-In Error:", error);
      console.error("❌ Error Code:", error.code);
      console.error("❌ Error Message:", error.message);
      console.error("❌ Error Stack:", error.stack);
      console.error("❌ Full Error Object:", JSON.stringify(error, null, 2));

      if (error.code === "SIGN_IN_CANCELLED") {
        console.log("ℹ️ User cancelled sign-in");
      } else if (error.code === "IN_PROGRESS") {
        console.log("ℹ️ Sign-in already in progress");
      } else if (error.code === "PLAY_SERVICES_NOT_AVAILABLE") {
        alert("Google Play Services ไม่พร้อมใช้งาน");
      } else {
        // แสดง error แบบละเอียด
        const errorDetails =
          `
🚨 Google Sign-In Failed

` +
          `❌ Error Code: ${error.code || "N/A"}\n` +
          `❌ Message: ${error.message || "Unknown error"}\n\n` +
          `📱 Config Check:\n` +
          `iOS Client: ${GOOGLE_IOS_CLIENT_ID ? "✅" : "❌"}\n` +
          `Android Client: ${GOOGLE_ANDROID_CLIENT_ID ? "✅" : "❌"}\n` +
          `Web Client: ${GOOGLE_WEB_CLIENT_ID ? "✅" : "❌"}\n\n` +
          `💡 Tip: Check console logs for details`;

        setError(error.message || "Failed to sign in");
        alert(errorDetails);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Gradient Background */}
      <LinearGradient
        colors={
          isDark
            ? ["#000000", "#1a1a1a", "#000000"]
            : ["#ffffff", "#f8f9fa", "#ffffff"]
        }
        style={styles.gradient}
      />

      <View style={styles.content}>
        {/* Logo Icon */}
        <View
          style={[
            styles.logoContainer,
            { backgroundColor: colors.primary + "20" },
          ]}
        >
          <Ionicons name="cube" size={80} color={colors.primary} />
        </View>

        {/* App Name */}
        <Text style={[styles.title, { color: colors.text }]}>FITT BSA</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t.login.subtitle}
        </Text>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
              {t.login.featureCount}
            </Text>
          </View>

          <View style={styles.feature}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <Ionicons name="bar-chart" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
              {t.login.featureReport}
            </Text>
          </View>

          <View style={styles.feature}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
              {t.login.featureSecurity}
            </Text>
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleGoogleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name="logo-google"
                size={24}
                color="#fff"
                style={styles.googleIcon}
              />
              <Text style={styles.buttonText}>{t.login.signInWithGoogle}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Sign in with Apple (iOS only, required for App Store) */}
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={16}
            style={styles.appleButton}
            onPress={handleAppleLogin}
          />
        )}

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          {t.login.note}
        </Text>

        {/* App Review Demo — hidden at bottom, for Apple reviewers */}
        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleDemoLogin}
          disabled={isLoading}
        >
          <Text style={styles.demoButtonText}>App Review Demo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  logoContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    shadowColor: "#4285f4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 48,
  },
  featuresContainer: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 48,
  },
  feature: {
    alignItems: "center",
    gap: 8,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    fontSize: 12,
    fontWeight: "500",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    minWidth: 300,
    gap: 12,
    shadowColor: "#4285f4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    marginRight: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  appleButton: {
    width: 300,
    height: 56,
    marginTop: 16,
  },
  demoButton: {
    marginTop: 32,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  demoButtonText: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
  },
  note: {
    marginTop: 24,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
