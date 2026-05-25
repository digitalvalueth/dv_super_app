"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { Branch, User } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Building2,
  Edit2,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  code: string;
}

interface SupervisorOption {
  id: string;
  name: string;
  email: string;
  companyId?: string;
  role?: string;
  branchIds: string[];
  managedBranchIds: string[];
  branchNames: Record<string, string>;
}

export default function UsersPage() {
  const { userData } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [selectedBranchSearch, setSelectedBranchSearch] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    role: "employee" as
      | "super_admin"
      | "admin"
      | "supervisor"
      | "manager"
      | "employee",
    companyId: "",
    branchId: "",
    branchIds: [] as string[],
    status: "active" as "pending" | "active" | "inactive" | "suspended",
    baCode: "",
    fullName: "",
    sellerCategory: "",
    supervisorId: "",
  });

  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);

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

  // ตรวจสอบว่าเป็น superadmin หรือไม่
  const isSuperAdmin = userData?.role === "super_admin";
  // ตรวจสอบว่าสามารถจัดการผู้ใช้ได้หรือไม่ (Admin และ Super Admin เท่านั้น)
  const canManageUsers =
    userData?.role === "admin" || userData?.role === "super_admin";

  useEffect(() => {
    if (!userData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchData = async () => {
    if (!userData) return;

    try {
      // ใช้ role ในการกำหนดว่าจะดึงข้อมูลแบบไหน
      let usersQuery;
      let branchesQuery;

      if (isSuperAdmin) {
        // Superadmin - ดึงทั้งหมด
        usersQuery = query(collection(db, "users"));
        branchesQuery = query(collection(db, "branches"));
      } else if (userData.companyId) {
        // Admin/Manager ที่มี companyId - ดึงเฉพาะบริษัทของตัวเอง
        usersQuery = query(
          collection(db, "users"),
          where("companyId", "==", userData.companyId),
        );
        branchesQuery = query(
          collection(db, "branches"),
          where("companyId", "==", userData.companyId),
        );
      } else {
        // ถ้าไม่มี companyId และไม่ใช่ super_admin -> ไม่ควรเห็นอะไรเลย
        setUsers([]);
        setBranches([]);
        setCompanies([]);
        setLoading(false);
        return;
      }

      // Fetch branches first so user branch labels can be resolved even when
      // legacy user.branchNames is missing.
      const branchesSnapshot = await getDocs(branchesQuery);
      const branchesData: Branch[] = [];
      const branchNameById = new Map<string, string>();
      branchesSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        const branch: Branch = {
          id: doc.id,
          companyId: data.companyId,
          name: data.name,
          code: data.code || "",
          address: data.address,
          createdAt: data.createdAt?.toDate(),
        };
        branchesData.push(branch);
        if (branch.name) {
          branchNameById.set(branch.id, branch.name);
        }
      });
      setBranches(branchesData);

      // Fetch users
      const usersSnapshot = await getDocs(usersQuery);
      const usersData: User[] = [];

      usersSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        const branchIds: string[] | null = Array.isArray(data.branchIds)
          ? data.branchIds
          : data.branchId
            ? [data.branchId]
            : null;
        const storedBranchNames: Record<string, string> | null =
          data.branchNames && typeof data.branchNames === "object"
            ? data.branchNames
            : null;
        const resolvedBranchNames =
          branchIds?.reduce<Record<string, string>>((acc, branchId) => {
            const name =
              storedBranchNames?.[branchId] || branchNameById.get(branchId);
            if (name) acc[branchId] = name;
            return acc;
          }, {}) || null;
        const primaryBranchName =
          data.branchName ||
          (data.branchId ? branchNameById.get(data.branchId) : "") ||
          "";

        usersData.push({
          id: doc.id,
          uid: data.uid,
          email: data.email,
          name: data.name || data.displayName,
          role: data.role,
          companyId: data.companyId,
          companyCode: data.companyCode || "",
          companyName: data.companyName || "",
          branchId: data.branchId,
          branchCode: data.branchCode || "",
          branchName: primaryBranchName,
          branchIds,
          branchNames: resolvedBranchNames,
          photoURL: data.photoURL,
          status: data.status,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          baCode: data.baCode || "",
          fullName: data.fullName || "",
          sellerCategory: data.sellerCategory || data.seller || "",
          supervisorId: data.supervisorId || "",
        } as any);
      });
      setUsers(usersData);

      // Fetch companies - ดึงจาก collection companies โดยตรง (เฉพาะ Super Admin)
      if (isSuperAdmin) {
        const companiesSnapshot = await getDocs(collection(db, "companies"));
        const companiesData: Company[] = [];
        companiesSnapshot.forEach((doc) => {
          const data = doc.data() as any;
          companiesData.push({
            id: doc.id,
            name: data.name,
            code: data.code,
          });
        });
        setCompanies(companiesData);
      }

      // Fetch supervisors (สำหรับ dropdown supervisor)
      let supervisorsQuery;
      if (isSuperAdmin) {
        supervisorsQuery = query(
          collection(db, "users"),
          where("role", "in", ["supervisor", "manager", "admin"]),
        );
      } else if (userData.companyId) {
        supervisorsQuery = query(
          collection(db, "users"),
          where("companyId", "==", userData.companyId),
          where("role", "in", ["supervisor", "manager", "admin"]),
        );
      }
      if (supervisorsQuery) {
        const supervisorsSnapshot = await getDocs(supervisorsQuery);
        const supervisorsData: SupervisorOption[] = [];
        supervisorsSnapshot.forEach((doc) => {
          const data = doc.data() as any;
          const branchIds = Array.isArray(data.branchIds)
            ? data.branchIds.filter(Boolean)
            : data.branchId
              ? [data.branchId]
              : [];
          const managedBranchIds = Array.isArray(data.managedBranchIds)
            ? data.managedBranchIds.filter(Boolean)
            : [];
          const supervisorBranchNames = [
            ...new Set([...branchIds, ...managedBranchIds]),
          ].reduce<Record<string, string>>((acc, branchId) => {
            const name =
              data.branchNames?.[branchId] || branchNameById.get(branchId);
            if (name) acc[branchId] = name;
            return acc;
          }, {});

          supervisorsData.push({
            id: data.uid || doc.id,
            name:
              data.fullName ||
              data.name ||
              data.displayName ||
              data.email ||
              "",
            email: data.email || "",
            companyId: data.companyId || "",
            role: data.role || "",
            branchIds,
            managedBranchIds,
            branchNames: supervisorBranchNames,
          });
        });
        setSupervisors(supervisorsData);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("ไม่สามารถดึงข้อมูลผู้ใช้ได้");
    } finally {
      setLoading(false);
    }
  };

  const normalizeSearchText = (value: unknown) =>
    String(value || "")
      .normalize("NFC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const filteredUsers = users.filter((user) => {
    const search = normalizeSearchText(searchTerm);
    const searchableText = normalizeSearchText(
      [
        user.name,
        (user as any).fullName,
        user.email,
        (user as any).baCode,
        user.companyName,
        user.branchCode,
        user.branchName,
        ...Object.values(user.branchNames || {}),
      ]
        .filter(Boolean)
        .join(" "),
    );
    const matchesSearch =
      !search ||
      searchableText.includes(search) ||
      searchableText.replace(/\s+/g, "").includes(search.replace(/\s+/g, ""));
    const matchesStatus =
      filterStatus === "all" || user.status === filterStatus;
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesCompany =
      filterCompany === "all" || user.companyId === filterCompany;
    return matchesSearch && matchesStatus && matchesRole && matchesCompany;
  });

  // กรอง branches ตาม company ที่เลือก
  const _filteredBranches = branches.filter(
    (branch) => filterCompany === "all" || branch.companyId === filterCompany,
  );

  // กรอง branches สำหรับ edit modal ตามบริษัทที่เลือก
  const editModalBranches = branches.filter(
    (branch) => !editForm.companyId || branch.companyId === editForm.companyId,
  );
  const branchNameById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );

  const editFormBranchIds = editForm.branchIds.length
    ? editForm.branchIds
    : editForm.branchId
      ? [editForm.branchId]
      : [];

  const branchMatchesSearch = (branch: Branch, term: string) => {
    const search = normalizeSearchText(term);
    if (!search) return true;

    const searchableText = normalizeSearchText(
      [branch.name, branch.code].filter(Boolean).join(" "),
    );
    return (
      searchableText.includes(search) ||
      searchableText.replace(/\s+/g, "").includes(search.replace(/\s+/g, ""))
    );
  };

  const selectedEditBranches = editFormBranchIds
    .map((branchId) => {
      const branch = branches.find((b) => b.id === branchId);
      return (
        branch ||
        ({
          id: branchId,
          companyId: editForm.companyId || "",
          name: branchNameById.get(branchId) || "สาขาถูกลบแล้ว",
        } as Branch)
      );
    })
    .filter((branch) => branchMatchesSearch(branch, selectedBranchSearch));

  const availableEditBranches = editModalBranches.filter(
    (branch) => !editFormBranchIds.includes(branch.id),
  );
  const editModalBranchesFiltered = availableEditBranches.filter((branch) =>
    branchMatchesSearch(branch, branchSearch),
  );

  const getSupervisorBranchIds = (supervisor?: SupervisorOption | null) => {
    if (!supervisor) return [];
    return Array.from(
      new Set([...supervisor.managedBranchIds, ...supervisor.branchIds]),
    );
  };

  const isSupervisorValidForBranches = (
    supervisor: SupervisorOption | undefined,
    branchIds: string[],
    companyId?: string,
  ) => {
    if (!supervisor || branchIds.length === 0) return false;
    if (companyId && supervisor.companyId !== companyId) return false;

    const supervisorBranchIds = getSupervisorBranchIds(supervisor);
    return supervisorBranchIds.some((branchId) => branchIds.includes(branchId));
  };

  const getSupervisorBranchLabel = (supervisor: SupervisorOption) => {
    const labels = getSupervisorBranchIds(supervisor)
      .map(
        (branchId) =>
          supervisor.branchNames[branchId] || branchNameById.get(branchId),
      )
      .filter(Boolean);

    if (labels.length === 0) return "ยังไม่ผูกสาขา";
    const visibleLabels = labels.slice(0, 2).join(", ");
    return labels.length > 2
      ? `${visibleLabels} +${labels.length - 2} สาขา`
      : visibleLabels;
  };

  const selectedSupervisor = editForm.supervisorId
    ? supervisors.find((s) => s.id === editForm.supervisorId)
    : undefined;
  const availableSupervisors = supervisors.filter(
    (supervisor) =>
      supervisor.id !== selectedUser?.uid &&
      supervisor.id !== selectedUser?.id &&
      isSupervisorValidForBranches(
        supervisor,
        editFormBranchIds,
        editForm.companyId,
      ),
  );
  const selectedSupervisorIsValid = editForm.supervisorId
    ? isSupervisorValidForBranches(
        selectedSupervisor,
        editFormBranchIds,
        editForm.companyId,
      )
    : true;

  const updateEditBranchSelection = (nextBranchIds: string[]) => {
    const branchIds = Array.from(new Set(nextBranchIds.filter(Boolean)));

    setEditForm((prev) => {
      const supervisor = prev.supervisorId
        ? supervisors.find((s) => s.id === prev.supervisorId)
        : undefined;
      const supervisorId =
        prev.supervisorId &&
        isSupervisorValidForBranches(supervisor, branchIds, prev.companyId)
          ? prev.supervisorId
          : "";

      return {
        ...prev,
        branchIds,
        branchId: branchIds[0] || "",
        supervisorId,
      };
    });
  };

  const addEditBranch = (branchId: string) => {
    updateEditBranchSelection([...editFormBranchIds, branchId]);
  };

  const removeEditBranch = (branchId: string) => {
    updateEditBranchSelection(
      editFormBranchIds.filter((selectedId) => selectedId !== branchId),
    );
  };

  const addFilteredEditBranches = () => {
    updateEditBranchSelection([
      ...editFormBranchIds,
      ...editModalBranchesFiltered.map((branch) => branch.id),
    ]);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setBranchSearch("");
    setSelectedBranchSearch("");
    const existingBranchIds: string[] =
      (user as any).branchIds || (user.branchId ? [user.branchId] : []);
    setEditForm({
      name: user.name || "",
      role: (user.role === "staff" ? "employee" : user.role) || "employee",
      companyId: user.companyId || "",
      branchId: user.branchId || "",
      branchIds: existingBranchIds,
      status: user.status || "active",
      baCode: (user as any).baCode || "",
      fullName: (user as any).fullName || "",
      sellerCategory: (user as any).sellerCategory || "",
      supervisorId: (user as any).supervisorId || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      // Primary branch = first selected (or legacy single)
      const primaryBranchId =
        editForm.branchIds[0] || editForm.branchId || null;
      const branchIdsToSave = editForm.branchIds.length
        ? editForm.branchIds
        : primaryBranchId
          ? [primaryBranchId]
          : [];
      const selectedBranch = branches.find((b) => b.id === primaryBranchId);
      const selectedCompany = companies.find(
        (c) => c.id === editForm.companyId,
      );
      const supervisorToSave =
        editForm.role === "employee" && editForm.supervisorId
          ? supervisors.find((s) => s.id === editForm.supervisorId)
          : undefined;

      if (
        editForm.role === "employee" &&
        editForm.supervisorId &&
        !isSupervisorValidForBranches(
          supervisorToSave,
          branchIdsToSave,
          editForm.companyId,
        )
      ) {
        toast.error("หัวหน้างานต้องดูแลสาขาเดียวกับพนักงาน");
        return;
      }

      // Build branchNames map from selected branch IDs
      const branchNames: Record<string, string> = {};
      branchIdsToSave.forEach((id) => {
        const b = branches.find((br) => br.id === id);
        if (b) branchNames[id] = b.name;
      });

      await updateDoc(doc(db, "users", selectedUser.id), {
        name: editForm.name,
        role: editForm.role,
        companyId: editForm.companyId || null,
        companyName: selectedCompany?.name || null,
        companyCode: selectedCompany?.code || null,
        branchId: primaryBranchId,
        branchName: selectedBranch?.name || null,
        branchIds: branchIdsToSave.length > 0 ? branchIdsToSave : null,
        branchNames: branchIdsToSave.length > 0 ? branchNames : null,
        status: editForm.status,
        baCode: editForm.baCode || null,
        fullName: editForm.fullName || null,
        sellerCategory: editForm.sellerCategory.trim() || null,
        seller: editForm.sellerCategory.trim() || null,
        supervisorId: supervisorToSave?.id || null,
        supervisorName: supervisorToSave?.name || null,
        supervisorEmail: supervisorToSave?.email || null,
        updatedAt: serverTimestamp(),
      });

      toast.success("อัปเดตผู้ใช้สำเร็จ");
      setShowEditModal(false);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("ไม่สามารถอัปเดตผู้ใช้ได้");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await deleteDoc(doc(db, "users", selectedUser.id));
      toast.success("ลบผู้ใช้สำเร็จ");
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("ไม่สามารถลบผู้ใช้ได้");
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";
      await updateDoc(doc(db, "users", user.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success(
        newStatus === "active" ? "เปิดใช้งานผู้ใช้แล้ว" : "ปิดใช้งานผู้ใช้แล้ว",
      );
      fetchData();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("ไม่สามารถเปลี่ยนสถานะได้");
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

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
          จัดการผู้ใช้งาน
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึง
        </p>
      </div>

      {/* Manager Info Banner */}
      {userData?.role === "manager" && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 shrink-0">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                ข้อมูลผู้ใช้ในบริษัท
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                คุณกำลังดูรายชื่อผู้ใช้ในบริษัท{" "}
                <strong>{userData.companyName || "ของคุณ"}</strong> เท่านั้น
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Info Banner */}
      {userData?.role === "admin" && userData?.companyName && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2 shrink-0">
              <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                บริษัทของคุณ
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                คุณกำลังจัดการผู้ใช้ในบริษัท{" "}
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

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative md:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล..."
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="pending">รออนุมัติ</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทุกบทบาท</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ผู้ใช้
                </th>
                {/* Company column - แสดงเฉพาะ superadmin */}
                {isSuperAdmin && (
                  <th className="hidden xl:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    บริษัท
                  </th>
                )}
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  บทบาท
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  วันที่สร้าง
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold shrink-0">
                        {((user as any).fullName ||
                          user.name)?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {(user as any).fullName || user.name}
                        </p>
                        {(user as any).fullName &&
                          (user as any).fullName !== user.name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              ({user.name})
                            </p>
                          )}
                        {(user as any).baCode && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-mono truncate">
                            รหัส: {(user as any).baCode}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* Company column - แสดงเฉพาะ superadmin */}
                  {isSuperAdmin && (
                    <td className="hidden xl:table-cell px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Building2 className="w-4 h-4" />
                        <span className="truncate max-w-40">
                          {user.companyName || "-"}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="hidden md:table-cell px-6 py-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {(() => {
                      const ids: string[] | null = (user as any).branchIds;
                      const names: Record<string, string> | null = (user as any)
                        .branchNames;
                      if (ids && ids.length > 0) {
                        const labels = ids.map((id) => {
                          const label = names?.[id] || branchNameById.get(id);
                          return {
                            id,
                            label: label || "สาขาถูกลบแล้ว",
                            missing: !label,
                          };
                        });
                        return (
                          <div className="flex flex-wrap gap-1">
                            {labels.map(({ id, label, missing }) => (
                              <span
                                key={id}
                                title={missing ? `branchId: ${id}` : undefined}
                                className={`inline-block px-2 py-0.5 rounded text-xs ${
                                  missing
                                    ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                    : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                }`}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        );
                      }
                      return (
                        user.branchName ||
                        (user.branchId
                          ? branchNameById.get(user.branchId) || "สาขาถูกลบแล้ว"
                          : "-")
                      );
                    })()}
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {user.createdAt
                      ? format(user.createdAt, "dd MMM yyyy", { locale: th })
                      : "-"}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-right">
                    {canManageUsers ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`p-2 rounded-lg transition-colors ${
                            user.status === "active"
                              ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          }`}
                          title={
                            user.status === "active"
                              ? "ปิดใช้งาน"
                              : "เปิดใช้งาน"
                          }
                        >
                          {user.status === "active" ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        ดูอย่างเดียว
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">ไม่พบผู้ใช้งาน</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal &&
        selectedUser &&
        (() => {
          // เช็คว่ากำลังแก้ไขตัวเองหรือไม่
          const isEditingSelf = selectedUser.id === userData?.id;

          // กำหนด role ที่สามารถแก้ไขได้
          // Super Admin: แก้ไขได้ทุก role (ยกเว้นตัวเอง)
          // Admin: แก้ไขได้เฉพาะ manager, supervisor, employee, staff
          const allowedRoles = isSuperAdmin
            ? ["super_admin", "admin", "supervisor", "manager", "employee"]
            : ["manager", "supervisor", "employee"];
          const fieldLabelClass =
            "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";
          const fieldClass =
            "w-full h-11 px-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                        แก้ไขผู้ใช้
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {selectedUser.email}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                      <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium">
                        {editForm.fullName || editForm.name || "ยังไม่ระบุชื่อ"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] gap-6">
                    <div className="space-y-6">
                      <section className="space-y-4">
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                            ข้อมูลพนักงาน
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className={fieldLabelClass}>
                              รหัสพนักงาน (BA Code)
                            </label>
                            <input
                              type="text"
                              value={editForm.baCode}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  baCode: e.target.value,
                                })
                              }
                              className={`${fieldClass} font-mono`}
                              placeholder="เช่น BA001"
                            />
                          </div>

                          <div>
                            <label className={fieldLabelClass}>
                              ชื่อ-นามสกุลจริง
                            </label>
                            <input
                              type="text"
                              value={editForm.fullName}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  fullName: e.target.value,
                                })
                              }
                              className={fieldClass}
                              placeholder="ชื่อ-นามสกุลตามบัตรประชาชน"
                            />
                          </div>

                          <div>
                            <label className={fieldLabelClass}>
                              ชื่อ (จาก Google/Apple)
                            </label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  name: e.target.value,
                                })
                              }
                              className={fieldClass}
                            />
                          </div>

                          <div>
                            <label className={fieldLabelClass}>
                              Seller Category
                            </label>
                            <input
                              type="text"
                              list="user-seller-category-presets"
                              value={editForm.sellerCategory}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  sellerCategory: e.target.value,
                                })
                              }
                              placeholder="เช่น Lotus, BigC, Watson"
                              className={fieldClass}
                            />
                            <datalist id="user-seller-category-presets">
                              {SELLER_CATEGORY_PRESETS.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </div>
                        </div>
                      </section>

                      <section className="space-y-4">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                            สาขาที่รับผิดชอบ
                          </h3>
                          {editForm.branchIds.length > 0 && (
                            <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                              เลือกแล้ว {editForm.branchIds.length} สาขา
                            </span>
                          )}
                        </div>
                        {isSuperAdmin && !editForm.companyId ? (
                          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
                            เลือกบริษัทก่อนเพื่อดูสาขา
                          </div>
                        ) : editModalBranches.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
                            ไม่พบสาขาในบริษัทนี้
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                              <div className="border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-gray-700 overflow-hidden">
                                <div className="px-3 py-2.5 border-b border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                        สาขาที่เลือกแล้ว
                                      </p>
                                      <p className="text-xs text-blue-600 dark:text-blue-300">
                                        {editFormBranchIds.length} สาขา
                                      </p>
                                    </div>
                                    {editFormBranchIds.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateEditBranchSelection([])
                                        }
                                        className="text-xs font-medium text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
                                      >
                                        ล้างทั้งหมด
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 rounded-lg border border-blue-100 dark:border-blue-800 bg-white dark:bg-gray-800 px-3 py-2">
                                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                                    <input
                                      type="text"
                                      placeholder="ค้นหาในสาขาที่เลือก..."
                                      value={selectedBranchSearch}
                                      onChange={(e) =>
                                        setSelectedBranchSearch(e.target.value)
                                      }
                                      className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
                                    />
                                    {selectedBranchSearch && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedBranchSearch("")
                                        }
                                        className="text-gray-400 hover:text-gray-600 text-xs"
                                      >
                                        ล้าง
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="divide-y divide-blue-50 dark:divide-gray-600 max-h-80 overflow-y-auto">
                                  {editFormBranchIds.length === 0 ? (
                                    <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-300">
                                      ยังไม่ได้เลือกสาขา
                                    </div>
                                  ) : selectedEditBranches.length === 0 ? (
                                    <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-300">
                                      ไม่พบสาขาที่เลือกจากคำค้นหา
                                    </div>
                                  ) : (
                                    selectedEditBranches.map((branch) => (
                                      <div
                                        key={branch.id}
                                        className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-700"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {branch.name}
                                          </p>
                                          {branch.code && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              รหัส: {branch.code}
                                            </p>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeEditBranch(branch.id)
                                          }
                                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30 transition-colors"
                                          aria-label={`ลบ ${branch.name}`}
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 overflow-hidden">
                                <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                        สาขาที่ยังไม่ได้เลือก
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        เหลือ {availableEditBranches.length} จาก{" "}
                                        {editModalBranches.length} สาขา
                                      </p>
                                    </div>
                                    {editModalBranchesFiltered.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={addFilteredEditBranches}
                                        className="text-xs font-medium text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200"
                                      >
                                        เพิ่มที่ค้นหา
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2">
                                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                                    <input
                                      type="text"
                                      placeholder={`ค้นหาจาก ${availableEditBranches.length} สาขาที่ยังไม่ได้เลือก...`}
                                      value={branchSearch}
                                      onChange={(e) =>
                                        setBranchSearch(e.target.value)
                                      }
                                      className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
                                    />
                                    {branchSearch && (
                                      <button
                                        type="button"
                                        onClick={() => setBranchSearch("")}
                                        className="text-gray-400 hover:text-gray-600 text-xs"
                                      >
                                        ล้าง
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-600 max-h-80 overflow-y-auto">
                                  {editModalBranchesFiltered.length === 0 ? (
                                    <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-300">
                                      ไม่พบสาขาที่ยังไม่ได้เลือก
                                    </div>
                                  ) : (
                                    editModalBranchesFiltered.map((branch) => (
                                      <button
                                        key={branch.id}
                                        type="button"
                                        onClick={() => addEditBranch(branch.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                      >
                                        <span className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 shrink-0">
                                          <Plus className="w-4 h-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {branch.name}
                                          </span>
                                          {branch.code && (
                                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                                              รหัส: {branch.code}
                                            </span>
                                          )}
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ค้นหาแล้วคลิกสาขาทางขวาเพื่อเพิ่ม หรือกด X
                              ทางซ้ายเพื่อลบออกจากรายการที่เลือก
                            </p>
                          </div>
                        )}
                      </section>
                    </div>

                    <section className="space-y-4">
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                          สิทธิ์และการดูแล
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className={fieldLabelClass}>บทบาท</label>
                          {isEditingSelf ? (
                            <div>
                              <div className="w-full h-11 px-4 flex items-center border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                                {editForm.role === "super_admin" &&
                                  "ผู้ดูแลระบบ"}
                                {editForm.role === "admin" && "เจ้าของบริษัท"}
                                {editForm.role === "supervisor" && "หัวหน้างาน"}
                                {editForm.role === "manager" && "ผู้จัดการสาขา"}
                                {editForm.role === "employee" && "พนักงาน"}
                              </div>
                              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1.5">
                                ไม่สามารถเปลี่ยนบทบาทของตัวเองได้
                              </p>
                            </div>
                          ) : (
                            <select
                              value={editForm.role}
                              onChange={(e) => {
                                const role = e.target.value as
                                  | "super_admin"
                                  | "admin"
                                  | "supervisor"
                                  | "manager"
                                  | "employee";
                                setEditForm({
                                  ...editForm,
                                  role,
                                  supervisorId:
                                    role === "employee"
                                      ? editForm.supervisorId
                                      : "",
                                });
                              }}
                              className={fieldClass}
                            >
                              {allowedRoles.includes("super_admin") && (
                                <option value="super_admin">ผู้ดูแลระบบ</option>
                              )}
                              {allowedRoles.includes("admin") && (
                                <option value="admin">เจ้าของบริษัท</option>
                              )}
                              {allowedRoles.includes("supervisor") && (
                                <option value="supervisor">หัวหน้างาน</option>
                              )}
                              {allowedRoles.includes("manager") && (
                                <option value="manager">ผู้จัดการสาขา</option>
                              )}
                              {allowedRoles.includes("employee") && (
                                <option value="employee">พนักงาน</option>
                              )}
                            </select>
                          )}
                          {!isEditingSelf && !isSuperAdmin && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                              เจ้าของบริษัทสามารถจัดการได้เฉพาะ ผู้จัดการสาขา,
                              หัวหน้างาน, พนักงาน
                            </p>
                          )}
                        </div>

                        {isSuperAdmin && companies.length > 0 && (
                          <div>
                            <label className={fieldLabelClass}>บริษัท</label>
                            <select
                              value={editForm.companyId}
                              onChange={(e) => {
                                setBranchSearch("");
                                setSelectedBranchSearch("");
                                setEditForm({
                                  ...editForm,
                                  companyId: e.target.value,
                                  branchId: "",
                                  branchIds: [],
                                  supervisorId: "",
                                });
                              }}
                              className={fieldClass}
                            >
                              <option value="">ไม่ระบุ (Super Admin)</option>
                              {companies.map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                              Admin และ Manager ต้องมีบริษัทก่อนเลือกสาขา
                            </p>
                          </div>
                        )}

                        <div>
                          <label className={fieldLabelClass}>
                            Supervisor (หัวหน้าพนักงาน)
                          </label>
                          <select
                            value={editForm.supervisorId}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                supervisorId: e.target.value,
                              })
                            }
                            disabled={
                              editForm.role !== "employee" ||
                              editFormBranchIds.length === 0
                            }
                            className={fieldClass}
                          >
                            <option value="">ไม่ระบุ</option>
                            {editForm.supervisorId &&
                              !selectedSupervisorIsValid && (
                                <option value={editForm.supervisorId} disabled>
                                  {selectedSupervisor
                                    ? `${selectedSupervisor.name} (${selectedSupervisor.email}) - คนละสาขา`
                                    : "หัวหน้างานเดิมไม่อยู่ในรายการที่เลือกได้"}
                                </option>
                              )}
                            {availableSupervisors.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.email}) -{" "}
                                {getSupervisorBranchLabel(s)}
                              </option>
                            ))}
                          </select>
                          {editForm.role !== "employee" ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                              ช่องนี้ใช้สำหรับพนักงานเท่านั้น
                            </p>
                          ) : editFormBranchIds.length === 0 ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                              เลือกสาขาของพนักงานก่อน
                              แล้วระบบจะแสดงเฉพาะหัวหน้างานที่ดูแลสาขานั้น
                            </p>
                          ) : !selectedSupervisorIsValid ? (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                              หัวหน้างานเดิมไม่ได้ดูแลสาขาของพนักงานนี้
                              กรุณาเลือกหัวหน้างานในสาขาเดียวกันหรือเลือกไม่ระบุ
                            </p>
                          ) : availableSupervisors.length === 0 ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                              ไม่พบหัวหน้างานที่ผูกกับสาขาที่เลือก
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                              แสดงเฉพาะหัวหน้างานที่มีสาขาตรงกับพนักงาน
                            </p>
                          )}
                        </div>

                        <div>
                          <label className={fieldLabelClass}>สถานะ</label>
                          <select
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                status: e.target.value as
                                  | "pending"
                                  | "active"
                                  | "inactive"
                                  | "suspended",
                              })
                            }
                            className={fieldClass}
                          >
                            <option value="active">ใช้งาน</option>
                            <option value="pending">รออนุมัติ</option>
                            <option value="inactive">ปิดใช้งาน</option>
                            <option value="suspended">ระงับการใช้งาน</option>
                          </select>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedUser(null);
                    }}
                    className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 sm:min-w-32"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleUpdateUser}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 sm:min-w-32"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              ยืนยันการลบ
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              คุณต้องการลบผู้ใช้ <strong>{selectedUser.name}</strong>{" "}
              ใช่หรือไม่?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteUser}
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

function StatusBadge({ status }: { status?: string }) {
  const config = {
    active: {
      label: "ใช้งาน",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    pending: {
      label: "รออนุมัติ",
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    inactive: {
      label: "ปิดใช้งาน",
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400",
    },
    suspended: {
      label: "ระงับการใช้งาน",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    },
  };

  const statusConfig = config[status as keyof typeof config] || config.inactive;

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold ${statusConfig.className}`}
    >
      {statusConfig.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const config = {
    super_admin: {
      label: "ผู้ดูแลระบบ",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    },
    admin: {
      label: "เจ้าของบริษัท",
      className:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    },
    supervisor: {
      label: "หัวหน้างาน",
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    },
    manager: {
      label: "ผู้จัดการสาขา",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    },
    employee: {
      label: "พนักงาน",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    staff: {
      label: "พนักงาน",
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400",
    },
  };

  const roleConfig = config[role as keyof typeof config] || config.staff;

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold ${roleConfig.className}`}
    >
      {roleConfig.label}
    </span>
  );
}
