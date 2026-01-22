"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { User } from "@/types";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Building2, Check, Edit2, Search, Shield, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  code: string;
  companyId: string;
}

interface ManagerWithBranches extends User {
  managedBranches?: Branch[];
}

export default function ManagersPage() {
  const { userData } = useAuthStore();
  const [managers, setManagers] = useState<ManagerWithBranches[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManager, setSelectedManager] =
    useState<ManagerWithBranches | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  const isSuperAdmin = userData?.role === "super_admin";
  const canManageManagers =
    userData?.role === "admin" || userData?.role === "super_admin";

  useEffect(() => {
    if (!userData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchData = async () => {
    if (!userData) return;

    try {
      const companyId = userData.companyId;
      console.log("Fetching managers data for:", { companyId, isSuperAdmin });

      // Fetch branches
      let branchesQuery;
      if (companyId) {
        branchesQuery = query(
          collection(db, "branches"),
          where("companyId", "==", companyId),
        );
      } else {
        branchesQuery = query(collection(db, "branches"));
      }

      const branchesSnapshot = await getDocs(branchesQuery);
      const branchesData: Branch[] = [];
      branchesSnapshot.forEach((doc) => {
        branchesData.push({
          id: doc.id,
          ...doc.data(),
        } as Branch);
      });
      setBranches(branchesData);

      // Fetch managers
      let managersQuery;
      if (companyId) {
        managersQuery = query(
          collection(db, "users"),
          where("companyId", "==", companyId),
          where("role", "==", "manager"),
        );
      } else {
        managersQuery = query(
          collection(db, "users"),
          where("role", "==", "manager"),
        );
      }

      const managersSnapshot = await getDocs(managersQuery);
      const managersData: ManagerWithBranches[] = [];

      managersSnapshot.forEach((doc) => {
        const data = doc.data() as User;
        const managerBranches = branchesData.filter((branch) =>
          data.managedBranchIds?.includes(branch.id),
        );

        managersData.push({
          ...data,
          id: doc.id,
          managedBranches: managerBranches,
        });
      });

      console.log("Managers fetched:", managersData.length);
      console.log("Branches fetched:", branchesData.length);

      setManagers(managersData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleEditBranches = (manager: ManagerWithBranches) => {
    setSelectedManager(manager);
    setSelectedBranchIds(manager.managedBranchIds || []);
    setShowEditModal(true);
  };

  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
  };

  const handleSubmit = async () => {
    if (!selectedManager) return;

    try {
      const userRef = doc(db, "users", selectedManager.id);
      await updateDoc(userRef, {
        managedBranchIds: selectedBranchIds,
      });

      toast.success("อัปเดตสาขาที่ควบคุมเรียบร้อยแล้ว");
      setShowEditModal(false);
      setSelectedManager(null);
      fetchData();
    } catch (error) {
      console.error("Error updating manager:", error);
      toast.error("เกิดข้อผิดพลาดในการอัปเดต");
    }
  };

  const filteredManagers = managers.filter(
    (manager) =>
      manager.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Filter branches for current user's company
  const availableBranches = branches.filter((branch) =>
    isSuperAdmin ? true : branch.companyId === userData?.companyId,
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  // ตรวจสอบสิทธิ์ - เฉพาะ Admin และ Super Admin เท่านั้น
  if (!canManageManagers) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto mt-12">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8">
            <div className="text-center">
              <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Shield className="w-8 h-8 text-red-600 dark:text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                ไม่มีสิทธิ์เข้าถึง
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                หน้านี้เฉพาะ <strong>Admin</strong> และ{" "}
                <strong>Super Admin</strong> เท่านั้น
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                คุณเป็น: <span className="font-semibold">{userData?.role}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">จัดการ Manager</h1>
          <p className="text-gray-600 mt-1">
            กำหนดสาขาที่ Manager แต่ละคนควบคุม
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ Manager, อีเมล..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <UserCog className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Manager ทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">
                {managers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">สาขาทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">
                {availableBranches.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Managers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Manager
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  บริษัท
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  สาขาที่ควบคุม
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  รายการสาขา
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredManagers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <UserCog className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {searchTerm
                        ? "ไม่พบ Manager ที่ค้นหา"
                        : "ยังไม่มี Manager"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredManagers.map((manager) => (
                  <tr key={manager.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Shield className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {manager.name || manager.displayName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {manager.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {manager.companyName || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
                        <Building2 className="w-4 h-4" />
                        {manager.managedBranches?.length || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {manager.managedBranches &&
                        manager.managedBranches.length > 0 ? (
                          manager.managedBranches.map((branch) => (
                            <span
                              key={branch.id}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700"
                            >
                              {branch.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">
                            ยังไม่ได้กำหนด
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleEditBranches(manager)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="จัดการสาขา"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Branches Modal */}
      {showEditModal && selectedManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                จัดการสาขาที่ควบคุม
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedManager.name || selectedManager.displayName}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {availableBranches.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    ไม่มีสาขาให้เลือก
                  </p>
                ) : (
                  availableBranches.map((branch) => {
                    const isSelected = selectedBranchIds.includes(branch.id);
                    return (
                      <button
                        key={branch.id}
                        onClick={() => handleToggleBranch(branch.id)}
                        className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isSelected ? "bg-blue-100" : "bg-gray-100"
                            }`}
                          >
                            <Building2
                              className={`w-5 h-5 ${
                                isSelected ? "text-blue-600" : "text-gray-500"
                              }`}
                            />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-900">
                              {branch.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {branch.code}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  เลือกแล้ว:{" "}
                  <span className="font-semibold">
                    {selectedBranchIds.length}
                  </span>{" "}
                  สาขา
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedManager(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
