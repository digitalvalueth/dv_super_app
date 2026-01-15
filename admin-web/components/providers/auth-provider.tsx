"use client";

import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { User } from "@/types";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect } from "react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserData, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Fetch user data from Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData({
              id: userDoc.id,
              email: data.email,
              displayName: data.displayName,
              role: data.role,
              companyId: data.companyId,
              branchId: data.branchId,
              photoURL: data.photoURL,
              status: data.status,
              createdAt: data.createdAt?.toDate(),
              lastLoginAt: data.lastLoginAt?.toDate(),
            } as User);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setUserData, setLoading]);

  return <>{children}</>;
}
