"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { Branch } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Building2,
  Edit2,
  Factory,
  MapPin,
  Plus,
  Search,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface BranchWithStats extends Branch {
  userCount?: number;
  companyName?: string;
}

interface Company {
  id: string;
  name: string;
  code: string;
}

export default function BranchesPage() {
  const { userData } = useAuthStore();
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<BranchWithStats | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    companyId: "",
  });

  // ตรวจสอบว่าเป็น superadmin (ไม่มี companyId) หรือไม่
  const isSuperAdmin = userData?.role === "super_admin";
  // ตรวจสอบว่าสามารถจัดการสาขาได้หรือไม่ (Admin และ Super Admin เท่านั้น)
  const canManageBranches =
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

      // Manager: ดึงเฉพาะสาขาที่ถูก assign ให้เท่านั้น
      if (userData.role === "manager") {
        const managedIds = userData.managedBranchIds ?? [];
        if (managedIds.length === 0) {
          setBranches([]);
          setLoading(false);
          return;
        }

        // ดึงเฉพาะสาขาที่ manage
        const branchesSnapshot = await getDocs(
          query(
            collection(db, "branches"),
            where(documentId(), "in", managedIds),
          ),
        );

        const branchesData: BranchWithStats[] = branchesSnapshot.docs.map(
          (d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              companyId: data.companyId,
              companyName: data.companyName || "",
              name: data.name,
              address: data.address,
              createdAt: data.createdAt?.toDate(),
              userCount: 0,
            };
          },
        );

        setBranches(branchesData);
        setLoading(false);
        return;
      }

      // ถ้าเป็น superadmin ดึงทั้งหมด
      let branchesQuery;
      let usersQuery;

      if (companyId) {
        branchesQuery = query(
          collection(db, "branches"),
          where("companyId", "==", companyId),
        );
        usersQuery = query(
          collection(db, "users"),
          where("companyId", "==", companyId),
        );
      } else {
        branchesQuery = query(collection(db, "branches"));
        usersQuery = query(collection(db, "users"));
      }

      // Fetch branches
      const branchesSnapshot = await getDocs(branchesQuery);

      const branchesData: BranchWithStats[] = [];
      branchesSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        branchesData.push({
          id: doc.id,
          companyId: data.companyId,
          companyName: data.companyName || "",
          name: data.name,
          address: data.address,
          createdAt: data.createdAt?.toDate(),
        });
      });

      // Fetch user count per branch + collect companies
      const usersSnapshot = await getDocs(usersQuery);
      const companiesMap = new Map<string, Company>();

      const branchUserCount: Record<string, number> = {};
      usersSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        const branchId = data.branchId;
        if (branchId) {
          branchUserCount[branchId] = (branchUserCount[branchId] || 0) + 1;
        }
        // เก็บข้อมูล company
        if (data.companyId && data.companyName) {
          companiesMap.set(data.companyId, {
            id: data.companyId,
            name: data.companyName,
            code: data.companyCode || "",
          });
        }
      });

      setCompanies(Array.from(companiesMap.values()));

      // Add user count to branches + company name
      const branchesWithStats = branchesData.map((branch) => {
        const company = companiesMap.get(branch.companyId || "");
        return {
          ...branch,
          userCount: branchUserCount[branch.id] || 0,
          companyName: branch.companyName || company?.name || "",
        };
      });

      setBranches(branchesWithStats);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("ไม่สามารถดึงข้อมูลสาขาได้");
    } finally {
      setLoading(false);
    }
  };

  const filteredBranches = branches.filter((branch) => {
    const matchesSearch =
      branch.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany =
      filterCompany === "all" || branch.companyId === filterCompany;

    // Manager เห็นเฉพาะสาขาที่ถูก assign ให้เท่านั้น
    if (userData?.role === "manager") {
      const managedIds = userData.managedBranchIds ?? [];
      if (managedIds.length === 0) return false;
      return matchesSearch && managedIds.includes(branch.id);
    }

    return matchesSearch && matchesCompany;
  });

  const handleAddBranch = async () => {
    if (!userData || !formData.name.trim()) {
      toast.error("กรุณากรอกชื่อสาขา");
      return;
    }

    // ถ้าเป็น superadmin ต้องเลือก company
    const targetCompanyId = isSuperAdmin
      ? formData.companyId
      : userData.companyId;
    if (!targetCompanyId) {
      toast.error("กรุณาเลือกบริษัท");
      return;
    }

    const targetCompany = companies.find((c) => c.id === targetCompanyId);

    try {
      await addDoc(collection(db, "branches"), {
        companyId: targetCompanyId,
        companyName: targetCompany?.name || "",
        companyCode: targetCompany?.code || "",
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        address: formData.address.trim() || null,
        createdAt: serverTimestamp(),
      });

      toast.success("เพิ่มสาขาสำเร็จ");
      setShowAddModal(false);
      setFormData({ name: "", code: "", address: "", companyId: "" });
      fetchData();
    } catch (error) {
      console.error("Error adding branch:", error);
      toast.error("ไม่สามารถเพิ่มสาขาได้");
    }
  };

  const handleEditBranch = (branch: BranchWithStats) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name,
      code: "",
      address: branch.address || "",
      companyId: branch.companyId || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateBranch = async () => {
    if (!selectedBranch || !formData.name.trim()) {
      toast.error("กรุณากรอกชื่อสาขา");
      return;
    }

    try {
      await updateDoc(doc(db, "branches", selectedBranch.id), {
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        updatedAt: serverTimestamp(),
      });

      toast.success("อัปเดตสาขาสำเร็จ");
      setShowEditModal(false);
      setSelectedBranch(null);
      setFormData({ name: "", code: "", address: "", companyId: "" });
      fetchData();
    } catch (error) {
      console.error("Error updating branch:", error);
      toast.error("ไม่สามารถอัปเดตสาขาได้");
    }
  };

  const handleDeleteBranch = async () => {
    if (!selectedBranch) return;

    try {
      await deleteDoc(doc(db, "branches", selectedBranch.id));
      toast.success("ลบสาขาสำเร็จ");
      setShowDeleteConfirm(false);
      setSelectedBranch(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast.error("ไม่สามารถลบสาขาได้");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            กำลังโหลดข้อมูล...
          </p>
        </div>
      </div>
    );
  }

  // ถ้ายังไม่มีบริษัทเลย แสดงข้อความแจ้งเตือน (ยกเว้น manager)
  if (!isSuperAdmin && userData?.role !== "manager" && companies.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            จัดการสาขา
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            จัดการสาขาและที่ตั้งของบริษัท
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8">
          <div className="text-center max-w-md mx-auto">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Factory className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              ยังไม่มีบริษัทในระบบ
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              ก่อนที่จะสามารถเพิ่มสาขาได้ จำเป็นต้องมีบริษัทในระบบก่อน
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                📞 กรุณาติดต่อ <strong>นักพัฒนาระบบ</strong>{" "}
                เพื่อขอให้เพิ่มบริษัทให้คุณ
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                เฉพาะ ผู้ดูแลระบบ เท่วนั้นที่สามารถสร้างบริษัทได้
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            จัดการสาขา
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            จัดการสาขาและที่ตั้งของบริษัท
          </p>
        </div>
        {canManageBranches && (
          <button
            onClick={() => {
              setFormData({
                name: "",
                code: "",
                address: "",
                companyId: isSuperAdmin
                  ? companies[0]?.id || ""
                  : userData?.companyId || "",
              });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            เพิ่มสาขา
          </button>
        )}
      </div>

      {/* Manager Info Banner */}
      {userData?.role === "manager" && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 shrink-0">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                สาขาที่คุณรับผิดชอบ
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                คุณมีหน้าที่ดูแลและจัดการสาขาเหล่านี้ในบริษัท{" "}
                <strong>{userData.companyName || "ของคุณ"}</strong>
                {userData.managedBranchIds &&
                userData.managedBranchIds.length > 0
                  ? ` (${userData.managedBranchIds.length} สาขา)`
                  : ""}
              </p>
              {(!userData.managedBranchIds ||
                userData.managedBranchIds.length === 0) && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  ⚠️ ยังไม่มีสาขาที่ถูกกำหนดให้คุณ กรุณาติดต่อเจ้าของบริษัท
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Info Banner */}
      {userData?.role === "admin" && userData?.companyName && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2 shrink-0">
              <Factory className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                สาขาในบริษัทของคุณ
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                คุณกำลังจัดการสาขาในบริษัท{" "}
                <strong>{userData.companyName}</strong>
                {userData.companyCode && (
                  <span className="text-green-600 dark:text-green-400">
                    {" "}
                    ({userData.companyCode})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อสาขา, ที่อยู่..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Company filter - แสดงเฉพาะ superadmin */}
          {isSuperAdmin && companies.length > 0 && (
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทุกบริษัท</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBranches.map((branch) => (
          <div
            key={branch.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all group relative"
          >
            {/* Clickable Card Area */}
            <Link
              href={`/dashboard/branches/${branch.id}`}
              className="block p-5 pb-0"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {branch.name}
              </h3>

              {/* แสดง company name สำหรับ superadmin */}
              {isSuperAdmin && branch.companyName && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-2">
                  <Factory className="w-4 h-4" />
                  <span>{branch.companyName}</span>
                </div>
              )}

              {branch.address && (
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{branch.address}</span>
                </div>
              )}
            </Link>

            {/* Action Buttons - Stop propagation */}
            {canManageBranches && (
              <div className="absolute top-5 right-5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEditBranch(branch);
                  }}
                  className="p-2 text-blue-600 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors shadow-sm border border-gray-200 dark:border-gray-600"
                  title="แก้ไข"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedBranch(branch);
                    setShowDeleteConfirm(true);
                  }}
                  className="p-2 text-red-600 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shadow-sm border border-gray-200 dark:border-gray-600"
                  title="ลบ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Footer */}
            <Link
              href={`/dashboard/branches/${branch.id}`}
              className="block px-5 pb-5"
            >
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <Users className="w-4 h-4" />
                  <span>{branch.userCount || 0} พนักงาน</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {branch.createdAt
                    ? format(branch.createdAt, "dd MMM yyyy", { locale: th })
                    : "-"}
                </span>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {filteredBranches.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">ไม่พบสาขา</p>
          {canManageBranches && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
            >
              เพิ่มสาขาใหม่
            </button>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              เพิ่มสาขาใหม่
            </h2>

            <div className="space-y-4">
              {/* Company selector - แสดงเฉพาะ superadmin */}
              {isSuperAdmin && companies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    บริษัท <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.companyId}
                    onChange={(e) =>
                      setFormData({ ...formData, companyId: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">เลือกบริษัท</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* แสดงชื่อบริษัทสำหรับ Admin (ไม่สามารถเปลี่ยนได้) */}
              {!isSuperAdmin && userData?.companyName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    บริษัท
                  </label>
                  <div className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                    {userData.companyName}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ชื่อสาขา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="เช่น สาขากรุงเทพฯ"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  รหัสสาขา
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="เช่น BKK01"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ที่อยู่
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  rows={3}
                  placeholder="ที่อยู่สาขา..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({
                    name: "",
                    code: "",
                    address: "",
                    companyId: "",
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAddBranch}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                เพิ่มสาขา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              แก้ไขสาขา
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ชื่อสาขา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ที่อยู่
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedBranch(null);
                  setFormData({
                    name: "",
                    code: "",
                    address: "",
                    companyId: "",
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateBranch}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && selectedBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              ยืนยันการลบ
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              คุณต้องการลบสาขา <strong>{selectedBranch.name}</strong>{" "}
              ใช่หรือไม่?
              {selectedBranch.userCount && selectedBranch.userCount > 0 && (
                <span className="block mt-2 text-red-600 dark:text-red-400 text-sm">
                  ⚠️ สาขานี้มีพนักงาน {selectedBranch.userCount} คน
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedBranch(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteBranch}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
