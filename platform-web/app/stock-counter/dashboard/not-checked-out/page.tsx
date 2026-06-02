"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { CheckIn } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  collection,
  documentId,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { Building2, Clock, LogOut, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface PendingCheckout {
  userId: string;
  userName: string;
  userEmail?: string;
  branchId?: string;
  branchName?: string;
  checkInTime?: Date;
  selectedShift?: string;
}

export default function NotCheckedOutPage() {
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingCheckout[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );

  useEffect(() => {
    if (!userData) return;
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, filterDate]);

  const fetchPending = async () => {
    if (!userData) return;
    try {
      setLoading(true);
      const companyId = userData.companyId;

      const selectedDate = new Date(filterDate);
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const checkInsQuery = companyId
        ? query(
            collection(db, "checkIns"),
            where("companyId", "==", companyId),
            where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
            where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
            orderBy("createdAt", "desc"),
          )
        : query(
            collection(db, "checkIns"),
            where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
            where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
            orderBy("createdAt", "desc"),
          );

      const snap = await getDocs(checkInsQuery);
      const records: CheckIn[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        records.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          companyId: data.companyId,
          companyName: data.companyName,
          branchId: data.branchId,
          branchName: data.branchName,
          type: data.type,
          selectedShift: data.selectedShift,
          createdAt: data.createdAt?.toDate(),
        } as CheckIn);
      });

      // Branch-scope for supervisor/manager (mirror attendance page logic)
      const isSuperOrManager =
        userData.role === "supervisor" || userData.role === "manager";
      let managedIds: string[] | null = isSuperOrManager
        ? userData.managedBranchIds?.length
          ? [...userData.managedBranchIds]
          : userData.branchId
            ? [userData.branchId]
            : []
        : null;

      if (userData.role === "manager") {
        const supervisorIds = (userData.managedSupervisorIds || []).slice(
          0,
          30,
        );
        if (supervisorIds.length > 0) {
          const supervisorsSnap = await getDocs(
            query(
              collection(db, "users"),
              where(documentId(), "in", supervisorIds),
            ),
          );
          const branchSet = new Set<string>(managedIds ?? []);
          supervisorsSnap.forEach((d) => {
            const supData = d.data() as any;
            (supData.managedBranchIds || []).forEach((id: string) =>
              branchSet.add(id),
            );
          });
          managedIds = [...branchSet];
        }
      }

      const visible =
        managedIds && managedIds.length > 0
          ? records.filter((c) => managedIds!.includes(c.branchId ?? ""))
          : managedIds
            ? []
            : records;

      // A person is "not checked out" if they have a check-in today but no
      // matching check-out at the same branch.
      const checkedOutKeys = new Set(
        visible
          .filter((c) => c.type === "check-out")
          .map((c) => `${c.userId}__${c.branchId ?? ""}`),
      );

      const seen = new Set<string>();
      const result: PendingCheckout[] = [];
      visible
        .filter((c) => c.type === "check-in")
        // earliest check-in first so the first record per person wins
        .sort(
          (a, b) =>
            (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
        )
        .forEach((c) => {
          const key = `${c.userId}__${c.branchId ?? ""}`;
          if (checkedOutKeys.has(key)) return;
          if (seen.has(key)) return;
          seen.add(key);
          result.push({
            userId: c.userId,
            userName: c.userName,
            userEmail: c.userEmail,
            branchId: c.branchId,
            branchName: c.branchName,
            checkInTime: c.createdAt as Date | undefined,
            selectedShift: (c as any).selectedShift,
          });
        });

      setPending(result);
    } catch (err) {
      console.error("Error fetching pending check-outs:", err);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return pending;
    const term = searchTerm.toLowerCase();
    return pending.filter(
      (p) =>
        p.userName?.toLowerCase().includes(term) ||
        p.branchName?.toLowerCase().includes(term) ||
        p.userEmail?.toLowerCase().includes(term),
    );
  }, [pending, searchTerm]);

  const formatTime = (date?: Date) =>
    date ? format(date, "HH:mm", { locale: th }) : "-";

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ยังไม่เช็คเอาท์</h1>
            <p className="text-sm text-gray-500">
              พนักงานที่เช็คอินแล้วแต่ยังไม่เช็คเอาท์ในวันที่เลือก
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={fetchPending}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">ยังไม่เช็คเอาท์</p>
          <p className="text-2xl font-bold text-amber-700">
            {loading ? "…" : pending.length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาชื่อ / สาขา / อีเมล"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-gray-500">กำลังโหลด…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            ทุกคนเช็คเอาท์เรียบร้อยแล้ว 🎉
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <div
                key={`${p.userId}__${p.branchId}`}
                className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{p.userName}</p>
                  {p.userEmail && (
                    <p className="text-xs text-gray-500">{p.userEmail}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    {p.branchName || p.branchId || "-"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-400" />
                    เช็คอิน {formatTime(p.checkInTime)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
