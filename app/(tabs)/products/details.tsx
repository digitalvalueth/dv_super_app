import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { createWatermarkMetadata } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
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
  }, []);

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
          {productImage ? (
            <Image source={{ uri: productImage }} style={styles.productImage} />
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
});
