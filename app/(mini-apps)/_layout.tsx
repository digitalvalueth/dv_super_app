import { useTheme } from "@/stores/theme.store";
import { Stack } from "expo-router";

export default function MiniAppsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerBackTitle: "กลับ",
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="stock-counter"
        options={{
          headerShown: false,
          title: "นับสต็อก",
        }}
      />
      <Stack.Screen
        name="check-in"
        options={{
          headerShown: false,
          title: "เช็คชื่อพนักงาน",
        }}
      />
      <Stack.Screen
        name="delivery-receive"
        options={{
          headerShown: false,
          title: "รับสินค้า",
        }}
      />
      <Stack.Screen
        name="speech-to-text"
        options={{
          title: "Speech to Text",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="reports"
        options={{
          title: "รายงาน",
          headerShown: true,
        }}
      />
    </Stack>
  );
}
