import { db } from "@/config/firebase";
import { processGoogleAuth } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
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

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

interface InvitationData {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  companyName?: string;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  managedBranchIds?: string[];
  supervisorId?: string;
  supervisorName?: string;
  supervisorEmail?: string;
  baCode?: string;
  fullName?: string;
  seller?: string;
  sellerCategory?: string;
  invitedByName?: string;
  status: string;
  token: string;
  expiresAt: Timestamp;
}

const ROLE_LABELS: Record<string, string> = {
  employee: "พนักงาน",
  supervisor: "ผู้ดูแลสาขา",
  manager: "ผู้จัดการสาขา",
  admin: "แอดมิน",
};

export default function InvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const setUser = useAuthStore((state) => state.setUser);
  const { colors, isDark } = useTheme();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const configuredRef = useRef(false);

  useEffect(() => {
    if (!configuredRef.current) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        offlineAccess: true,
      });
      configuredRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    verifyInvitation(token);
  }, [token]);

  const verifyInvitation = async (invitationToken: string) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "invitations"),
        where("token", "==", invitationToken),
        where("status", "==", "pending"),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("คำเชิญไม่ถูกต้องหรือหมดอายุแล้ว");
        setLoading(false);
        return;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      // Check expiry
      const expiresAt: Timestamp = data.expiresAt;
      if (expiresAt && expiresAt.toDate() < new Date()) {
        setError("คำเชิญนี้หมดอายุแล้ว");
        setLoading(false);
        return;
      }

      setInvitation({ id: doc.id, ...data } as InvitationData);
    } catch (err) {
      console.error("Error verifying invitation:", err);
      setError("ไม่สามารถตรวจสอบคำเชิญได้");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!invitation) return;

    try {
      setAccepting(true);

      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) throw new Error("ไม่สามารถรับ ID Token จาก Google");

      // Authenticate with Firebase
      const user = await processGoogleAuth(idToken);
      if (!user) throw new Error("ไม่สามารถยืนยันตัวตนได้");

      // Check email matches
      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        Alert.alert(
          "อีเมลไม่ตรงกัน",
          `กรุณาใช้อีเมล ${invitation.email} ที่ได้รับคำเชิญ`,
          [{ text: "ตกลง" }],
        );
        setAccepting(false);
        return;
      }

      // Accept invitation — update user doc + mark invitation accepted
      const {
        doc: firestoreDoc,
        setDoc,
        updateDoc: fsUpdateDoc,
        Timestamp: fsTimestamp,
        arrayUnion,
        getDoc,
      } = await import("firebase/firestore");

      const userDocRef = firestoreDoc(db, "users", user.uid);
      let resolvedBranchName = invitation.branchName || "";
      let resolvedBranchCode = invitation.branchCode || "";
      if (invitation.branchId) {
        const branchDoc = await getDoc(
          firestoreDoc(db, "branches", invitation.branchId),
        );
        if (branchDoc.exists()) {
          const branchData = branchDoc.data();
          resolvedBranchName = branchData.name || resolvedBranchName;
          resolvedBranchCode = branchData.code || resolvedBranchCode;
        }
      }

      const sellerCategory =
        invitation.sellerCategory || invitation.seller || "";
      const userUpdate: Record<string, any> = {
        companyId: invitation.companyId,
        companyName: invitation.companyName || "",
        name: invitation.fullName || user.name,
        displayName: invitation.fullName || user.name,
        role: invitation.role,
        baCode: invitation.baCode || null,
        fullName: invitation.fullName || null,
        seller: sellerCategory || null,
        sellerCategory: sellerCategory || null,
        updatedAt: fsTimestamp.now(),
        invitationId: invitation.id,
      };

      if (invitation.role === "employee") {
        userUpdate.branchId = invitation.branchId || null;
        userUpdate.branchName = resolvedBranchName;
        userUpdate.branchCode = resolvedBranchCode;
        // Multi-branch support: add branchId to branchIds array + branchNames map
        if (invitation.branchId) {
          userUpdate.branchIds = arrayUnion(invitation.branchId);
          userUpdate[`branchNames.${invitation.branchId}`] = resolvedBranchName;
        }
        if (invitation.supervisorId) {
          userUpdate.supervisorId = invitation.supervisorId;
        }
        if (invitation.supervisorName) {
          userUpdate.supervisorName = invitation.supervisorName;
        }
        if (invitation.supervisorEmail) {
          userUpdate.supervisorEmail = invitation.supervisorEmail;
        }
      } else {
        userUpdate.managedBranchIds = invitation.managedBranchIds || [];
        userUpdate.branchName = resolvedBranchName;
      }

      await setDoc(userDocRef, userUpdate, { merge: true });

      // Mark invitation as accepted
      const invitationRef = firestoreDoc(db, "invitations", invitation.id);
      await fsUpdateDoc(invitationRef, {
        status: "accepted",
        acceptedAt: fsTimestamp.now(),
        acceptedBy: user.uid,
      });

      // Update local store (include branchIds for multi-branch UI)
      const updatedBranchIds = Array.from(
        new Set([
          ...(user.branchIds || []),
          ...(invitation.branchId ? [invitation.branchId] : []),
        ]),
      );
      const updatedBranchNames = {
        ...(user.branchNames || {}),
        ...(invitation.branchId
          ? { [invitation.branchId]: resolvedBranchName }
          : {}),
      };
      setUser({
        ...user,
        ...userUpdate,
        branchIds: updatedBranchIds,
        branchNames: updatedBranchNames,
      });

      Alert.alert(
        "ยินดีต้อนรับ! 🎉",
        `คุณเข้าร่วม ${invitation.companyName || "ทีม"} ในบทบาท ${ROLE_LABELS[invitation.role] || invitation.role} แล้ว`,
        [
          {
            text: "เริ่มใช้งาน",
            onPress: () => router.replace("/(tabs)" as any),
          },
        ],
      );
    } catch (err: any) {
      console.error("Error accepting invitation:", err);
      Alert.alert("เกิดข้อผิดพลาด", err.message || "ไม่สามารถยอมรับคำเชิญได้");
    } finally {
      setAccepting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          กำลังตรวจสอบคำเชิญ...
        </Text>
      </View>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={styles.centered}>
          <View style={styles.errorIcon}>
            <Ionicons name="close-circle" size={64} color="#ef4444" />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            คำเชิญไม่ถูกต้อง
          </Text>
          <Text style={[styles.errorMsg, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.backBtnText}>กลับ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!invitation) return null;

  // ─── Main ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* Header */}
        <LinearGradient
          colors={["#f97316", "#ea580c"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="mail-open" size={36} color="#f97316" />
          </View>
          <Text style={styles.headerTitle}>คำเชิญเข้าร่วม FITT BSA</Text>
          <Text style={styles.headerSub}>
            คุณได้รับเชิญให้เข้าร่วมทีมของเรา
          </Text>
        </LinearGradient>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <DetailRow
            icon="person"
            label="ชื่อ-นามสกุล"
            value={invitation.name}
            colors={colors}
          />
          <DetailRow
            icon="mail"
            label="อีเมล"
            value={invitation.email}
            colors={colors}
          />
          <DetailRow
            icon="business"
            label="บริษัท"
            value={invitation.companyName || "-"}
            colors={colors}
          />
          {invitation.branchName && (
            <DetailRow
              icon="location"
              label="สาขา"
              value={invitation.branchName}
              colors={colors}
            />
          )}
          <DetailRow
            icon="briefcase"
            label="บทบาท"
            value={ROLE_LABELS[invitation.role] || invitation.role}
            colors={colors}
            isLast
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.googleBtn, accepting && styles.btnDisabled]}
            onPress={handleGoogleSignIn}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="logo-google"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.googleBtnText}>ยืนยันด้วย Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.note, { color: colors.textSecondary }]}>
            กรุณาใช้อีเมล {invitation.email} ในการยืนยัน
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
  isLast,
}: {
  icon: string;
  label: string;
  value: string;
  colors: any;
  isLast?: boolean;
}) {
  const iconColors: Record<string, string> = {
    person: "#6366f1",
    mail: "#10b981",
    business: "#8b5cf6",
    location: "#f97316",
    briefcase: "#6366f1",
  };

  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View
        style={[styles.rowIcon, { backgroundColor: iconColors[icon] + "20" }]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={iconColors[icon] || "#6366f1"}
        />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorIcon: { marginBottom: 16 },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMsg: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  backBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: "#f97316",
    borderRadius: 12,
  },
  backBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  header: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  headerSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  card: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, marginBottom: 2 },
  rowValue: { fontSize: 16, fontWeight: "600" },
  actions: { paddingHorizontal: 16, paddingTop: 8 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f97316",
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  googleBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  note: { textAlign: "center", fontSize: 13, lineHeight: 18 },
});
