import { useAuthStore } from "@/stores/auth.store";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  console.log("📍 AuthLayout - loading:", loading, "user:", user?.email);
  console.log(
    "📍 AuthLayout - companyId:",
    user?.companyId,
    "branchId:",
    user?.branchId,
  );

  // Show loading spinner while initializing
  if (loading) {
    console.log("⏳ AuthLayout - Still loading...");
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // If user is authenticated, redirect appropriately
  if (user) {
    const isDisabled =
      user.status === "inactive" || user.status === "suspended";
    if (isDisabled) {
      console.log(
        "🚫 AuthLayout - Account disabled, redirecting to pending-approval",
      );
      return <Redirect href="/pending-approval" />;
    }
    console.log("🚀 Redirecting to /(tabs)/home");
    return <Redirect href="/(tabs)/home" />;
  }

  console.log("📍 Showing login screen");
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
