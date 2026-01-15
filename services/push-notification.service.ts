import { db } from "@/config/firebase";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | undefined
> {
  let token: string | undefined;

  // Check if running on a physical device
  if (!Device.isDevice) {
    console.log("📱 Push notifications require a physical device");
    return undefined;
  }

  // Check and request notification permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("❌ Push notification permission not granted");
    return undefined;
  }

  try {
    // Get Expo push token
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID, // Add to .env
    });
    token = pushToken.data;
    console.log("📬 Expo Push Token:", token);
  } catch (error: unknown) {
    // Handle iOS simulator or missing entitlements error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("aps-environment") ||
      errorMessage.includes("simulator")
    ) {
      console.log(
        "⚠️ Push notifications not available on iOS Simulator. Use a physical device."
      );
    } else {
      console.error("Error getting push token:", error);
    }
  }

  // Android specific channel setup
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4285f4",
    });

    // Invitation channel
    await Notifications.setNotificationChannelAsync("invitations", {
      name: "คำเชิญ",
      description: "การแจ้งเตือนคำเชิญเข้าร่วมสาขา",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#34a853",
    });

    // Assignment channel
    await Notifications.setNotificationChannelAsync("assignments", {
      name: "งานมอบหมาย",
      description: "การแจ้งเตือนงานที่ได้รับมอบหมาย",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4285f4",
    });
  }

  return token;
}

/**
 * Save push token to user's Firestore document
 */
export async function savePushTokenToUser(
  userId: string,
  token: string
): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      expoPushToken: token,
      pushTokenUpdatedAt: new Date(),
    });
    console.log("✅ Push token saved for user:", userId);
  } catch (error) {
    console.error("Error saving push token:", error);
    throw error;
  }
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: "default",
    },
    trigger: null, // Immediately
  });

  return identifier;
}

/**
 * Get notification listeners
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Remove all delivered notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
