import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Redirect } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { ActivityIndicator, Platform, View } from "react-native";

export default function TabLayout() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const isFirebaseAuthenticated = useAuthStore(
    (state) => state.isFirebaseAuthenticated,
  );

  console.log("📍 TabLayout - loading:", loading, "user:", user?.email);

  // Still initializing
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Firebase Auth confirmed but Firestore snapshot hasn't arrived yet
  // (prevents flicker-redirect to login during cache-miss)
  if (isFirebaseAuthenticated && !user) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If user is not authenticated, redirect to login
  if (!user) {
    console.log("🚀 TabLayout - Redirecting to /(login)");
    return <Redirect href="/(login)" />;
  }

  // Allow users without company/branch to enter tabs
  // They will see a message to check notifications for invitations
  if (!loading && user && (!user.companyId || !user.branchId)) {
    console.log("📍 TabLayout - User without company/branch, allowing access");
  }

  console.log("✅ TabLayout - Showing tabs");

  // iOS: Use transparent background with blur effect
  // Android: Use solid background color
  const bgColor = Platform.OS === "android" ? colors.card : undefined;
  const indicatorBgColor =
    Platform.OS === "android" ? colors.border : undefined;
  const foregroundColor = Platform.OS === "android" ? colors.text : undefined;

  return (
    <NativeTabs
      backgroundColor={bgColor}
      indicatorColor={indicatorBgColor}
      // Enable glass effect on iOS 26+ (systemDefault adapts to light/dark mode)
      blurEffect={Platform.OS === "ios" ? "systemDefault" : undefined}
      // Keep consistent appearance when scrolling
      disableTransparentOnScrollEdge={false}
      iconColor={foregroundColor}
      labelStyle={{
        color: foregroundColor,
      }}
    >
      <NativeTabs.Trigger name="home">
        <Icon sf="house" />
        <Label>หน้าแรก</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="services">
        <Icon sf="square.grid.2x2" />
        <Label>บริการ</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf="person" />
        <Label>โปรไฟล์</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
