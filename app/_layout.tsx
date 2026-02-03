import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  addNotificationResponseReceivedListener,
  registerForPushNotificationsAsync,
  savePushTokenToUser,
} from "@/services/push-notification.service";
import { useAuthStore } from "@/stores/auth.store";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const initialize = useAuthStore((state) => state.initialize);
  const loading = useAuthStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Initialize auth state
    initialize();
  }, [initialize]);

  // Memoized handler for notification taps
  const handleNotificationTap = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      console.log("📬 Notification tapped:", data);

      // Navigate based on notification type
      if (data?.type === "company_invite") {
        router.push("/(tabs)/settings/inbox");
      } else if (data?.type === "assignment") {
        router.push("/(mini-apps)/stock-counter/products");
      }
    },
    [router],
  );

  // Setup push notifications when user is logged in
  useEffect(() => {
    if (user?.uid) {
      // Register for push notifications
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          savePushTokenToUser(user.uid, token);
        }
      });

      // Handle notification tap
      const subscription = addNotificationResponseReceivedListener(
        handleNotificationTap,
      );
      responseListener.current = subscription;

      return () => {
        if (responseListener.current) {
          responseListener.current.remove();
        }
      };
    }
  }, [user?.uid, handleNotificationTap]);

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
        <Stack.Screen name="(mini-apps)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="pending-approval" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
