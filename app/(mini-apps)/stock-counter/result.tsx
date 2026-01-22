import {
  createCountingSession,
  updateAssignmentStatus,
  uploadCountingImage,
} from "@/services/counting.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { formatTimestamp, WatermarkData } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ResultScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [isSaving, setIsSaving] = useState(false);
  const params = useLocalSearchParams<{
    sessionId?: string; // เพิ่ม sessionId สำหรับกรณีที่มี session อยู่แล้ว
    imageUri: string;
    barcodeCount: string;
    processingTime: string;
    productId?: string;
    productName?: string;
    productBarcode?: string;
    watermarkData?: string;
    assignmentId?: string;
    beforeQty?: string;
  }>();

  const barcodeCount = parseInt(params.barcodeCount || "0", 10);
  const processingTime = parseInt(params.processingTime || "0", 10);
  const beforeQty = parseInt(params.beforeQty || "0", 10);
  const variance = beforeQty - barcodeCount;

  const watermarkData: WatermarkData | null = useMemo(() => {
    try {
      return params.watermarkData ? JSON.parse(params.watermarkData) : null;
    } catch {
      return null;
    }
  }, [params.watermarkData]);

  const handleSave = async () => {
    if (!user?.uid) {
      Alert.alert("เกิดข้อผิดพลาด", "กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    if (!params.productId || !params.assignmentId) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่พบข้อมูลสินค้าหรือ assignment");
      return;
    }

    try {
      setIsSaving(true);

      // ถ้ามี sessionId แสดงว่ามี session อยู่แล้ว (จาก preview) ให้อัพเดทแทนการสร้างใหม่
      if (params.sessionId) {
        console.log("📝 Updating existing session:", params.sessionId);

        // อัพเดท session ที่มีอยู่ให้เป็น completed
        const { updateDoc, doc, Timestamp } =
          await import("firebase/firestore");
        const { db } = await import("@/config/firebase");

        await updateDoc(doc(db, "countingSessions", params.sessionId), {
          status: "completed", // เปลี่ยนจาก pending เป็น completed
          finalCount: barcodeCount,
          manualCount: barcodeCount,
          updatedAt: new Date(),
        });

        // อัพเดท assignment status เป็น completed
        await updateAssignmentStatus(
          params.assignmentId,
          "completed",
          Timestamp.now(),
          params.productId,
        );

        Alert.alert(
          "ยืนยันสำเร็จ",
          `ยืนยันผลการนับ ${barcodeCount} รายการเรียบร้อยแล้ว\n\n${
            variance !== 0
              ? `ผลต่าง: ${variance > 0 ? "+" : ""}${variance} (${
                  variance > 0 ? "ขาด" : "เกิน"
                })`
              : "จำนวนตรงกัน ✓"
          }`,
          [
            {
              text: "ตกลง",
              onPress: () =>
                router.replace("/(mini-apps)/stock-counter/products"),
            },
          ],
        );
        return;
      }

      // ถ้าไม่มี sessionId ให้สร้างใหม่ (กรณีเก่า)
      const sessionId = `session_${Date.now()}`;

      // Upload image to Firebase Storage
      let imageUrl = "";
      if (params.imageUri) {
        imageUrl = await uploadCountingImage(
          user.uid,
          sessionId,
          params.imageUri,
        );
      }

      // 3. Create counting session in Firestore
      await createCountingSession({
        assignmentId: params.assignmentId,
        userId: user.uid,
        productId: params.productId,
        companyId: user.companyId || "",
        branchId: user.branchId || "",
        beforeCountQty: beforeQty,
        currentCountQty: barcodeCount,
        variance: variance,
        imageUrl: imageUrl,
        aiConfidence: 0.95,
        aiModel: "gemini-2.5-flash",
        processingTime: processingTime,
        deviceInfo: watermarkData?.deviceModel || "",
        appVersion: "1.0.0",
        userName: user.name || "",
        userEmail: user.email || "",
        branchName: user.branchName || "",
        productName: params.productName || "",
        productSKU: params.productBarcode || params.productId || "",
        imageURL: imageUrl,
        aiCount: barcodeCount,
        manualCount: barcodeCount,
        finalCount: barcodeCount,
        standardCount: beforeQty,
        discrepancy: Math.abs(variance),
        status: "completed", // เปลี่ยนเป็น completed เลย
        ...(watermarkData && {
          remarks: JSON.stringify({
            location: watermarkData.location,
            coordinates: watermarkData.coordinates,
            timestamp: watermarkData.timestamp,
            employeeName: watermarkData.employeeName,
            employeeId: watermarkData.employeeId,
          }),
        }),
      });

      Alert.alert(
        "บันทึกสำเร็จ",
        `บันทึกผลการนับ ${barcodeCount} รายการเรียบร้อยแล้ว\n\n${
          variance !== 0
            ? `ผลต่าง: ${variance > 0 ? "+" : ""}${variance} (${
                variance > 0 ? "ขาด" : "เกิน"
              })`
            : "จำนวนตรงกัน ✓"
        }`,
        [
          {
            text: "ตกลง",
            onPress: () =>
              router.replace("/(mini-apps)/stock-counter/products"),
          },
        ],
      );
    } catch (error) {
      console.error("Error saving counting result:", error);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetake = () => {
    // Go back to camera
    router.back();
    router.back();
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ผลการนับ
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.successContainer}>
          <View
            style={[styles.successIcon, { backgroundColor: "#10b981" + "20" }]}
          >
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            วิเคราะห์เสร็จสิ้น!
          </Text>
        </View>

        {/* Count Result */}
        <View style={[styles.resultCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
            จำนวน Barcode ที่นับได้
          </Text>
          <View
            style={[
              styles.countContainer,
              { backgroundColor: colors.primary + "15" },
            ]}
          >
            <Text style={[styles.countNumber, { color: colors.primary }]}>
              {barcodeCount}
            </Text>
            <Text style={[styles.countUnit, { color: colors.primary }]}>
              รายการ
            </Text>
          </View>
          <Text
            style={[styles.processingTime, { color: colors.textSecondary }]}
          >
            ⚡ ประมวลผลใน {processingTime}ms
          </Text>
        </View>

        {/* Image Preview */}
        <View style={[styles.imageCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            📷 รูปที่ถ่าย
          </Text>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: params.imageUri }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
          </View>
        </View>

        {/* Product Info */}
        {params.productName && (
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              📦 ข้อมูลสินค้า
            </Text>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                ชื่อสินค้า:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {params.productName}
              </Text>
            </View>
            {params.productBarcode && (
              <View style={styles.infoRow}>
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

        {/* Metadata Info */}
        {watermarkData && (
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              📋 ข้อมูลการบันทึก
            </Text>
            <View style={styles.metadataGrid}>
              <View style={styles.metadataItem}>
                <Ionicons
                  name="person"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.metadataText, { color: colors.textSecondary }]}
                >
                  {watermarkData.employeeName}
                </Text>
              </View>
              <View style={styles.metadataItem}>
                <Ionicons
                  name="phone-portrait"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.metadataText, { color: colors.textSecondary }]}
                >
                  {watermarkData.deviceModel}
                </Text>
              </View>
              <View style={styles.metadataItem}>
                <Ionicons
                  name="location"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.metadataText, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {watermarkData.location}
                </Text>
              </View>
              <View style={styles.metadataItem}>
                <Ionicons name="time" size={16} color={colors.textSecondary} />
                <Text
                  style={[styles.metadataText, { color: colors.textSecondary }]}
                >
                  {formatTimestamp(new Date(watermarkData.timestamp))}
                </Text>
              </View>
            </View>
          </View>
        )}
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
            styles.saveButton,
            { backgroundColor: isSaving ? "#9ca3af" : "#10b981" },
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="save-outline" size={20} color="#fff" />
          )}
          <Text style={[styles.actionButtonText, { color: "#fff" }]}>
            {isSaving ? "กำลังบันทึก..." : "บันทึกผล"}
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
  successContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  resultCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  resultLabel: {
    fontSize: 14,
  },
  countContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  countNumber: {
    fontSize: 56,
    fontWeight: "700",
  },
  countUnit: {
    fontSize: 18,
    fontWeight: "600",
  },
  processingTime: {
    fontSize: 12,
  },
  imageCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  metadataGrid: {
    gap: 10,
  },
  metadataItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metadataText: {
    fontSize: 13,
    flex: 1,
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
  saveButton: {},
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
