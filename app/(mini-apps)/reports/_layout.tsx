import { useTheme } from "@/stores/theme.store";
import { Stack } from "expo-router";

export default function ReportsLayout() {
  const { colors, isDark } = useTheme();

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
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "รายงานและสถิติ",
          headerLargeTitle: true,
          headerLargeTitleStyle: {
            color: colors.text,
          },
        }}
      />
    </Stack>
  );
}
