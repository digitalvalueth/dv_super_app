"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  Building2,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { userData } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    phoneNumber: "",
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || "",
        displayName: userData.displayName || "",
        phoneNumber: userData.phoneNumber || "",
      });

      // Fetch company name from Firestore
      const resolveCompanyName = async () => {
        // 1. Try companyId directly
        const cid = userData.companyId;
        if (cid) {
          const snap = await getDoc(doc(db, "companies", cid));
          if (snap.exists()) {
            setCompanyName(snap.data()?.name || "");
            return;
          }
        }
        // 2. Try branchId or first managedBranchId
        const bid = userData.branchId || userData.managedBranchIds?.[0];
        if (bid) {
          const branchSnap = await getDoc(doc(db, "branches", bid));
          if (branchSnap.exists()) {
            const branchData = branchSnap.data();
            if (branchData?.companyId) {
              const compSnap = await getDoc(
                doc(db, "companies", branchData.companyId),
              );
              if (compSnap.exists()) {
                setCompanyName(compSnap.data()?.name || "");
                return;
              }
            }
            if (branchData?.companyName) {
              setCompanyName(branchData.companyName);
              return;
            }
          }
        }
        // 3. Fallback to stored companyName on user doc
        if (userData.companyName) {
          setCompanyName(userData.companyName);
        }
      };
      resolveCompanyName().catch(console.error);
    }
  }, [userData]);

  const handleSave = async () => {
    if (!userData?.id) return;

    setLoading(true);
    try {
      const userRef = doc(db, "users", userData.id);
      await updateDoc(userRef, {
        name: formData.name,
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber,
      });

      toast.success("บันทึกข้อมูลเรียบร้อยแล้ว");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (userData) {
      setFormData({
        name: userData.name || "",
        displayName: userData.displayName || "",
        phoneNumber: userData.phoneNumber || "",
      });
    }
    setIsEditing(false);
  };

  const getRoleBadge = (role?: string) => {
    const roleConfig = {
      super_admin: {
        label: "ผู้ดูแลระบบ",
        color: "bg-purple-100 text-purple-700",
      },
      admin: { label: "เจ้าของบริษัท", color: "bg-blue-100 text-blue-700" },
      manager: { label: "ผู้จัดการสาขา", color: "bg-green-100 text-green-700" },
      employee: { label: "พนักงาน", color: "bg-gray-100 text-gray-700" },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || {
      label: role || "Unknown",
      color: "bg-gray-100 text-gray-700",
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${config.color}`}
      >
        <Shield className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status?: string) => {
    const statusConfig = {
      active: { label: "ใช้งานอยู่", color: "bg-green-100 text-green-700" },
      pending: { label: "รออนุมัติ", color: "bg-yellow-100 text-yellow-700" },
      inactive: { label: "ไม่ใช้งาน", color: "bg-red-100 text-red-700" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status || "Unknown",
      color: "bg-gray-100 text-gray-700",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-semibold ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  if (!userData) {
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
          <h1 className="text-3xl font-bold text-gray-900">โปรไฟล์</h1>
          <p className="text-gray-600 mt-1">จัดการข้อมูลส่วนตัวของคุณ</p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            แก้ไขข้อมูล
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-linear-to-r from-blue-500 to-purple-600"></div>

        {/* Profile Info */}
        <div className="p-6 -mt-16">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="bg-white rounded-full p-2 shadow-lg">
              <div className="bg-blue-100 rounded-full p-6">
                <UserCircle className="w-20 h-20 text-blue-600" />
              </div>
            </div>

            {/* Basic Info */}
            <div className="flex-1 mt-16">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {userData.name || userData.displayName || "ไม่ระบุชื่อ"}
                  </h2>
                  <p className="text-gray-600 mt-1">{userData.email}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  {getRoleBadge(userData.role)}
                  {getStatusBadge(userData.status)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            ข้อมูลส่วนตัว
          </h3>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อ-นามสกุล
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              ) : (
                <p className="text-gray-900">
                  {userData.name || (
                    <span className="text-gray-400">ไม่ระบุ</span>
                  )}
                </p>
              )}
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อที่แสดง
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="กรอกชื่อที่แสดง"
                />
              ) : (
                <p className="text-gray-900">
                  {userData.displayName || (
                    <span className="text-gray-400">ไม่ระบุ</span>
                  )}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 items-center gap-1">
                <Mail className="w-4 h-4" />
                อีเมล
              </label>
              <p className="text-gray-900">{userData.email}</p>
              <p className="text-xs text-gray-500 mt-1">
                ไม่สามารถเปลี่ยนอีเมลได้
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 items-center gap-1">
                <Phone className="w-4 h-4" />
                เบอร์โทรศัพท์
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="กรอกเบอร์โทรศัพท์"
                />
              ) : (
                <p className="text-gray-900">
                  {userData.phoneNumber || (
                    <span className="text-gray-400">ไม่ระบุ</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Organization Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            ข้อมูลองค์กร
          </h3>

          <div className="space-y-4">
            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                บริษัท
              </label>
              <p className="text-gray-900">
                {userData.role === "super_admin" ? (
                  <span className="text-purple-600 font-semibold">
                    ผู้ดูแลระบบ (ทุกบริษัท)
                  </span>
                ) : companyName ? (
                  <span className="font-medium">{companyName}</span>
                ) : (
                  <span className="text-gray-400">ไม่ระบุ</span>
                )}
              </p>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สาขา
              </label>
              <p className="text-gray-900">
                {userData.branchName || (
                  <span className="text-gray-400">ไม่ระบุ</span>
                )}
              </p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ตำแหน่ง
              </label>
              {getRoleBadge(userData.role)}
            </div>

            {/* Managed Branches (for managers) */}
            {userData.role === "manager" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สาขาที่ควบคุม
                </label>
                {userData.managedBranchIds &&
                userData.managedBranchIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {userData.managedBranchIds.map((branchId) => (
                      <span
                        key={branchId}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                      >
                        {branchId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">ยังไม่ได้กำหนด</p>
                )}
              </div>
            )}

            {/* User ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <p className="text-gray-600 text-sm font-mono">{userData.id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
