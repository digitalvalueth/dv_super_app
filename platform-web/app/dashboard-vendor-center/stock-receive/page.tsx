"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";

interface ReceiveRow {
  id: string;
  transferNumber: string | null;
  branchCode: string | null;
  branchName: string | null;
  receiverName: string | null;
  totalItems: number;
  syncStatus: string | null;
  receivedAt: string | null;
}

export default function StockReceivePage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<ReceiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!user) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
        const token = await user.getIdToken();
        const res = await fetch("/api/dashboard/shop-stock-receive", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
        setRows(json.data as ReceiveRow[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">การรับสินค้า (Transfer)</h1>
      {loading && <p>กำลังโหลด...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Transfer</th>
              <th>สาขา</th>
              <th>ผู้รับ</th>
              <th>รายการ</th>
              <th>สถานะ</th>
              <th>เวลา</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.transferNumber}</td>
                <td>{r.branchCode}</td>
                <td>{r.receiverName}</td>
                <td>{r.totalItems}</td>
                <td>{r.syncStatus}</td>
                <td>{r.receivedAt ? new Date(r.receivedAt).toLocaleString("th-TH") : "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
