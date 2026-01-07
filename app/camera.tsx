import { StyleSheet, Text, View } from "react-native";

export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>📷 Camera Screen</Text>
      <Text style={styles.subtitle}>Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  text: {
    fontSize: 24,
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
  },
});
