import { processGoogleAuth } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  const [isLoading, setIsLoading] = useState(false);

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

      if (error.code === "SIGN_IN_CANCELLED") {
        console.log("ℹ️ User cancelled sign-in");
      } else if (error.code === "IN_PROGRESS") {
        console.log("ℹ️ Sign-in already in progress");
      } else if (error.code === "PLAY_SERVICES_NOT_AVAILABLE") {
        alert("Google Play Services ไม่พร้อมใช้งาน");
      } else {
        setError(error.message || "Failed to sign in");
        alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
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
        <Text style={[styles.title, { color: colors.text }]}>Super Fitt</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          ระบบนับสินค้าด้วย AI
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
              นับสินค้าอัตโนมัติ
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
              รายงานแบบเรียลไทม์
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
              ปลอดภัยสูง
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
              <Text style={styles.buttonText}>เข้าสู่ระบบด้วย Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          ใช้บัญชี Google ของบริษัทในการเข้าสู่ระบบ
        </Text>
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
  note: {
    marginTop: 24,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
