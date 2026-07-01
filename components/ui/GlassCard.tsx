import { useTheme } from "@/stores/theme.store";
import { BlurView } from "expo-blur";
import { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  radius?: number;
  /** Force the blur tint — use "light" for cards placed over a bright gradient. */
  tint?: "light" | "dark" | "default";
  /** Translucent overlay on top of the blur (the "frost"). */
  overlay?: string;
}

/**
 * Frosted-glass card — real blur on iOS (and Android via the experimental
 * method), degrading to a translucent panel elsewhere. iOS-26 "Liquid Glass"
 * vibe: subtle highlight border + soft frost.
 */
export function GlassCard({
  children,
  style,
  intensity = 40,
  radius = 22,
  tint,
  overlay,
}: GlassCardProps) {
  const { isDark } = useTheme();
  const frost =
    overlay ??
    (isDark ? "rgba(28,28,30,0.45)" : "rgba(255,255,255,0.55)");
  const borderColor = isDark
    ? "rgba(255,255,255,0.14)"
    : "rgba(255,255,255,0.7)";

  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor,
        },
        style as ViewStyle,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={tint ?? (isDark ? "dark" : "light")}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: frost }]} />
      {children}
    </View>
  );
}
