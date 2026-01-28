# 🍎 Sign in with Apple Implementation Guide

> คู่มือเพิ่ม Sign in with Apple สำหรับ FITT BSA  
> **⚠️ จำเป็นต้องทำก่อน Submit App Store!**

---

## 📋 ทำไมต้องมี Sign in with Apple?

ตาม **App Store Review Guideline 4.8**:

> Apps that exclusively use a third-party or social login service (such as Facebook Login, Google Sign-In, Sign in with Twitter, Sign In with LinkedIn, Login with Amazon, or WeChat Login) to set up or authenticate the user's primary account with the app must also offer Sign in with Apple as an equivalent option.

**แปล**: ถ้า App มี Google Sign-In ต้องมี Sign in with Apple ด้วย ไม่งั้นจะถูก reject!

---

## 📦 ขั้นตอนที่ 1: ติดตั้ง Dependencies

```bash
# ติดตั้ง expo-apple-authentication
npx expo install expo-apple-authentication

# ติดตั้ง expo-crypto (สำหรับ nonce)
npx expo install expo-crypto
```

---

## ⚙️ ขั้นตอนที่ 2: ตั้งค่า Apple Developer Console

### 2.1 เปิดใช้งาน Sign in with Apple

1. ไปที่ [Apple Developer Console](https://developer.apple.com/account)
2. ไปที่ **Certificates, Identifiers & Profiles**
3. เลือก **Identifiers** > เลือก App ID ของคุณ
4. เปิดใช้งาน **Sign in with Apple**
5. คลิก **Save**

### 2.2 สร้าง Service ID (สำหรับ Web)

ถ้าต้องการใช้กับ Web ด้วย:

1. ไปที่ **Identifiers** > **+** (สร้างใหม่)
2. เลือก **Services IDs**
3. กรอก Description และ Identifier
4. เปิดใช้งาน Sign in with Apple
5. Configure domains และ return URLs

---

## 🔥 ขั้นตอนที่ 3: ตั้งค่า Firebase

### 3.1 เปิดใช้งาน Apple Provider ใน Firebase

1. ไปที่ [Firebase Console](https://console.firebase.google.com)
2. ไปที่ **Authentication** > **Sign-in method**
3. เปิดใช้งาน **Apple**
4. กรอก **Service ID** (สำหรับ Web flow)
5. (Optional) กรอก Team ID และ Key ID สำหรับ OAuth flow

### 3.2 ดาวน์โหลด Private Key

1. ไปที่ [Apple Developer > Keys](https://developer.apple.com/account/resources/authkeys/list)
2. สร้าง Key ใหม่ เปิดใช้งาน **Sign in with Apple**
3. ดาวน์โหลด Private Key (.p8)
4. อัพโหลดไปที่ Firebase Console

---

## 📱 ขั้นตอนที่ 4: อัพเดท app.json

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.itswatthachai.superfitt",
      "usesAppleSignIn": true,
      "infoPlist": {
        "CFBundleAllowMixedLocalizations": true
      }
    },
    "plugins": ["expo-apple-authentication"]
  }
}
```

---

## 🔧 ขั้นตอนที่ 5: สร้าง Apple Auth Service

สร้างไฟล์ `services/apple-auth.service.ts`:

```typescript
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { OAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "@/config/firebase";

/**
 * Check if Apple Sign In is available on this device
 */
export const isAppleSignInAvailable = async (): Promise<boolean> => {
  return await AppleAuthentication.isAvailableAsync();
};

/**
 * Sign in with Apple and authenticate with Firebase
 */
export const signInWithApple = async () => {
  try {
    // Generate nonce for security
    const nonce = Math.random().toString(36).substring(2, 10);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      nonce,
    );

    // Request Apple Sign In
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    // Create Firebase credential
    const provider = new OAuthProvider("apple.com");
    const oAuthCredential = provider.credential({
      idToken: credential.identityToken!,
      rawNonce: nonce,
    });

    // Sign in to Firebase
    const result = await signInWithCredential(auth, oAuthCredential);

    // Get user info
    const user = result.user;

    // Apple only provides name on first sign in
    // Store it if available
    const fullName = credential.fullName;
    const displayName = fullName
      ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim()
      : user.displayName || "User";

    return {
      user,
      displayName,
      email: credential.email || user.email,
      isNewUser: result.additionalUserInfo?.isNewUser || false,
    };
  } catch (error: any) {
    if (error.code === "ERR_REQUEST_CANCELED") {
      // User cancelled, don't throw error
      return null;
    }
    console.error("Apple Sign In Error:", error);
    throw error;
  }
};

/**
 * Get credential state for a user
 */
