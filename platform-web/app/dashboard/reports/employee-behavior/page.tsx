"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { CountingSession } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowLeft,
  MapPin,
  Package,
  Search,
  TrendingDown,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface EmployeeBehaviorReport {
  userId: string;
  userName: string;
  userEmail: string;
  branchName: string;
  // Location analysis
  uniqueLocations: number;
  suspiciousLocations: number;
  locationDetails: {
    address: string;
    count: number;
    coordinates?: { lat: number; lng: number };
  }[];
  // Discrepancy
  totalDiscrepancy: number;
  averageDiscrepancy: number;
  sessionCount: number;
  // Risk level
  riskLevel: "low" | "medium" | "high";
  // Sessions with issues
  issuesSessions: CountingSession[];
}

export default function EmployeeBehaviorPage() {
  const { userData } = useAuthStore();
  const [reports, setReports] = useState<EmployeeBehaviorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeBehaviorReport | null>(null);

  useEffect(() => {
    if (!userData) return;
    fetchBehaviorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchBehaviorData = async () => {
    try {
      const companyId = userData?.companyId;

      let sessionsQuery;
      if (companyId) {
        sessionsQuery = query(
          collection(db, "countingSessions"),
          where("companyId", "==", companyId),
        );
      } else {
        sessionsQuery = query(collection(db, "countingSessions"));
      }

      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessions: CountingSession[] = [];

      sessionsSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        sessions.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          companyId: data.companyId,
          branchId: data.branchId,
          branchName: data.branchName,
          productId: data.productId,
          productName: data.productName,
          productSKU: data.productSKU,
          imageUrl: data.imageUrl || data.imageURL,
          aiCount: data.aiCount,
          manualCount: data.manualCount,
          finalCount: data.finalCount,
          standardCount: data.standardCount,
          discrepancy: Math.abs(data.discrepancy || 0),
          status: data.status,
          remarks: data.remarks,
          location: data.location,
          createdAt: data.createdAt?.toDate(),
        });
      });

      // Group by user and analyze behavior
      const userMap = new Map<string, EmployeeBehaviorReport>();

      sessions.forEach((session) => {
        const existing = userMap.get(session.userId);
        const location = session.location;

        // Parse location from remarks if not available
        let parsedLocation = location;
        if (!parsedLocation && session.remarks) {
          try {
            const remarksData = JSON.parse(session.remarks);
            parsedLocation = {
              address: remarksData.location || "",
              latitude: remarksData.coordinates?.latitude,
              longitude: remarksData.coordinates?.longitude,
            };
          } catch {
            // Ignore parse error
          }
        }

        if (existing) {
          existing.totalDiscrepancy += session.discrepancy ?? 0;
          existing.sessionCount += 1;

          // Track location
          if (parsedLocation?.address) {
            const existingLocation = existing.locationDetails.find(
              (l) => l.address === parsedLocation.address,
            );
            if (existingLocation) {
              existingLocation.count += 1;
            } else {
              existing.locationDetails.push({
                address: parsedLocation.address,
                count: 1,
                coordinates:
                  parsedLocation.latitude && parsedLocation.longitude
                    ? {
                        lat: parsedLocation.latitude,
                        lng: parsedLocation.longitude,
                      }
                    : undefined,
              });
            }
          }

          // Track sessions with high discrepancy
          if ((session.discrepancy ?? 0) > 5) {
            existing.issuesSessions.push(session);
          }
        } else {
          const locationDetails: EmployeeBehaviorReport["locationDetails"] = [];
          if (parsedLocation?.address) {
            locationDetails.push({
              address: parsedLocation.address,
              count: 1,
              coordinates:
                parsedLocation.latitude && parsedLocation.longitude
                  ? {
                      lat: parsedLocation.latitude,
                      lng: parsedLocation.longitude,
                    }
                  : undefined,
            });
          }

          userMap.set(session.userId, {
            userId: session.userId,
            userName: session.userName ?? "ไม่ระบุ",
            userEmail: session.userEmail ?? "",
            branchName: session.branchName ?? "ไม่ระบุ",
            uniqueLocations: 0,
            suspiciousLocations: 0,
            locationDetails,
            totalDiscrepancy: session.discrepancy ?? 0,
            averageDiscrepancy: 0,
            sessionCount: 1,
            riskLevel: "low",
            issuesSessions: (session.discrepancy ?? 0) > 5 ? [session] : [],
          });
        }
      });

      // Calculate metrics and risk level
      const reportsData: EmployeeBehaviorReport[] = [];

      userMap.forEach((report) => {
        report.uniqueLocations = report.locationDetails.length;
        report.averageDiscrepancy =
          report.sessionCount > 0
            ? report.totalDiscrepancy / report.sessionCount
            : 0;

        // Check for suspicious behavior
        // 1. Same location used many times (possible fake location)
        const maxLocationCount = Math.max(
          ...report.locationDetails.map((l) => l.count),
          0,
        );
        if (
          maxLocationCount > 10 &&
          maxLocationCount / report.sessionCount > 0.8
        ) {
          report.suspiciousLocations = 1;
        }

        // 2. Too few unique locations
        if (report.sessionCount > 10 && report.uniqueLocations === 1) {
          report.suspiciousLocations += 1;
        }

        // Calculate risk level
        if (
          report.suspiciousLocations > 0 ||
          report.averageDiscrepancy > 10 ||
          report.issuesSessions.length > 5
        ) {
          report.riskLevel = "high";
        } else if (
          report.averageDiscrepancy > 5 ||
          report.issuesSessions.length > 2
        ) {
          report.riskLevel = "medium";
        } else {
          report.riskLevel = "low";
        }

        reportsData.push(report);
      });

      // Sort by risk level and total discrepancy
      reportsData.sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        }
        return b.totalDiscrepancy - a.totalDiscrepancy;
      });

      setReports(reportsData);
    } catch (error) {
      console.error("Error fetching behavior data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.branchName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRisk = filterRisk === "all" || report.riskLevel === filterRisk;

    return matchesSearch && matchesRisk;
  });

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case "high":
        return "ความเสี่ยงสูง";
      case "medium":
        return "ความเสี่ยงปานกลาง";
      default:
        return "ความเสี่ยงต่ำ";
    }
  };

  // Summary stats
  const highRiskCount = reports.filter((r) => r.riskLevel === "high").length;
  const mediumRiskCount = reports.filter(
    (r) => r.riskLevel === "medium",
  ).length;
  const totalDiscrepancy = reports.reduce(
    (sum, r) => sum + r.totalDiscrepancy,
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังวิเคราะห์ข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/reports"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            รายงานพฤติกรรมพนักงาน
          </h1>
          <p className="text-gray-600 mt-1">
            วิเคราะห์พฤติกรรมการนับสินค้าและ Location ที่ผิดปกติ
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {reports.length}
              </p>
              <p className="text-sm text-gray-500">พนักงานทั้งหมด</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{highRiskCount}</p>
              <p className="text-sm text-gray-500">ความเสี่ยงสูง</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {mediumRiskCount}
              </p>
              <p className="text-sm text-gray-500">ความเสี่ยงปานกลาง</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {totalDiscrepancy}
              </p>
              <p className="text-sm text-gray-500">ของหายรวม (ชิ้น)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, สาขา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทุกระดับความเสี่ยง</option>
            <option value="high">ความเสี่ยงสูง</option>
            <option value="medium">ความเสี่ยงปานกลาง</option>
            <option value="low">ความเสี่ยงต่ำ</option>
          </select>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  พนักงาน
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  สาขา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  จำนวนนับ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ของหายรวม
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  เฉลี่ย/ครั้ง
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ระดับความเสี่ยง
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReports.map((report) => (
                <tr key={report.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {report.userName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {report.userEmail}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {report.branchName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {report.sessionCount} ครั้ง
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`font-semibold ${
                        report.totalDiscrepancy > 10
                          ? "text-red-600"
                          : report.totalDiscrepancy > 0
                            ? "text-orange-600"
                            : "text-green-600"
                      }`}
                    >
                      {report.totalDiscrepancy} ชิ้น
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {report.averageDiscrepancy.toFixed(1)} ชิ้น
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {report.uniqueLocations} แห่ง
                      </span>
                      {report.suspiciousLocations > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          น่าสงสัย
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskBadgeColor(
                        report.riskLevel,
                      )}`}
                    >
                      {getRiskLabel(report.riskLevel)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedEmployee(report)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      ดูรายละเอียด
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ไม่พบข้อมูลพนักงาน</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  รายละเอียด: {selectedEmployee.userName}
                </h2>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">ของหายรวม</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {selectedEmployee.totalDiscrepancy} ชิ้น
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">เฉลี่ย/ครั้ง</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedEmployee.averageDiscrepancy.toFixed(1)} ชิ้น
                  </p>
                </div>
              </div>

              {/* Location Analysis */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Location ที่ใช้นับสินค้า
                </h3>
                {selectedEmployee.locationDetails.length > 0 ? (
                  <div className="space-y-2">
                    {selectedEmployee.locationDetails.map((loc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm">{loc.address}</span>
                        <span className="text-sm font-medium">
                          {loc.count} ครั้ง
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">ไม่มีข้อมูล Location</p>
                )}
              </div>

              {/* Issue Sessions */}
              {selectedEmployee.issuesSessions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    รายการที่มีของหาย (&gt;5 ชิ้น)
                  </h3>
                  <div className="space-y-2">
                    {selectedEmployee.issuesSessions
                      .slice(0, 10)
                      .map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{session.productName}</p>
                            <p className="text-sm text-gray-500">
                              {session.createdAt
                                ? format(session.createdAt, "dd MMM yyyy", {
                                    locale: th,
                                  })
                                : "-"}
                            </p>
                          </div>
                          <span className="font-semibold text-red-600">
                            -{session.discrepancy} ชิ้น
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
