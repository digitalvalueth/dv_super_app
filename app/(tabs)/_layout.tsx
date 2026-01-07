import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

export default function TabLayout() {
  const { colors } = useTheme();

  const bgColor = Platform.OS === "android" ? colors.card : null;
  const indicatorBgColor =
    Platform.OS === "android" ? colors.border : undefined;
  const foregroundColor = Platform.OS === "android" ? colors.text : undefined;

  return (
    <NativeTabs
      backgroundColor={bgColor}
      indicatorColor={indicatorBgColor}
      disableTransparentOnScrollEdge={false}
      iconColor={foregroundColor}
      labelStyle={{
        color: foregroundColor,
      }}
    >
      <NativeTabs.Trigger name="products">
        <Label>สินค้า</Label>
        {Platform.OS === "ios" ? (
          <Icon sf="cube" />
        ) : (
          <Ionicons name="cube-outline" size={24} color={foregroundColor} />
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Label>ประวัติ</Label>
        {Platform.OS === "ios" ? (
          <Icon sf="clock" />
        ) : (
          <Ionicons name="time-outline" size={24} color={foregroundColor} />
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>โปรไฟล์</Label>
        {Platform.OS === "ios" ? (
          <Icon sf="person" />
        ) : (
          <Ionicons name="person-outline" size={24} color={foregroundColor} />
        )}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
