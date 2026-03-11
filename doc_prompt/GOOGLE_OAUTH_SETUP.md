# Google OAuth Client IDs Setup

ต้องได้ Client IDs จาก Firebase Console:

## 📍 ไปที่ Firebase Console

1. ไปที่ [Firebase Console](https://console.firebase.google.com)
2. เลือก Project ของคุณ
3. ไปที่ **Authentication** > **Sign-in method**
4. คลิกที่ **Google** provider
5. จะเห็น **Web SDK configuration**

## 🔑 Client IDs ที่ต้องใส่ใน `.env`

### Web Client ID

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

**หาจาก:** Firebase Console > Authentication > Google > Web SDK configuration

### iOS Client ID (Optional สำหรับ iOS)

```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

**หาจาก:**

1. Download `GoogleService-Info.plist`
2. เปิดไฟล์ แล้วหา `CLIENT_ID`

### Android Client ID (Optional สำหรับ Android)

```
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

**หาจาก:**

1. Download `google-services.json`
2. เปิดไฟล์ แล้วหา `oauth_client` > `client_id`

---

## ⚙️ วิธีเพิ่มใน `.env`

เปิดไฟล์ `.env` และเพิ่ม:

```env
# Google OAuth Client IDs
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

---

## 🚀 ทดสอบ

```bash
npx expo start -c
```

กด Login → ควรเห็น Google Sign-In popup/screen
