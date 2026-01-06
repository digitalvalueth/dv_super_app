import { useAuthStore } from "@/stores/auth.store";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  // If user is authenticated, redirect to app
  if (!loading && user) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
