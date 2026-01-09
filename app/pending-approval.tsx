import { signOut } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PendingApprovalScreen() {
  const { colors, isDark } = useTheme();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    Alert.alert("ออกจากระบบ", "คุณต้องการออกจากระบบหรือไม่?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ออกจากระบบ",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            logout();
            router.replace("/(login)");
          } catch {
            Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถออกจากระบบได้");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <LinearGradient
        colors={
          isDark
            ? ["#1a1a2e", "#16213e"]
            : [colors.primary + "10", colors.background]
        }
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Icon */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Ionicons name="time" size={80} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            รอการอนุมัติ
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ
          </Text>

          {/* Email */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="mail" size={24} color={colors.primary} />
            <Text style={[styles.email, { color: colors.text }]}>
              {user?.email}
            </Text>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={[styles.instructionsTitle, { color: colors.text }]}>
              ขั้นตอนถัดไป:
            </Text>

            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepBullet,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text style={[styles.stepNumber, { color: colors.primary }]}>
                  1
                </Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                ติดต่อผู้ดูแลระบบเพื่อขออนุมัติการเข้าถึง
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepBullet,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text style={[styles.stepNumber, { color: colors.primary }]}>
                  2
                </Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                รอผู้ดูแลกำหนดบริษัทและสาขาให้กับคุณ
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepBullet,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text style={[styles.stepNumber, { color: colors.primary }]}>
                  3
                </Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                เข้าสู่ระบบอีกครั้งหลังได้รับการอนุมัติ
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.logoutButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out" size={20} color={colors.text} />
              <Text style={[styles.logoutText, { color: colors.text }]}>
                ออกจากระบบ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    maxWidth: 300,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
  email: {
    fontSize: 16,
    fontWeight: "500",
  },
  instructionsContainer: {
    width: "100%",
    gap: 16,
    marginBottom: 32,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepBullet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "bold",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    paddingTop: 4,
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
