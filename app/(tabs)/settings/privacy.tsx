import { useTranslation } from "@/constants/i18n";
import { requestAccountDeletion } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PrivacyScreen() {
  const { colors, isDark } = useTheme();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [confirmText, setConfirmText] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [requested, setRequested] = useState(false);

  const userEmail = user?.email || "";
  const requiredText = "DELETE";
  const canConfirm =
    acknowledged && confirmText.trim().toUpperCase() === requiredText;

  const handleRequestPress = () => {
    if (!canConfirm) return;
    Alert.alert(
      t.settings.requestDeleteConfirm,
      t.settings.requestDeleteMessage,
      [
        { text: t.cancel, style: "cancel" },
        {
          text: t.settings.requestDeleteBtn,
          style: "destructive",
          onPress: async () => {
            try {
              setIsRequesting(true);
              await requestAccountDeletion();
              setRequested(true);
              setConfirmText("");
              setAcknowledged(false);
              Alert.alert(
                t.settings.requestDeleteSuccess,
                t.settings.requestDeleteSuccessMessage,
              );
            } catch {
              Alert.alert(t.error, t.settings.requestDeleteError);
            } finally {
              setIsRequesting(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? "#2A2A2A" : "#E5E5E5" },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          ความเป็นส่วนตัวและข้อมูล
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {/* Privacy info */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.iconRow}>
            <Ionicons
              name="shield-checkmark"
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              ข้อมูลของคุณ
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            FITT BSA เก็บรักษาข้อมูลของท่านอย่างปลอดภัย ท่านสามารถจัดการข้อมูล
            ส่วนตัว ดูประวัติการเข้าใช้งาน หรือขอลบบัญชีได้จากหน้านี้
          </Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push("/(tabs)/settings/login-history")}
          >
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.primary }]}>
              ประวัติการเข้าสู่ระบบ
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View
          style={[
            styles.card,
            styles.dangerCard,
            { backgroundColor: isDark ? "#2A1515" : "#FFF5F5" },
          ]}
        >
          <View style={styles.iconRow}>
            <Ionicons name="warning" size={24} color="#DC2626" />
            <Text style={[styles.cardTitle, { color: "#DC2626" }]}>
              พื้นที่อันตราย
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.text }]}>
            การขอลบบัญชีจะส่งคำขอให้{" "}
            <Text style={{ fontWeight: "700" }}>ผู้ดูแลระบบพิจารณา</Text>
            {"\n"}บัญชีจะไม่ถูกลบทันที — จะดำเนินการหลังจากได้รับการอนุมัติ
            {"\n\n"}เมื่อลบแล้ว ข้อมูลทั้งหมด เช่น ประวัติการนับสต็อก,
            การเช็คชื่อ, รูปถ่าย, ค่าคอมมิชชั่น{" "}
            <Text style={{ fontWeight: "700" }}>
              จะถูกลบถาวรและไม่สามารถกู้คืนได้
            </Text>
          </Text>

          {requested && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                backgroundColor: isDark ? "#052E16" : "#F0FDF4",
                borderRadius: 8,
                padding: 12,
                borderWidth: 1,
                borderColor: isDark ? "#166534" : "#BBF7D0",
                marginBottom: 12,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#16A34A"
                style={{ marginTop: 1 }}
              />
              <Text
                style={{
                  fontSize: 13,
                  color: isDark ? "#86EFAC" : "#15803D",
                  flex: 1,
                  lineHeight: 20,
                }}
              >
                {t.settings.requestDeleteSuccessMessage}
              </Text>
            </View>
          )}

          {userEmail ? (
            <Text style={[styles.emailHint, { color: colors.textSecondary }]}>
              บัญชีของท่าน: {userEmail}
            </Text>
          ) : null}

          {/* Step 1: acknowledge checkbox */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setAcknowledged(!acknowledged)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={acknowledged ? "checkbox" : "square-outline"}
              size={24}
              color={acknowledged ? "#DC2626" : colors.textSecondary}
            />
            <Text style={[styles.checkText, { color: colors.text }]}>
              ฉันเข้าใจว่าการกระทำนี้ไม่สามารถย้อนกลับได้
            </Text>
          </TouchableOpacity>

          {/* Step 2: type DELETE */}
          <Text style={[styles.label, { color: colors.text }]}>
            พิมพ์{" "}
            <Text style={{ fontWeight: "700", color: "#DC2626" }}>
              {requiredText}
            </Text>{" "}
            เพื่อยืนยัน
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={requiredText}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isRequesting}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor:
                  confirmText.toUpperCase() === requiredText
                    ? "#DC2626"
                    : isDark
                      ? "#444"
                      : "#DDD",
                backgroundColor: isDark ? "#1A1A1A" : "#FFF",
              },
            ]}
          />

          <TouchableOpacity
            disabled={!canConfirm || isRequesting || requested}
            onPress={handleRequestPress}
            style={[
              styles.dangerBtn,
              {
                opacity: canConfirm && !isRequesting && !requested ? 1 : 0.4,
              },
            ]}
          >
            {isRequesting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={20} color="#fff" />
                <Text style={styles.dangerBtnText}>
                  {t.settings.requestDeleteBtn}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "600", flex: 1, textAlign: "center" },
  container: { flex: 1 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dangerCard: { borderWidth: 1, borderColor: "#DC2626" },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5E5",
  },
  linkText: { fontSize: 14, fontWeight: "500" },
  emailHint: { fontSize: 12, marginBottom: 12, fontStyle: "italic" },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  checkText: { fontSize: 14, flex: 1 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 2,
    marginBottom: 16,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  dangerBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
