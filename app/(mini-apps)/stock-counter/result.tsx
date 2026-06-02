import {
  canUploadPhoto,
  getEffectiveCountingPeriod,
} from "@/services/counting-period.service";
import {
  createCountingSession,
  updateAssignmentStatus,
  uploadCountingImage,
} from "@/services/counting.service";
import {
  EodDetail,
  findEodDetailByBarcode,
  getEodForBranchId,
  getEodForUser,
} from "@/services/eod.service";
import { writeShopCountConfirmed } from "@/services/shopCountConfirmed.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { formatTimestamp, WatermarkData } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
    sessionId?: string;
    imageUri: string;
    barcodeCount: string;
    processingTime: string;
    productId?: string;
    productName?: string;
    productBarcode?: string;
    watermarkData?: string;
    assignmentId?: string;
    beforeQty?: string;
    assignmentBranchId?: string;
    barcodeMatchStatus?: string;
    userReportedCount?: string;
    disputeRemark?: string;
    isSupplemental?: string; // "รูปเพิ่มเติม" ไม่นับรวมกับจำนวนหลัก
    aiModelUsed?: string;
    aiConfidence?: string;
  }>();

  const isSupplemental = params.isSupplemental === "true";
  const [eodDetail, setEodDetail] = useState<EodDetail | null>(null);
  const [eodLoading, setEodLoading] = useState(false);

  // Fetch EOD data for the correct branch + product barcode
  useEffect(() => {
    if (!user || !params.productBarcode) return;
    setEodLoading(true);
    // Use assignment's branchId for EOD lookup (supports multi-branch employees)
    const eodPromise = params.assignmentBranchId
      ? getEodForBranchId(params.assignmentBranchId)
      : getEodForUser(user);
    eodPromise
      .then((eod) =>
        setEodDetail(findEodDetailByBarcode(eod, params.productBarcode!)),
      )
      .catch(() => {})
      .finally(() => setEodLoading(false));
  }, [user, params.productBarcode, params.assignmentBranchId]);

  const barcodeCount = parseInt(params.barcodeCount || "0", 10);
  const processingTime = parseInt(params.processingTime || "0", 10);
  const beforeQty = parseInt(params.beforeQty || "0", 10);
  const variance = beforeQty - barcodeCount;
  const userReportedCount = params.userReportedCount?.trim()
    ? parseInt(params.userReportedCount, 10)
    : null;
  const disputeRemark = params.disputeRemark?.trim() || null;
  const hasDispute = userReportedCount !== null || !!disputeRemark;

  // Block save when barcode mismatch — unless user filed a dispute
  const isBarcodeMatch = params.barcodeMatchStatus !== "mismatch";
  const canSave = (isBarcodeMatch || hasDispute) && !isSaving;

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

    if (!params.productId || (!params.assignmentId && !isSupplemental)) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่พบข้อมูลสินค้าหรือ assignment");
      return;
    }

    // Resolve the branch this count belongs to. Multi-branch employees pick a
    // branch in the product list; that selection flows here as
    // params.assignmentBranchId. Falling back to user.branchId only when no
    // explicit branch was chosen avoids mis-tagging counts to the primary branch.
    const countBranchId = params.assignmentBranchId || user.branchId || "";
    const countBranchName =
      user.branchNames?.[countBranchId] || user.branchName || "";

    try {
      setIsSaving(true);

      // Check if this is a late submission (in grace period)
      const [uploadCheck, effectivePeriod] = user.companyId
        ? await Promise.all([
            canUploadPhoto(user.companyId, undefined, { userId: user.uid }),
            getEffectiveCountingPeriod(user.companyId, undefined, {
              userId: user.uid,
            }),
          ])
        : [null, null];

      if (uploadCheck && !uploadCheck.canUpload) {
        Alert.alert(
          uploadCheck.status === "locked"
            ? "🔒 ระบบปิดรับรูปชั่วคราว"
            : "❌ หมดเวลาส่งรูป",
          uploadCheck.message || "ขณะนี้ยังไม่สามารถบันทึกผลการนับได้",
        );
        return;
      }

      const isLate = uploadCheck?.isLateSubmission ?? false;

      // ถ้ามี sessionId แสดงว่ามี session อยู่แล้ว (จาก preview) ให้อัพเดทแทนการสร้างใหม่
      if (params.sessionId) {
        console.log("📝 Updating existing session:", params.sessionId);

        // อัพเดท session ที่มีอยู่ให้เป็น completed
        const { updateDoc, doc, Timestamp } =
          await import("firebase/firestore");
        const { db } = await import("@/config/firebase");

        const sessionStatus = hasDispute ? "mismatch" : "completed";

        const eodQty = eodDetail?.EOD_Qty ?? beforeQty;
        const eodDiscrepancy = Math.abs(barcodeCount - eodQty);

        await updateDoc(doc(db, "countingSessions", params.sessionId), {
          status: sessionStatus,
          branchId: countBranchId,
          branchName: countBranchName,
          finalCount: barcodeCount,
          manualCount: barcodeCount,
          barcode: params.productBarcode || "",
          standardCount: eodQty,
          discrepancy: eodDiscrepancy,
          ...(effectivePeriod && {
            periodId: effectivePeriod.periodId,
            periodMonth: effectivePeriod.periodMonth,
            periodHalf: effectivePeriod.periodHalf,
          }),
          updatedAt: new Date(),
          ...(disputeRemark && { errorRemark: disputeRemark }),
          ...(userReportedCount !== null && { userReportedCount }),
          ...(isLate && { isLate: true }),
          ...(isSupplemental && { isSupplemental: true }),
        });

        // Case A: AI correct — write confirmed record immediately
        if (!hasDispute && !isSupplemental) {
          await writeShopCountConfirmed({
            sessionId: params.sessionId,
            branchId: countBranchId,
            productId: params.productId || "",
            userId: user.uid,
            userName: user.name || "",
            barcode: params.productBarcode || "",
            paTotalQty: barcodeCount,
            source: "ai",
            countDate: new Date(),
            periodId: effectivePeriod?.periodId,
            periodMonth: effectivePeriod?.periodMonth,
            periodHalf: effectivePeriod?.periodHalf,
          });
        }

        // อัพเดท assignment status เป็น completed (ข้ามถ้าเป็น supplemental)
        if (!isSupplemental && params.assignmentId) {
          await updateAssignmentStatus(
            params.assignmentId,
            "completed",
            Timestamp.now(),
            params.productId,
          );
        }

        const saveMsg = isSupplemental
          ? `แนบรูปเพิ่มเติม ${barcodeCount} รายการเรียบร้อยแล้ว`
          : hasDispute && userReportedCount !== null
            ? `บันทึกสำเร็จ\nAI นับได้: ${barcodeCount} | คุณรายงาน: ${userReportedCount} รายการ\n(บันทึกไว้ให้ผู้ดูแลตรวจสอบ)`
            : `ยืนยันผลการนับ ${barcodeCount} รายการเรียบร้อยแล้ว`;

        Alert.alert(
          isSupplemental ? "แนบรูปเพิ่มเติมสำเร็จ" : "ยืนยันสำเร็จ",
          saveMsg,
          [
            {
              text: "ตกลง",
              onPress: () => router.replace("/(mini-apps)/stock-counter"),
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
      const newSessionStatus = hasDispute ? "mismatch" : "completed";

      await createCountingSession({
        assignmentId: params.assignmentId || "",
        userId: user.uid,
        productId: params.productId,
        companyId: user.companyId || "",
        branchId: countBranchId,
        ...(effectivePeriod && {
          periodId: effectivePeriod.periodId,
          periodMonth: effectivePeriod.periodMonth,
          periodHalf: effectivePeriod.periodHalf,
        }),
        beforeCountQty: beforeQty,
        currentCountQty: barcodeCount,
        variance: variance,
        imageUrl: imageUrl,
        aiConfidence: params.aiConfidence ? parseFloat(params.aiConfidence) : 0,
        aiModel: params.aiModelUsed || "gemini-3-flash-preview",
        processingTime: processingTime,
        deviceInfo: watermarkData?.deviceModel || "",
        appVersion: "1.0.0",
        userName: user.name || "",
        userEmail: user.email || "",
        branchName: countBranchName,
        productName: params.productName || "",
        productSKU: params.productId || "",
        barcode: params.productBarcode || "",
        imageURL: imageUrl,
        aiCount: barcodeCount,
        manualCount: barcodeCount,
        finalCount: barcodeCount,
        standardCount: eodDetail?.EOD_Qty ?? beforeQty,
        discrepancy: Math.abs(barcodeCount - (eodDetail?.EOD_Qty ?? beforeQty)),
        status: newSessionStatus,
        ...(isLate && { isLate: true }),
        ...(isSupplemental && { isSupplemental: true }),
        ...(disputeRemark && { errorRemark: disputeRemark }),
        ...(userReportedCount !== null && { userReportedCount }),
        ...(watermarkData && {
          remarks: JSON.stringify({
            location: watermarkData.location,
            coordinates: watermarkData.coordinates,
            timestamp: watermarkData.timestamp,
            employeeName: watermarkData.employeeName,
            employeeId: watermarkData.employeeId,
            branchName: watermarkData.branchName || "",
          }),
        }),
      });

      // Case A: AI correct — write confirmed record immediately
      if (!hasDispute && !isSupplemental) {
        await writeShopCountConfirmed({
          sessionId: sessionId,
          branchId: countBranchId,
          productId: params.productId || "",
          userId: user.uid,
          userName: user.name || "",
          barcode: params.productBarcode || "",
          paTotalQty: barcodeCount,
          source: "ai",
          countDate: new Date(),
          periodId: effectivePeriod?.periodId,
          periodMonth: effectivePeriod?.periodMonth,
          periodHalf: effectivePeriod?.periodHalf,
        });
      }

      Alert.alert(
        "บันทึกสำเร็จ",
        `บันทึกผลการนับ ${barcodeCount} รายการเรียบร้อยแล้ว`,
        [
          {
            text: "ตกลง",
            onPress: () => router.replace("/(mini-apps)/stock-counter"),
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
          {isSupplemental ? "แนบรูปเพิ่มเติม" : "ผลการนับ"}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Barcode Mismatch Warning */}
        {!isBarcodeMatch && (
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: "#fef2f2",
                borderWidth: 2,
                borderColor: "#ef4444",
              },
            ]}
          >
            <Ionicons name="warning" size={48} color="#ef4444" />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#dc2626",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              ⚠️ บาร์โค้ดไม่ตรงกับสินค้า
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#991b1b",
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {hasDispute
                ? "กรอกจำนวนจริงแล้ว — สามารถบันทึกได้"
                : "ไม่สามารถบันทึกได้ กรุณาถ่ายรูปสินค้าที่ถูกต้องใหม่"}
            </Text>
          </View>
        )}

        {/* Success Icon */}
        <View style={styles.successContainer}>
          <View
            style={[
              styles.successIcon,
              {
                backgroundColor: isBarcodeMatch
                  ? "#10b981" + "20"
                  : "#ef4444" + "20",
              },
            ]}
          >
            <Ionicons
              name={isBarcodeMatch ? "checkmark-circle" : "close-circle"}
              size={64}
              color={isBarcodeMatch ? "#10b981" : "#ef4444"}
            />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            {isBarcodeMatch ? "วิเคราะห์เสร็จสิ้น!" : "บาร์โค้ดไม่ตรง"}
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

        {/* EOD Comparison */}
        {(eodDetail || eodLoading) && (
          <View style={[styles.resultCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              📊 เปรียบเทียบสินค้า ณ วันที่ EOD
            </Text>
            {eodLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : eodDetail ? (
              <>
                <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#3b82f620",
                      borderRadius: 12,
                      padding: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#3b82f6",
                        marginBottom: 4,
                      }}
                    >
                      {eodDetail.EOD_Date
                        ? `ณ ${new Date(eodDetail.EOD_Date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`
                        : "จำนวน EOD"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: "700",
                        color: "#3b82f6",
                      }}
                    >
                      {(eodDetail.EOD_Qty ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: colors.primary + "15",
                      borderRadius: 12,
                      padding: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.primary,
                        marginBottom: 4,
                      }}
                    >
                      นับได้
                    </Text>
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: "700",
                        color: colors.primary,
                      }}
                    >
                      {barcodeCount}
                    </Text>
                  </View>
                  {(() => {
                    const diff = barcodeCount - (eodDetail.EOD_Qty ?? 0);
                    const diffColor =
                      diff > 0 ? "#10b981" : diff < 0 ? "#ef4444" : "#6b7280";
                    return (
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: diffColor + "20",
                          borderRadius: 12,
                          padding: 12,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: diffColor,
                            marginBottom: 4,
                          }}
                        >
                          ผลต่าง
                        </Text>
                        <Text
                          style={{
                            fontSize: 28,
                            fontWeight: "700",
                            color: diffColor,
                          }}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                {eodDetail.EOD_Date && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    ข้อมูล EOD:{" "}
                    {new Date(eodDetail.EOD_Date).toLocaleDateString("th-TH", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                )}
              </>
            ) : null}
          </View>
        )}

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

        {/* Dispute / AI Error Report Summary */}
        {hasDispute && (
          <View
            style={[
              styles.disputeCard,
              { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
            ]}
          >
            <View style={styles.disputeHeader}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={styles.disputeTitle}>แจ้งความผิดพลาด AI</Text>
            </View>
            <View style={styles.disputeRow}>
              <View style={styles.disputeBox}>
                <Text style={styles.disputeBoxLabel}>AI นับได้</Text>
                <Text style={[styles.disputeBoxValue, { color: "#dc2626" }]}>
                  {barcodeCount}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#92400e" />
              <View style={styles.disputeBox}>
                <Text style={styles.disputeBoxLabel}>คุณรายงาน</Text>
                <Text style={[styles.disputeBoxValue, { color: "#16a34a" }]}>
                  {userReportedCount ?? "-"}
                </Text>
              </View>
            </View>
            {disputeRemark && (
              <View style={styles.disputeRemarkBox}>
                <Text style={styles.disputeRemarkLabel}>เหตุผล:</Text>
                <Text style={styles.disputeRemarkText}>{disputeRemark}</Text>
              </View>
            )}
            <Text style={styles.disputeSaved}>
              ข้อมูลนี้จะถูกบันทึกไว้ให้ผู้ดูแลตรวจสอบ
            </Text>
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
            {
              backgroundColor: !canSave
                ? "#9ca3af"
                : !isBarcodeMatch && hasDispute
                  ? "#f59e0b"
                  : "#10b981",
            },
          ]}
          onPress={handleSave}
          disabled={!canSave}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : !isBarcodeMatch && !hasDispute ? (
            <Ionicons name="close-circle-outline" size={20} color="#fff" />
          ) : (
            <Ionicons name="save-outline" size={20} color="#fff" />
          )}
          <Text style={[styles.actionButtonText, { color: "#fff" }]}>
            {isSaving
              ? "กำลังบันทึก..."
              : !isBarcodeMatch && !hasDispute
                ? "บาร์โค้ดไม่ตรง — กรุณาถ่ายใหม่"
                : "บันทึกผล"}
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
  disputeCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  disputeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  disputeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f59e0b",
    flex: 1,
  },
  disputeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  disputeBox: {
    alignItems: "center",
    gap: 4,
  },
  disputeBoxLabel: {
    fontSize: 12,
    color: "#92400e",
  },
  disputeBoxValue: {
    fontSize: 36,
    fontWeight: "700",
  },
  disputeRemarkBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  disputeRemarkLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
  },
  disputeRemarkText: {
    fontSize: 14,
    color: "#78350f",
  },
  disputeSaved: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "500",
    textAlign: "center",
  },
});
