"use client";

import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { User } from "@/types";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect } from "react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserData, setLoading } = useAuthStore();

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      // Unsubscribe from previous user listener
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (firebaseUser) {
        // Listen to user data changes in real-time
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);

          // First check if document exists
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data();

            // Auto-activate admin/manager/super_admin ถ้า status ยังเป็น pending
            if (
              (data.role === "admin" ||
                data.role === "manager" ||
                data.role === "super_admin") &&
              data.status === "pending"
            ) {
              console.log("Auto-activating admin/manager/super_admin user...");
              await setDoc(
                userDocRef,
                {
                  status: "active",
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );
            }

            // Listen to real-time updates
            userUnsubscribe = onSnapshot(userDocRef, (doc) => {
              if (doc.exists()) {
                const data = doc.data();
                setUserData({
                  id: doc.id,
                  uid: data.uid || firebaseUser.uid,
                  email: data.email,
                  name: data.name || data.displayName,
                  role: data.role,
                  companyId: data.companyId,
                  companyCode: data.companyCode || "",
                  companyName: data.companyName || "",
                  branchId: data.branchId,
                  branchCode: data.branchCode || "",
                  branchName: data.branchName || "",
                  photoURL: data.photoURL,
                  status: data.status,
                  createdAt: data.createdAt?.toDate(),
                  updatedAt:
                    data.updatedAt?.toDate() || data.lastLoginAt?.toDate(),
                } as User);
              }
            });

            // เพิ่ม login log (เฉพาะครั้งแรกที่ login)
            try {
              const userAgent = navigator.userAgent;
              const isIOS = /iPhone|iPad|iPod/.test(userAgent);
              const isAndroid = /Android/.test(userAgent);
              const isMac = /Macintosh/.test(userAgent);
              const isWindows = /Windows/.test(userAgent);

              let osName = "Unknown";
              let deviceType = 3; // 3 = Desktop/Web

              if (isIOS) {
                osName = "iOS";
                deviceType = 1; // 1 = Phone/Tablet
              } else if (isAndroid) {
                osName = "Android";
                deviceType = 1;
              } else if (isMac) {
                osName = "macOS";
              } else if (isWindows) {
                osName = "Windows";
              }

              await addDoc(
                collection(db, "users", firebaseUser.uid, "login_logs"),
                {
                  userId: firebaseUser.uid,
                  loginAt: serverTimestamp(),
                  deviceInfo: {
                    brand: "Web Browser",
                    deviceName: "Web",
                    deviceType,
                    isDevice: false,
                    manufacturer: "Browser",
                    modelName: "Web Browser",
                    osName,
                    osVersion: "N/A",
                  },
                },
              );
            } catch (logError) {
              console.error("Error creating login log:", logError);
            }
          } else {
            // ไม่มี user document → สร้างใหม่ด้วยสถานะ pending
            console.log("User document not found, creating new one...");
            const newUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name:
                firebaseUser.displayName ||
                firebaseUser.email?.split("@")[0] ||
                "User",
              role: "staff", // default role
              companyId: "",
              companyCode: "",
              companyName: "",
              branchId: "",
              branchCode: "",
              branchName: "",
              photoURL: firebaseUser.photoURL,
              status: "pending", // รออนุมัติ
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            await setDoc(userDocRef, newUserData);

            // สร้าง login log แรก
            try {
              const userAgent = navigator.userAgent;
              const isIOS = /iPhone|iPad|iPod/.test(userAgent);
              const isAndroid = /Android/.test(userAgent);
              const isMac = /Macintosh/.test(userAgent);
              const isWindows = /Windows/.test(userAgent);

              let osName = "Unknown";
              let deviceType = 3; // 3 = Desktop/Web

              if (isIOS) {
                osName = "iOS";
                deviceType = 1; // 1 = Phone/Tablet
              } else if (isAndroid) {
                osName = "Android";
                deviceType = 1;
              } else if (isMac) {
                osName = "macOS";
              } else if (isWindows) {
                osName = "Windows";
              }

              await addDoc(
                collection(db, "users", firebaseUser.uid, "login_logs"),
                {
                  userId: firebaseUser.uid,
                  loginAt: serverTimestamp(),
                  deviceInfo: {
                    brand: "Web Browser",
                    deviceName: "Web",
                    deviceType,
                    isDevice: false,
                    manufacturer: "Browser",
                    modelName: "Web Browser",
                    osName,
                    osVersion: "N/A",
                  },
                },
              );
            } catch (logError) {
              console.error("Error creating login log:", logError);
            }

            // Set initial userData ด้วยข้อมูลที่สร้างใหม่
            setUserData({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: newUserData.email!,
              name: newUserData.name,
              role: newUserData.role as "admin" | "manager" | "staff",
              companyId: newUserData.companyId,
              companyCode: newUserData.companyCode,
              companyName: newUserData.companyName,
              branchId: newUserData.branchId,
              branchCode: newUserData.branchCode,
              branchName: newUserData.branchName,
              photoURL: newUserData.photoURL || undefined,
              status: newUserData.status as "pending" | "active" | "inactive",
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Listen to real-time updates
            userUnsubscribe = onSnapshot(userDocRef, (doc) => {
              if (doc.exists()) {
                const data = doc.data();
                setUserData({
                  id: doc.id,
                  uid: data.uid || firebaseUser.uid,
                  email: data.email,
                  name: data.name || data.displayName,
                  role: data.role,
                  companyId: data.companyId,
                  companyCode: data.companyCode || "",
                  companyName: data.companyName || "",
                  branchId: data.branchId,
                  branchCode: data.branchCode || "",
                  branchName: data.branchName || "",
                  photoURL: data.photoURL,
                  status: data.status,
                  createdAt: data.createdAt?.toDate(),
                  updatedAt:
                    data.updatedAt?.toDate() || data.lastLoginAt?.toDate(),
                } as User);
              }
            });
          }
        } catch (error) {
          console.error("Error fetching/creating user data:", error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) {
        userUnsubscribe();
      }
    };
  }, [setUser, setUserData, setLoading]);

  return <>{children}</>;
}
