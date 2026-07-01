import { Ionicons } from "@expo/vector-icons";

export interface MiniApp {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  gradientColors: [string, string];
  route: string;
  category: string;
  comingSoon?: boolean;
}

export const ALL_MINI_APPS: MiniApp[] = [
  {
    id: "stock-counter",
    name: "นับสต็อก",
    description: "นับสินค้าด้วย AI Camera",
    icon: "cube-outline",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    gradientColors: ["#3B82F6", "#1D4ED8"],
    route: "/(mini-apps)/stock-counter",
    category: "inventory",
  },
  {
    id: "shop-stock-receive",
    name: "รับสินค้า (Transfer)",
    description: "สแกน QR ใบส่งของ รับสินค้าเข้าสาขา",
    icon: "download-outline",
    color: "#0EA5E9",
    bgColor: "#E0F2FE",
    gradientColors: ["#0EA5E9", "#0369A1"],
    route: "/(mini-apps)/shop-stock-receive",
    category: "inventory",
  },
  {
    id: "check-in",
    name: "เช็คชื่อ",
    description: "ลงเวลาเข้า-ออกงาน",
    icon: "finger-print-outline",
    color: "#6366F1",
    bgColor: "#EEF2FF",
    gradientColors: ["#6366F1", "#4F46E5"],
    route: "/(mini-apps)/check-in",
    category: "tools",
  },
  {
    id: "daily-sale",
    name: "บันทึกยอดขาย",
    description: "บันทึกยอดขายรายวัน",
    icon: "receipt-outline",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    gradientColors: ["#F59E0B", "#D97706"],
    route: "/(mini-apps)/daily-sale",
    category: "reports",
  },
  {
    id: "history",
    name: "ประวัติการนับ",
    description: "ดูประวัติการนับสต็อก",
    icon: "time-outline",
    color: "#0EA5E9",
    bgColor: "#F0F9FF",
    gradientColors: ["#0EA5E9", "#0284C7"],
    route: "/(mini-apps)/stock-counter?tab=history",
    category: "inventory",
  },
  {
    id: "speech-to-text",
    name: "Speech to Text",
    description: "แปลงเสียงเป็นข้อความ",
    icon: "mic-outline",
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
    gradientColors: ["#8B5CF6", "#6D28D9"],
    route: "/(mini-apps)/speech-to-text",
    category: "tools",
    comingSoon: true,
  },
  {
    id: "scanner",
    name: "Barcode Scanner",
    description: "สแกนบาร์โค้ดสินค้า",
    icon: "barcode-outline",
    color: "#EC4899",
    bgColor: "#FDF2F8",
    gradientColors: ["#EC4899", "#BE185D"],
    route: "/(mini-apps)/scanner",
    category: "tools",
    comingSoon: true,
  },
  {
    id: "reports",
    name: "รายงานสรุป",
    description: "ดูสถิติและรายงาน",
    icon: "bar-chart-outline",
    color: "#10B981",
    bgColor: "#ECFDF5",
    gradientColors: ["#10B981", "#047857"],
    route: "/(mini-apps)/reports",
    category: "reports",
    comingSoon: true,
  },
  {
    id: "export",
    name: "ส่งออกข้อมูล",
    description: "Export เป็น Excel/PDF",
    icon: "download-outline",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    gradientColors: ["#F59E0B", "#B45309"],
    route: "/(mini-apps)/export",
    category: "reports",
    comingSoon: true,
  },
];

// Apps that can be pinned (not coming soon)
export const PINNABLE_APPS = ALL_MINI_APPS.filter((a) => !a.comingSoon);
export const DEFAULT_PINNED_IDS = PINNABLE_APPS.slice(0, 4).map((a) => a.id);
export const PIN_STORAGE_KEY = "pinned_quick_apps";
