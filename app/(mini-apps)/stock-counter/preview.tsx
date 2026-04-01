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
  BarcodeCountResult,
  countBarcodesInImage,
} from "@/services/gemini.service";
import { createSupplementSession } from "@/services/supplement.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { formatTimestamp, WatermarkData } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
    isSupplementMode?: string; // "true" เมื่อเข้ามาจาก history ถ่ายเพิ่ม
    originalSessionId?: string; // original countingSession id สำหรับ supplement
    isSupplemental?: string; // "true" เมื่อถ่ายรูปเพิ่มเติม (ใน completed.tsx)
  }>();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [barcodeCount, setBarcodeCount] = useState<number | null>(null);
  const [barcodeMatch, setBarcodeMatch] = useState<boolean | null>(null);
  const [detectedBarcodes, setDetectedBarcodes] = useState<string[]>([]);
  const [needsRecount, setNeedsRecount] = useState<boolean>(false);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [aiModelUsed, setAiModelUsed] = useState<string>("");
  const [aiConfidence, setAiConfidence] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(
    params.existingSessionId || null,
  );
  const [imageBase64, setImageBase64] = useState<string | null>(
    params.imageBase64 || null,
  );
  const [displayImageUri, setDisplayImageUri] = useState<string>(
    params.imageUri || "",
  );

  // Auto-analyze ref — ensures AI runs exactly once after upload completes
  const autoAnalyzedRef = useRef(false);

  // Dispute / error-report state
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [disputeCount, setDisputeCount] = useState("");
  const [disputeRemark, setDisputeRemark] = useState("");

  // Supplement mode: stores the uploaded image URL (no countingSession created)
  const [supplementImageUrl, setSupplementImageUrl] = useState<string>("");

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
      if (!user || !params.productId || !params.imageUri) return;
      // isSupplemental flow (from completed.tsx) always allowed — no assignmentId required
      const isSupplementalFlow = params.isSupplemental === "true";
      // Normal mode requires assignmentId; supplement mode (history) skips it
      if (
        !isSupplementalFlow &&
        params.isSupplementMode !== "true" &&
        !params.assignmentId
      )
        return;

      const isViewingExistingRemoteSession =
        !!params.existingSessionId &&
        !params.imageBase64 &&
        params.imageUri?.startsWith("https://");

      if (user.companyId && !isViewingExistingRemoteSession) {
        try {
          const uploadCheck = await canUploadPhoto(user.companyId, undefined, {
            userId: user.uid,
          });

          if (!uploadCheck.canUpload) {
            Alert.alert(
              uploadCheck.status === "locked"
                ? "🔒 ระบบปิดรับรูปชั่วคราว"
                : "❌ หมดเวลาส่งรูป",
              uploadCheck.message || "ขณะนี้ยังไม่สามารถอัปโหลดรูปได้",
              [{ text: "ตกลง", onPress: () => router.back() }],
              { cancelable: false },
            );
            return;
          }
        } catch {
          // ไม่มี period config → ไม่บล็อค
        }
      }

      const effectivePeriod = user.companyId
        ? await getEffectiveCountingPeriod(user.companyId, undefined, {
            userId: user.uid,
          })
        : null;

      // ── Supplement mode (history flow): just upload image, no counting session ──
      if (params.isSupplementMode === "true") {
        try {
          setIsUploading(true);
          const tempId = `supplement_${Date.now()}`;
          const imageUrl = await uploadCountingImage(
            user.uid,
            tempId,
            params.imageUri,
          );
          setSupplementImageUrl(imageUrl);
        } catch (error) {
          console.error("Error uploading supplement image:", error);
          Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถอัพโหลดรูปภาพได้");
        } finally {
          setIsUploading(false);
        }
        return;
      }

      // ถ้ามี existingSessionId และไม่มี imageBase64 และ imageUri เป็น Firebase URL
      // = มาจากหน้า details กดดูรูปเก่า → โหลด base64 จาก URL
      // (ถ้า imageUri เป็น local file = กด ถ่ายใหม่ → ผ่านไปให้ upload logic ด้านล่างจัดการ)
      if (
        params.existingSessionId &&
        !params.imageBase64 &&
        params.imageUri?.startsWith("https://")
      ) {
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

        // 1. Mark product as in_progress (ข้ามถ้าเป็น supplemental — สินค้านับเสร็จแล้ว)
        if (!isSupplementalFlow && params.assignmentId) {
          await updateAssignmentStatus(
            params.assignmentId,
            "in_progress",
            undefined,
            params.productId,
          );
        }

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
              ...(effectivePeriod && {
                periodId: effectivePeriod.periodId,
                periodMonth: effectivePeriod.periodMonth,
                periodHalf: effectivePeriod.periodHalf,
              }),
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
            assignmentId: params.assignmentId || "",
            productId: params.productId,
            productName: params.productName || "",
            productSKU: params.productBarcode || "",
            companyId: user.companyId || "",
            branchId: user.branchId || "",
            branchName: user.branchName || "",
            beforeCountQty: beforeQty,
            ...(effectivePeriod && {
              periodId: effectivePeriod.periodId,
              periodMonth: effectivePeriod.periodMonth,
              periodHalf: effectivePeriod.periodHalf,
            }),
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
                  branchName: watermarkData.branchName || user.branchName || "",
                  deviceModel: watermarkData.deviceModel || "Unknown",
                })
              : "",
            processingTime: 0,
            deviceInfo: watermarkData?.deviceModel || "Unknown",
            appVersion: "1.0.0",
            ...(isSupplementalFlow && { isSupplemental: true }),
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
    params.isSupplementMode,
    params.isSupplemental,
  ]);

  // ── Auto-trigger AI analysis once sessionId is ready (normal + isSupplemental flow) ──
  useEffect(() => {
    if (
      !autoAnalyzedRef.current &&
      sessionId &&
      barcodeCount === null &&
      !isProcessing &&
      params.isSupplementMode !== "true"
    ) {
      autoAnalyzedRef.current = true;
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Auto-trigger for supplement mode (uses supplementImageUrl instead of sessionId) ──
  useEffect(() => {
    if (
      !autoAnalyzedRef.current &&
      params.isSupplementMode === "true" &&
      supplementImageUrl &&
      barcodeCount === null &&
      !isProcessing
    ) {
      autoAnalyzedRef.current = true;
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplementImageUrl]);

  const handleAnalyze = useCallback(async () => {
    // Supplement mode doesn't need a sessionId; normal mode does
    if (!sessionId && params.isSupplementMode !== "true") {
      Alert.alert("กรุณารอสักครู่", "กำลังอัพโหลดรูปภาพ...");
      return;
    }

    try {
      setIsProcessing(true);
      setBarcodeCount(null);
      setNeedsRecount(false);

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
          encoding: "base64",
        });
        setImageBase64(base64ForAI);
      }

      // 1. วิเคราะห์รูปด้วย AI พร้อม barcode validation
      // ใช้ productBarcode จากระบบเป็นหลัก (barcode ที่ลงทะเบียนในฐานข้อมูล)
      // nativeScannedBarcode อาจเป็น barcode ของผู้ผลิตต่างประเทศ ≠ barcode ในระบบ
      // AI จะตรวจบาร์โค้ดในรูปเสมอ — ป้องกัน fraud (สแกนสินค้าถูก แต่ถ่ายรูปสินค้าผิด)
      const effectiveExpectedBarcode =
        params.productBarcode || params.nativeScannedBarcode || undefined;

      const result: BarcodeCountResult = await countBarcodesInImage(
        base64ForAI,
        effectiveExpectedBarcode,
        params.productName || undefined,
      );

      setBarcodeCount(result.count);
      setBarcodeMatch(result.barcodeMatch);
      setDetectedBarcodes(result.detectedBarcodes);
      setNeedsRecount(result.needsRecount ?? false);
      setProcessingTime(result.processingTime);
      setAiModelUsed(result.modelUsed);
      setAiConfidence(result.confidence);

      // needsRecount = AI detected correct barcode but gave inconsistent count=0 (hallucination)
      if (result.needsRecount) {
        Alert.alert(
          "🔄 วิเคราะห์ไม่สมบูรณ์",
          `AI พบบาร์โค้ดถูกต้อง (${result.matchedBarcode}) แต่นับจำนวนไม่สมบูรณ์\nกรุณากดวิเคราะห์อีกครั้ง`,
          [{ text: "วิเคราะห์อีกครั้ง" }],
        );
      } else if (params.productBarcode && !result.barcodeMatch) {
        // Warning if barcode doesn't match (only when product has a barcode)
        Alert.alert(
          "⚠️ บาร์โค้ดไม่ตรง",
          result.detectedBarcodes.length > 0
            ? `พบบาร์โค้ด: ${result.detectedBarcodes.join(", ")}\nแต่ต้องการ: ${params.productBarcode || "-"}\n\nกรุณาถ่ายรูปสินค้าที่ถูกต้อง`
            : `ไม่พบบาร์โค้ดในรูปภาพ\nกรุณาถ่ายรูปสินค้าให้เห็นบาร์โค้ดชัดเจน`,
          [{ text: "ตกลง" }],
        );
      }

      // 2. อัพเดท session ที่มีอยู่แล้วด้วยผลวิเคราะห์
      // ข้ามขั้นตอนนี้ใน supplement mode (ไม่มี countingSession)
      if (params.isSupplementMode !== "true" && sessionId) {
        const { updateDoc, doc } = await import("firebase/firestore");
        const { db } = await import("@/config/firebase");

        const beforeQty = parseInt(params.beforeQty || "0");
        // ถ้าบาร์โค้ดไม่ตรง อย่าบันทึกจำนวนของสินค้าอื่น ให้ count = 0
        const isMismatch = !!params.productBarcode && !result.barcodeMatch;
        const countToSave = isMismatch ? 0 : result.count;
        const variance = beforeQty - countToSave;

        await updateDoc(doc(db, "countingSessions", sessionId), {
          currentCountQty: countToSave,
          variance: variance,
          aiCount: countToSave,
          aiConfidence: result.confidence,
          manualCount: countToSave,
          finalCount: countToSave,
          discrepancy: Math.abs(variance),
          processingTime: result.processingTime || 0,
          barcodeMatch: result.barcodeMatch,
          detectedBarcodes: result.detectedBarcodes,
          matchedBarcode: result.matchedBarcode || null,
          // mismatch = ถ่ายผิดสินค้า, analyzed = วิเคราะห์แล้วรอยืนยัน
          status: isMismatch ? "mismatch" : "analyzed",
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถวิเคราะห์รูปภาพได้");
    } finally {
      setIsProcessing(false);
    }
  }, [
    imageBase64,
    sessionId,
    params.beforeQty,
    params.imageUri,
    params.isSupplementMode,
    params.nativeScannedBarcode,
    params.productBarcode,
    params.productName,
  ]);

  const handleRetake = () => {
    router.back();
  };

  const handleConfirm = async () => {
    if (barcodeCount === null) {
      Alert.alert(
        "กรุณาวิเคราะห์รูปก่อน",
        "กดปุ่ม 'วิเคราะห์ด้วย AI' เพื่อนับจำนวน Barcode",
      );
      return;
    }

    // ── Supplement mode: save supplement session and go back ──
    if (params.isSupplementMode === "true") {
      if (!params.originalSessionId) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่พบข้อมูล session เดิม");
        return;
      }
      try {
        await createSupplementSession({
          originalSessionId: params.originalSessionId,
          userId: user!.uid,
          userName: user!.name || "",
          productId: params.productId || "",
          productName: params.productName || "",
          companyId: user!.companyId || "",
          branchId: user!.branchId || "",
          additionalCount: barcodeCount,
          imageUrl: supplementImageUrl,
          aiCount: barcodeCount,
          reason: "เจอสินค้าเพิ่มเติม",
        });
        Alert.alert(
          "✅ ส่งข้อมูลสำเร็จ",
          "รายการถ่ายเพิ่มถูกส่งให้ Supervisor ตรวจสอบแล้ว",
          [{ text: "ตกลง", onPress: () => router.back() }],
        );
      } catch (error) {
        console.error("Error creating supplement session:", error);
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่");
      }
      return;
    }

    if (!sessionId) {
      Alert.alert("กรุณารอสักครู่", "กำลังอัพโหลดรูปภาพ...");
      return;
    }

    // Navigate to result screen with session ID + dispute data
    router.push({
      pathname: "/(mini-apps)/stock-counter/result",
      params: {
        sessionId: sessionId,
        imageUri: params.imageUri,
        barcodeCount: barcodeCount.toString(),
        processingTime: processingTime?.toString() || "0",
        productId: params.productId,
        productName: params.productName,
        productBarcode: params.productBarcode,
        assignmentId: params.assignmentId,
        beforeQty: params.beforeQty,
        watermarkData: params.watermarkData,
        // Barcode match status — used to block save on mismatch
        barcodeMatchStatus: barcodeMatch === false ? "mismatch" : "match",
        // Dispute / error-report fields
        userReportedCount: disputeCount.trim() || "",
        disputeRemark: disputeRemark.trim() || "",
        isSupplemental: params.isSupplemental || "",
        aiModelUsed: aiModelUsed || "",
        aiConfidence: aiConfidence.toString(),
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
          {params.isSupplementMode === "true" ? "ถ่ายเพิ่ม" : "ตรวจสอบรูปภาพ"}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => setIsFullscreen(true)}
              >
                <Image
                  source={{ uri: displayImageUri || params.imageUri }}
                  style={styles.image}
                  resizeMode="cover"
                />
                {/* Fullscreen hint */}
                <View style={styles.fullscreenHint}>
                  <Ionicons name="expand" size={16} color="#fff" />
                  <Text style={styles.fullscreenHintText}>ดูรูปเต็มจอ</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Fullscreen Modal */}
          <Modal
            visible={isFullscreen}
            transparent={false}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setIsFullscreen(false)}
          >
            <View style={styles.fullscreenContainer}>
              <Image
                source={{ uri: displayImageUri || params.imageUri }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={styles.fullscreenClose}
                onPress={() => setIsFullscreen(false)}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </Modal>

          {/* Product Info */}
          {params.productName && (
            <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
              <View style={styles.infoRow}>
                <Ionicons
                  name="cube-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
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
                  style={[
                    styles.processingText,
                    { color: colors.textSecondary },
                  ]}
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
                {needsRecount ? (
                  <View
                    style={[
                      styles.barcodeMatchBadge,
                      { backgroundColor: "#d9770620" },
                    ]}
                  >
                    <Ionicons name="refresh-circle" size={18} color="#d97706" />
                    <Text
                      style={[styles.barcodeMatchText, { color: "#d97706" }]}
                    >
                      พบบาร์โค้ดถูกต้องแต่นับไม่สมบูรณ์ — วิเคราะห์อีกครั้ง
                    </Text>
                  </View>
                ) : params.productBarcode ? (
                  <View
                    style={[
                      styles.barcodeMatchBadge,
                      {
                        backgroundColor: barcodeMatch
                          ? "#16a34a20"
                          : "#dc262620",
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

                {/* ──── Dispute / Error-report form ──── */}
                <TouchableOpacity
                  style={[styles.disputeToggle, { borderColor: "#f59e0b" }]}
                  onPress={() => {
                    const willOpen = !showDisputeForm;
                    setShowDisputeForm(willOpen);
                    if (willOpen) {
                      setDisputeCount("");
                      setTimeout(
                        () =>
                          scrollViewRef.current?.scrollToEnd({
                            animated: true,
                          }),
                        300,
                      );
                    }
                  }}
                >
                  <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                  <Text style={styles.disputeToggleText}>
                    {showDisputeForm
                      ? "ยกเลิกการแจ้ง"
                      : "AI นับผิด? แจ้งข้อผิดพลาด"}
                  </Text>
                  <Ionicons
                    name={showDisputeForm ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#f59e0b"
                  />
                </TouchableOpacity>

                {showDisputeForm && (
                  <View style={styles.disputeForm}>
                    <Text style={styles.disputeLabel}>
                      🤖 AI นับได้:{" "}
                      <Text style={styles.disputeAiCount}>{barcodeCount}</Text>{" "}
                      รายการ
                    </Text>

                    <Text style={styles.disputeFieldLabel}>
                      จำนวนที่คุณนับได้จริง
                    </Text>
                    <TextInput
                      style={styles.disputeCountInput}
                      value={disputeCount}
                      onChangeText={(t) =>
                        setDisputeCount(t.replace(/[^0-9]/g, ""))
                      }
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      onFocus={() =>
                        setTimeout(
                          () =>
                            scrollViewRef.current?.scrollToEnd({
                              animated: true,
                            }),
                          200,
                        )
                      }
                    />

                    <Text style={[styles.disputeFieldLabel, { marginTop: 10 }]}>
                      เหตุผล / รายละเอียด
                    </Text>
                    <TextInput
                      style={styles.disputeRemarkInput}
                      value={disputeRemark}
                      onChangeText={setDisputeRemark}
                      placeholder="เช่น สินค้าหันหลังให้กล้อง, บาร์โค้ดบางส่วนถูกบัง..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      onFocus={() =>
                        setTimeout(
                          () =>
                            scrollViewRef.current?.scrollToEnd({
                              animated: true,
                            }),
                          200,
                        )
                      }
                    />

                    {disputeCount.trim().length > 0 && (
                      <Text style={styles.disputeHint}>
                        ✓ จะบันทึก: AI={barcodeCount} | คุณรายงาน=
                        {disputeCount}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyResult}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  {isUploading || !sessionId
                    ? "กำลังอัพโหลดและเตรียมวิเคราะห์..."
                    : "กำลังวิเคราะห์อัตโนมัติ..."}
                </Text>
              </View>
            )}

            {/* แสดงปุ่ม "ลองอีกครั้ง" หลังจากวิเคราะห์ครั้งแรกแล้วเท่านั้น */}
            {barcodeCount !== null && (
              <TouchableOpacity
                style={[
                  styles.analyzeButton,
                  { backgroundColor: colors.primary },
                  (isProcessing || isUploading || isLoadingImage) && {
                    opacity: 0.6,
                  },
                ]}
                onPress={handleAnalyze}
                disabled={isProcessing || isUploading || isLoadingImage}
              >
                {isProcessing ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.analyzeButtonText}>
                      กำลังวิเคราะห์...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.analyzeButtonText}>ลองอีกครั้ง</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
              {
                backgroundColor:
                  barcodeMatch === false &&
                  !!params.productBarcode &&
                  !(showDisputeForm && disputeCount.trim().length > 0)
                    ? "#dc2626"
                    : colors.primary,
              },
              (barcodeCount === null ||
                (barcodeMatch === false &&
                  !!params.productBarcode &&
                  !(showDisputeForm && disputeCount.trim().length > 0))) && {
                opacity: 0.5,
              },
            ]}
            onPress={handleConfirm}
            disabled={
              barcodeCount === null ||
              (barcodeMatch === false &&
                !!params.productBarcode &&
                !(showDisputeForm && disputeCount.trim().length > 0))
            }
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={[styles.actionButtonText, { color: "#fff" }]}>
              ยืนยัน
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  fullscreenHint: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  fullscreenHintText: {
    color: "#fff",
    fontSize: 12,
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
  // Dispute / error-report
  disputeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 4,
  },
  disputeToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f59e0b",
  },
  disputeForm: {
    width: "100%",
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  disputeLabel: {
    fontSize: 13,
    color: "#92400e",
    fontWeight: "500",
    marginBottom: 4,
  },
  disputeAiCount: {
    fontWeight: "700",
    color: "#dc2626",
  },
  disputeFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78350f",
  },
  disputeCountInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  disputeRemarkInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1f2937",
    minHeight: 80,
  },
  disputeHint: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "600",
    textAlign: "center",
  },
});
