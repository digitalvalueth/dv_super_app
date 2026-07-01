import { Stack } from "expo-router";

export default function ShopStockReceiveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="form" />
      <Stack.Screen name="camera" />
      <Stack.Screen name="review" />
      <Stack.Screen name="result" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
