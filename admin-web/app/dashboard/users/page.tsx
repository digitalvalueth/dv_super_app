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
  Search,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  code: string;
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
  const [editForm, setEditForm] = useState({
    name: "",
    role: "employee" as
      | "super_admin"
      | "admin"
      | "supervisor"
      | "manager"
      | "employee"
      | "staff",
    companyId: "",
    branchId: "",
    status: "active" as "pending" | "active" | "inactive" | "suspended",
  });

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

      // Fetch users
      const usersSnapshot = await getDocs(usersQuery);
      const usersData: User[] = [];

      usersSnapshot.forEach((doc) => {
        const data = doc.data();

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
          branchName: data.branchName || "",
          photoURL: data.photoURL,
          status: data.status,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        });
      });
      setUsers(usersData);

      // Fetch companies - ดึงจาก collection companies โดยตรง (เฉพาะ Super Admin)
      if (isSuperAdmin) {
        const companiesSnapshot = await getDocs(collection(db, "companies"));
        const companiesData: Company[] = [];
        companiesSnapshot.forEach((doc) => {
          const data = doc.data();
          companiesData.push({
            id: doc.id,
            name: data.name,
            code: data.code,
          });
        });
        setCompanies(companiesData);
      }

      // Fetch branches
      const branchesSnapshot = await getDocs(branchesQuery);
      const branchesData: Branch[] = [];
      branchesSnapshot.forEach((doc) => {
        const data = doc.data();
        branchesData.push({
          id: doc.id,
          companyId: data.companyId,
          name: data.name,
          address: data.address,
          createdAt: data.createdAt?.toDate(),
        });
      });
      setBranches(branchesData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("ไม่สามารถดึงข้อมูลผู้ใช้ได้");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || user.status === filterStatus;
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesCompany =
      filterCompany === "all" || user.companyId === filterCompany;
    return matchesSearch && matchesStatus && matchesRole && matchesCompany;
  });

  // กรอง branches ตาม company ที่เลือก
  const filteredBranches = branches.filter(
    (branch) => filterCompany === "all" || branch.companyId === filterCompany,
  );

  // กรอง branches สำหรับ edit modal ตามบริษัทที่เลือก
  const editModalBranches = branches.filter(
    (branch) => !editForm.companyId || branch.companyId === editForm.companyId,
  );

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      role: user.role || "employee",
      companyId: user.companyId || "",
      branchId: user.branchId || "",
      status: user.status || "active",
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const selectedBranch = branches.find((b) => b.id === editForm.branchId);
      const selectedCompany = companies.find(
        (c) => c.id === editForm.companyId,
      );

      await updateDoc(doc(db, "users", selectedUser.id), {
        name: editForm.name,
        role: editForm.role,
        companyId: editForm.companyId || null,
        companyName: selectedCompany?.name || null,
        companyCode: selectedCompany?.code || null,
        branchId: editForm.branchId || null,
        branchName: selectedBranch?.name || null,
        status: editForm.status,
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
            <option value="staff">Staff</option>
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
                        {user.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {user.name}
                        </p>
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
                    {user.branchName || "-"}
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
            ? [
                "super_admin",
                "admin",
                "supervisor",
                "manager",
                "employee",
                "staff",
              ]
            : ["manager", "supervisor", "employee", "staff"];

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  แก้ไขผู้ใช้
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ชื่อ
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      บทบาท
                    </label>
                    {isEditingSelf ? (
                      <div>
                        <div className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                          {editForm.role === "super_admin" && "ผู้ดูแลระบบ"}
                          {editForm.role === "admin" && "เจ้าของบริษัท"}
                          {editForm.role === "supervisor" && "หัวหน้างาน"}
                          {editForm.role === "manager" && "ผู้จัดการสาขา"}
                          {editForm.role === "employee" && "พนักงาน"}
                          {editForm.role === "staff" && "พนักงาน"}
                        </div>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                          ⚠️ ไม่สามารถเปลี่ยนบทบาทของตัวเองได้
                        </p>
                      </div>
                    ) : (
                      <select
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            role: e.target.value as
                              | "super_admin"
                              | "admin"
                              | "supervisor"
                              | "manager"
                              | "employee"
                              | "staff",
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                        {allowedRoles.includes("staff") && (
                          <option value="staff">พนักงาน</option>
                        )}
                      </select>
                    )}
                    {!isEditingSelf && !isSuperAdmin && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        💡 เจ้าของบริษัทสามารถจัดการได้เฉพาะ ผู้จัดการสาขา,
                        หัวหน้างาน, พนักงาน
                      </p>
                    )}
                  </div>

                  {/* Company selector - แสดงเฉพาะ Super Admin */}
                  {isSuperAdmin && companies.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        บริษัท
                      </label>
                      <select
                        value={editForm.companyId}
                        onChange={(e) => {
                          setEditForm({
                            ...editForm,
                            companyId: e.target.value,
                            branchId: "", // รีเซ็ตสาขาเมื่อเปลี่ยนบริษัท
                          });
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">ไม่ระบุ (Super Admin)</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        💡 Admin/Manager ต้องมีบริษัท
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      สาขา
                    </label>
                    <select
                      value={editForm.branchId}
                      onChange={(e) =>
                        setEditForm({ ...editForm, branchId: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={!editForm.companyId && isSuperAdmin}
                    >
                      <option value="">ไม่ระบุ</option>
                      {editModalBranches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    {isSuperAdmin && !editForm.companyId && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        เลือกบริษัทก่อนเพื่อดูสาขา
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      สถานะ
                    </label>
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
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="active">ใช้งาน</option>
                      <option value="pending">รออนุมัติ</option>
                      <option value="inactive">ปิดใช้งาน</option>
                      <option value="suspended">ระงับการใช้งาน</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedUser(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleUpdateUser}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
