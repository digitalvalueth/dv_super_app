"use client";

import AssignPreviewModal from "@/components/stock-counter/assign-preview-modal";
import type { AssignPlan } from "@/lib/assign-products";
import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Employee {
  id: string;
  name: string;
  email: string;
  branchName: string;
  branchCode: string;
  status: string;
}

interface Assignment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  branchName: string;
  productCount: number;
  completedCount: number;
  month: number;
  year: number;
  status: string;
}

interface Statistics {
  completed: number;
  pending: number;
  completionRate: number;
}

export default function SupervisorDashboard() {
  const { userData } = useAuthStore();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    completed: 0,
    pending: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignPlan, setAssignPlan] = useState<AssignPlan | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignContext, setAssignContext] = useState<{
    month: number;
    year: number;
    half: number;
  } | null>(null);
  const [userFullNameMap, setUserFullNameMap] = useState<
    Record<string, string>
  >({});
  const [userBaCodeMap, setUserBaCodeMap] = useState<Record<string, string>>(
    {},
  );

  // Redirect non-supervisors
  useEffect(() => {
    if (
      userData &&
      userData.role !== "supervisor" &&
      userData.role !== "manager"
    ) {
      router.push("/dashboard");
    }
  }, [userData, router]);

  // Fetch userId → fullName + baCode map
  useEffect(() => {
    if (!userData) return;
    const fetchUserInfoMaps = async () => {
      try {
        const usersQ = userData.companyId
          ? query(
              collection(db, "users"),
              where("companyId", "==", userData.companyId),
            )
          : query(collection(db, "users"));
        const snap = await getDocs(usersQ);
        const fullNameMap: Record<string, string> = {};
        const baCodeMap: Record<string, string> = {};
        snap.forEach((d) => {
          const data = d.data() as any;
          const uid = data.uid || d.id;
          if (data.fullName) fullNameMap[uid] = data.fullName;
          if (data.baCode) baCodeMap[uid] = data.baCode;
        });
        setUserFullNameMap(fullNameMap);
        setUserBaCodeMap(baCodeMap);
      } catch (err) {
        console.error("Error fetching user info maps:", err);
      }
    };
    fetchUserInfoMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  // Fetch userId → fullName + baCode map
  useEffect(() => {
    if (!userData) return;
    const fetchUserInfoMaps = async () => {
      try {
        const usersQ = userData.companyId
          ? query(
              collection(db, "users"),
              where("companyId", "==", userData.companyId),
            )
          : query(collection(db, "users"));
        const snap = await getDocs(usersQ);
        const fullNameMap: Record<string, string> = {};
        const baCodeMap: Record<string, string> = {};
        snap.forEach((d) => {
          const data = d.data() as any;
          const uid = data.uid || d.id;
          if (data.fullName) fullNameMap[uid] = data.fullName;
          if (data.baCode) baCodeMap[uid] = data.baCode;
        });
        setUserFullNameMap(fullNameMap);
        setUserBaCodeMap(baCodeMap);
      } catch (err) {
        console.error("Error fetching user info maps:", err);
      }
    };
    fetchUserInfoMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  // Fetch employees and assignments
  useEffect(() => {
    if (!userData || userData.role !== "supervisor") return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();

        // Fetch employees
        const employeesRes = await fetch("/api/supervisor/employees", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const employeesData = await employeesRes.json();

        if (employeesRes.ok) {
          setEmployees(employeesData.employees || []);
        }

        // Fetch assignments
        const assignmentsRes = await fetch("/api/supervisor/assignments", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const assignmentsData = await assignmentsRes.json();

        if (assignmentsRes.ok) {
          setAssignments(assignmentsData.assignments || []);
          setStatistics(
            assignmentsData.statistics || {
              completed: 0,
              pending: 0,
              completionRate: 0,
            },
          );
        }
      } catch (error) {
        console.error("Error fetching supervisor data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData]);

  const openAssignPreview = async () => {
    if (bulkAssigning || assignLoading) return;

    const currentDate = new Date();
    const half = currentDate.getDate() <= 15 ? 1 : 2;
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    setAssignContext({ month, year, half });
    setAssignPlan(null);
    setShowAssignModal(true);
    setAssignLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("ไม่พบผู้ใช้");
        setShowAssignModal(false);
        return;
      }
      const token = await user.getIdToken();
      const managedBranchIds = (userData as any)?.managedBranchIds;

      const response = await fetch("/api/assignments/bulk-assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month,
          year,
          half,
          companyId: userData?.companyId,
          branchIds:
            Array.isArray(managedBranchIds) && managedBranchIds.length > 0
              ? managedBranchIds
              : undefined,
          dryRun: true,
        }),
      });

      const data = await response.json();
      if (response.ok && data.plan) {
        setAssignPlan(data.plan as AssignPlan);
      } else {
        toast.error(data.error || "ไม่สามารถเตรียมข้อมูลการมอบหมายได้");
        setShowAssignModal(false);
      }
    } catch (error) {
      console.error("Error previewing bulk assign:", error);
      toast.error("ไม่สามารถเตรียมข้อมูลการมอบหมายได้");
      setShowAssignModal(false);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleConfirmAssign = async () => {
    if (!assignContext) return;
    try {
      setBulkAssigning(true);
      const user = auth.currentUser;
      if (!user) {
        toast.error("ไม่พบผู้ใช้");
        return;
      }
      const token = await user.getIdToken();
      const managedBranchIds = (userData as any)?.managedBranchIds;

      const response = await fetch("/api/assignments/bulk-assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month: assignContext.month,
          year: assignContext.year,
          half: assignContext.half,
          companyId: userData?.companyId,
          branchIds:
            Array.isArray(managedBranchIds) && managedBranchIds.length > 0
              ? managedBranchIds
              : undefined,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(
          `มอบหมายสำเร็จ! สร้างใหม่ ${data.created} คน, อัปเดต ${data.updated} คน (สินค้า ${data.productCount} รายการ)`,
        );
        setShowAssignModal(false);
        setAssignPlan(null);
        setAssignContext(null);
        window.location.reload();
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาดในการมอบหมายงาน");
      }
    } catch (error) {
      console.error("Error bulk assigning:", error);
      toast.error("เกิดข้อผิดพลาดในการมอบหมายงาน");
    } finally {
      setBulkAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Supervisor Dashboard
        </h1>
        <p className="mt-2 text-gray-600">
          ยินดีต้อนรับ, {userData?.name || "Supervisor"}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="shrink-0 bg-blue-100 rounded-lg p-3">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                พนักงานทั้งหมด
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {employees.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="shrink-0 bg-green-100 rounded-lg p-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">งานเสร็จแล้ว</p>
              <p className="text-2xl font-bold text-gray-900">
                {statistics.completed}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="shrink-0 bg-yellow-100 rounded-lg p-3">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">รอดำเนินการ</p>
              <p className="text-2xl font-bold text-gray-900">
                {statistics.pending}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="shrink-0 bg-purple-100 rounded-lg p-3">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">อัตราสำเร็จ</p>
              <p className="text-2xl font-bold text-gray-900">
                {statistics.completionRate}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Assign Button */}
      <div className="mb-6">
        <button
          onClick={openAssignPreview}
          disabled={bulkAssigning || assignLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          {bulkAssigning ? "กำลังมอบหมาย..." : "มอบหมายสินค้าทั้งหมดให้ทุกสาขา"}
        </button>
      </div>

      {showAssignModal && (
        <AssignPreviewModal
          open={showAssignModal}
          title="มอบหมายสินค้าทั้งหมดให้ทุกสาขา"
          subtitle={
            assignContext
              ? `รอบ ${assignContext.half} • เดือน ${assignContext.month}/${assignContext.year}`
              : undefined
          }
          loading={assignLoading}
          committing={bulkAssigning}
          plan={assignPlan}
          onConfirm={handleConfirmAssign}
          onClose={() => {
            if (bulkAssigning) return;
            setShowAssignModal(false);
            setAssignPlan(null);
            setAssignContext(null);
          }}
        />
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            รายชื่อพนักงาน ({employees.length} คน)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ชื่อ-นามสกุล
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  อีเมล
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  งานที่ได้รับ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ความคืบหน้า
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    ไม่มีพนักงานในระบบ
                  </td>
                </tr>
              ) : (
                employees.map((employee) => {
                  const employeeAssignments = assignments.filter(
                    (a) => a.userId === employee.id,
                  );
                  const totalAssignments = employeeAssignments.length;
                  const completedAssignments = employeeAssignments.filter(
                    (a) => a.status === "completed",
                  ).length;
                  const progress =
                    totalAssignments > 0
                      ? Math.round(
                          (completedAssignments / totalAssignments) * 100,
                        )
                      : 0;

                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {userFullNameMap[employee.id] || employee.name}
                        </div>
                        {userFullNameMap[employee.id] &&
                          userFullNameMap[employee.id] !== employee.name && (
                            <div className="text-xs text-gray-500">
                              ({employee.name})
                            </div>
                          )}
                        {userBaCodeMap[employee.id] && (
                          <div className="text-xs font-mono text-blue-600">
                            รหัส: {userBaCodeMap[employee.id]}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {employee.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {employee.branchName}
                        </div>
                        <div className="text-xs text-gray-500">
                          ({employee.branchCode})
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            employee.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {employee.status === "active"
                            ? "ใช้งาน"
                            : "ไม่ใช้งาน"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {totalAssignments} งาน
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">
                            {progress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
