"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { CheckIn } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  Calendar,
  Check,
  Clock,
  Eye,
  MapPin,
  Phone,
  Search,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AttendancePage() {
  const { userData } = useAuthStore();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [filteredCheckIns, setFilteredCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Stats
  const [stats, setStats] = useState({
    totalCheckIns: 0,
    totalCheckOuts: 0,
    lateCount: 0,
    onTimeCount: 0,
  });

  useEffect(() => {
    if (!userData) return;
    fetchCheckIns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, filterDate]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIns, filterType, searchTerm]);

  const fetchCheckIns = async () => {
    if (!userData) return;

    try {
      setLoading(true);
      const companyId = userData.companyId;

      // Parse date
      const selectedDate = new Date(filterDate);
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Build query
      let checkInsQuery;
      if (companyId) {
        checkInsQuery = query(
          collection(db, "checkIns"),
          where("companyId", "==", companyId),
          where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
          where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
          orderBy("createdAt", "desc"),
        );
      } else {
        // Super admin - fetch all
        checkInsQuery = query(
          collection(db, "checkIns"),
          where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
          where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
          orderBy("createdAt", "desc"),
        );
      }

      const checkInsSnapshot = await getDocs(checkInsQuery);

      const checkInsData: CheckIn[] = [];
      checkInsSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        checkInsData.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          companyId: data.companyId,
          companyName: data.companyName,
          branchId: data.branchId,
          branchName: data.branchName,
          type: data.type,
          imageUrl: data.imageUrl,
          watermarkData: data.watermarkData,
          isLate: data.isLate,
          lateMinutes: data.lateMinutes,
          remarks: data.remarks,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        });
      });

      setCheckIns(checkInsData);

      // Calculate stats
      const checkInRecords = checkInsData.filter((c) => c.type === "check-in");
      const checkOutRecords = checkInsData.filter(
        (c) => c.type === "check-out",
      );
      const lateRecords = checkInRecords.filter((c) => c.isLate);

      setStats({
        totalCheckIns: checkInRecords.length,
        totalCheckOuts: checkOutRecords.length,
        lateCount: lateRecords.length,
        onTimeCount: checkInRecords.length - lateRecords.length,
      });
    } catch (error) {
      console.error("Error fetching check-ins:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...checkIns];

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((c) => c.type === filterType);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.userName?.toLowerCase().includes(term) ||
          c.branchName?.toLowerCase().includes(term) ||
          c.userEmail?.toLowerCase().includes(term),
      );
    }

    setFilteredCheckIns(filtered);
  };

  const formatTime = (date: Date | undefined) => {
    if (!date) return "-";
    return format(date, "HH:mm", { locale: th });
  };

  const formatDateTime = (date: Date | undefined) => {
    if (!date) return "-";
    return format(date, "d MMM yyyy HH:mm", { locale: th });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            กำลังโหลดข้อมูล...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          เช็คชื่อพนักงาน
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          ดูรายงานการเข้า-ออกงานของพนักงาน
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalCheckIns}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                เข้างาน
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalCheckOuts}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                เลิกงาน
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.onTimeCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ตรงเวลา
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.lateCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">มาสาย</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              วันที่
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ประเภท
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">ทั้งหมด</option>
              <option value="check-in">เข้างาน</option>
              <option value="check-out">เลิกงาน</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, สาขา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  พนักงาน
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  สาขา
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  ประเภท
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  เวลา
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  สถานะ
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  ดำเนินการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCheckIns.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p>ไม่พบข้อมูลการเช็คชื่อ</p>
                  </td>
                </tr>
              ) : (
                filteredCheckIns.map((checkIn) => (
                  <tr
                    key={checkIn.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {checkIn.imageUrl && (
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                            <Image
                              src={checkIn.imageUrl}
                              alt={checkIn.userName}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {checkIn.userName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {checkIn.userEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {checkIn.branchName || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          checkIn.type === "check-in"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                        }`}
                      >
                        {checkIn.type === "check-in" ? "เข้างาน" : "เลิกงาน"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {formatTime(checkIn.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      {checkIn.type === "check-in" && (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            checkIn.isLate
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }`}
                        >
                          {checkIn.isLate
                            ? `สาย ${checkIn.lateMinutes} นาที`
                            : "ตรงเวลา"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedCheckIn(checkIn)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCheckIn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                รายละเอียดการเช็คชื่อ
              </h2>
              <button
                onClick={() => setSelectedCheckIn(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Image */}
              {selectedCheckIn.imageUrl && (
                <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden">
                  <Image
                    src={selectedCheckIn.imageUrl}
                    alt="Check-in photo"
                    fill
                    className="object-cover"
                  />

                  {/* Watermark Overlay */}
                  {selectedCheckIn.watermarkData && (
                    <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4">
                      <div className="text-white text-sm space-y-1">
                        <p className="font-semibold">
                          {selectedCheckIn.watermarkData.employeeName}
                        </p>
                        <p className="text-xs opacity-80">
                          {selectedCheckIn.watermarkData.timestamp}
                        </p>
                        {selectedCheckIn.watermarkData.location && (
                          <p className="text-xs opacity-80 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {selectedCheckIn.watermarkData.location}
                          </p>
                        )}
                        {selectedCheckIn.watermarkData.deviceModel && (
                          <p className="text-xs opacity-80 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {selectedCheckIn.watermarkData.deviceModel}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    พนักงาน
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCheckIn.userName}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    สาขา
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCheckIn.branchName || "-"}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    ประเภท
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCheckIn.type === "check-in"
                      ? "เข้างาน"
                      : "เลิกงาน"}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    เวลา
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDateTime(selectedCheckIn.createdAt)}
                  </p>
                </div>

                {selectedCheckIn.type === "check-in" && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      สถานะ
                    </p>
                    <p
                      className={`font-medium ${
                        selectedCheckIn.isLate
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {selectedCheckIn.isLate
                        ? `มาสาย ${selectedCheckIn.lateMinutes} นาที`
                        : "ตรงเวลา"}
                    </p>
                  </div>
                )}

                {selectedCheckIn.watermarkData?.coordinates && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      พิกัด GPS
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {selectedCheckIn.watermarkData.coordinates.latitude.toFixed(
                        6,
                      )}
                      ,{" "}
                      {selectedCheckIn.watermarkData.coordinates.longitude.toFixed(
                        6,
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
