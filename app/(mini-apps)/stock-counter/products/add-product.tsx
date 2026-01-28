import { db, storage } from "@/config/firebase";
import { compressProductImage } from "@/services/image.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddProductScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    productId: "",
    name: "",
    description: "",
    barcode: "",
    category: "",
    series: "",
    beforeCount: "0",
  });

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert("ข้อมูลไม่ครบ", "กรุณากรอกชื่อสินค้า");
      return;
    }

    if (!user?.companyId) {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่พบข้อมูลบริษัท");
      return;
    }

    setLoading(true);

    try {
      let imageUrl: string | null = null;

      // Upload image if exists
      if (imageUri) {
        // Compress image before upload (reduces ~50% size)
        const compressed = await compressProductImage(imageUri);
        console.log(
          `📸 Compressed product image: ${compressed.width}x${compressed.height}`,
        );

        const response = await fetch(compressed.uri);
        const blob = await response.blob();

        const timestamp = Date.now();
        const fileName = `products/${user.companyId}/${formData.productId || timestamp}_${timestamp}.jpg`;
        const storageRef = ref(storage, fileName);

        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      // Generate product ID if not provided
      const productId = formData.productId.trim() || `PROD-${Date.now()}`;

      // Add product to Firestore
      await addDoc(collection(db, "products"), {
        productId: productId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        barcode: formData.barcode.trim() || null,
        category: formData.category.trim() || null,
        series: formData.series.trim() || null,
        beforeCount: parseInt(formData.beforeCount) || 0,
        companyId: user.companyId,
        branchId: user.branchId || null,
        imageUrl: imageUrl,
        // Employee tracking fields
        status: "pending_verification", // รอ admin ตรวจสอบกับคลัง
        isUserCreated: true,
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        "สำเร็จ",
        "เพิ่มสินค้าเรียบร้อยแล้ว\n\nสินค้านี้อยู่ระหว่างรอตรวจสอบจากคลังสินค้า เมื่อยืนยันแล้วจะถูกมอบหมายให้นับโดยอัตโนมัติ",
        [
          {
            text: "ตกลง",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error("Error adding product:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเพิ่มสินค้าได้");
    } finally {
      setLoading(false);
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
          เพิ่มสินค้าใหม่
        </Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.content}
        >
          {/* Image Picker */}
          <TouchableOpacity
            style={[styles.imagePicker, { backgroundColor: colors.card }]}
            onPress={handlePickImage}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons
                  name="camera-outline"
                  size={40}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.imageText, { color: colors.textSecondary }]}
                >
                  ถ่ายรูปสินค้า
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form */}
          <View style={[styles.formCard, { backgroundColor: colors.card }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                รหัสสินค้า
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="เช่น SK-C-250"
                placeholderTextColor={colors.textSecondary}
                value={formData.productId}
                onChangeText={(text) =>
                  setFormData({ ...formData, productId: text })
                }
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                ชื่อสินค้า <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="กรอกชื่อสินค้า"
                placeholderTextColor={colors.textSecondary}
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                บาร์โค้ด
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="สแกนหรือกรอกบาร์โค้ด"
                placeholderTextColor={colors.textSecondary}
                value={formData.barcode}
                onChangeText={(text) =>
                  setFormData({ ...formData, barcode: text })
                }
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.text }]}>
                  หมวดหมู่
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="เช่น SK"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.category}
                  onChangeText={(text) =>
                    setFormData({ ...formData, category: text })
                  }
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Series
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="เช่น Series A"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.series}
                  onChangeText={(text) =>
                    setFormData({ ...formData, series: text })
                  }
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                รายละเอียด
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="รายละเอียดเพิ่มเติม..."
                placeholderTextColor={colors.textSecondary}
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                จำนวนก่อนหน้า
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={formData.beforeCount}
                onChangeText={(text) =>
                  setFormData({ ...formData, beforeCount: text })
                }
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              loading && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>เพิ่มสินค้า</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  imagePicker: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageText: {
    marginTop: 8,
    fontSize: 14,
  },
  formCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
