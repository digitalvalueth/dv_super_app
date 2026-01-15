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
    branchId: "",
    status: "active" as "pending" | "active" | "inactive" | "suspended",
  });

  // ตรวจสอบว่าเป็น superadmin (ไม่มี companyId) หรือไม่
  const isSuperAdmin = !userData?.companyId;

  useEffect(() => {
    if (!userData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchData = async () => {
    if (!userData) return;

    try {
      const companyId = userData.companyId;

      // ถ้าเป็น superadmin (ไม่มี companyId) ดึงข้อมูลทั้งหมด
      // ถ้าไม่ใช่ ดึงเฉพาะ company ของตัวเอง
      let usersQuery;
      let branchesQuery;

      if (companyId) {
        usersQuery = query(
          collection(db, "users"),
          where("companyId", "==", companyId)
        );
        branchesQuery = query(
          collection(db, "branches"),
          where("companyId", "==", companyId)
        );
      } else {
        // Superadmin - ดึงทั้งหมด
        usersQuery = query(collection(db, "users"));
        branchesQuery = query(collection(db, "branches"));
      }

      // Fetch users
      const usersSnapshot = await getDocs(usersQuery);
      const usersData: User[] = [];
      const companiesMap = new Map<string, Company>();

      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        // เก็บข้อมูล company จาก user
        if (data.companyId && data.companyName) {
          companiesMap.set(data.companyId, {
            id: data.companyId,
            name: data.companyName,
            code: data.companyCode || "",
          });
        }

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
      setCompanies(Array.from(companiesMap.values()));

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
    (branch) => filterCompany === "all" || branch.companyId === filterCompany
  );

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      role: user.role || "employee",
      branchId: user.branchId || "",
      status: user.status || "active",
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const selectedBranch = branches.find((b) => b.id === editForm.branchId);

      await updateDoc(doc(db, "users", selectedUser.id), {
        name: editForm.name,
        role: editForm.role,
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
        newStatus === "active" ? "เปิดใช้งานผู้ใช้แล้ว" : "ปิดใช้งานผู้ใช้แล้ว"
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.status === "active"
                            ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        }`}
                        title={
                          user.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"
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
      {showEditModal && selectedUser && (
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
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

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
                >
                  <option value="">ไม่ระบุ</option>
                  {filteredBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
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
      )}

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
      label: "Super Admin",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    },
    admin: {
      label: "Admin",
      className:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    },
    supervisor: {
      label: "Supervisor",
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    },
    manager: {
      label: "Manager",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    },
    employee: {
      label: "Employee",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    staff: {
      label: "Staff",
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
