"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { Branch } from "@/types";
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
  User as UserIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface BranchWithStats extends Branch {
  userCount?: number;
  companyName?: string;
  sellerCategory?: string;
  supervisorId?: string;
  supervisorName?: string;
}

interface Company {
  id: string;
  name: string;
  code: string;
}

interface SupervisorOption {
  id: string;
  name: string;
  email: string;
}

// Common preset categories — input is free-text but suggestions help consistency
const SELLER_CATEGORY_PRESETS = [
  "Lotus",
  "BigC",
  "Watson",
  "Boots",
  "Tops",
  "Makro",
  "7-Eleven",
];

export default function BranchesPage() {
  const { userData } = useAuthStore();
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterSellerCategory, setFilterSellerCategory] =
    useState<string>("all");
  const [filterSupervisor, setFilterSupervisor] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<BranchWithStats | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    companyId: "",
    latitude: "",
    longitude: "",
    radiusMeters: "200",
    sellerCategory: "",
    supervisorId: "",
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

      // Manager/Supervisor: ดึงเฉพาะสาขาที่ถูก assign ให้เท่านั้น
      if (userData.role === "manager" || userData.role === "supervisor") {
        const managedIds = userData.managedBranchIds?.length
          ? userData.managedBranchIds
          : userData.branchId
            ? [userData.branchId]
            : [];
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
              code: data.code || undefined,
              address: data.address,
              latitude: data.latitude,
              longitude: data.longitude,
              radiusMeters: data.radiusMeters,
              createdAt: data.createdAt?.toDate(),
              userCount: 0,
              sellerCategory: data.sellerCategory || "",
              supervisorId: data.supervisorId || "",
              supervisorName: data.supervisorName || "",
            };
          },
        );

        // Fetch user count for managed branches
        if (managedIds.length > 0) {
          const usersSnapshot = await getDocs(
            query(collection(db, "users"), where("branchId", "in", managedIds)),
          );
          const branchUserCount: Record<string, number> = {};
          usersSnapshot.forEach((doc) => {
            const data = doc.data() as any;
            // Count via branchIds array (multi-branch) or fall back to branchId
            const ids: string[] = data.branchIds?.length
              ? data.branchIds
              : data.branchId
                ? [data.branchId]
                : [];
            ids.forEach((id) => {
              if (managedIds.includes(id)) {
                branchUserCount[id] = (branchUserCount[id] || 0) + 1;
              }
            });
          });
          branchesData.forEach((b) => {
            b.userCount = branchUserCount[b.id] || 0;
          });
        }

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
          code: data.code || undefined,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          radiusMeters: data.radiusMeters,
          createdAt: data.createdAt?.toDate(),
          sellerCategory: data.sellerCategory || "",
          supervisorId: data.supervisorId || "",
          supervisorName: data.supervisorName || "",
        });
      });

      // Fetch user count per branch + collect companies
      const usersSnapshot = await getDocs(usersQuery);
      const companiesMap = new Map<string, Company>();

      const branchUserCount: Record<string, number> = {};
      usersSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        // Count via branchIds array (multi-branch) or fall back to branchId
        const ids: string[] = data.branchIds?.length
          ? data.branchIds
          : data.branchId
            ? [data.branchId]
            : [];
        ids.forEach((id) => {
          branchUserCount[id] = (branchUserCount[id] || 0) + 1;
        });
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

      // Fetch supervisors (admin / manager / supervisor) for assignment dropdown
      let supervisorsQuery;
      if (companyId) {
        supervisorsQuery = query(
          collection(db, "users"),
          where("companyId", "==", companyId),
          where("role", "in", ["supervisor", "manager", "admin"]),
        );
      } else {
        supervisorsQuery = query(
          collection(db, "users"),
          where("role", "in", ["supervisor", "manager", "admin"]),
        );
      }
      const supervisorsSnapshot = await getDocs(supervisorsQuery);
      const supervisorsData: SupervisorOption[] = [];
      supervisorsSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        supervisorsData.push({
          id: data.uid || doc.id,
          name:
            data.fullName || data.name || data.displayName || data.email || "",
          email: data.email || "",
        });
      });
      setSupervisors(supervisorsData);
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
      branch.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.code || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany =
      filterCompany === "all" || branch.companyId === filterCompany;
    const matchesSeller =
      filterSellerCategory === "all" ||
      (branch.sellerCategory || "") === filterSellerCategory;
    const matchesSupervisor =
      filterSupervisor === "all" ||
      (branch.supervisorId || "") === filterSupervisor;

    // Manager/Supervisor เห็นเฉพาะสาขาที่ถูก assign ให้เท่านั้น
    if (userData?.role === "manager" || userData?.role === "supervisor") {
      const managedIds = userData.managedBranchIds?.length
        ? userData.managedBranchIds
        : userData.branchId
          ? [userData.branchId]
          : [];
      if (managedIds.length === 0) return false;
      return (
        matchesSearch &&
        matchesSeller &&
        matchesSupervisor &&
        managedIds.includes(branch.id)
      );
    }

    return (
      matchesSearch && matchesCompany && matchesSeller && matchesSupervisor
    );
  });

  // Unique sellerCategories present in current branches (for filter dropdown)
  const availableSellerCategories = Array.from(
    new Set(
      branches
        .map((b) => b.sellerCategory || "")
        .filter((s): s is string => !!s),
    ),
  ).sort();

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
      const lat = formData.latitude.trim()
        ? parseFloat(formData.latitude)
        : null;
      const lng = formData.longitude.trim()
        ? parseFloat(formData.longitude)
        : null;
      const rawRadius = formData.radiusMeters.trim()
        ? parseInt(formData.radiusMeters, 10)
        : 200;
      const radius = Math.min(Math.max(rawRadius, 50), 500);

      if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
        toast.error("ละติจูด/ลองจิจูดต้องเป็นตัวเลข");
        return;
      }

      // ป้องกันรหัสสาขาซ้ำภายในบริษัทเดียวกัน
      const trimmedCode = formData.code.trim();
      if (trimmedCode) {
        const dupSnap = await getDocs(
          query(
            collection(db, "branches"),
            where("companyId", "==", targetCompanyId),
            where("code", "==", trimmedCode),
          ),
        );
        if (!dupSnap.empty) {
          toast.error(`รหัสสาขา "${trimmedCode}" มีอยู่แล้วในบริษัทนี้`);
          return;
        }
      }

      const supervisor = supervisors.find(
        (s) => s.id === formData.supervisorId,
      );

      await addDoc(collection(db, "branches"), {
        companyId: targetCompanyId,
        companyName: targetCompany?.name || "",
        companyCode: targetCompany?.code || "",
        name: formData.name.trim(),
        code: trimmedCode || null,
        address: formData.address.trim() || null,
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        sellerCategory: formData.sellerCategory.trim() || null,
        supervisorId: formData.supervisorId || null,
        supervisorName: supervisor?.name || null,
        createdAt: serverTimestamp(),
      });

      toast.success("เพิ่มสาขาสำเร็จ");
      setShowAddModal(false);
      setFormData({
        name: "",
        code: "",
        address: "",
        companyId: "",
        latitude: "",
        longitude: "",
        radiusMeters: "200",
        sellerCategory: "",
        supervisorId: "",
      });
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
      code: branch.code || "",
      address: branch.address || "",
      companyId: branch.companyId || "",
      latitude: branch.latitude != null ? String(branch.latitude) : "",
      longitude: branch.longitude != null ? String(branch.longitude) : "",
      radiusMeters:
        branch.radiusMeters != null ? String(branch.radiusMeters) : "200",
      sellerCategory: branch.sellerCategory || "",
      supervisorId: branch.supervisorId || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateBranch = async () => {
    if (!selectedBranch || !formData.name.trim()) {
      toast.error("กรุณากรอกชื่อสาขา");
      return;
    }

    try {
      const lat = formData.latitude.trim()
        ? parseFloat(formData.latitude)
        : null;
      const lng = formData.longitude.trim()
        ? parseFloat(formData.longitude)
        : null;
      const rawRadius = formData.radiusMeters.trim()
        ? parseInt(formData.radiusMeters, 10)
        : 200;
      const radius = Math.min(Math.max(rawRadius, 50), 500);

      if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
        toast.error("ละติจูด/ลองจิจูดต้องเป็นตัวเลข");
        return;
      }

      // ป้องกันรหัสสาขาซ้ำ (ยกเว้นตัวเอง)
      const trimmedCode = formData.code.trim();
      if (trimmedCode) {
        const targetCompanyId =
          selectedBranch.companyId || formData.companyId || "";
        if (targetCompanyId) {
          const dupSnap = await getDocs(
            query(
              collection(db, "branches"),
              where("companyId", "==", targetCompanyId),
              where("code", "==", trimmedCode),
            ),
          );
          const conflict = dupSnap.docs.find((d) => d.id !== selectedBranch.id);
          if (conflict) {
            toast.error(`รหัสสาขา "${trimmedCode}" มีอยู่แล้วในบริษัทนี้`);
            return;
          }
        }
      }

      const supervisor = supervisors.find(
        (s) => s.id === formData.supervisorId,
      );

      await updateDoc(doc(db, "branches", selectedBranch.id), {
        name: formData.name.trim(),
        code: trimmedCode || null,
        address: formData.address.trim() || null,
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        sellerCategory: formData.sellerCategory.trim() || null,
        supervisorId: formData.supervisorId || null,
        supervisorName: supervisor?.name || null,
        updatedAt: serverTimestamp(),
      });

      toast.success("อัปเดตสาขาสำเร็จ");
      setShowEditModal(false);
      setSelectedBranch(null);
      setFormData({
        name: "",
        code: "",
        address: "",
        companyId: "",
        latitude: "",
        longitude: "",
        radiusMeters: "200",
        sellerCategory: "",
        supervisorId: "",
      });
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
  if (
    !isSuperAdmin &&
    userData?.role !== "manager" &&
    userData?.role !== "supervisor" &&
    companies.length === 0
  ) {
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
                latitude: "",
                longitude: "",
                radiusMeters: "200",
                sellerCategory: "",
                supervisorId: "",
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

      {/* Manager/Supervisor Info Banner */}
      {(userData?.role === "manager" || userData?.role === "supervisor") && (
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
                {(() => {
                  const count = userData.managedBranchIds?.length
                    ? userData.managedBranchIds.length
                    : userData.branchId
                      ? 1
                      : 0;
                  return count > 0 ? ` (${count} สาขา)` : "";
                })()}
              </p>
              {!userData.managedBranchIds?.length && !userData.branchId && (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อสาขา, รหัส, ที่อยู่..."
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
          <select
            value={filterSellerCategory}
            onChange={(e) => setFilterSellerCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทุก Seller Category</option>
            {availableSellerCategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filterSupervisor}
            onChange={(e) => setFilterSupervisor(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทุก Supervisor</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Branches Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  รหัส
                </th>
                {isSuperAdmin && (
                  <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    บริษัท
                  </th>
                )}
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Seller Category
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Supervisor
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Geofence
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  พนักงาน
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredBranches.map((branch) => (
                <tr
                  key={branch.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock-counter/dashboard/branches/${branch.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {branch.name}
                        </p>
                        {branch.address && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{branch.address}</span>
                          </p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-xs font-mono text-gray-700 dark:text-gray-300">
                    {branch.code || "-"}
                  </td>
                  {isSuperAdmin && (
                    <td className="hidden xl:table-cell px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <Factory className="w-3.5 h-3.5" />
                        <span className="truncate max-w-32">
                          {branch.companyName || "-"}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="hidden lg:table-cell px-4 py-3">
                    {branch.sellerCategory ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                        {branch.sellerCategory}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3">
                    {branch.supervisorName ? (
                      <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate max-w-32">
                          {branch.supervisorName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3">
                    {branch.latitude != null && branch.longitude != null ? (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        ✅ {branch.radiusMeters || 200}m
                      </span>
                    ) : (
                      <span className="text-xs text-orange-600 dark:text-orange-400">
                        ⚠️ ยังไม่ตั้ง
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      {branch.userCount || 0}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManageBranches ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditBranch(branch)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBranch(branch);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredBranches.length === 0 && (
            <div className="text-center py-12">
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
        </div>
      </div>

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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ℹ️ ระบบจะตรวจสอบรหัสซ้ำภายในบริษัทเดียวกันก่อนบันทึก
                </p>
              </div>

              {/* Seller Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Seller Category (หมวดหมู่ร้านค้า)
                </label>
                <input
                  type="text"
                  list="seller-category-presets"
                  value={formData.sellerCategory}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sellerCategory: e.target.value,
                    })
                  }
                  placeholder="เช่น Lotus, BigC, Watson"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <datalist id="seller-category-presets">
                  {SELLER_CATEGORY_PRESETS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Supervisor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supervisor (หัวหน้างานสาขา)
                </label>
                <select
                  value={formData.supervisorId}
                  onChange={(e) =>
                    setFormData({ ...formData, supervisorId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
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

              {/* Geofence (lat/lng/radius) */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📍 พิกัดสาขา (สำหรับ Geofence)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      ละติจูด (Latitude)
                    </label>
                    <input
                      type="text"
                      value={formData.latitude}
                      onChange={(e) =>
                        setFormData({ ...formData, latitude: e.target.value })
                      }
                      placeholder="13.7563"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      ลองจิจูด (Longitude)
                    </label>
                    <input
                      type="text"
                      value={formData.longitude}
                      onChange={(e) =>
                        setFormData({ ...formData, longitude: e.target.value })
                      }
                      placeholder="100.5018"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    รัศมีอนุญาตเช็คอิน (เมตร)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={500}
                    value={formData.radiusMeters}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        radiusMeters: e.target.value,
                      })
                    }
                    placeholder="200"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    📏 รัศมีตั้งได้ 50–500 เมตร (จำกัดสูงสุดไว้เพื่อความแม่นยำ)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error("เบราว์เซอร์ไม่รองรับ Geolocation");
                      return;
                    }
                    toast.loading("กำลังขอตำแหน่งปัจจุบัน...");
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        toast.dismiss();
                        setFormData((f) => ({
                          ...f,
                          latitude: pos.coords.latitude.toFixed(6),
                          longitude: pos.coords.longitude.toFixed(6),
                        }));
                        toast.success("ใส่พิกัดปัจจุบันแล้ว");
                      },
                      (err) => {
                        toast.dismiss();
                        toast.error("ไม่สามารถขอตำแหน่งได้: " + err.message);
                      },
                      { enableHighAccuracy: true, timeout: 10000 },
                    );
                  }}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  📍 ใช้ตำแหน่งปัจจุบันของฉัน
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  หา lat/lng จาก Google Maps: คลิกขวาที่ตำแหน่ง → คลิกที่พิกัด
                  จะถูก copy
                </p>
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
                    latitude: "",
                    longitude: "",
                    radiusMeters: "200",
                    sellerCategory: "",
                    supervisorId: "",
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

              {/* รหัสสาขา (เพิ่มใน edit modal) */}
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ℹ️ ระบบจะตรวจสอบรหัสซ้ำภายในบริษัทเดียวกันก่อนบันทึก
                </p>
              </div>

              {/* Seller Category (เพิ่มใน edit modal) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Seller Category (หมวดหมู่ร้านค้า)
                </label>
                <input
                  type="text"
                  list="seller-category-presets"
                  value={formData.sellerCategory}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sellerCategory: e.target.value,
                    })
                  }
                  placeholder="เช่น Lotus, BigC, Watson"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Supervisor (เพิ่มใน edit modal) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supervisor (หัวหน้างานสาขา)
                </label>
                <select
                  value={formData.supervisorId}
                  onChange={(e) =>
                    setFormData({ ...formData, supervisorId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Geofence (lat/lng/radius) */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📍 พิกัดสาขา (สำหรับ Geofence)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      ละติจูด
                    </label>
                    <input
                      type="text"
                      value={formData.latitude}
                      onChange={(e) =>
                        setFormData({ ...formData, latitude: e.target.value })
                      }
                      placeholder="13.7563"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      ลองจิจูด
                    </label>
                    <input
                      type="text"
                      value={formData.longitude}
                      onChange={(e) =>
                        setFormData({ ...formData, longitude: e.target.value })
                      }
                      placeholder="100.5018"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    รัศมีอนุญาตเช็คอิน (เมตร)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={500}
                    value={formData.radiusMeters}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        radiusMeters: e.target.value,
                      })
                    }
                    placeholder="200"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    📏 รัศมีตั้งได้ 50–500 เมตร (จำกัดสูงสุดไว้เพื่อความแม่นยำ)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error("เบราว์เซอร์ไม่รองรับ Geolocation");
                      return;
                    }
                    toast.loading("กำลังขอตำแหน่งปัจจุบัน...");
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        toast.dismiss();
                        setFormData((f) => ({
                          ...f,
                          latitude: pos.coords.latitude.toFixed(6),
                          longitude: pos.coords.longitude.toFixed(6),
                        }));
                        toast.success("ใส่พิกัดปัจจุบันแล้ว");
                      },
                      (err) => {
                        toast.dismiss();
                        toast.error("ไม่สามารถขอตำแหน่งได้: " + err.message);
                      },
                      { enableHighAccuracy: true, timeout: 10000 },
                    );
                  }}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  📍 ใช้ตำแหน่งปัจจุบันของฉัน
                </button>
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
                    latitude: "",
                    longitude: "",
                    radiusMeters: "200",
                    sellerCategory: "",
                    supervisorId: "",
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
