import { StyleSheet, Text, View } from "react-native";

export default function PreviewScreen() {
  return (
    <View style={styles.container}>
      <Text>Preview Screen - Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
