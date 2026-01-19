import { getProductCountingSessions } from "@/services/counting.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { CountingSession } from "@/types";
import { createWatermarkMetadata } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Base64 encoding type
const BASE64_ENCODING = "base64" as const;

// Fix Firebase Storage URL encoding
const fixFirebaseStorageUrl = (url: string): string => {
  if (!url) return url;

  // Check if URL is already properly encoded
  if (url.includes("%2F")) return url;

  // Fix unencoded URLs by replacing / with %2F in the path segment
  // Example: /o/products/abc/file.jpg -> /o/products%2Fabc%2Ffile.jpg
  const match = url.match(/\/o\/([^?]+)/);
  if (match) {
    const path = match[1];
    const encodedPath = path.split("/").map(encodeURIComponent).join("%2F");
    return url.replace(/\/o\/[^?]+/, `/o/${encodedPath}`);
  }

  return url;
};

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [countingSessions, setCountingSessions] = useState<CountingSession[]>(
    []
  );

  const productId = params.productId as string;
  const productName = params.productName as string;
  const productSKU = params.productSKU as string;
  const productImage = params.productImage as string;
  const beforeQty = params.beforeQty as string;
  const assignmentId = params.assignmentId as string;
  const productBarcode = params.productBarcode as string;

  useEffect(() => {
    checkPermissions();
    getLocation();
    fetchCountingSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const fetchCountingSessions = async () => {
    if (!productId) return;

    try {
      const sessions = await getProductCountingSessions(productId);
      // แสดงทั้ง pending (draft) และ completed
      setCountingSessions(sessions);
    } catch (error) {
      console.error("Error fetching counting sessions:", error);
    }
  };

  const checkPermissions = async () => {
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const locationStatus = await Location.requestForegroundPermissionsAsync();

    setHasPermissions(
      cameraStatus.granted && mediaStatus.granted && locationStatus.granted
    );
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      }
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const handleTakePhoto = async () => {
    if (!hasPermissions) {
      Alert.alert(
        "ต้องการสิทธิ์",
        "กรุณาอนุญาตให้เข้าถึงกล้องและตำแหน่งเพื่อถ่ายรูปสินค้า",
        [
          { text: "ยกเลิก", style: "cancel" },
          { text: "ตั้งค่า", onPress: checkPermissions },
        ]
      );
      return;
    }

    // ถ้ามี pending session อยู่แล้ว ให้ส่ง existingSessionId ไปเพื่ออัพเดทแทนสร้างใหม่
    const pendingSession = countingSessions.find(
      (s) => s.status === "pending" || s.status === "analyzed"
    );

    router.push({
      pathname: "/camera",
      params: {
        productId,
        productName,
        productSKU,
        productBarcode,
        assignmentId,
        beforeQty,
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
        existingSessionId: pendingSession?.id || "",
      },
    });
  };

  const handlePickImage = async () => {
    if (!hasPermissions) {
      Alert.alert("ต้องการสิทธิ์", "กรุณาอนุญาตให้เข้าถึงคลังรูปภาพ", [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ตั้งค่า", onPress: checkPermissions },
      ]);
      return;
    }

    try {
      setIsPickingImage(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // Important: Request base64 encoding
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let base64Data = asset.base64;

        // If base64 is not included, read it manually
        if (!base64Data && asset.uri) {
          const fileInfo = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: BASE64_ENCODING,
          });
          base64Data = fileInfo;
        }

        if (!base64Data) {
          Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถอ่านรูปภาพได้");
          return;
        }

        // Get watermark metadata
        const watermarkData = await createWatermarkMetadata(
          user?.name || "Unknown",
          user?.uid || "",
          productName,
          productBarcode
        );

        // ถ้ามี pending session อยู่แล้ว ให้ส่ง existingSessionId ไปเพื่ออัพเดทแทนสร้างใหม่
        const pendingSession = countingSessions.find(
          (s) => s.status === "pending" || s.status === "analyzed"
        );

        router.push({
          pathname: "/preview",
          params: {
            imageUri: asset.uri,
            imageBase64: base64Data,
            watermarkData: JSON.stringify(watermarkData),
            productId,
            productName,
            productBarcode,
            assignmentId,
            beforeQty,
            existingSessionId: pendingSession?.id || "",
          },
        });
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเลือกรูปภาพได้");
    } finally {
      setIsPickingImage(false);
    }
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
          รายละเอียดสินค้า
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Product Image */}
        <View style={[styles.imageCard, { backgroundColor: colors.card }]}>
          {productImage && !imageError ? (
            <>
              <Image
                source={{ uri: fixFirebaseStorageUrl(productImage) }}
                style={styles.productImage}
                contentFit="cover"
                transition={200}
                onLoadStart={() => setImageLoading(true)}
                onLoad={() => {
                  setImageLoading(false);
                  setImageError(false);
                }}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
              {imageLoading && (
                <View style={styles.imageLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
            </>
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: colors.border },
              ]}
            >
              <Ionicons
                name="cube-outline"
                size={80}
                color={colors.textSecondary}
              />
              {imageError && (
                <Text
                  style={[styles.errorText, { color: colors.textSecondary }]}
                >
                  ไม่สามารถโหลดรูปภาพ
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sku, { color: colors.primary }]}>
            {productSKU}
          </Text>
          <Text style={[styles.productName, { color: colors.text }]}>
            {productName}
          </Text>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons
                name="cube-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                จำนวนเดิม
              </Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {beforeQty || "0"} ชิ้น
            </Text>
          </View>

          {location && (
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons
                  name="location"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  ตำแหน่ง
                </Text>
              </View>
              <Text
                style={[styles.locationText, { color: colors.textSecondary }]}
              >
                {location.coords.latitude.toFixed(6)},{" "}
                {location.coords.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        {/* Attached Images Section */}
        {countingSessions.length > 0 && (
          <View
            style={[
              styles.attachedImagesCard,
              { backgroundColor: colors.card },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="images" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                รูปที่แนบแล้ว ({countingSessions.length})
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imagesScroll}
            >
              {countingSessions.map((session, index) => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.attachedImageContainer}
                  onPress={() => {
                    // pending = แนบรูปแล้วยังไม่วิเคราะห์ → ไป preview
                    // analyzed = วิเคราะห์แล้วยังไม่ยืนยัน → ไป result
                    // completed = เสร็จสมบูรณ์ → ไป completed
                    const fixedImageUrl = fixFirebaseStorageUrl(
                      session.imageUrl
                    );

                    // Parse remarks และเพิ่ม deviceModel ถ้าไม่มี
                    let watermarkDataStr = session.remarks || "";
                    try {
                      if (watermarkDataStr) {
                        const parsedRemarks = JSON.parse(watermarkDataStr);
                        if (!parsedRemarks.deviceModel && session.deviceInfo) {
                          parsedRemarks.deviceModel = session.deviceInfo;
                          watermarkDataStr = JSON.stringify(parsedRemarks);
                        }
                      }
                    } catch {
                      // Parse error - use original remarks
                    }

                    if (session.status === "pending") {
                      // ไปหน้า preview เพื่อวิเคราะห์
                      router.push({
                        pathname: "/preview",
                        params: {
                          existingSessionId: session.id,
                          imageUri: fixedImageUrl,
                          imageBase64: "", // ไม่มี base64 เพราะโหลดจาก URL
                          productId,
                          productName,
                          productBarcode: session.productSKU,
                          assignmentId: session.assignmentId,
                          beforeQty,
                          watermarkData: watermarkDataStr,
                        },
                      });
                    } else if (session.status === "analyzed") {
                      // ไปหน้า result เพื่อยืนยัน
                      router.push({
                        pathname: "/result",
                        params: {
                          sessionId: session.id,
                          imageUri: fixedImageUrl,
                          barcodeCount:
                            session.currentCountQty?.toString() || "0",
                          processingTime:
                            session.processingTime?.toString() || "0",
                          productId,
                          productName,
                          productBarcode: session.productSKU,
                          assignmentId: session.assignmentId,
                          beforeQty,
                        },
                      });
                    } else {
                      router.push({
                        pathname: "/(tabs)/products/completed",
                        params: {
                          productId,
                          productName,
                          productSKU,
                          productImage,
                          beforeQty,
                        },
                      });
                    }
                  }}
                >
                  <Image
                    source={{ uri: session.imageUrl }}
                    style={styles.attachedImage}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.imageOverlay}>
                    <View style={styles.overlayTop}>
                      <Text style={styles.imageNumber}>#{index + 1}</Text>
                      {session.status === "pending" && (
                        <View
                          style={[
                            styles.pendingBadge,
                            { backgroundColor: "#f59e0b" },
                          ]}
                        >
                          <Text style={styles.pendingText}>รอวิเคราะห์</Text>
                        </View>
                      )}
                      {session.status === "analyzed" && (
                        <View
                          style={[
                            styles.pendingBadge,
                            { backgroundColor: "#3b82f6" },
                          ]}
                        >
                          <Text style={styles.pendingText}>รอยืนยัน</Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        styles.countBadge,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={styles.countText}>
                        {session.currentCountQty || "-"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.viewAllButton, { borderColor: colors.border }]}
              onPress={() => {
                router.push({
                  pathname: "/(tabs)/products/completed",
                  params: {
                    productId,
                    productName,
                    productSKU,
                    productImage,
                    beforeQty,
                  },
                });
              }}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                ดูทั้งหมด
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.primaryButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleTakePhoto}
          >
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>ถ่ายรูปสินค้า</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              isPickingImage && { opacity: 0.6 },
            ]}
            onPress={handlePickImage}
            disabled={isPickingImage}
          >
            {isPickingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="images" size={24} color={colors.primary} />
            )}
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {isPickingImage ? "กำลังโหลด..." : "เลือกจากคลังรูป"}
            </Text>
          </TouchableOpacity>
        </View>

        {!hasPermissions && (
          <View style={[styles.warningCard, { backgroundColor: "#fff3cd" }]}>
            <Ionicons name="warning" size={20} color="#856404" />
            <Text style={styles.warningText}>
              ต้องการสิทธิ์เข้าถึงกล้อง, คลังรูปภาพ และตำแหน่งเพื่อนับสินค้า
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Loading Overlay */}
      {isPickingImage && (
        <View style={styles.loadingOverlay}>
          <View
            style={[styles.loadingContainer, { backgroundColor: colors.card }]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              กำลังโหลดรูปภาพ...
            </Text>
            <Text
              style={[styles.loadingSubtext, { color: colors.textSecondary }]}
            >
              กรุณารอสักครู่
            </Text>
          </View>
        </View>
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
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  imageCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  productImage: {
    width: "100%",
    height: 300,
    resizeMode: "cover",
  },
  placeholderImage: {
    width: "100%",
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sku: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  productName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    lineHeight: 28,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e0e0e0",
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  locationText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 16,
    gap: 12,
  },
  primaryButton: {
    shadowColor: "#4285f4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#856404",
    lineHeight: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loadingContainer: {
    padding: 32,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  imageLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
  },
  attachedImagesCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  imagesScroll: {
    marginBottom: 12,
  },
  attachedImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
    overflow: "hidden",
    position: "relative",
  },
  attachedImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "space-between",
    padding: 8,
  },
  overlayTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  imageNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  pendingBadge: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  countBadge: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
