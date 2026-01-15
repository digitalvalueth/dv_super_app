import { countBarcodesInImage } from "@/services/gemini.service";
import { useTheme } from "@/stores/theme.store";
import {
  formatTimestamp,
  generateWatermarkLines,
  WatermarkData,
} from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PreviewScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{
    imageUri: string;
    imageBase64: string;
    watermarkData: string;
    productId?: string;
    productName?: string;
    productBarcode?: string;
    assignmentId?: string;
    beforeQty?: string;
  }>();

  const [isProcessing, setIsProcessing] = useState(false);
  const [barcodeCount, setBarcodeCount] = useState<number | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  // Parse watermark data
  const watermarkData: WatermarkData | null = useMemo(() => {
    try {
      return params.watermarkData ? JSON.parse(params.watermarkData) : null;
    } catch {
      return null;
    }
  }, [params.watermarkData]);

  // Generate watermark lines for display
  const watermarkLines = useMemo(() => {
    if (!watermarkData) return [];
    return generateWatermarkLines(watermarkData);
  }, [watermarkData]);

  const handleAnalyze = useCallback(async () => {
    if (!params.imageBase64) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่พบข้อมูลรูปภาพ");
      return;
    }

    try {
      setIsProcessing(true);
      setBarcodeCount(null);

      const result = await countBarcodesInImage(params.imageBase64);

      setBarcodeCount(result.count);
      setProcessingTime(result.processingTime);
    } catch (error) {
      console.error("Error analyzing image:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถวิเคราะห์รูปภาพได้");
    } finally {
      setIsProcessing(false);
    }
  }, [params.imageBase64]);

  const handleRetake = () => {
    router.back();
  };

  const handleConfirm = () => {
    if (barcodeCount === null) {
      Alert.alert(
        "กรุณาวิเคราะห์รูปก่อน",
        "กดปุ่ม 'วิเคราะห์ด้วย AI' เพื่อนับจำนวน Barcode"
      );
      return;
    }

    // Navigate to result screen with all data
    router.push({
      pathname: "/result",
      params: {
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
        {/* Image Preview with Watermark Overlay */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: params.imageUri }}
            style={styles.image}
            resizeMode="contain"
          />

          {/* Watermark Overlay */}
          {watermarkData && (
            <View style={styles.watermarkOverlay}>
              {watermarkLines.map((line, index) => (
                <Text key={index} style={styles.watermarkText}>
                  {line}
                </Text>
              ))}
            </View>
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
                  {watermarkData.deviceModel}
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
              isProcessing && { opacity: 0.6 },
            ]}
            onPress={handleAnalyze}
            disabled={isProcessing}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.analyzeButtonText}>
              {barcodeCount !== null ? "วิเคราะห์อีกครั้ง" : "วิเคราะห์ด้วย AI"}
            </Text>
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
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  watermarkOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    gap: 4,
  },
  watermarkText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
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
