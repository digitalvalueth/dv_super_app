import {
  createDailySale,
  fetchActivePromoItems,
  lookupProductByBarcode,
  PromoItem,
} from "@/services/daily-sale.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { DailySaleItem, SaleType } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Date helpers ───────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatDateTH = (s: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`;
};
const MONTHS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// ─── Promotion helpers ─────────────────────────────────────
const NON_PROMO_REMARKS = ["buy 1", "buy1"];
const isNonPromo = (remark?: string) =>
  NON_PROMO_REMARKS.includes(
    String(remark ?? "")
      .trim()
      .toLowerCase(),
  );

// ─── Item state (includes UI-only fields) ──────────────────
type ItemState = Partial<DailySaleItem> & {
  _key: string;
  saleType: SaleType;
  productImageUrl?: string;
  freebieImageUrl?: string;
  promoStart?: Date | null;
  promoEnd?: Date | null;
  /** Real (non-Buy1) promos waiting for user selection */
  availablePromos?: PromoItem[];
};

// ─── Calendar component ─────────────────────────────────────
function CalendarPicker({
  selected,
  onSelect,
  onClose,
  colors,
  isDark,
}: {
  selected: string;
  onSelect: (s: string) => void;
  onClose: () => void;
  colors: any;
  isDark: boolean;
}) {
  const init = selected ? new Date(selected + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isSelectedCell = (day: number | null) =>
    day !== null &&
    selected === `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
  const isTodayCell = (day: number | null) =>
    day !== null &&
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 20,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 12,
      }}
    >
      {/* Month/year nav */}
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}
      >
        <TouchableOpacity onPress={prevMonth} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            {MONTHS_TH[viewMonth]} {viewYear + 543}
          </Text>
        </View>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 6 }}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {DAY_LABELS.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: colors.textSecondary,
              }}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Days grid */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row", marginBottom: 2 }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            const isSel = isSelectedCell(day);
            const isToday = isTodayCell(day);
            return (
              <TouchableOpacity
                key={col}
                onPress={() => {
                  if (!day) return;
                  onSelect(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`);
                }}
                disabled={!day}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 19,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: isSel
                    ? "#F59E0B"
                    : isToday
                      ? isDark
                        ? "#374151"
                        : "#FEF9C3"
                      : "transparent",
                }}
              >
                {day ? (
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isSel || isToday ? "700" : "400",
                      color: isSel ? "#fff" : isToday ? "#D97706" : colors.text,
                    }}
                  >
                    {day}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Footer buttons */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <TouchableOpacity
          onPress={onClose}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
            ยกเลิก
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onSelect(todayStr())}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
            backgroundColor: isDark ? "#374151" : "#F3F4F6",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>วันนี้</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────
const EMPTY_ITEM = (): ItemState => ({
  _key: String(Date.now() + Math.random()),
  barcode: "",
  productDescription: "",
  productImageUrl: undefined,
  price: 0,
  quantity: 1,
  saleType: "normal",
  hasFreebie: false,
  freebieBarcode: "",
  freebieDescription: "",
  promotionRemark: "",
  availablePromos: [],
});

