"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Backward compatibility: redirect /dashboard/* → /stock-counter/*
export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/stock-counter");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">กำลังเปลี่ยนเส้นทาง...</p>
      </div>
    </div>
  );
}
