import { processGoogleAuth } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Google OAuth Config
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export default function LoginScreen() {
  const setUser = useAuthStore((state) => state.setUser);
  const setError = useAuthStore((state) => state.setError);
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
        router.replace("/(tabs)/products");
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
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Super Fitt</Text>
        <Text style={styles.subtitle}>ระบบนับสินค้าด้วย AI</Text>

        <View style={styles.illustration}>
          <Text style={styles.emoji}>📦</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>🔐 เข้าสู่ระบบด้วย Google</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          ใช้บัญชี Google ของบริษัทในการเข้าสู่ระบบ
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    marginBottom: 40,
  },
  illustration: {
    marginBottom: 60,
  },
  emoji: {
    fontSize: 100,
  },
  button: {
    backgroundColor: "#4285f4",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 280,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    marginTop: 24,
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});
