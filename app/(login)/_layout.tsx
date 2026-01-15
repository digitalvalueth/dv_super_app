import { useAuthStore } from "@/stores/auth.store";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  console.log("📍 AuthLayout - loading:", loading, "user:", user?.email);
  console.log(
    "📍 AuthLayout - companyId:",
    user?.companyId,
    "branchId:",
    user?.branchId
  );

  // Show nothing while loading
  if (loading) {
    console.log("⏳ AuthLayout - Still loading...");
    return null;
  }

  // If user is authenticated, redirect to tabs (regardless of company/branch)
  if (user) {
    console.log("🚀 Redirecting to /(tabs)/products");
    return <Redirect href="/(tabs)/products" />;
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
