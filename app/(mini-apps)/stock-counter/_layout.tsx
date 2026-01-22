import { Stack } from "expo-router";

export default function StockCounterLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* products and history are folders with _layout.tsx, auto-detected */}
      <Stack.Screen name="camera" options={{ animation: "slide_from_right" }} />
      <Stack.Screen
        name="preview"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen name="result" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
