# 🔧 แก้ไข Error 400: invalid_request

## ปัญหา

Google OAuth ไม่ยอมรับ redirect URI ที่ Expo สร้างให้ (`exp://172.168.1.133:8081`)

---

## ✅ วิธีแก้ (3 ทางเลือก)

### **วิธีที่ 1: เพิ่ม Redirect URI ใน Google Cloud Console** ⭐ แนะนำ

#### ขั้นตอน:

1. **ไปที่ Google Cloud Console:**

   - [https://console.cloud.google.com](https://console.cloud.google.com)
   - เลือก Project: **fittbsa**

2. **ไปที่ APIs & Services > Credentials:**

   - คลิกที่ OAuth 2.0 Client ID ที่ใช้ (Web client)
   - หา Client ID: `1095128507689-q8iq6a4qgke7ksp3he50eo2hr2r5d7ad`

3. **เพิ่ม Authorized redirect URIs:**

   เพิ่ม URIs เหล่านี้:

   ```
   https://auth.expo.io/@anonymous/super-fitt
   https://auth.expo.io/@YOUR_EXPO_USERNAME/super-fitt
   http://localhost:19006
   ```

4. **บันทึกและรอ 5 นาที** (Google ต้อง propagate การเปลี่ยนแปลง)

---

### **วิธีที่ 2: ใช้ Expo Go (Development only)**

ถ้าใช้ Expo Go app:

```typescript
// app/(auth)/login.tsx
const [request, response, promptAsync] = Google.useAuthRequest({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  redirectUri: makeRedirectUri({
    scheme: "superfitt",
    useProxy: true, // ใช้ Expo's auth proxy
  }),
});
```

---

### **วิธีที่ 3: สร้าง OAuth Client ID แยก (สำหรับ Mobile)**

#### สำหรับ iOS:

1. ไปที่ Google Cloud Console > Credentials
2. คลิก **Create Credentials** > **OAuth client ID**
3. เลือก **iOS**
4. ใส่:
   - **Bundle ID**: `com.itswatthachai.superfitt` (จาก app.json)
5. คัดลอก **iOS client ID** ใส่ใน `.env`

#### สำหรับ Android:

1. Generate SHA-1 fingerprint:

   ```bash
   # Debug keystore
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

2. ไปที่ Google Cloud Console > Credentials
3. คลิก **Create Credentials** > **OAuth client ID**
4. เลือก **Android**
5. ใส่:
   - **Package name**: `com.itswatthachai.superfitt`
   - **SHA-1**: (จากขั้นตอนที่ 1)
6. คัดลอก **Android client ID** ใส่ใน `.env`

---

## 🚀 วิธีที่เร็วที่สุด (แนะนำตอนนี้)

ใช้ **Expo's auth proxy** สำหรับ development:

### 1. อัพเดท login.tsx:

```typescript
import { makeRedirectUri } from "expo-auth-session";

const [request, response, promptAsync] = Google.useAuthRequest({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  redirectUri: makeRedirectUri({
    scheme: "superfitt",
    useProxy: true,
  }),
});
```

### 2. เพิ่ม URI ใน Google Cloud Console:

ไปเพิ่ม:

```
https://auth.expo.io/@anonymous/super-fitt
```

ใน **Authorized redirect URIs**

---

## 🔍 ตรวจสอบ redirect URI ที่ใช้อยู่:

```typescript
import { makeRedirectUri } from "expo-auth-session";

console.log(
  "Redirect URI:",
  makeRedirectUri({
    scheme: "superfitt",
    useProxy: true,
  })
);
```

จะแสดง URI ที่ต้องเพิ่มใน Google Cloud Console

---

## ✅ หลังแก้ไขแล้ว:

```bash
# Restart app
npx expo start -c
```

---

**ใช้วิธีที่ 1 + Expo proxy จะทำงานได้เร็วที่สุดครับ!** 🚀
