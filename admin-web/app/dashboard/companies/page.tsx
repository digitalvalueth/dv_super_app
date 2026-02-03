"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Building2,
  Edit2,
  Factory,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  code: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface CompanyWithStats extends Company {
  branchCount: number;
  userCount: number;
}

export default function CompaniesPage() {
  const { userData } = useAuthStore();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] =
    useState<CompanyWithStats | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
  });

  // ตรวจสอบว่าเป็น superadmin หรือไม่
  const isSuperAdmin = userData?.role === "super_admin";

  useEffect(() => {
    if (!userData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchData = async () => {
    if (!userData) return;

    try {
      // Fetch companies
      const companiesSnapshot = await getDocs(collection(db, "companies"));
      const companiesData: CompanyWithStats[] = [];

      // Fetch branches and users for counting
      const branchesSnapshot = await getDocs(collection(db, "branches"));
      const usersSnapshot = await getDocs(collection(db, "users"));

      const branchCountMap = new Map<string, number>();
      const userCountMap = new Map<string, number>();

      // Count branches per company
      branchesSnapshot.forEach((doc) => {
        const data = doc.data();
        const companyId = data.companyId;
        branchCountMap.set(companyId, (branchCountMap.get(companyId) || 0) + 1);
      });

      // Count users per company
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const companyId = data.companyId;
        if (companyId) {
          userCountMap.set(companyId, (userCountMap.get(companyId) || 0) + 1);
        }
      });

      companiesSnapshot.forEach((doc) => {
        const data = doc.data();
        companiesData.push({
          id: doc.id,
          name: data.name || "",
          code: data.code || "",
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          branchCount: branchCountMap.get(doc.id) || 0,
          userCount: userCountMap.get(doc.id) || 0,
        });
      });

      setCompanies(companiesData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      name: "",
      code: "",
    });
    setShowAddModal(true);
  };

  const handleEdit = (company: CompanyWithStats) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      code: company.code,
    });
    setShowEditModal(true);
  };

  const handleDelete = (company: CompanyWithStats) => {
    setSelectedCompany(company);
    setShowDeleteConfirm(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    try {
      // Check if code already exists
      const q = query(
        collection(db, "companies"),
        where("code", "==", formData.code.trim()),
      );
      const existingCompanies = await getDocs(q);

      if (!existingCompanies.empty) {
        toast.error("รหัสบริษัทนี้มีอยู่แล้ว");
        return;
      }

      await addDoc(collection(db, "companies"), {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("เพิ่มบริษัทเรียบร้อยแล้ว");
      setShowAddModal(false);
      fetchData();
    } catch (error) {
      console.error("Error adding company:", error);
      toast.error("เกิดข้อผิดพลาดในการเพิ่มบริษัท");
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompany || !formData.name.trim() || !formData.code.trim()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    try {
      // Check if new code already exists (excluding current company)
      const q = query(
        collection(db, "companies"),
        where("code", "==", formData.code.trim()),
      );
      const existingCompanies = await getDocs(q);
      const duplicate = existingCompanies.docs.find(
        (doc) => doc.id !== selectedCompany.id,
      );

      if (duplicate) {
        toast.error("รหัสบริษัทนี้มีอยู่แล้ว");
        return;
      }

      const companyRef = doc(db, "companies", selectedCompany.id);
      await updateDoc(companyRef, {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        updatedAt: serverTimestamp(),
      });

      toast.success("แก้ไขบริษัทเรียบร้อยแล้ว");
      setShowEditModal(false);
      setSelectedCompany(null);
      fetchData();
    } catch (error) {
      console.error("Error updating company:", error);
      toast.error("เกิดข้อผิดพลาดในการแก้ไขบริษัท");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedCompany) return;

    try {
      // Check if company has branches
      if (selectedCompany.branchCount > 0) {
        toast.error(
          `ไม่สามารถลบบริษัทได้ เนื่องจากมี ${selectedCompany.branchCount} สาขาที่เชื่อมโยงอยู่`,
        );
        return;
      }

      // Check if company has users
      if (selectedCompany.userCount > 0) {
        toast.error(
          `ไม่สามารถลบบริษัทได้ เนื่องจากมี ${selectedCompany.userCount} ผู้ใช้ที่เชื่อมโยงอยู่`,
        );
        return;
      }

      await deleteDoc(doc(db, "companies", selectedCompany.id));
      toast.success("ลบบริษัทเรียบร้อยแล้ว");
      setShowDeleteConfirm(false);
      setSelectedCompany(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error("เกิดข้อผิดพลาดในการลบบริษัท");
    }
  };

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto mt-12">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8">
            <div className="text-center">
              <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Factory className="w-8 h-8 text-red-600 dark:text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                ไม่มีสิทธิ์เข้าถึง
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                หน้านี้เฉพาะ <strong>ผู้ดูแลระบบ</strong> เท่านั้น
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">จัดการบริษัท</h1>
          <p className="text-gray-600 mt-1">
            จัดการรายชื่อบริษัทและรหัสของบริษัท
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          เพิ่มบริษัท
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อบริษัท, รหัส..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Factory className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">บริษัททั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">
                {companies.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">สาขาทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">
                {companies.reduce((sum, c) => sum + c.branchCount, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">ผู้ใช้ทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">
                {companies.reduce((sum, c) => sum + c.userCount, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ชื่อบริษัท
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  รหัสบริษัท
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  สาขา
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  ผู้ใช้
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  วันที่สร้าง
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Factory className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {searchTerm ? "ไม่พบบริษัทที่ค้นหา" : "ยังไม่มีบริษัท"}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={handleAdd}
                        className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        เพิ่มบริษัทใหม่
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Factory className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {company.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {company.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        {company.branchCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                        <Users className="w-4 h-4 text-gray-500" />
                        {company.userCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {company.createdAt
                        ? format(company.createdAt.toDate(), "d MMM yyyy", {
                            locale: th,
                          })
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(company)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(company)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                เพิ่มบริษัทใหม่
              </h2>
            </div>
            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อบริษัท <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="บริษัท ABC จำกัด"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสบริษัท <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ABC"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  ใช้ตัวอักษรภาษาอังกฤษ A-Z ไม่มีช่องว่าง
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  เพิ่มบริษัท
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">แก้ไขบริษัท</h2>
            </div>
            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อบริษัท <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสบริษัท <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCompany(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                ยืนยันการลบบริษัท
              </h3>
              <p className="text-gray-600 text-center mb-6">
                คุณต้องการลบบริษัท &quot;{selectedCompany.name}&quot;
                ใช่หรือไม่?
                <br />
                <span className="text-sm text-red-600">
                  การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </span>
              </p>

              {(selectedCompany.branchCount > 0 ||
                selectedCompany.userCount > 0) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ ไม่สามารถลบได้
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    บริษัทนี้มี {selectedCompany.branchCount} สาขา และ{" "}
                    {selectedCompany.userCount} ผู้ใช้
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedCompany(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={
                    selectedCompany.branchCount > 0 ||
                    selectedCompany.userCount > 0
                  }
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  ลบบริษัท
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
