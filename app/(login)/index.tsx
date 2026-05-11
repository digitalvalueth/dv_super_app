import { useTranslation } from "@/constants/i18n";
import {
  isAppleSignInAvailable,
  signInWithApple,
} from "@/services/apple-auth.service";
import {
  processAppleAuth,
  processGoogleAuth,
  signInWithDemo,
  signInWithEmail,
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
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

  const handleEmailLogin = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setEmailError("กรุณากรอก Email และ Password");
      return;
    }
    try {
      setEmailError("");
      setIsLoading(true);
      const user = await signInWithEmail(emailInput.trim(), passwordInput);
      if (user) {
        setUser(user);
        const onboardingCompleted = await AsyncStorage.getItem(
          "onboarding_completed",
        );
        router.replace(
          onboardingCompleted === "true" ? "/(tabs)/home" : "/onboarding",
        );
      }
    } catch (error: any) {
      const msg =
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/wrong-password"
          ? "Email หรือ Password ไม่ถูกต้อง"
          : error?.code === "auth/user-not-found"
            ? "ไม่พบบัญชีนี้ในระบบ"
            : error?.code === "auth/too-many-requests"
              ? "ลองใหม่ภายหลัง (มีการเข้าสู่ระบบผิดพลาดบ่อยเกินไป)"
              : error.message;
      setEmailError(msg);
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

        // If admin disabled the account, go directly to pending-approval
        const isDisabled =
          user.status === "inactive" || user.status === "suspended";
        if (isDisabled) {
          console.log(
            "🚫 Account disabled after login, redirecting to pending-approval",
          );
          router.replace("/pending-approval");
          return;
        }

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

        {/* Email Sign In Button */}
        <TouchableOpacity
          style={[styles.emailButton, { borderColor: colors.border }]}
          onPress={() => setShowEmailForm(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="mail-outline" size={22} color={colors.text} />
          <Text style={[styles.emailButtonText, { color: colors.text }]}>
            Sign in with Email
          </Text>
        </TouchableOpacity>

        {/* Email Login Modal */}
        <Modal
          visible={showEmailForm}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowEmailForm(false);
            setEmailError("");
          }}
        >
          <TouchableWithoutFeedback
            onPress={() => {
              setShowEmailForm(false);
              setEmailError("");
            }}
          >
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                  <View
                    style={[
                      styles.modalSheet,
                      { backgroundColor: colors.card },
                    ]}
                  >
                    {/* Handle bar */}
                    <View
                      style={[
                        styles.modalHandle,
                        { backgroundColor: colors.border },
                      ]}
                    />

                    {/* Header */}
                    <View style={styles.modalHeader}>
                      <View
                        style={[
                          styles.modalIconBg,
                          { backgroundColor: colors.primary + "20" },
                        ]}
                      >
                        <Ionicons
                          name="mail"
                          size={28}
                          color={colors.primary}
                        />
                      </View>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>
                        เข้าสู่ระบบ
                      </Text>
                      <Text
                        style={[
                          styles.modalSubtitle,
                          { color: colors.textSecondary },
                        ]}
                      >
                        ใช้อีเมลและรหัสผ่านของคุณ
                      </Text>
                    </View>

                    {/* Email Input */}
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.modalInput, { color: colors.text }]}
                        placeholder="อีเมล"
                        placeholderTextColor={colors.textSecondary}
                        value={emailInput}
                        onChangeText={setEmailInput}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                      />
                    </View>

                    {/* Password Input */}
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.modalInput, { color: colors.text }]}
                        placeholder="รหัสผ่าน"
                        placeholderTextColor={colors.textSecondary}
                        value={passwordInput}
                        onChangeText={setPasswordInput}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={handleEmailLogin}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((v) => !v)}
                        style={styles.eyeButton}
                      >
                        <Ionicons
                          name={
                            showPassword ? "eye-off-outline" : "eye-outline"
                          }
                          size={20}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Error */}
                    {emailError ? (
                      <View style={styles.errorRow}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={16}
                          color="#ef4444"
                        />
                        <Text style={styles.emailError}>{emailError}</Text>
                      </View>
                    ) : null}

                    {/* Sign In Button */}
                    <TouchableOpacity
                      style={[
                        styles.modalSignInButton,
                        { backgroundColor: colors.primary },
                        isLoading && styles.buttonDisabled,
                      ]}
                      onPress={handleEmailLogin}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.modalSignInText}>เข้าสู่ระบบ</Text>
                      )}
                    </TouchableOpacity>

                    {/* Cancel */}
                    <TouchableOpacity
                      style={styles.modalCancelButton}
                      onPress={() => {
                        setShowEmailForm(false);
                        setEmailError("");
                      }}
                    >
                      <Text
                        style={[
                          styles.modalCancelText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        ยกเลิก
                      </Text>
                    </TouchableOpacity>
                  </View>
                </KeyboardAvoidingView>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
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
  note: {
    marginTop: 24,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  // Email button (outline style like Google/Apple)
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 300,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
    marginTop: 16,
  },
  emailButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 28,
    gap: 8,
  },
  modalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "400",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 6,
    marginLeft: 4,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  emailError: {
    fontSize: 13,
    color: "#ef4444",
    flexShrink: 1,
  },
  modalSignInButton: {
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#4285f4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSignInText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  modalCancelButton: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
