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

  // If user is authenticated, redirect to tabs
  if (user) {
    // Check if user has company/branch
    if (!user.companyId || !user.branchId) {
      console.log("🚀 Redirecting to /pending-approval");
      return <Redirect href="/pending-approval" />;
    }
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
