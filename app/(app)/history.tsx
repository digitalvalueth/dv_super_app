import { useTheme } from "@/stores/theme.store";
import { StyleSheet, Text, View } from "react-native";

export default function HistoryScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.emoji}>📊</Text>
      <Text style={[styles.title, { color: colors.text }]}>
        ประวัติการนับสินค้า
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Coming Soon...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
});
