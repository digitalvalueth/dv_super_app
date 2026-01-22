import { Stack } from "expo-router";

export default function CheckInLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="camera" options={{ animation: "slide_from_right" }} />
      <Stack.Screen
        name="preview"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen name="result" options={{ animation: "slide_from_right" }} />
      <Stack.Screen
        name="history"
        options={{ animation: "slide_from_right" }}
      />
    </Stack>
  );
}
