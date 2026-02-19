"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function StockCounterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/stock-counter/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}
