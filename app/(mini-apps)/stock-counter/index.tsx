import { trackAppUsage } from "@/services/app-usage.service";
import {
  canUploadPhoto,
  getCurrentPeriod,
  getPeriodLabel,
} from "@/services/counting-period.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Import tab content components
import HistoryContent from "./history/index";
import InboxContent from "./inbox/index";
import ProductsContent from "./products/index";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TabKey = "products" | "history" | "inbox";
type ViewMode = "grid" | "list";

const TABS = [
  { key: "products" as TabKey, label: "รายการสินค้า", icon: "cube-outline" },
  { key: "history" as TabKey, label: "ประวัติ", icon: "time-outline" },
  { key: "inbox" as TabKey, label: "Inbox", icon: "mail-outline", badge: 0 },
];

// Context สำหรับแชร์ viewMode + upload status
const ViewModeContext = createContext<{
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  uploadStatus: "open" | "locked" | "grace" | "closed" | null;
  periodMessage: string;
}>({
  viewMode: "grid",
  setViewMode: () => {},
  uploadStatus: null,
  periodMessage: "",
});

export const useViewMode = () => useContext(ViewModeContext);

export default function StockCounterIndex() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("products");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showMenu, setShowMenu] = useState(false);
  // Period banner state
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "open" | "locked" | "grace" | "closed" | null
  >(null);
  const [periodMessage, setPeriodMessage] = useState<string>("");
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const hasInitializedTab = useRef(false);
  const menuAnimation = useRef(new Animated.Value(0)).current;
  const backdropAnimation = useRef(new Animated.Value(0)).current;

  // Track app usage when component mounts
  useEffect(() => {
    trackAppUsage("stock-counter", user?.uid);
  }, [user?.uid]);

  // Fetch current counting period status
  useEffect(() => {
    async function checkPeriod() {
      if (!user?.companyId) return;
      try {
        const result = await canUploadPhoto(user.companyId);
        setUploadStatus(result.status);
        setPeriodMessage(result.message);

        const period = await getCurrentPeriod(user.companyId);
        if (period) {
          setPeriodLabel(getPeriodLabel(period));
        }
      } catch {
        // ไม่มี period ก็ผ่านไปได้
      }
    }
    checkPeriod();
  }, [user?.companyId]);

  const handleTabPress = (tab: TabKey, index: number) => {
    setActiveTab(tab);
    scrollViewRef.current?.scrollTo({
      x: SCREEN_WIDTH * index,
      animated: true,
    });
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SCREEN_WIDTH);
        const newTab = TABS[index]?.key;
        if (newTab && newTab !== activeTab) {
          setActiveTab(newTab);
        }
      },
    },
  );

  const handleMenuPress = () => {
    if (showMenu) {
      // Close animation
      Animated.parallel([
        Animated.timing(menuAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setShowMenu(false));
    } else {
      setShowMenu(true);
      // Open animation
      Animated.parallel([
        Animated.timing(menuAnimation, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnimation, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleViewModeSelect = (mode: ViewMode) => {
    setViewMode(mode);
    // Close animation
    Animated.parallel([
      Animated.timing(menuAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowMenu(false));
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowMenu(false));
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (showMenu) {
      const timer = setTimeout(() => {
        // Auto close after 10 seconds
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showMenu]);

  // Handle tab parameter from navigation
  useEffect(() => {
    if (tab && !hasInitializedTab.current) {
      const tabIndex = TABS.findIndex((t) => t.key === tab);
      if (tabIndex !== -1) {
        hasInitializedTab.current = true;
        setActiveTab(tab as TabKey);
        // Delay scroll to ensure layout is ready
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: SCREEN_WIDTH * tabIndex,
            animated: false,
          });
        }, 100);
      }
    }
  }, [tab]);

  return (
    <ViewModeContext.Provider
      value={{ viewMode, setViewMode, uploadStatus, periodMessage }}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.card }]}
        edges={["top"]}
      >
        {/* Backdrop to close menu */}
        {showMenu && (
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropAnimation,
              },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={closeMenu} />
          </Animated.View>
        )}
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Ionicons name="home-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            นับสต็อก
          </Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleMenuPress}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Dropdown Menu - Outside header for proper z-index */}
        {showMenu && (
          <Animated.View
            style={[
              styles.dropdown,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: isDark ? "#fff" : "#000",
                opacity: menuAnimation,
                transform: [
                  {
                    translateY: menuAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                  {
                    scale: menuAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                viewMode === "grid" && {
                  backgroundColor: colors.primary + "15",
                },
              ]}
              onPress={() => handleViewModeSelect("grid")}
            >
              <Ionicons
                name="grid"
                size={18}
                color={viewMode === "grid" ? colors.primary : colors.text}
              />
              <Text
                style={[
                  styles.dropdownText,
                  {
                    color: viewMode === "grid" ? colors.primary : colors.text,
                  },
                ]}
              >
                มุมมอง Grid
              </Text>
              {viewMode === "grid" && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
            <View
              style={[
                styles.dropdownDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                viewMode === "list" && {
                  backgroundColor: colors.primary + "15",
                },
              ]}
              onPress={() => handleViewModeSelect("list")}
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === "list" ? colors.primary : colors.text}
              />
              <Text
                style={[
                  styles.dropdownText,
                  {
                    color: viewMode === "list" ? colors.primary : colors.text,
                  },
                ]}
              >
                มุมมอง List
              </Text>
              {viewMode === "list" && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Period Status Banner */}
        {uploadStatus !== null && (
          <View
            style={[
              styles.periodBanner,
              uploadStatus === "locked"
                ? { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }
                : uploadStatus === "closed"
                  ? { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" }
                  : uploadStatus === "grace"
                    ? { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }
                    : { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
            ]}
          >
            <View style={styles.periodBannerLeft}>
              <Text style={styles.periodBannerIcon}>
                {uploadStatus === "locked"
                  ? "🔒"
                  : uploadStatus === "closed"
                    ? "❌"
                    : uploadStatus === "grace"
                      ? "⏰"
                      : "📅"}
              </Text>
              <View>
                {periodLabel && (
                  <Text
                    style={[
                      styles.periodBannerLabel,
                      {
                        color:
                          uploadStatus === "locked"
                            ? "#991B1B"
                            : uploadStatus === "closed"
                              ? "#374151"
                              : uploadStatus === "grace"
                                ? "#92400E"
                                : "#14532D",
                      },
                    ]}
                  >
                    รอบปัจจุบัน: {periodLabel}
                  </Text>
                )}
                {periodMessage ? (
                  <Text
                    style={[
                      styles.periodBannerSub,
                      {
                        color:
                          uploadStatus === "locked"
                            ? "#B91C1C"
                            : uploadStatus === "closed"
                              ? "#6B7280"
                              : uploadStatus === "grace"
                                ? "#B45309"
                                : "#166534",
                      },
                    ]}
                  >
                    {periodMessage}
                  </Text>
                ) : (
                  <Text style={[styles.periodBannerSub, { color: "#166534" }]}>
                    เปิดรับรูปภาพ
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Segment Control */}
        <View
          style={[
            styles.segmentContainer,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          {TABS.map((tab, index) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.segmentButton,
                  isActive && {
                    borderBottomWidth: 2,
                    borderBottomColor: colors.primary,
                  },
                ]}
                onPress={() => handleTabPress(tab.key, index)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isActive ? colors.primary : colors.textSecondary,
                      fontWeight: isActive ? "600" : "400",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View
                    style={[styles.badge, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.badgeText}>{tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Swipeable Content */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <ProductsContent />
          </View>
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <HistoryContent />
          </View>
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <InboxContent />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ViewModeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 998,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  segmentContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  segmentText: {
    fontSize: 14,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  page: {
    flex: 1,
  },
  dropdown: {
    position: "absolute",
    top: 68, // Header height + padding
    right: 16,
    width: 180,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 999,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  dropdownDivider: {
    height: 1,
  },
  periodBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  periodBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  periodBannerIcon: {
    fontSize: 20,
  },
  periodBannerLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  periodBannerSub: {
    fontSize: 11,
    marginTop: 1,
  },
});
