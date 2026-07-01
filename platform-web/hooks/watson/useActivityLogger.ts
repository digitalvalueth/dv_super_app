"use client";

import { saveActivityLogFull } from "@/lib/watson-firebase";
import { useAuthStore } from "@/stores/auth.store";

export function useActivityLogger() {
  const { user, userData } = useAuthStore();

  const logAction = async (
    action: string,
    description: string,
    details: Record<string, any> = {}
  ) => {
    try {
      const userInfo = {
        id: user?.uid || userData?.id || "unknown",
        name:
          userData?.name ||
          user?.displayName ||
          user?.email?.split("@")[0] ||
          "Unknown User",
        role: userData?.role || "Viewer",
        email: user?.email || userData?.email || "",
      };

      // Clean undefined values from details
      const cleanDetails = Object.fromEntries(
        Object.entries(details).filter(([_, val]) => val !== undefined)
      );

      await saveActivityLogFull({
        action,
        description,
        details: {
          ...cleanDetails,
          module: "vendor-center",
        },
        canUndo: false,
        undone: false,
        user: userInfo,
      });
    } catch (err) {
      console.error("Failed to save activity log:", err);
    }
  };

  return { logAction };
}
