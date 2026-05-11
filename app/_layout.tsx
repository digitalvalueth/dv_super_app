import { Ionicons } from "@expo/vector-icons";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  addNotificationResponseReceivedListener,
  registerForPushNotificationsAsync,
  savePushTokenToUser,
} from "@/services/push-notification.service";
import { useAuthStore } from "@/stores/auth.store";

// Prevent auto-hiding splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const initialize = useAuthStore((state) => state.initialize);
  const loading = useAuthStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Load fonts
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

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

  // Handle deep link callback
  const handleDeepLink = useCallback(
    (url: string) => {
      console.log("🔗 Deep link received:", url);

      // Parse URL
      const parsed = Linking.parse(url);
      const pathParts = (parsed.path || "").replace(/^\//, "").split("/");

      // Match: fittbsa://invitation/TOKEN or https://.../invitation/TOKEN
      if (pathParts[0] === "invitation" && pathParts[1]) {
        const token = pathParts[1];
        console.log("📧 Invitation token (path):", token);
        router.push(`/invitation/${token}` as any);
        return;
      }

      // Match: fittbsa://invitation?token=TOKEN (legacy/fallback)
      const tokenParam = parsed.queryParams?.token;
      if (
        (pathParts[0] === "invitation" || parsed.hostname === "invitation") &&
        tokenParam
      ) {
        console.log("📧 Invitation token (query):", tokenParam);
        router.push(`/invitation/${tokenParam}` as any);
      }
    },
    [router],
  );

  // Handle deep links (invitation links)
  useEffect(() => {
    // Handle initial URL (when app is opened from a link)
    const handleInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleDeepLink(url);
      }
    };

    // Handle URL when app is already open
    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  // Show loading screen while initializing or loading fonts
  if (loading || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a0a",
          gap: 16,
        }}
      >
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={{ color: "#888", fontSize: 14 }}>กำลังตรวจสอบ...</Text>
      </View>
    );
  }

  // Determine initial route once — avoids redirect chain:
  // disabled → pending-approval directly (skip login → tabs → pending-approval)
  // authenticated → (tabs) directly (skip login → tabs)
  // unauthenticated → (login)
  const isDisabled =
    user?.status === "inactive" || user?.status === "suspended";
  const initialRouteName = isDisabled
    ? "pending-approval"
    : user
      ? "(tabs)"
      : "(login)";

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName={initialRouteName}
      >
        <Stack.Screen name="(login)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(mini-apps)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="pending-approval" />
        <Stack.Screen
          name="invitation/[token]"
          options={{ presentation: "modal", headerShown: false }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
