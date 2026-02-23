import {
  createCountingSession,
  updateAssignmentStatus,
  uploadCountingImage,
} from "@/services/counting.service";
import {
  BarcodeCountResult,
  countBarcodesInImage,
} from "@/services/gemini.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { formatTimestamp, WatermarkData } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Fix Firebase Storage URL encoding
const fixFirebaseStorageUrl = (url: string): string => {
  if (!url) return url;
  if (url.includes("%2F")) return url;

  const match = url.match(/\/o\/([^?]+)/);
  if (match) {
    const path = match[1];
    const encodedPath = path.split("/").map(encodeURIComponent).join("%2F");
    return url.replace(/\/o\/[^?]+/, `/o/${encodedPath}`);
  }
  return url;
};

export default function PreviewScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{
    imageUri: string;
    imageBase64: string;
    watermarkData: string;
    productId?: string;
    productName?: string;
    productBarcode?: string;
    assignmentId?: string;
    beforeQty?: string;
    existingSessionId?: string; // ถ้ามี แสดงว่ามี session อยู่แล้ว ให้อัพเดทแทนสร้างใหม่
    nativeScannedBarcode?: string; // barcode ที่สแกนด้วย native scanner (แม่นยำ 100%)
  }>();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [barcodeCount, setBarcodeCount] = useState<number | null>(null);
  const [barcodeMatch, setBarcodeMatch] = useState<boolean | null>(null);
  const [detectedBarcodes, setDetectedBarcodes] = useState<string[]>([]);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    params.existingSessionId || null,
  );
  const [imageBase64, setImageBase64] = useState<string | null>(
    params.imageBase64 || null,
  );
  const [displayImageUri, setDisplayImageUri] = useState<string>(
    params.imageUri || "",
  );

  // Parse watermark data
  const watermarkData: WatermarkData | null = useMemo(() => {
    try {
      return params.watermarkData ? JSON.parse(params.watermarkData) : null;
    } catch {
      return null;
    }
  }, [params.watermarkData]);

  // เมื่อเข้าหน้า preview: อัพโหลดรูปและสร้าง/อัพเดท draft session
  useEffect(() => {
    const createOrUpdateDraftSession = async () => {
      if (
        !user ||
        !params.assignmentId ||
        !params.productId ||
        !params.imageUri
      ) {
        return;
      }

      // ถ้ามี existingSessionId และไม่มี imageBase64 แสดงว่ามาจากหน้า details กดดูรูปที่มีอยู่แล้ว
      // ต้องโหลด base64 จาก URL เพื่อวิเคราะห์ AI
      if (params.existingSessionId && !params.imageBase64) {
        // Fix URL encoding สำหรับ Firebase Storage
        const fixedImageUrl = fixFirebaseStorageUrl(params.imageUri);

        setSessionId(params.existingSessionId);
        setDisplayImageUri(fixedImageUrl);

        // โหลด base64 จาก Firebase URL ด้วย fetch
        try {
          setIsLoadingImage(true);

          // ดาวน์โหลดรูปจาก URL และแปลงเป็น base64
          const response = await fetch(fixedImageUrl);

          // Check if response is OK
          if (!response.ok) {
            Alert.alert(
              "เกิดข้อผิดพลาด",
              `ไม่สามารถโหลดรูปภาพได้ (${response.status})`,
            );
            return;
          }

          const blob = await response.blob();

          // Convert blob to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64data = reader.result as string;
              // Remove data:image/jpeg;base64, prefix
              const base64 = base64data.split(",")[1] || base64data;
              resolve(base64);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);

          const base64 = await base64Promise;
          setImageBase64(base64);
        } catch (error) {
          console.error("Error loading image from URL:", error);
          Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถโหลดรูปภาพได้");
        } finally {
          setIsLoadingImage(false);
        }
        return;
      }

      // ถ้ามี sessionId อยู่แล้ว ไม่ต้องสร้างใหม่ (กรณี re-render)
      if (sessionId && !params.existingSessionId) return;

      try {
        setIsUploading(true);

        // 1. Mark product as in_progress
        await updateAssignmentStatus(
          params.assignmentId,
          "in_progress",
          undefined,
          params.productId,
        );

        // 2. อัพโหลดรูปปกติ (ไม่มี watermark) ไป Firebase Storage
        // Watermark จะถูกฝังตอนกดยืนยันใน result.tsx
        const sessionIdTemp = `session_${Date.now()}`;
        const imageUrl = await uploadCountingImage(
          user.uid,
          sessionIdTemp,
          params.imageUri,
        );

        // 3. ถ้ามี existingSessionId ให้อัพเดทรูปแทนสร้างใหม่
        if (params.existingSessionId) {
          const { updateDoc, doc } = await import("firebase/firestore");
          const { db } = await import("@/config/firebase");

          await updateDoc(
            doc(db, "countingSessions", params.existingSessionId),
            {
              imageUrl: imageUrl,
              imageURL: imageUrl,
              status: "pending", // Reset to pending (need AI analysis again)
              currentCountQty: 0,
              variance: 0,
              aiCount: 0,
              aiConfidence: 0,
              updatedAt: new Date(),
            },
          );

          setSessionId(params.existingSessionId);
        } else {
          // 4. สร้าง draft session ใหม่
          const watermarkData = params.watermarkData
            ? JSON.parse(params.watermarkData)
            : null;
          const beforeQty = parseInt(params.beforeQty || "0");

          const newSessionId = await createCountingSession({
            assignmentId: params.assignmentId,
            productId: params.productId,
            productName: params.productName || "",
            productSKU: params.productBarcode || "",
            companyId: user.companyId || "",
            branchId: user.branchId || "",
            branchName: user.branchName || "",
            beforeCountQty: beforeQty,
            currentCountQty: 0,
            variance: 0,
            aiCount: 0,
            aiConfidence: 0,
            aiModel: "gemini-2.5-flash",
            imageUrl: imageUrl,
            imageURL: imageUrl,
            status: "pending",
            userId: user.uid,
            userName: user.name || "",
            userEmail: user.email || "",
            manualCount: 0,
            finalCount: 0,
            standardCount: beforeQty,
            discrepancy: 0,
            remarks: watermarkData
              ? JSON.stringify({
                  location: watermarkData.location || "",
                  coordinates: {
                    latitude: watermarkData.latitude || 0,
                    longitude: watermarkData.longitude || 0,
                  },
                  timestamp:
                    watermarkData.timestamp || new Date().toISOString(),
                  employeeName: watermarkData.employeeName || user.name || "",
                  employeeId: user.uid,
                  deviceModel: watermarkData.deviceModel || "Unknown",
                })
              : "",
            processingTime: 0,
            deviceInfo: watermarkData?.deviceModel || "Unknown",
            appVersion: "1.0.0",
          });

          setSessionId(newSessionId);
        }
      } catch (error) {
        console.error("Error creating/updating draft session:", error);
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถอัพโหลดรูปภาพได้");
      } finally {
        setIsUploading(false);
      }
    };

    createOrUpdateDraftSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    params.assignmentId,
    params.productId,
    params.imageUri,
    params.existingSessionId,
  ]);

  const handleAnalyze = useCallback(async () => {
    if (!sessionId) {
      Alert.alert("กรุณารอสักครู่", "กำลังอัพโหลดรูปภาพ...");
      return;
    }

    try {
      setIsProcessing(true);
      setBarcodeCount(null);

      // Read base64 lazily — only when AI analysis is actually needed
      let base64ForAI = imageBase64;
      if (!base64ForAI) {
        const localUri = params.imageUri;
        if (!localUri) {
          Alert.alert("เกิดข้อผิดพลาด", "ไม่พบข้อมูลรูปภาพ");
          return;
        }
        // Read from local file — fast disk I/O, no network needed
        base64ForAI = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setImageBase64(base64ForAI);
      }

      // 1. วิเคราะห์รูปด้วย AI พร้อม barcode validation
      // ใช้ nativeScannedBarcode ถ้ามี (แม่นยำกว่า) มิฉะนั้นใช้ productBarcode จากระบบ
      // AI จะตรวจบาร์โค้ดในรูปเสมอ — ป้องกัน fraud (สแกนสินค้าถูก แต่ถ่ายรูปสินค้าผิด)
      const effectiveExpectedBarcode =
        params.nativeScannedBarcode || params.productBarcode || undefined;

      const result: BarcodeCountResult = await countBarcodesInImage(
        base64ForAI,
        effectiveExpectedBarcode,
        params.productName || undefined,
      );

      setBarcodeCount(result.count);
      setBarcodeMatch(result.barcodeMatch);
      setDetectedBarcodes(result.detectedBarcodes);
      setProcessingTime(result.processingTime);

      // Warning if barcode doesn't match (only when product has a barcode)
      if (params.productBarcode && !result.barcodeMatch) {
        Alert.alert(
          "⚠️ บาร์โค้ดไม่ตรง",
          result.detectedBarcodes.length > 0
            ? `พบบาร์โค้ด: ${result.detectedBarcodes.join(", ")}\nแต่ต้องการ: ${params.productBarcode || "-"}\n\nกรุณาถ่ายรูปสินค้าที่ถูกต้อง`
            : `ไม่พบบาร์โค้ดในรูปภาพ\nกรุณาถ่ายรูปสินค้าให้เห็นบาร์โค้ดชัดเจน`,
          [{ text: "ตกลง" }],
        );
      }

      // 2. อัพเดท session ที่มีอยู่แล้วด้วยผลวิเคราะห์
      const { updateDoc, doc } = await import("firebase/firestore");
      const { db } = await import("@/config/firebase");

      const beforeQty = parseInt(params.beforeQty || "0");
      const variance = beforeQty - result.count;

      await updateDoc(doc(db, "countingSessions", sessionId), {
        currentCountQty: result.count,
        variance: variance,
        aiCount: result.count,
        aiConfidence: 0.95,
        manualCount: result.count,
        finalCount: result.count,
        discrepancy: Math.abs(variance),
        processingTime: result.processingTime || 0,
        barcodeMatch: result.barcodeMatch,
        detectedBarcodes: result.detectedBarcodes,
        matchedBarcode: result.matchedBarcode || null,
        status: "analyzed", // เปลี่ยนจาก pending เป็น analyzed (วิเคราะห์แล้ว แต่ยังไม่ยืนยัน)
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error analyzing image:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถวิเคราะห์รูปภาพได้");
    } finally {
      setIsProcessing(false);
    }
  }, [imageBase64, sessionId, params.beforeQty, params.imageUri]);

  const handleRetake = () => {
    router.back();
  };

  const handleConfirm = () => {
    if (barcodeCount === null || !sessionId) {
      Alert.alert(
        "กรุณาวิเคราะห์รูปก่อน",
        "กดปุ่ม 'วิเคราะห์ด้วย AI' เพื่อนับจำนวน Barcode",
      );
      return;
    }

    // Navigate to result screen with session ID
    router.push({
      pathname: "/(mini-apps)/stock-counter/result",
      params: {
        sessionId: sessionId, // ส่ง session ID ไปเพื่ออัพเดท
        imageUri: params.imageUri,
        barcodeCount: barcodeCount.toString(),
        processingTime: processingTime?.toString() || "0",
        productId: params.productId,
        productName: params.productName,
        productBarcode: params.productBarcode,
        assignmentId: params.assignmentId,
        beforeQty: params.beforeQty,
        watermarkData: params.watermarkData,
      },
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity style={styles.headerButton} onPress={handleRetake}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ตรวจสอบรูปภาพ
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Visible Image for Employee - รูปปกติไม่มี watermark */}
        <View style={styles.imageContainer}>
          {isLoadingImage ? (
            <View
              style={[
                styles.image,
                {
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: colors.card,
                },
              ]}
            >
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[
                  styles.processingText,
                  { color: colors.textSecondary, marginTop: 10 },
                ]}
              >
                กำลังโหลดรูปภาพ...
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: displayImageUri || params.imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Product Info */}
        {params.productName && (
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoRow}>
              <Ionicons name="cube-outline" size={20} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                สินค้า:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {params.productName}
              </Text>
            </View>
            {params.productBarcode && (
              <View style={styles.infoRow}>
                <Ionicons
                  name="barcode-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  Barcode:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {params.productBarcode}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Watermark Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            📋 ข้อมูลที่บันทึก
          </Text>
          {watermarkData && (
            <>
              <View style={styles.infoRow}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.infoText, { color: colors.textSecondary }]}
                >
                  {watermarkData.employeeName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.infoText, { color: colors.textSecondary }]}
                >
                  {watermarkData.deviceModel || "-"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.infoText, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {watermarkData.location}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.infoText, { color: colors.textSecondary }]}
                >
                  {formatTimestamp(new Date(watermarkData.timestamp))}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* AI Analysis Result */}
        <View style={[styles.resultCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            🤖 ผลการวิเคราะห์ AI
          </Text>

          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[styles.processingText, { color: colors.textSecondary }]}
              >
                กำลังนับจำนวน Barcode...
              </Text>
            </View>
          ) : barcodeCount !== null ? (
            <View style={styles.resultContainer}>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text style={[styles.countNumber, { color: colors.primary }]}>
                  {barcodeCount}
                </Text>
                <Text style={[styles.countLabel, { color: colors.primary }]}>
                  Barcode
                </Text>
              </View>

              {/* Barcode match status badge */}
              {params.productBarcode ? (
                <View
                  style={[
                    styles.barcodeMatchBadge,
                    {
                      backgroundColor: barcodeMatch ? "#16a34a20" : "#dc262620",
                    },
                  ]}
                >
                  <Ionicons
                    name={barcodeMatch ? "checkmark-circle" : "close-circle"}
                    size={18}
                    color={barcodeMatch ? "#16a34a" : "#dc2626"}
                  />
                  <Text
                    style={[
                      styles.barcodeMatchText,
                      { color: barcodeMatch ? "#16a34a" : "#dc2626" },
                    ]}
                  >
                    {barcodeMatch
                      ? "บาร์โค้ดตรงกัน"
                      : detectedBarcodes.length > 0
                        ? `ไม่ตรง (พบ: ${detectedBarcodes[0]})`
                        : "ไม่พบบาร์โค้ด"}
                  </Text>
                </View>
              ) : null}

              {processingTime && (
                <Text
                  style={[
                    styles.processingTimeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  ประมวลผลใน {processingTime}ms
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyResult}>
              <Ionicons
                name="scan-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                กดปุ่มด้านล่างเพื่อวิเคราะห์
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.analyzeButton,
              { backgroundColor: colors.primary },
              (isProcessing ||
                isUploading ||
                isLoadingImage ||
                !sessionId ||
                !imageBase64) && { opacity: 0.6 },
            ]}
            onPress={handleAnalyze}
            disabled={
              isProcessing ||
              isUploading ||
              isLoadingImage ||
              !sessionId ||
              !imageBase64
            }
          >
            {isUploading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.analyzeButtonText}>กำลังอัพโหลดรูป...</Text>
              </>
            ) : isLoadingImage ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.analyzeButtonText}>กำลังโหลดรูป...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.analyzeButtonText}>
                  {barcodeCount !== null
                    ? "วิเคราะห์อีกครั้ง"
                    : "วิเคราะห์ด้วย AI"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View
        style={[
          styles.bottomActions,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.retakeButton,
            { borderColor: colors.border },
          ]}
          onPress={handleRetake}
        >
          <Ionicons name="camera-outline" size={20} color={colors.text} />
          <Text style={[styles.actionButtonText, { color: colors.text }]}>
            ถ่ายใหม่
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.confirmButton,
            { backgroundColor: colors.primary },
            barcodeCount === null && { opacity: 0.5 },
          ]}
          onPress={handleConfirm}
          disabled={barcodeCount === null}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={[styles.actionButtonText, { color: "#fff" }]}>
            ยืนยัน
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  viewShotContainer: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 3 / 4, // Changed to 3:4 for better photo ratio
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  resultCard: {
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  processingContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  processingText: {
    fontSize: 14,
  },
  resultContainer: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  countBadge: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  countNumber: {
    fontSize: 48,
    fontWeight: "700",
  },
  countLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  processingTimeText: {
    fontSize: 12,
  },
  barcodeMatchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  barcodeMatchText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyResult: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  analyzeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomActions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  retakeButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
