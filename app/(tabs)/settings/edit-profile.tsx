import { db } from "@/config/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    baCode: user?.baCode || "",
    phoneNumber: (user as any)?.phoneNumber || "",
  });

  const handleSave = async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        fullName: form.fullName.trim() || null,
        baCode: form.baCode.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
        updatedAt: new Date(),
      });

      // Update local store
      setUser({
        ...user,
        fullName: form.fullName.trim() || undefined,
        baCode: form.baCode.trim() || undefined,
      });

      Alert.alert("สำเร็จ", "บันทึกข้อมูลเรียบร้อยแล้ว", [
        { text: "ตกลง", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          แก้ไขโปรไฟล์
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Read-only info */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ข้อมูลบัญชี (แก้ไขไม่ได้)
          </Text>
          <View style={styles.readonlyRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              อีเมล
            </Text>
            <Text style={[styles.readonlyValue, { color: colors.text }]}>
              {user.email}
            </Text>
          </View>
          <View style={styles.readonlyRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              ชื่อ (Google/Apple)
            </Text>
            <Text style={[styles.readonlyValue, { color: colors.text }]}>
              {user.name || "—"}
            </Text>
          </View>
        </View>

        {/* Editable fields */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ข้อมูลส่วนตัว
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              รหัสพนักงาน (BA Code)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                  fontFamily: "monospace",
                },
              ]}
              value={form.baCode}
              onChangeText={(v) => setForm({ ...form, baCode: v })}
              placeholder="เช่น BA001"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              ชื่อ-นามสกุลจริง
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={form.fullName}
              onChangeText={(v) => setForm({ ...form, fullName: v })}
              placeholder="ชื่อ-นามสกุลตามบัตรประชาชน"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              เบอร์โทรศัพท์
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={form.phoneNumber}
              onChangeText={(v) => setForm({ ...form, phoneNumber: v })}
              placeholder="0812345678"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: colors.primary },
            loading && { opacity: 0.7 },
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>บันทึก</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
  },
  placeholder: { width: 32 },
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: 12, padding: 16, gap: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  readonlyRow: { gap: 2 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  readonlyValue: { fontSize: 15 },
  fieldGroup: { gap: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