export const getAppleCredentialState = async (userId: string) => {
  try {
    const state = await AppleAuthentication.getCredentialStateAsync(userId);
    return state;
  } catch (error) {
    console.error("Error getting credential state:", error);
    return null;
  }
};
```

---

## 🎨 ขั้นตอนที่ 6: อัพเดท Login Screen

อัพเดทไฟล์ `app/(login)/index.tsx`:

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  isAppleSignInAvailable,
  signInWithApple
} from '@/services/apple-auth.service';
import { useEffect, useState } from 'react';
import { Platform, View, StyleSheet, Text, Alert } from 'react-native';

export default function LoginScreen() {
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if Apple Sign In is available (iOS 13+)
    const checkAppleAuth = async () => {
      if (Platform.OS === 'ios') {
        const available = await isAppleSignInAvailable();
        setAppleAuthAvailable(available);
      }
    };
    checkAppleAuth();
  }, []);

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      const result = await signInWithApple();

      if (result) {
        console.log('Apple Sign In Success:', result.user.uid);

        // Navigate to home or complete profile
        if (result.isNewUser) {
          // New user - may need to complete profile
          router.replace('/(tabs)/home');
        } else {
          router.replace('/(tabs)/home');
        }
      }
    } catch (error: any) {
      console.error('Apple Sign In Error:', error);
      Alert.alert(
        'เข้าสู่ระบบไม่สำเร็จ',
        'ไม่สามารถเข้าสู่ระบบด้วย Apple ได้ กรุณาลองอีกครั้ง'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Google Sign In Button */}
      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
      >
        <Text>Sign in with Google</Text>
      </TouchableOpacity>

      {/* Apple Sign In Button - Only show on iOS */}
      {appleAuthAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  googleButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
});
```

---

## 🔄 ขั้นตอนที่ 7: อัพเดท Auth Store

อัพเดท `stores/auth.store.ts` เพื่อรองรับ Apple user:

```typescript
// Add function to handle Apple user
const handleAppleUser = async (
  firebaseUser: FirebaseUser,
  displayName: string,
) => {
  const userRef = doc(db, "users", firebaseUser.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    // Create new user document
    await setDoc(userRef, {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: displayName,
      provider: "apple",
      role: "employee",
      status: "pending_approval",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Fetch and set user data
  const userData = (await getDoc(userRef)).data();
  set({ user: { ...userData, uid: firebaseUser.uid } as User });
};
```

---

## 🧪 ขั้นตอนที่ 8: ทดสอบ

### ทดสอบบน Simulator

⚠️ **หมายเหตุ**: Sign in with Apple **ไม่ทำงานบน Simulator**  
ต้องทดสอบบน **Real Device** เท่านั้น!

### ทดสอบบน Real Device

1. Build development build:

```bash
eas build --platform ios --profile development
```

2. ติดตั้งบน iPhone
3. ทดสอบ Sign in with Apple

### Test Cases

- [ ] Sign in with Apple สำเร็จ
- [ ] Cancel sign in ไม่ crash
- [ ] User ใหม่ถูกสร้างใน Firestore
- [ ] User เก่า login ได้ปกติ
- [ ] ข้อมูล profile ถูกต้อง

---

## ⚠️ ข้อควรระวัง

### 1. Apple อาจซ่อน Email

User สามารถเลือก "Hide My Email" ซึ่ง Apple จะสร้าง relay email เช่น:

```
abc123@privaterelay.appleid.com
```

ต้อง handle กรณีนี้ใน app

### 2. ชื่อให้แค่ครั้งแรก

Apple จะส่ง fullName **เฉพาะครั้งแรก** ที่ user sign in  
หลังจากนั้นจะเป็น `null`

**วิธีแก้**: เก็บชื่อไว้ใน Firestore ตั้งแต่ครั้งแรก

### 3. ต้องใช้ iOS 13+

Sign in with Apple ต้องการ iOS 13 ขึ้นไป  
ตรวจสอบใน app.json:

```json
{
  "expo": {
    "ios": {
      "supportsTablet": true
    }
  }
}
```

---

## 📋 Checklist สำหรับ App Store

- [ ] ติดตั้ง `expo-apple-authentication`
- [ ] ตั้งค่า Apple Developer Console
- [ ] เปิดใช้งาน Apple Provider ใน Firebase
- [ ] อัพเดท app.json
- [ ] สร้าง Apple Auth Service
- [ ] อัพเดท Login Screen
- [ ] ทดสอบบน Real Device
- [ ] Build Production และ Submit

---

## 🔗 Resources

- [Expo Apple Authentication Docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Firebase Apple Sign In](https://firebase.google.com/docs/auth/ios/apple)
- [Apple Sign In Guidelines](https://developer.apple.com/sign-in-with-apple/get-started/)
- [App Store Review Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple)

---

© 2026 Digital Value Company Limited