export default function DailySaleRecord() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);

  // ─── Branch (multi-branch support) ────────────────────────
  const availableBranches: { id: string; name: string }[] = (() => {
    if (user?.branchIds && user.branchIds.length > 0) {
      return user.branchIds.map((id) => ({
        id,
        name: user.branchNames?.[id] || user.branchName || id,
      }));
    }
    if (user?.branchId) {
      return [{ id: user.branchId, name: user.branchName || user.branchId }];
    }
    return [];
  })();

  const [selectedBranchId, setSelectedBranchId] = useState(
    user?.branchId || "",
  );
  const [selectedBranchName, setSelectedBranchName] = useState(
    user?.branchName || "",
  );

  const [saleDate, setSaleDate] = useState(todayStr());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [workDescription, setWorkDescription] = useState("");
  const [items, setItems] = useState<ItemState[]>([EMPTY_ITEM()]);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUp, setLookingUp] = useState<string | null>(null); // itemKey being looked up

  // ─── Promotion list for selected month ─────────────────────
  const [promoItems, setPromoItems] = useState<PromoItem[]>([]);
  useEffect(() => {
    fetchActivePromoItems(saleDate)
      .then(setPromoItems)
      .catch(() => {});
  }, [saleDate]);
  // promoSet: barcodes/itemCodes that have ANY promo entry (for validation badge)
  const promoSet = new Set(
    promoItems.flatMap((p) =>
      p.barcode ? [p.barcode, p.itemCode] : [p.itemCode],
    ),
  );
  // promoMultiMap: barcode/itemCode → ALL PromoItem[] (multiple rows per barcode)
  const promoMultiMap = new Map<string, PromoItem[]>();
  promoItems.forEach((p) => {
    const keys = p.barcode ? [p.barcode, p.itemCode] : [p.itemCode];
    keys.forEach((k) => {
      if (!promoMultiMap.has(k)) promoMultiMap.set(k, []);
      promoMultiMap.get(k)!.push(p);
    });
  });

  /** Check if a promo is active on the exact saleDate */
  const isPromoActiveOnDate = (promo: PromoItem): boolean => {
    if (!promo.promoStart || !promo.promoEnd) return false;
    const d = new Date(saleDate + "T00:00:00");
    return promo.promoStart <= d && d <= promo.promoEnd;
  };

  /** Apply promo master data when a barcode is scanned.
   *  - Filters to promos active on exact saleDate
   *  - Skips Buy1 (non-promo) entries
   *  - Auto-applies if exactly 1 real promo; sets availablePromos for user to pick if >1
   */
  const applyPromoToItem = (itemKey: string, barcode: string) => {
    const allPromos = promoMultiMap.get(barcode) ?? [];
    const activePromos = allPromos.filter(isPromoActiveOnDate);
    const realPromos = activePromos.filter((p) => !isNonPromo(p.remark));

    if (realPromos.length === 0) {
      // No real promo — check if there's a Buy1 base-price entry
      const buy1Entry = activePromos.find((p) => isNonPromo(p.remark));
      if (buy1Entry) {
        updateItem(itemKey, {
          ...(buy1Entry.commPrice != null
            ? { price: buy1Entry.commPrice }
            : {}),
          saleType: "normal",
          promotionRemark: "",
          promoStart: null,
          promoEnd: null,
          availablePromos: [],
        });
      }
      // If no promos at all, leave the item unchanged (price from product catalog)
    } else if (realPromos.length === 1) {
      // Auto-apply the single real promo
      const promo = realPromos[0];
      updateItem(itemKey, {
        ...(promo.commPrice != null ? { price: promo.commPrice } : {}),
        saleType: "promotion",
        promotionRemark: promo.remark ?? "",
        promoStart: promo.promoStart,
        promoEnd: promo.promoEnd,
        availablePromos: [],
      });
    } else {
      // Multiple real promos — let the user pick
      updateItem(itemKey, {
        saleType: "promotion",
        promotionRemark: "",
        promoStart: null,
        promoEnd: null,
        availablePromos: realPromos,
      });
    }
  };

  /** Switch an item to normal sale type, restoring the Buy1 commPrice if available */
  const switchToNormal = (itemKey: string, barcode?: string) => {
    if (barcode) {
      const allPromos = promoMultiMap.get(barcode) ?? [];
      const activePromos = allPromos.filter(isPromoActiveOnDate);
      const buy1Entry = activePromos.find((p) => isNonPromo(p.remark));
      if (buy1Entry && buy1Entry.commPrice != null) {
        updateItem(itemKey, {
          price: buy1Entry.commPrice,
          saleType: "normal",
          promotionRemark: "",
          promoStart: null,
          promoEnd: null,
          availablePromos: [],
        });
        return;
      }
    }
    updateItem(itemKey, {
      saleType: "normal",
      promotionRemark: "",
      promoStart: null,
      promoEnd: null,
      availablePromos: [],
    });
  };

  // Barcode scanner
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanTarget, setScanTarget] = useState<{
    itemKey: string;
    field: "barcode" | "freebieBarcode";
  } | null>(null);
  const lastScanRef = useRef<number>(0);
  const [permission, requestPermission] = useCameraPermissions();

  const openScanner = (
    itemKey: string,
    field: "barcode" | "freebieBarcode",
  ) => {
    if (!permission?.granted) {
      requestPermission().then((res) => {
        if (res.granted) {
          setScanTarget({ itemKey, field });
          setScannerVisible(true);
        } else {
          Alert.alert(
            "ไม่ได้รับอนุญาต",
            "กรุณาอนุญาตการเข้าถึงกล้องในการตั้งค่า",
          );
        }
      });
    } else {
      setScanTarget({ itemKey, field });
      setScannerVisible(true);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    const now = Date.now();
    if (now - lastScanRef.current < 1200) return;
    lastScanRef.current = now;
    if (!scanTarget) return;
    setScannerVisible(false);

    const { itemKey, field } = scanTarget;
    setScanTarget(null);
    setLookingUp(itemKey);

    if (field === "barcode") {
      updateItem(itemKey, { barcode: data, productDescription: data });
      const product = await lookupProductByBarcode(data, user?.companyId || "");
      // Base update from product catalog
      updateItem(itemKey, {
        barcode: data,
        productDescription: product?.name || data,
        productImageUrl: product?.imageUrl,
        price: product?.price ?? 0,
      });
      // Override with promo master data if barcode matches
      applyPromoToItem(itemKey, data);
    } else {
      updateItem(itemKey, { freebieBarcode: data });
      const product = await lookupProductByBarcode(data, user?.companyId || "");
      updateItem(itemKey, {
        freebieBarcode: data,
        freebieDescription: product?.name || data,
        freebieImageUrl: product?.imageUrl,
      });
    }
    setLookingUp(null);
  };

  const updateItem = (key: string, patch: Partial<ItemState>) => {
    setItems((prev) =>
      prev.map((it) => (it._key === key ? { ...it, ...patch } : it)),
    );
  };

  const addItem = () => setItems((prev) => [...prev, EMPTY_ITEM()]);

  const removeItem = (key: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((it) => it._key !== key));
  };

  const handleSubmit = async () => {
    if (!user) return;

    // ── Validation ──────────────────────────────────────────
    const errors: string[] = [];
    const promoWarnings: string[] = [];

    if (!saleDate) errors.push("• วันที่ขาย — ยังไม่ได้เลือก");

    if (availableBranches.length > 1 && !selectedBranchId) {
      errors.push("• สาขา — ยังไม่ได้เลือก");
    }

    const filledItems = items.filter(
      (it) => it.barcode || it.productDescription,
    );
    if (filledItems.length === 0) {
      errors.push("• รายการสินค้า — ยังไม่มีสินค้าเลยแม้แต่รายการเดียว");
    }

    items.forEach((it, idx) => {
      const num = idx + 1;
      if (!it.barcode && !it.productDescription) return; // skip blank rows
      if (!it.barcode)
        errors.push(`• สินค้าที่ ${num} — ยังไม่ได้กรอกบาร์โค้ด`);
      if (!it.productDescription)
        errors.push(`• สินค้าที่ ${num} — ยังไม่ได้กรอกชื่อสินค้า`);
      if (!it.price || Number(it.price) <= 0)
        errors.push(`• สินค้าที่ ${num} — ราคาต้องมากกว่า 0`);
      if (!it.quantity || Number(it.quantity) < 1)
        errors.push(`• สินค้าที่ ${num} — จำนวนต้องอย่างน้อย 1`);
      if (it.hasFreebie && !it.freebieBarcode)
        errors.push(
          `• สินค้าที่ ${num} — มีของแถมแต่ยังไม่ได้กรอกบาร์โค้ดของแถม`,
        );
      // Promotion check (warning, not hard error)
      if (
        it.saleType === "promotion" &&
        it.barcode &&
        promoItems.length > 0 &&
        !promoSet.has(it.barcode)
      ) {
        promoWarnings.push(
          `• สินค้าที่ ${num} (${it.barcode}) — ไม่พบในรายการโปรโมชั่นประจำเดือนนี้`,
        );
      }
    });

    if (errors.length > 0) {
      Alert.alert("กรุณาตรวจสอบข้อมูล", errors.join("\n"), [{ text: "ตกลง" }]);
      return;
    }

    // Promotion mismatch warning — confirmable
    if (promoWarnings.length > 0) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "⚠ สินค้าไม่อยู่ในรายการโปรโมชั่น",
          promoWarnings.join("\n") + "\n\nต้องการบันทึกต่อหรือไม่?",
          [
            {
              text: "ยกเลิก",
              style: "cancel",
              onPress: () => resolve(false),
            },
            { text: "บันทึกต่อ", onPress: () => resolve(true) },
          ],
        );
      });
      if (!confirmed) return;
    }

    const validItems = items.filter(
      (it) => it.barcode && it.productDescription && (it.quantity ?? 0) > 0,
    );

    setSubmitting(true);
    try {
      const saleItems: DailySaleItem[] = validItems.map((it) => ({
        barcode: it.barcode!,
        productDescription: it.productDescription!,
        productImageUrl: it.productImageUrl,
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
        revenue: (Number(it.price) || 0) * (Number(it.quantity) || 1),
        saleType: it.saleType,
        hasFreebie: it.hasFreebie || false,
        freebieBarcode: it.freebieBarcode,
        freebieDescription: it.freebieDescription,
        promotionRemark: it.promotionRemark || undefined,
      }));

      const totalItems = saleItems.reduce((s, i) => s + i.quantity, 0);
      const totalRevenue = saleItems.reduce((s, i) => s + i.revenue, 0);

      await createDailySale({
        companyId: user.companyId || "",
        branchId: selectedBranchId,
        branchName: selectedBranchName,
        employeeId: user.uid,
        baCode: (user as any).baCode,
        employeeName: (user as any).fullName || user.name || user.email || "",
        supervisorId: (user as any).supervisorId,
        supervisorName: (user as any).supervisorName,
        seller: (user as any).seller,
        saleDate,
        workDescription: workDescription.trim() || undefined,
        items: saleItems,
        totalItems,
        totalRevenue,
      });

      Alert.alert("บันทึกสำเร็จ", `บันทึกยอดขายวันที่ ${saleDate} เรียบร้อย`, [
        { text: "ตกลง", onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error("Error saving daily sale:", e);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: isDark ? "#1F2937" : "#F9FAFB",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["bottom", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* ── Header info card ── */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 10,
              }}
            >
              ข้อมูลทั่วไป
            </Text>

            {/* Branch picker — shown only when user has multiple branches */}
            {availableBranches.length > 1 && (
              <>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: 6,
                  }}
                >
                  สาขา
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {availableBranches.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      onPress={() => {
                        setSelectedBranchId(b.id);
                        setSelectedBranchName(b.name);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1.5,
                        borderColor:
                          selectedBranchId === b.id ? "#F59E0B" : colors.border,
                        backgroundColor:
                          selectedBranchId === b.id
                            ? isDark
                              ? "#451A03"
                              : "#FFF7ED"
                            : isDark
                              ? "#1F2937"
                              : "#F9FAFB",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: selectedBranchId === b.id ? "700" : "400",
                          color:
                            selectedBranchId === b.id ? "#D97706" : colors.text,
                        }}
                      >
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Date picker trigger */}
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: 6,
              }}
            >
              วันที่ขาย
            </Text>
            <TouchableOpacity
              onPress={() => setDatePickerVisible(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: isDark ? "#1F2937" : "#F9FAFB",
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 11,
                gap: 10,
              }}
            >
              <Ionicons name="calendar-outline" size={18} color="#F59E0B" />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                {formatDateTH(saleDate)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Work note */}
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              หมายเหตุ (ไม่บังคับ)
            </Text>
            <TextInput
              style={[inputStyle, { minHeight: 56, textAlignVertical: "top" }]}
              value={workDescription}
              onChangeText={setWorkDescription}
              placeholder="บรรยายการทำงาน..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          </View>

          {/* Items */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 10,
            }}
          >
            รายการสินค้า ({items.filter((i) => i.barcode).length} รายการ)
          </Text>

          {items.map((item, idx) => {
            const isPromoMismatch =
              item.saleType === "promotion" &&
              !!item.barcode &&
              promoItems.length > 0 &&
              !promoSet.has(item.barcode);
            return (
              <View
                key={item._key}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: isPromoMismatch ? 2 : 1,
                  borderColor: isPromoMismatch ? "#EF4444" : colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      color: colors.text,
                      fontSize: 13,
                    }}
                  >
                    รายการที่ {idx + 1}
                  </Text>
                  <TouchableOpacity onPress={() => removeItem(item._key)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {/* Barcode row */}
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  บาร์โค้ด
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}
                >
                  <TextInput
                    style={[inputStyle, { flex: 1 }]}
                    value={item.barcode || ""}
                    onChangeText={(v) => updateItem(item._key, { barcode: v })}
                    onEndEditing={(e) => {
                      const val = e.nativeEvent.text.trim();
                      if (val) applyPromoToItem(item._key, val);
                    }}
                    placeholder="8851234567890"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    onPress={() => openScanner(item._key, "barcode")}
                    style={{
                      backgroundColor: "#F59E0B",
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="barcode-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Loading for this item */}
                {lookingUp === item._key && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <ActivityIndicator size="small" color="#F59E0B" />
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      ค้นหาข้อมูลสินค้า...
                    </Text>
                  </View>
                )}

                {/* Product card: image + name */}
                {item.productDescription || item.productImageUrl ? (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      marginBottom: 10,
                      backgroundColor: isDark ? "#111827" : "#F8FAFC",
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: isDark ? "#374151" : "#E2E8F0",
                    }}
                  >
                    {item.productImageUrl ? (
                      <Image
                        source={{ uri: item.productImageUrl }}
                        style={{ width: 68, height: 68, borderRadius: 6 }}
                        contentFit="contain"
                      />
                    ) : (
                      <View
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: 6,
                          backgroundColor: isDark ? "#1F2937" : "#EEF2FF",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Ionicons
                          name="cube-outline"
                          size={30}
                          color="#6366F1"
                        />
                      </View>
                    )}
                    <View style={{ flex: 1, justifyContent: "center" }}>
                      <TextInput
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: colors.text,
                          padding: 0,
                        }}
                        value={item.productDescription || ""}
                        onChangeText={(v) =>
                          updateItem(item._key, { productDescription: v })
                        }
                        placeholder="ชื่อสินค้า"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.textSecondary,
                          marginTop: 3,
                        }}
                      >
                        {item.barcode}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      ชื่อสินค้า
                    </Text>
                    <TextInput
                      style={[inputStyle, { marginBottom: 10 }]}
                      value={item.productDescription || ""}
                      onChangeText={(v) =>
                        updateItem(item._key, { productDescription: v })
                      }
                      placeholder="ระบุชื่อสินค้า"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </>
                )}

                {/* Price + Qty */}
                <View
                  style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      ราคา (฿)
                    </Text>
                    <TextInput
                      style={inputStyle}
                      value={
                        item.price != null && item.price !== 0
                          ? String(item.price)
                          : ""
                      }
                      onChangeText={(v) =>
                        updateItem(item._key, { price: Number(v) || 0 })
                      }
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      จำนวน (ชิ้น)
                    </Text>
                    <TextInput
                      style={inputStyle}
                      value={String(item.quantity ?? 1)}
                      onChangeText={(v) =>
                        updateItem(item._key, { quantity: Number(v) || 1 })
                      }
                      placeholder="1"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                {/* Revenue */}
                <Text
                  style={{
                    fontSize: 12,
                    color: "#2563EB",
                    fontWeight: "600",
                    marginBottom: 10,
                  }}
                >
                  ยอด ฿
                  {(
                    (Number(item.price) || 0) * (Number(item.quantity) || 1)
                  ).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>

                {/* ── Sale type per item ── */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    ประเภทการขาย
                  </Text>
                  {item.saleType === "promotion" &&
                    item.barcode &&
                    promoItems.length > 0 &&
                    (promoSet.has(item.barcode) ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                          backgroundColor: "#F0FDF4",
                          borderRadius: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={12}
                          color="#10B981"
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#059669",
                            fontWeight: "600",
                          }}
                        >
                          อยู่ในรายการโปร
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                          backgroundColor: "#FFF7ED",
                          borderRadius: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Ionicons
                          name="warning-outline"
                          size={12}
                          color="#D97706"
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#D97706",
                            fontWeight: "600",
                          }}
                        >
                          ไม่พบในรายการโปร
                        </Text>
                      </View>
                    ))}
                </View>
                <View
                  style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}
                >
                  {(["normal", "promotion"] as SaleType[]).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() =>
                        t === "normal"
                          ? switchToNormal(item._key, item.barcode)
                          : item.barcode
                            ? applyPromoToItem(item._key, item.barcode)
                            : updateItem(item._key, { saleType: t })
                      }
                      style={{
                        flex: 1,
                        paddingVertical: 7,
                        borderRadius: 8,
                        alignItems: "center",
                        borderWidth: 1.5,
                        borderColor:
                          item.saleType === t
                            ? t === "promotion"
                              ? "#F59E0B"
                              : "#10B981"
                            : colors.border,
                        backgroundColor:
                          item.saleType === t
                            ? t === "promotion"
                              ? "#FFF7ED"
                              : "#F0FDF4"
                            : isDark
                              ? "#1F2937"
                              : "#F9FAFB",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color:
                            item.saleType === t
                              ? t === "promotion"
                                ? "#D97706"
                                : "#059669"
                              : colors.textSecondary,
                        }}
                      >
                        {t === "normal" ? "ปกติ" : "โปรโมชั่น"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Promo info badge */}
                {(() => {
                  const fmtD = (d?: Date | null) =>
                    d
                      ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`
                      : "?";
                  if (item.saleType === "promotion" && item.barcode) {
                    if (promoSet.has(item.barcode)) {
                      return (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 6,
                            marginBottom: 10,
                            backgroundColor: isDark ? "#451A03" : "#FFF7ED",
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderWidth: 1,
                            borderColor: isDark ? "#92400E" : "#FED7AA",
                          }}
                        >
                          <Ionicons
                            name="pricetag-outline"
                            size={14}
                            color="#D97706"
                            style={{ marginTop: 1 }}
                          />
                          <View style={{ flex: 1 }}>
                            {item.promotionRemark ? (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: "#D97706",
                                  fontWeight: "700",
                                }}
                              >
                                โปรโมชัน: {item.promotionRemark}
                              </Text>
                            ) : null}
                            {item.promoStart || item.promoEnd ? (
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: "#B45309",
                                  marginTop: item.promotionRemark ? 2 : 0,
                                }}
                              >
                                ระยะเวลา: {fmtD(item.promoStart)} –{" "}
                                {fmtD(item.promoEnd)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    }
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 10,
                          backgroundColor: isDark ? "#1C1917" : "#FFF1F2",
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          borderWidth: 1,
                          borderColor: isDark ? "#9F1239" : "#FECDD3",
                        }}
                      >
                        <Ionicons
                          name="alert-circle-outline"
                          size={14}
                          color="#F43F5E"
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#F43F5E",
                            fontWeight: "600",
                            flex: 1,
                          }}
                        >
                          ไม่พบโปรโมชันสำหรับสินค้านี้
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

                {/* Promo picker — shown when multiple real promos need user selection */}
                {item.availablePromos && item.availablePromos.length > 0 && (
                  <View
                    style={{
                      marginBottom: 10,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: isDark ? "#92400E" : "#FCD34D",
                      backgroundColor: isDark ? "#451A03" : "#FFFBEB",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingTop: 8,
                        paddingBottom: 6,
                      }}
                    >
                      <Ionicons
                        name="pricetags-outline"
                        size={14}
                        color="#D97706"
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#D97706",
                        }}
                      >
                        เลือกโปรโมชัน ({item.availablePromos.length} รายการ)
                      </Text>
                    </View>
                    {item.availablePromos.map((promo, pi) => {
                      const fmtD = (d?: Date | null) =>
                        d
                          ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`
                          : "?";
                      return (
                        <TouchableOpacity
                          key={pi}
                          onPress={() => {
                            updateItem(item._key, {
                              ...(promo.commPrice != null
                                ? { price: promo.commPrice }
                                : {}),
                              saleType: "promotion",
                              promotionRemark: promo.remark ?? "",
                              promoStart: promo.promoStart,
                              promoEnd: promo.promoEnd,
                              availablePromos: [],
                            });
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 10,
                            paddingVertical: 9,
                            borderTopWidth: 1,
                            borderTopColor: isDark ? "#78350F" : "#FDE68A",
                            gap: 8,
                          }}
                        >
                          <Ionicons
                            name="chevron-forward-outline"
                            size={14}
                            color="#D97706"
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: isDark ? "#FDE68A" : "#92400E",
                              }}
                            >
                              {promo.remark ?? "(ไม่มีชื่อโปรโมชัน)"}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                color: isDark ? "#D97706" : "#B45309",
                                marginTop: 2,
                              }}
                            >
                              {fmtD(promo.promoStart)} – {fmtD(promo.promoEnd)}
                            </Text>
                          </View>
                          {promo.commPrice != null && (
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: "#D97706",
                              }}
                            >
                              ฿
                              {promo.commPrice.toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                              })}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Freebie toggle */}
                <TouchableOpacity
                  onPress={() =>
                    updateItem(item._key, { hasFreebie: !item.hasFreebie })
                  }
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: item.hasFreebie ? "#F59E0B" : colors.border,
                      backgroundColor: item.hasFreebie
                        ? "#F59E0B"
                        : "transparent",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {item.hasFreebie && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: colors.text }}>
                    มีของแถม (Freebie)
                  </Text>
                </TouchableOpacity>

                {/* Freebie fields */}
                {item.hasFreebie && (
                  <View style={{ marginTop: 12 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      บาร์โค้ดของแถม
                    </Text>
                    <View
                      style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}
                    >
                      <TextInput
                        style={[inputStyle, { flex: 1 }]}
                        value={item.freebieBarcode || ""}
                        onChangeText={(v) =>
                          updateItem(item._key, { freebieBarcode: v })
                        }
                        placeholder="บาร์โค้ด"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity
                        onPress={() => openScanner(item._key, "freebieBarcode")}
                        style={{
                          backgroundColor: "#8B5CF6",
                          borderRadius: 8,
                          paddingHorizontal: 14,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Ionicons
                          name="barcode-outline"
                          size={22}
                          color="#fff"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Freebie product card */}
                    {(item.freebieDescription || item.freebieImageUrl) && (
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          backgroundColor: isDark ? "#111827" : "#F5F3FF",
                          borderRadius: 8,
                          padding: 8,
                          borderWidth: 1,
                          borderColor: isDark ? "#4C1D95" : "#DDD6FE",
                        }}
                      >
                        {item.freebieImageUrl ? (
                          <Image
                            source={{ uri: item.freebieImageUrl }}
                            style={{ width: 50, height: 50, borderRadius: 6 }}
                            contentFit="contain"
                          />
                        ) : (
                          <View
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 6,
                              backgroundColor: isDark ? "#1F2937" : "#EDE9FE",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Ionicons
                              name="gift-outline"
                              size={22}
                              color="#8B5CF6"
                            />
                          </View>
                        )}
                        <View style={{ flex: 1, justifyContent: "center" }}>
                          <TextInput
                            style={{
                              fontSize: 12,
                              color: colors.text,
                              padding: 0,
                            }}
                            value={item.freebieDescription || ""}
                            onChangeText={(v) =>
                              updateItem(item._key, { freebieDescription: v })
                            }
                            placeholder="ชื่อของแถม"
                            placeholderTextColor={colors.textSecondary}
                          />
                          <Text
                            style={{
                              fontSize: 10,
                              color: colors.textSecondary,
                              marginTop: 2,
                            }}
                          >
                            {item.freebieBarcode}
                          </Text>
                        </View>
                      </View>
                    )}
                    {!item.freebieDescription && !item.freebieImageUrl && (
                      <>
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginBottom: 4,
                          }}
                        >
                          ชื่อของแถม
                        </Text>
                        <TextInput
                          style={inputStyle}
                          value={item.freebieDescription || ""}
                          onChangeText={(v) =>
                            updateItem(item._key, { freebieDescription: v })
                          }
                          placeholder="ชื่อของแถม"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Add item button */}
          <TouchableOpacity
            onPress={addItem}
            style={{
              borderWidth: 1.5,
              borderColor: "#F59E0B",
              borderStyle: "dashed",
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#F59E0B" />
            <Text style={{ color: "#F59E0B", fontWeight: "600" }}>
              เพิ่มรายการสินค้า
            </Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              backgroundColor: submitting ? "#9CA3AF" : "#F59E0B",
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                บันทึกยอดขาย
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Date picker modal ── */}
      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setDatePickerVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <CalendarPicker
              selected={saleDate}
              onSelect={(s) => {
                setSaleDate(s);
                setDatePickerVisible(false);
              }}
              onClose={() => setDatePickerVisible(false)}
              colors={colors}
              isDark={isDark}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Barcode scanner modal ── */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: "#000" }}
          edges={["top"]}
        >
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "qr"],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            {/* Overlay */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: "center",
                alignItems: "center",
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  width: 240,
                  height: 140,
                  borderWidth: 2,
                  borderColor: "#F59E0B",
                  borderRadius: 8,
                }}
              />
              <Text style={{ color: "#fff", marginTop: 16, fontSize: 14 }}>
                วางบาร์โค้ดในกรอบ
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setScannerVisible(false)}
            style={{
              position: "absolute",
              top: Platform.OS === "ios" ? 56 : 16,
              right: 16,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: 20,
              padding: 10,
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
