"use client";

import { useCallback, useEffect, useState } from "react";

export interface OnlineStatus {
  isOnline: boolean;
  isFirebaseConnected: boolean;
  lastChecked: Date | null;
  checkConnection: () => Promise<void>;
}

export function useOnlineStatus(): OnlineStatus {
  // Use lazy initialization to get initial online state
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Check browser online status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsFirebaseConnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check Firebase connectivity
  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setIsFirebaseConnected(false);
      setLastChecked(new Date());
      return;
    }

    try {
      // Try to fetch from a known endpoint to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "test";
      const response = await fetch(
        `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${apiKey}`,
        {
          method: "GET",
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      // Even a 400 response means we have connectivity
      setIsOnline(true);
      setIsFirebaseConnected(response.ok || response.status === 400);
    } catch {
      // Network error - offline or Firebase unreachable
      setIsFirebaseConnected(false);
    }
    setLastChecked(new Date());
  }, []);

  // Check connection on mount and periodically
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      checkConnection();
    }, 0);

    // Check every 30 seconds if online but Firebase disconnected
    const interval = setInterval(() => {
      if (isOnline && !isFirebaseConnected) {
        checkConnection();
      }
    }, 30000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [checkConnection, isOnline, isFirebaseConnected]);

  return {
    isOnline,
    isFirebaseConnected,
    lastChecked,
    checkConnection,
  };
}
