import { getProductCountingSessions } from "@/services/counting.service";
import { useTheme } from "@/stores/theme.store";
import { CountingSession } from "@/types";
import { formatTimestamp } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CompletedProductScreen() {
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<CountingSession[]>([]);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const productId = params.productId as string;
  const productName = params.productName as string;
  const productSKU = params.productSKU as string;
  const productImage = params.productImage as string;
  const beforeQty = params.beforeQty as string;

  useEffect(() => {
    loadCountingSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const loadCountingSessions = async () => {
    try {
      setIsLoading(true);
      const data = await getProductCountingSessions(productId);
      setSessions(data);
    } catch (error) {
      console.error("Error loading counting sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLatestSession = () => {
    if (sessions.length === 0) return null;
    return sessions[0]; // Already sorted by createdAt desc
  };

  const latestSession = getLatestSession();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ผลการนับสินค้า
        </Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            กำลังโหลดข้อมูล...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.content}
        >
          {/* Product Info */}
          <View style={[styles.productCard, { backgroundColor: colors.card }]}>
            {productImage ? (
              <Image
                source={{ uri: productImage }}
                style={styles.productImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View
                style={[
                  styles.placeholderImage,
                  { backgroundColor: colors.border },
                ]}
              >
                <Ionicons
                  name="cube-outline"
                  size={40}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <View style={styles.productInfo}>
              <Text style={[styles.productSKU, { color: colors.primary }]}>
                {params.productBarcode || productSKU}
              </Text>
              <Text
                style={[styles.productName, { color: colors.text }]}
                numberOfLines={2}
              >
                {productName}
              </Text>
            </View>
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: "#10B981" }]}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.statusText}>นับสินค้าเรียบร้อยแล้ว</Text>
          </View>

          {/* Latest Count Result */}
          {latestSession && (
            <View style={[styles.resultCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                ผลการนับล่าสุด
              </Text>

              {/* Counting Image */}
              {latestSession.imageUrl ? (
                <View style={styles.imageWrapper}>
                  {imageLoading && (
                    <View style={styles.imageLoadingOverlay}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text
                        style={[
                          styles.imageLoadingText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        กำลังโหลดรูปภาพ...
                      </Text>
                    </View>
                  )}
                  {imageError ? (
                    <View
                      style={[
                        styles.imageErrorContainer,
                        { backgroundColor: colors.border },
                      ]}
                    >
                      <Ionicons
                        name="image-outline"
                        size={48}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.imageErrorText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        ไม่สามารถโหลดรูปภาพได้
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: latestSession.imageUrl }}
                      style={styles.countingImage}
                      resizeMode="cover"
                      onLoadStart={() => {
                        setImageLoading(true);
                        setImageError(false);
                      }}
                      onLoadEnd={() => setImageLoading(false)}
                      onError={() => {
                        setImageLoading(false);
                        setImageError(true);
                      }}
                    />
                  )}
                </View>
              ) : (
                <View
                  style={[
                    styles.noImageContainer,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name="camera-outline"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.noImageText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    ไม่มีรูปภาพการนับ
                  </Text>
                </View>
              )}

              {/* Count Stats */}
              <View style={styles.statsContainer}>
                <View
                  style={[styles.statBox, { backgroundColor: colors.border }]}
                >
                  <Text
                    style={[styles.statLabel, { color: colors.textSecondary }]}
                  >
                    จำนวนเดิม
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {latestSession.beforeCountQty || beforeQty || 0}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statBox,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Text style={[styles.statLabel, { color: colors.primary }]}>
                    นับได้
                  </Text>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {latestSession.currentCountQty}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statBox,
                    {
                      backgroundColor:
                        latestSession.variance > 0
                          ? "#EF444420"
                          : latestSession.variance < 0
                            ? "#10B98120"
                            : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statLabel,
                      {
                        color:
                          latestSession.variance > 0
                            ? "#EF4444"
                            : latestSession.variance < 0
                              ? "#10B981"
                              : colors.textSecondary,
                      },
                    ]}
                  >
                    ผลต่าง
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          latestSession.variance > 0
                            ? "#EF4444"
                            : latestSession.variance < 0
                              ? "#10B981"
                              : colors.textSecondary,
                      },
                    ]}
                  >
                    {latestSession.variance > 0
                      ? "-"
                      : latestSession.variance < 0
                        ? "+"
                        : ""}
                    {Math.abs(latestSession.variance)}
                  </Text>
                </View>
              </View>

              {/* Meta Info */}
              <View style={styles.metaContainer}>
                <View style={styles.metaRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.metaText, { color: colors.textSecondary }]}
                  >
                    {latestSession.createdAt
                      ? formatTimestamp(
                          latestSession.createdAt instanceof Date
                            ? latestSession.createdAt
                            : latestSession.createdAt.toDate(),
                        )
                      : "ไม่ระบุเวลา"}
                  </Text>
                </View>

                {latestSession.location && (
                  <View style={styles.metaRow}>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[styles.metaText, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {latestSession.location.address || "ไม่ระบุตำแหน่ง"}
                    </Text>
                  </View>
                )}

                {latestSession.countedBy && (
                  <View style={styles.metaRow}>
                    <Ionicons
                      name="person-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[styles.metaText, { color: colors.textSecondary }]}
                    >
                      {latestSession.countedBy.name || "ไม่ระบุผู้นับ"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* History Section */}
          {sessions.length > 1 && (
            <View
              style={[styles.historyCard, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                ประวัติการนับ ({sessions.length} ครั้ง)
              </Text>
              {sessions.slice(1).map((session, index) => (
                <View
                  key={session.id || index}
                  style={[
                    styles.historyItem,
                    { borderBottomColor: colors.border },
                    index === sessions.length - 2 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyCount, { color: colors.text }]}>
                      นับได้ {session.currentCountQty} ชิ้น
                    </Text>
                    <Text
                      style={[
                        styles.historyDate,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {session.createdAt
                        ? formatTimestamp(
                            session.createdAt instanceof Date
                              ? session.createdAt
                              : session.createdAt.toDate(),
                          )
                        : ""}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.varianceBadge,
                      {
                        backgroundColor:
                          session.variance > 0
                            ? "#EF444420"
                            : session.variance < 0
                              ? "#10B98120"
                              : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.varianceText,
                        {
                          color:
                            session.variance > 0
                              ? "#EF4444"
                              : session.variance < 0
                                ? "#10B981"
                                : colors.textSecondary,
                        },
                      ]}
                    >
                      {session.variance > 0
                        ? "-"
                        : session.variance < 0
                          ? "+"
                          : ""}
                      {Math.abs(session.variance)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {sessions.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                ไม่พบข้อมูลการนับสินค้า
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  productCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  productSKU: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resultCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  imageWrapper: {
    position: "relative",
    width: "100%",
    height: 200,
    marginBottom: 16,
  },
  countingImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  imageLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    gap: 12,
  },
  imageLoadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  imageErrorContainer: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  imageErrorText: {
    fontSize: 14,
  },
  noImageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  noImageText: {
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  metaContainer: {
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    flex: 1,
  },
  historyCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyInfo: {
    flex: 1,
  },
  historyCount: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
  },
  varianceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  varianceText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
