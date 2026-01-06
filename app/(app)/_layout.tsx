import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthStore } from "@/stores/auth.store";
import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";

export default function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  // If user is not authenticated, redirect to login
  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4285f4",
        headerShown: true,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
          },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "รายการสินค้า",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet" color={color} />
          ),
          headerTitle: "รายการสินค้าที่ต้องนับ",
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "ประวัติ",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="clock" color={color} />
          ),
          headerTitle: "ประวัติการนับสินค้า",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "โปรไฟล์",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person" color={color} />
          ),
          headerTitle: "โปรไฟล์ของฉัน",
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen
        name="camera"
        options={{
          href: null, // Hide from tabs
        }}
      />
      <Tabs.Screen
        name="preview"
        options={{
          href: null, // Hide from tabs
        }}
      />
      <Tabs.Screen
        name="result"
        options={{
          href: null, // Hide from tabs
        }}
      />
    </Tabs>
  );
}
