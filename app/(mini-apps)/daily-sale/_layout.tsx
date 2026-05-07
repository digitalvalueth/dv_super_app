import { useTheme } from "@/stores/theme.store";
import { Stack } from "expo-router";

export default function DailySaleLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600" },
        headerBackTitle: "กลับ",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="record" options={{ title: "บันทึกยอดขาย" }} />
    </Stack>
  );
}
