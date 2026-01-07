import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/stores/auth.store";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initialize = useAuthStore((state) => state.initialize);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    // Initialize auth state
    initialize();
  }, []);

  // Show loading screen while initializing
  if (loading) {
    return null; // or return a loading component
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName="(login)"
      >
        <Stack.Screen name="(login)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="pending-approval" />
        <Stack.Screen name="camera" />
        <Stack.Screen name="preview" />
        <Stack.Screen name="result" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
