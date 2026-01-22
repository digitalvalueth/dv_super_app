import { db } from "@/config/firebase";
import { signOut } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { ThemeMode, useTheme, useThemeStore } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SettingItemWithComponent = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  component: React.ReactNode;
  badge?: number;
};

type SettingItemWithPress = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
};

type SettingItem = SettingItemWithComponent | SettingItemWithPress;

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { colors, isDark, mode } = useTheme();
  const setMode = useThemeStore((state) => state.setMode);
  const [unreadCount, setUnreadCount] = useState(0);
  const [companyName, setCompanyName] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("");

  // Load company and branch names
  useFocusEffect(
    useCallback(() => {
      const loadNames = async () => {
        if (!user) return;

        // Load company name if not in user object
        if (user.companyId && !user.companyName) {
          try {
            const companyDoc = await getDoc(
              doc(db, "companies", user.companyId),
            );
            if (companyDoc.exists()) {
              setCompanyName(companyDoc.data().name || "");
            }
          } catch (error) {
            console.error("Error loading company name:", error);
          }
        } else {
          setCompanyName(user.companyName || "");
        }

        // Load branch name if not in user object
        if (user.branchId && !user.branchName) {
          try {
            const branchDoc = await getDoc(doc(db, "branches", user.branchId));
            if (branchDoc.exists()) {
              setBranchName(branchDoc.data().name || "");
            }
          } catch (error) {
            console.error("Error loading branch name:", error);
          }
        } else {
          setBranchName(user.branchName || "");
        }
      };

      loadNames();
    }, [user]),
  );

  // Load unread notifications count
  useFocusEffect(
    useCallback(() => {
      const loadUnreadCount = async () => {
        if (!user) return;
        try {
          const notificationsRef = collection(db, "notifications");
          const q = query(
            notificationsRef,
            where("userId", "==", user.uid),
            where("read", "==", false),
          );
          const snapshot = await getDocs(q);
          setUnreadCount(snapshot.size);
        } catch (error) {
          console.error("Error loading unread count:", error);
        }
      };
      loadUnreadCount();
    }, [user]),
  );

  const handleLogout = () => {
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

  const handleThemeChange = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const themeOptions: {
    mode: ThemeMode;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }[] = [
    { mode: "light", icon: "sunny", label: "สว่าง" },
    { mode: "dark", icon: "moon", label: "มืด" },
    { mode: "system", icon: "phone-portrait", label: "ตามระบบ" },
  ];

  const settingsSections: { title: string; items: SettingItem[] }[] = [
    {
      title: "ธีม",
      items: [
        {
          icon: "color-palette",
          label: "โหมดสี",
          component: (
            <View style={styles.themeSelector}>
              {themeOptions.map((option) => (
                <TouchableOpacity
                  key={option.mode}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    mode === option.mode && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + "20",
                    },
                  ]}
                  onPress={() => handleThemeChange(option.mode)}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={
                      mode === option.mode
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      {
                        color:
                          mode === option.mode
                            ? colors.primary
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        },
      ],
    },
    // Show admin section only for admin users
    ...(user?.role === "admin" || user?.role === "super_admin"
      ? [
          {
            title: "การจัดการ",
            items: [
              {
                icon: "people",
                label: "คำขอเข้าใช้งาน",
                onPress: () => router.push("/settings/access-requests" as any),
              },
            ] as SettingItem[],
          },
        ]
      : []),
    {
      title: "บัญชี",
      items: [
        {
          icon: "mail",
          label: "กล่องข้อความ",
          badge: unreadCount,
          onPress: () => router.push("/(tabs)/settings/inbox"),
        },
        {
          icon: "person",
          label: "แก้ไขโปรไฟล์",
          onPress: () => Alert.alert("Coming Soon", "ฟีเจอร์นี้กำลังพัฒนา"),
        },
        {
          icon: "time",
          label: "ประวัติการเข้าใช้งาน",
          onPress: () => router.push("/(tabs)/settings/login-history"),
        },
      ],
    },
    {
      title: "ทั่วไป",
      items: [
        {
          icon: "help-circle",
          label: "ช่วยเหลือ",
          onPress: () => Alert.alert("Coming Soon", "ฟีเจอร์นี้กำลังพัฒนา"),
        },
        {
          icon: "information-circle",
          label: "เกี่ยวกับ",
          onPress: () =>
            Alert.alert("Super Fitt", "Version 1.0.0\n\n© 2026 Super Fitt"),
        },
      ],
    },
  ];

  if (!user) return null;

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          โปรไฟล์
        </Text>
      </View>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
          <View style={styles.avatarContainer}>
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={styles.avatar}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.primary + "30" },
                ]}
              >
                <Ionicons name="person" size={40} color={colors.primary} />
              </View>
            )}
          </View>

          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.name || "User"}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {user?.email}
          </Text>

          <View
            style={[
              styles.roleBadge,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Ionicons
              name="shield-checkmark"
              size={14}
              color={colors.primary}
            />
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {user?.role === "employee"
                ? "พนักงาน"
                : user?.role === "admin"
                  ? "เจ้าของบริษัท"
                  : user?.role === "super_admin"
                    ? "ผู้ดูแลระบบ"
                    : user?.role === "supervisor"
                      ? "หัวหน้างาน"
                      : user?.role === "manager"
                        ? "ผู้จัดการสาขา"
                        : user?.role}
            </Text>
          </View>

          {/* Company & Branch Info Badges */}
          {user?.companyId && (
            <View style={styles.badgeContainer}>
              <View
                style={[
                  styles.infoBadge,
                  { backgroundColor: "#10b981" + "20" },
                ]}
              >
                <Ionicons name="business" size={14} color="#10b981" />
                <Text style={[styles.infoBadgeText, { color: "#10b981" }]}>
                  {companyName || user?.companyCode || user?.companyId}
                </Text>
              </View>

              {user?.branchId && (
                <View
                  style={[
                    styles.infoBadge,
                    { backgroundColor: "#f59e0b" + "20" },
                  ]}
                >
                  <Ionicons name="location" size={14} color="#f59e0b" />
                  <Text style={[styles.infoBadgeText, { color: "#f59e0b" }]}>
                    {branchName || user?.branchCode || user?.branchId}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              {section.title}
            </Text>

            <View
              style={[styles.sectionCard, { backgroundColor: colors.card }]}
            >
              {section.items.map((item, itemIndex) => (
                <View key={itemIndex}>
                  {"component" in item ? (
                    <View style={styles.settingItem}>
                      <View style={styles.settingItemLeft}>
                        <Ionicons
                          name={item.icon}
                          size={22}
                          color={colors.primary}
                        />
                        <Text
                          style={[styles.settingLabel, { color: colors.text }]}
                        >
                          {item.label}
                        </Text>
                      </View>
                      {item.component}
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.settingItem,
                        itemIndex < section.items.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        },
                      ]}
                      onPress={item.onPress}
                    >
                      <View style={styles.settingItemLeft}>
                        <View style={styles.iconWithBadge}>
                          <Ionicons
                            name={item.icon}
                            size={22}
                            color={colors.primary}
                          />
                          {item.badge && item.badge > 0 ? (
                            <View
                              style={[
                                styles.notificationBadge,
                                { backgroundColor: colors.error },
                              ]}
                            >
                              <Text style={styles.badgeText}>
                                {item.badge > 99 ? "99+" : item.badge}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          style={[styles.settingLabel, { color: colors.text }]}
                        >
                          {item.label}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: colors.card, borderColor: colors.error },
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>
            ออกจากระบบ
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Super Fitt v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Sections
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 12,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconWithBadge: {
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
  },

  // Theme Selector
  themeSelector: {
    flexDirection: "row",
    gap: 8,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    gap: 6,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 12,
  },
});
