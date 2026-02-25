// Dynamic Expo config — extends app.json and selects the correct native Firebase
// config files based on APP_ENV (set per EAS build profile in eas.json).
//
// APP_ENV=production  → uses *.prod.json / *.prod.plist  (fittbsa-app-prod bucket)
// APP_ENV=sandbox     → uses google-services.json / GoogleService-Info.plist (fittbsa-app-sandbox bucket)

const isProduction = process.env.APP_ENV === "production";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "FITT BSA",
  slug: "fitt-bsa",
  version: "1.0.2",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "fittbsa",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.digitalvalue.fittbsa",
    associatedDomains: ["applinks:fittbsa.com", "applinks:admin.fittbsa.com"],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "ใช้กล้องเพื่อถ่ายรูปสินค้าสำหรับนับจำนวน",
      NSPhotoLibraryUsageDescription: "เข้าถึงคลังรูปภาพเพื่อเลือกรูปสินค้า",
      NSLocationWhenInUseUsageDescription:
        "ใช้ตำแหน่งเพื่อบันทึกสถานที่นับสินค้า",
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [
            "com.googleusercontent.apps.1095128507689-ha6nlvo9t0dooacrks93su4ht30mtqnb",
            "fittbsa",
          ],
        },
      ],
    },
    appleTeamId: "X66E4729UG",
    // Select GoogleService-Info.plist based on environment
    googleServicesFile: isProduction
      ? "./GoogleService-Info.prod.plist"
      : "./GoogleService-Info.plist",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.digitalvalue.fittbsa",
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "fittbsa.com", pathPrefix: "/invitation" },
          {
            scheme: "https",
            host: "admin.fittbsa.com",
            pathPrefix: "/invitation",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.RECORD_AUDIO",
    ],
    // Select google-services.json based on environment
    googleServicesFile: isProduction
      ? "./google-services.prod.json"
      : "./google-services.json",
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#000000" },
      },
    ],
    "@react-native-google-signin/google-signin",
    [
      "expo-camera",
      { cameraPermission: "ใช้กล้องเพื่อถ่ายรูปสินค้าสำหรับนับจำนวน" },
    ],
    [
      "expo-image-picker",
      { photosPermission: "เข้าถึงคลังรูปภาพเพื่อเลือกรูปสินค้า" },
    ],
    [
      "expo-location",
      { locationWhenInUsePermission: "ใช้ตำแหน่งเพื่อบันทึกสถานที่นับสินค้า" },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "fc7bbd1e-59a8-4f4c-abe7-4ae3a73df297",
    },
  },
  owner: "digitalvalue",
};

export default config;
