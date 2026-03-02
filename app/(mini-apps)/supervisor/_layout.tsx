import { Stack } from "expo-router";
import { useTheme } from "@/stores/theme.store";

export default function SupervisorLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600" },
        headerBackTitle: "กลับ",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Supervisor Dashboard", headerShown: false }}
      />
      <Stack.Screen
        name="counting-review"
        options={{ title: "รีวิวยอดนับ", headerBackTitle: "กลับ" }}
      />
      <Stack.Screen
        name="team-status"
        options={{ title: "สถานะทีม", headerBackTitle: "กลับ" }}
      />
      <Stack.Screen
        name="alerts"
        options={{ title: "แจ้งเตือน", headerBackTitle: "กลับ" }}
      />
      <Stack.Screen
        name="supplement-review"
        options={{ title: "นับเสริม", headerBackTitle: "กลับ" }}
      />
    </Stack>
  );
}
