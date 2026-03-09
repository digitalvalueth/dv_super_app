import { useLanguageStore } from "@/stores/language.store";

const translations = {
  th: {
    // Common
    cancel: "ยกเลิก",
    confirm: "ยืนยัน",
    error: "เกิดข้อผิดพลาด",
    comingSoon: "ฟีเจอร์นี้กำลังพัฒนา",

    // Login
    login: {
      title: "ยินดีต้อนรับ",
      subtitle: "เข้าสู่ระบบเพื่อเริ่มต้นใช้งาน FITT BSA",
      signInWithGoogle: "เข้าสู่ระบบด้วย Google",
      signingIn: "กำลังเข้าสู่ระบบ...",
      errorTitle: "เข้าสู่ระบบไม่สำเร็จ",
      featureCount: "นับสินค้าอัตโนมัติ",
      featureReport: "รายงานแบบเรียลไทม์",
      featureSecurity: "ปลอดภัยสูง",
      note: "ใช้บัญชี Google ของบริษัทในการเข้าสู่ระบบ",
    },

    // Onboarding
    onboarding: {
      next: "ถัดไป",
      start: "เริ่มใช้งาน",
      checking: "กำลังตรวจสอบ...",
      permissionRequired: "ต้องการสิทธิ์นี้",
      permissionMessage: (title: string) =>
        `แอปต้องการสิทธิ์${title}เพื่อใช้งานอย่างเต็มรูปแบบ`,
      camera: {
        title: "กล้องถ่ายรูป",
        description: "ใช้กล้องเพื่อถ่ายรูปสินค้าสำหรับนับจำนวนอัตโนมัติด้วย AI",
        feature1: "นับสินค้าอัตโนมัติด้วย AI",
        feature2: "ถ่ายรูปง่ายๆ ได้ผลทันที",
        feature3: "รองรับหลายรูปแบบสินค้า",
      },
      location: {
        title: "ตำแหน่งที่อยู่",
        description: "บันทึกตำแหน่งที่นับสินค้าเพื่อความถูกต้องและตรวจสอบได้",
        feature1: "บันทึกตำแหน่งที่แม่นยำ",
        feature2: "ตรวจสอบย้อนหลังได้",
        feature3: "ปลอดภัย ไว้วางใจได้",
      },
    },

    // Pending Approval
    pendingApproval: {
      title: "รอการอนุมัติ",
      subtitle: "บัญชีของคุณอยู่ระหว่างการตรวจสอบ",
      description:
        "ผู้ดูแลระบบกำลังตรวจสอบคำขอเข้าใช้งานของคุณ กรุณารอการยืนยันก่อนเริ่มใช้งาน",
      waitingFor: "กำลังรอ:",
      nextSteps: "ขั้นตอนถัดไป:",
      step1: "ติดต่อผู้ดูแลระบบเพื่อขออนุมัติการเข้าถึง",
      step2: "รอผู้ดูแลกำหนดบริษัทและสาขาให้กับคุณ",
      step3: "เข้าสู่ระบบอีกครั้งหลังได้รับการอนุมัติ",
      adminApproval: "การอนุมัติจากผู้ดูแลระบบ",
      companyAssignment: "การกำหนดบริษัท",
      branchAssignment: "การกำหนดสาขา",
      logout: "ออกจากระบบ",
      logoutTitle: "ออกจากระบบ",
      logoutConfirm: "คุณต้องการออกจากระบบหรือไม่?",
      logoutMessage: "คุณต้องการออกจากระบบหรือไม่?",
      logoutError: "ไม่สามารถออกจากระบบได้",
    },

    // Profile / Settings
    settings: {
      title: "โปรไฟล์",
      theme: "ธีม",
      colorMode: "โหมดสี",
      light: "สว่าง",
      dark: "มืด",
      system: "ตามระบบ",
      language: "ภาษา",
      languageLabel: "ภาษา",
      thai: "ไทย",
      english: "English",
      management: "การจัดการ",
      accessRequests: "คำขอเข้าใช้งาน",
      account: "บัญชี",
      inbox: "กล่องข้อความ",
      editProfile: "แก้ไขโปรไฟล์",
      loginHistory: "ประวัติการเข้าใช้งาน",
      deleteAccount: "ลบบัญชี",
      general: "ทั่วไป",
      help: "ช่วยเหลือ",
      about: "เกี่ยวกับ",
      aboutMessage: "Version 1.1.0\n\n© 2026 FITT BSA",
      logout: "ออกจากระบบ",
      logoutTitle: "ออกจากระบบ",
      logoutMessage: "คุณต้องการออกจากระบบหรือไม่?",
      logoutError: "ไม่สามารถออกจากระบบได้",
      deleteTitle: "ลบบัญชี",
      deleteMessage:
        "คุณแน่ใจว่าต้องการลบบัญชีนี้หรือไม่? ข้อมูลทั้งหมดจะถูกลบอย่างถาวรและไม่สามารถกู้คืนได้",
      deleteError: "ไม่สามารถลบบัญชีได้ กรุณาติดต่อผู้ดูแลระบบ",
      reloginTitle: "ต้องเข้าสู่ระบบใหม่",
      reloginMessage:
        "เพื่อความปลอดภัย กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่ จากนั้นลองลบบัญชีอีกครั้ง",
      roles: {
        employee: "พนักงาน",
        admin: "เจ้าของบริษัท",
        super_admin: "ผู้ดูแลระบบ",
        supervisor: "หัวหน้างาน",
        manager: "ผู้จัดการสาขา",
      },
    },
  },

  en: {
    // Common
    cancel: "Cancel",
    confirm: "Confirm",
    error: "Error",
    comingSoon: "This feature is coming soon",

    // Login
    login: {
      title: "Welcome",
      subtitle: "Sign in to start using FITT BSA",
      signInWithGoogle: "Sign in with Google",
      signingIn: "Signing in...",
      errorTitle: "Sign-in Failed",
      featureCount: "Automatic product counting",
      featureReport: "Real-time reports",
      featureSecurity: "High security",
      note: "Use your company Google account to sign in",
    },

    // Onboarding
    onboarding: {
      next: "Next",
      start: "Get Started",
      checking: "Checking...",
      permissionRequired: "Permission Required",
      permissionMessage: (title: string) =>
        `The app needs ${title} permission to work fully.`,
      camera: {
        title: "Camera",
        description:
          "Use your camera to photograph products for AI-powered automatic counting",
        feature1: "AI-powered product counting",
        feature2: "Instant results from photos",
        feature3: "Supports multiple product types",
      },
      location: {
        title: "Location",
        description:
          "Record your location when counting stock for accuracy and traceability",
        feature1: "Precise location tracking",
        feature2: "Historical review",
        feature3: "Safe and trustworthy",
      },
    },

    // Pending Approval
    pendingApproval: {
      title: "Pending Approval",
      subtitle: "Your account is under review",
      description:
        "An administrator is reviewing your access request. Please wait for confirmation before getting started.",
      waitingFor: "Waiting for:",
      nextSteps: "Next steps:",
      step1: "Contact the administrator to request access approval",
      step2: "Wait for the administrator to assign your company and branch",
      step3: "Sign in again after receiving approval",
      adminApproval: "Admin approval",
      companyAssignment: "Company assignment",
      branchAssignment: "Branch assignment",
      logout: "Sign Out",
      logoutTitle: "Sign Out",
      logoutConfirm: "Are you sure you want to sign out?",
      logoutMessage: "Are you sure you want to sign out?",
      logoutError: "Unable to sign out",
    },

    // Profile / Settings
    settings: {
      title: "Profile",
      theme: "Theme",
      colorMode: "Theme",
      light: "Light",
      dark: "Dark",
      system: "System",
      language: "Language",
      languageLabel: "Language",
      thai: "ไทย",
      english: "English",
      management: "Management",
      accessRequests: "Access Requests",
      account: "Account",
      inbox: "Inbox",
      editProfile: "Edit Profile",
      loginHistory: "Login History",
      deleteAccount: "Delete Account",
      general: "General",
      help: "Help",
      about: "About",
      aboutMessage: "Version 1.1.0\n\n© 2026 FITT BSA",
      logout: "Sign Out",
      logoutTitle: "Sign Out",
      logoutMessage: "Are you sure you want to sign out?",
      logoutError: "Unable to sign out",
      deleteTitle: "Delete Account",
      deleteMessage:
        "Are you sure you want to delete your account? All data will be permanently deleted and cannot be recovered.",
      deleteError:
        "Unable to delete account. Please contact the administrator.",
      reloginTitle: "Re-authentication Required",
      reloginMessage:
        "For security, please sign out and sign back in, then try deleting your account again.",
      roles: {
        employee: "Employee",
        admin: "Company Owner",
        super_admin: "Super Admin",
        supervisor: "Supervisor",
        manager: "Branch Manager",
      },
    },
  },
};

export type Translations = typeof translations.th;

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  return translations[language] as Translations;
}
