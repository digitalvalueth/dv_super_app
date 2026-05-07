import { getProductCountingSessions } from "@/services/counting.service";
import {
  EodDetail,
  findEodDetailByBarcode,
  getEodForBranchId,
  getEodForUser,
} from "@/services/eod.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { CountingSession } from "@/types";
import { formatTimestamp } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
  const user = useAuthStore((state) => state.user);
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<CountingSession[]>([]);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [eodDetail, setEodDetail] = useState<EodDetail | null>(null);
  const [eodLoading, setEodLoading] = useState(false);

  const productId = params.productId as string;
  const productName = params.productName as string;
  const productSKU = params.productSKU as string;
  const productImage = params.productImage as string;
  const beforeQty = params.beforeQty as string;
  const assignmentId = params.assignmentId as string;
  const productBarcode = params.productBarcode as string;
  const assignmentBranchId = params.assignmentBranchId as string | undefined;

  useEffect(() => {
    loadCountingSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Fetch EOD data for this product's barcode
  useEffect(() => {
    if (!user || !productBarcode) return;
    setEodLoading(true);
    // Use assignment's branchId for EOD lookup (supports multi-branch employees)
    const eodPromise = assignmentBranchId
      ? getEodForBranchId(assignmentBranchId)
      : getEodForUser(user);
    eodPromise
      .then((eod) => setEodDetail(findEodDetailByBarcode(eod, productBarcode)))
      .catch(() => {})
      .finally(() => setEodLoading(false));
  }, [user, productBarcode, assignmentBranchId]);

  const loadCountingSessions = async () => {
    try {
      setIsLoading(true);
      // กรองด้วย branchId (กันรูปจากสาขาอื่นที่มี SKU เดียวกัน)
      const branchIdForQuery = assignmentBranchId || user?.branchId;
      const data = await getProductCountingSessions(
        productId,
        10,
        user?.uid,
        branchIdForQuery,
      );
      // กันเหนียว: filter อีกชั้นเผื่อ caller เก่า
      const scoped = branchIdForQuery
        ? data.filter((s) => s.branchId === branchIdForQuery)
        : data;
      setSessions(scoped);
    } catch (error) {
      console.error("Error loading counting sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLatestSession = () => {
    if (sessions.length === 0) return null;
    // Prefer approved/completed non-supplemental (approved = admin ยืนยันแล้ว)
    const mainDone = sessions.filter(
      (s) =>
        !s.isSupplemental &&
        (s.status === "completed" || s.status === "approved"),
    );
    if (mainDone.length > 0) return mainDone[0];
    // fallback: any non-supplemental
    const mainAny = sessions.filter((s) => !s.isSupplemental);
    if (mainAny.length > 0) return mainAny[0];
    return sessions[0];
  };

  // ── Split sessions ────────────────────────
  const mainSessions = sessions.filter((s) => !s.isSupplemental);
  const supplementalSessions = sessions.filter((s) => s.isSupplemental);
  const supplementalTotal = supplementalSessions.reduce(
    (sum, s) => sum + (s.currentCountQty ?? 0),
    0,
  );

  const latestSession = getLatestSession();

  // รวมทั้งหมด = ครั้งแรก + เพิ่มเติมทุกครั้ง
  const grandTotal = (latestSession?.currentCountQty ?? 0) + supplementalTotal;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Fullscreen Image Modal */}
      <Modal
        visible={isFullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fullscreenContainer}>
          <Image
            source={{ uri: latestSession?.imageUrl }}
            style={styles.fullscreenImage}
            contentFit="contain"
          />
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setIsFullscreen(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
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
          {(() => {
            const hasCompleted = sessions.some(
              (s) => s.status === "completed" || s.status === "approved",
            );
            const hasAnalyzed = sessions.some((s) => s.status === "analyzed");
            if (hasCompleted) {
              return (
                <View
                  style={[styles.statusBadge, { backgroundColor: "#10B981" }]}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.statusText}>นับสินค้าเรียบร้อยแล้ว</Text>
                </View>
              );
            } else if (hasAnalyzed) {
              return (
                <View
                  style={[styles.statusBadge, { backgroundColor: "#f59e0b" }]}
                >
                  <Ionicons name="time-outline" size={20} color="#fff" />
                  <Text style={styles.statusText}>
                    วิเคราะห์แล้ว — รอยืนยัน
                  </Text>
                </View>
              );
            } else {
              return (
                <View
                  style={[styles.statusBadge, { backgroundColor: "#6b7280" }]}
                >
                  <Ionicons name="camera-outline" size={20} color="#fff" />
                  <Text style={styles.statusText}>ยังไม่ได้นับ</Text>
                </View>
              );
            }
          })()}

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
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setIsFullscreen(true)}
                    >
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
                      <View style={styles.fullscreenHint}>
                        <Ionicons name="expand" size={12} color="#fff" />
                        <Text style={styles.fullscreenHintText}>
                          ดูรูปเต็มจอ
                        </Text>
                      </View>
                    </TouchableOpacity>
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
                    {eodDetail?.EOD_Date
                      ? `ณ ${new Date(eodDetail.EOD_Date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`
                      : "จำนวนเดิม"}
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {eodLoading
                      ? "..."
                      : eodDetail?.EOD_Qty != null
                        ? eodDetail.EOD_Qty
                        : latestSession.beforeCountQty || beforeQty || 0}
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
                      backgroundColor: (() => {
                        const diff =
                          eodDetail != null
                            ? (latestSession.currentCountQty ?? 0) -
                              (eodDetail.EOD_Qty ?? 0)
                            : -latestSession.variance;
                        return diff > 0
                          ? "#10B98120"
                          : diff < 0
                            ? "#EF444420"
                            : colors.border;
                      })(),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statLabel,
                      {
                        color: (() => {
                          const diff =
                            eodDetail != null
                              ? (latestSession.currentCountQty ?? 0) -
                                (eodDetail.EOD_Qty ?? 0)
                              : -latestSession.variance;
                          return diff > 0
                            ? "#10B981"
                            : diff < 0
                              ? "#EF4444"
                              : colors.textSecondary;
                        })(),
                      },
                    ]}
                  >
                    ผลต่าง
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color: (() => {
                          const diff =
                            eodDetail != null
                              ? (latestSession.currentCountQty ?? 0) -
                                (eodDetail.EOD_Qty ?? 0)
                              : -latestSession.variance;
                          return diff > 0
                            ? "#10B981"
                            : diff < 0
                              ? "#EF4444"
                              : colors.textSecondary;
                        })(),
                      },
                    ]}
                  >
                    {(() => {
                      const diff =
                        eodDetail != null
                          ? (latestSession.currentCountQty ?? 0) -
                            (eodDetail.EOD_Qty ?? 0)
                          : -latestSession.variance;
                      return `${diff > 0 ? "+" : ""}${diff}`;
                    })()}
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

          {/* History Section — main sessions only */}
          {mainSessions.length > 1 && (
            <View
              style={[styles.historyCard, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                ประวัติการนับหลัก ({mainSessions.length} ครั้ง)
              </Text>
              {mainSessions.slice(1).map((session, index) => (
                <View
                  key={session.id || index}
                  style={[
                    styles.historyItem,
                    { borderBottomColor: colors.border },
                    index === mainSessions.length - 2 && {
                      borderBottomWidth: 0,
                    },
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

          {/* Supplemental Sessions Section */}
          {supplementalSessions.length > 0 && (
            <View
              style={[
                styles.supplementalCard,
                { backgroundColor: colors.card },
              ]}
            >
              {/* Header */}
              <View style={styles.supplementalHeader}>
                <View style={styles.supplementalTitleRow}>
                  <Ionicons name="attach" size={18} color="#6366f1" />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.text, marginBottom: 0 },
                    ]}
                  >
                    รูปเพิ่มเติม ({supplementalSessions.length} ครั้ง)
                  </Text>
                </View>
                {/* Total Summary Badge */}
                <View style={styles.supplementalTotalBadge}>
                  <Text style={styles.supplementalTotalLabel}>รวม</Text>
                  <Text style={styles.supplementalTotalValue}>
                    {grandTotal}
                  </Text>
                  <Text style={styles.supplementalTotalLabel}>รายการ</Text>
                </View>
              </View>

              {/* Each supplemental entry */}
              {supplementalSessions.map((session, index) => (
                <View
                  key={session.id || `sup-${index}`}
                  style={[
                    styles.supplementalItem,
                    { borderBottomColor: colors.border },
                    index === supplementalSessions.length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  {/* Thumbnail */}
                  {session.imageUrl ? (
                    <Image
                      source={{ uri: session.imageUrl }}
                      style={styles.supplementalThumb}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.supplementalThumb,
                        {
                          backgroundColor: colors.border,
                          justifyContent: "center",
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Ionicons
                        name="image-outline"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </View>
                  )}

                  {/* Info */}
                  <View style={styles.supplementalInfo}>
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

                  {/* Count badge */}
                  <View style={styles.supplementalCountBadge}>
                    <Text style={styles.supplementalCountText}>
                      +{session.currentCountQty}
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

      {/* Bottom Action Bar */}
      {!isLoading && (
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.addPhotoButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              router.push({
                pathname: "/(mini-apps)/stock-counter/camera",
                params: {
                  productId,
                  productName,
                  productBarcode,
                  assignmentId,
                  beforeQty,
                  isSupplemental: "true",
                },
              });
            }}
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.addPhotoButtonText}>ถ่ายสินค้าเพิ่มเติม</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addPhotoButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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
  fullscreenHint: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fullscreenHintText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  fullscreenClose: {
    position: "absolute",
    top: 52,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
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
  // ── Supplemental styles ────────────────────────────────
  supplementalCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: "#6366f1",
  },
  supplementalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  supplementalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  supplementalTotalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6366f115",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  supplementalTotalLabel: {
    fontSize: 12,
    color: "#6366f1",
  },
  supplementalTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6366f1",
  },
  supplementalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  supplementalThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  supplementalInfo: {
    flex: 1,
  },
  supplementalCountBadge: {
    backgroundColor: "#6366f115",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  supplementalCountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6366f1",
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
