import { db } from "@/config/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LoginLog = {
  id: string;
  deviceInfo: {
    deviceId: string;
    deviceName: string;
    modelName: string;
    osName: string;
    osVersion: string;
    brand: string;
    manufacturer: string;
    deviceType: number | null;
    isDevice: boolean;
  };
  location?: {
    latitude: number;
    longitude: number;
    city: string | null;
    region: string | null;
    country: string | null;
    address: string;
  };
  loginAt: {
    seconds: number;
    nanoseconds: number;
  };
};

export default function LoginHistoryScreen() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentDeviceId();
    loadLoginLogs();
  }, []);

  const loadCurrentDeviceId = async () => {
    const deviceId = await AsyncStorage.getItem("device_id");
    setCurrentDeviceId(deviceId);
  };

  const loadLoginLogs = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const logsRef = collection(db, `users/${user.uid}/login_logs`);
      const q = query(logsRef, orderBy("loginAt", "desc"));
      const snapshot = await getDocs(q);

      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LoginLog[];

      setLoginLogs(logs);
    } catch (error) {
      console.error("Error loading login logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: { seconds: number; nanoseconds: number }) => {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceIcon = (deviceType: number | null): keyof typeof Ionicons.glyphMap => {
    switch (deviceType) {
      case 1:
        return "phone-portrait";
      case 2:
        return "tablet-portrait";
      case 3:
        return "desktop";
      case 4:
        return "tv";
      default:
        return "hardware-chip";
    }
  };

  const getDeviceTypeName = (deviceType: number | null): string => {
    switch (deviceType) {
      case 1:
        return "มือถือ";
      case 2:
        return "แท็บเล็ต";
      case 3:
        return "คอมพิวเตอร์";
      case 4:
        return "ทีวี";
      default:
        return "อุปกรณ์อื่นๆ";
    }
  };

  const renderLoginLog = ({ item }: { item: LoginLog }) => {
    const isCurrentDevice = currentDeviceId === item.deviceInfo.deviceId;

    return (
      <View
        style={[
          styles.logCard,
          {
            backgroundColor: colors.card,
            borderColor: isCurrentDevice ? colors.primary : colors.border,
          },
          isCurrentDevice && { borderWidth: 2 },
        ]}
      >
        <View style={styles.logHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Ionicons
              name={getDeviceIcon(item.deviceInfo.deviceType)}
              size={24}
              color={colors.primary}
            />
          </View>
          <View style={styles.logInfo}>
            <View style={styles.deviceNameRow}>
              <Text style={[styles.deviceName, { color: colors.text }]}>
                {item.deviceInfo.deviceName || "Unknown Device"}
              </Text>
              {isCurrentDevice && (
                <View
                  style={[
                    styles.activeBadge,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
            </View>
            <Text style={[styles.deviceType, { color: colors.textSecondary }]}>
              {getDeviceTypeName(item.deviceInfo.deviceType)}
            </Text>
          </View>
        </View>

        <View style={styles.logDetails}>
          <View style={styles.detailRow}>
            <Ionicons
              name="hardware-chip-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {item.deviceInfo.modelName}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name="phone-portrait-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {item.deviceInfo.osName} {item.deviceInfo.osVersion}
            </Text>
          </View>

          {item.location && (
            <View style={styles.detailRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.detailText, { color: colors.textSecondary }]}
              >
                {item.location.address || "Unknown Location"}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons
              name="time-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {formatDate(item.loginAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.card }]}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.card}
      />
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ประวัติการเข้าใช้งาน
        </Text>
        <View style={styles.headerRight} />
      </View>

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={[styles.loadingText, { color: colors.textSecondary }]}
            >
              กำลังโหลดข้อมูล...
            </Text>
          </View>
        ) : loginLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="time-outline"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              ไม่พบประวัติการเข้าใช้งาน
            </Text>
          </View>
        ) : (
          <FlatList
            data={loginLogs}
            renderItem={renderLoginLog}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  logCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  logInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "600",
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  deviceType: {
    fontSize: 14,
  },
  logDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
  },
});
