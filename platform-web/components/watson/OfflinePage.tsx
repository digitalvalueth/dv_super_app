"use client";

import { WifiOff, RefreshCw, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/watson/ui/button";
import { useState } from "react";

interface OfflinePageProps {
  isOnline: boolean;
  isFirebaseConnected: boolean;
  lastChecked: Date | null;
  onRetry: () => Promise<void>;
}

export function OfflinePage({
  isOnline,
  isFirebaseConnected,
  lastChecked,
  onRetry,
}: OfflinePageProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
      // Wait a bit for state to update
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      setIsRetrying(false);
    }
  };

  // Determine the type of offline state
  const isFullyOffline = !isOnline;

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center ${
                isFullyOffline ? "bg-red-100" : "bg-orange-100"
              }`}
            >
              {isFullyOffline ? (
                <WifiOff className="w-12 h-12 text-red-500" />
              ) : (
                <CloudOff className="w-12 h-12 text-orange-500" />
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {isFullyOffline
                ? "ไม่มีการเชื่อมต่ออินเทอร์เน็ต"
                : "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้"}
            </h1>
            <p className="text-slate-500">
              {isFullyOffline
                ? "กรุณาตรวจสอบการเชื่อมต่อ Wi-Fi หรือเครือข่ายของคุณ"
                : "ระบบกำลังพยายามเชื่อมต่อกับ Firebase อีกครั้ง"}
            </p>
          </div>

          {/* Status indicators */}
          <div className="flex flex-col gap-2 py-4 border-y border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2">
                <WifiOff className="w-4 h-4" />
                การเชื่อมต่ออินเทอร์เน็ต
              </span>
              <span
                className={`font-medium ${
                  isOnline ? "text-green-600" : "text-red-600"
                }`}
              >
                {isOnline ? "เชื่อมต่อแล้ว" : "ไม่ได้เชื่อมต่อ"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                การเชื่อมต่อ Firebase
              </span>
              <span
                className={`font-medium ${
                  isFirebaseConnected ? "text-green-600" : "text-orange-600"
                }`}
              >
                {isFirebaseConnected ? "เชื่อมต่อแล้ว" : "รอเชื่อมต่อ..."}
              </span>
            </div>
          </div>

          {/* Last checked */}
          {lastChecked && (
            <p className="text-xs text-slate-400">
              ตรวจสอบล่าสุด: {lastChecked.toLocaleTimeString("th-TH")}
            </p>
          )}

          {/* Retry button */}
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full"
            size="lg"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                กำลังลองใหม่...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                ลองเชื่อมต่อใหม่
              </>
            )}
          </Button>

          {/* Additional info */}
          <div className="text-xs text-slate-400 space-y-1">
            <p>หากปัญหายังคงอยู่ กรุณา:</p>
            <ul className="text-left list-disc list-inside">
              <li>ตรวจสอบการเชื่อมต่อ Wi-Fi/Internet</li>
              <li>ลอง Refresh หน้าเว็บ</li>
              <li>ติดต่อฝ่าย IT หากยังใช้งานไม่ได้</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Watson Excel Validator v0.1.0
        </p>
      </div>
    </div>
  );
}
