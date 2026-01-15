"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { Branch, Invitation } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Check, Clock, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function InvitationsPage() {
  const { userData } = useAuthStore();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    role: "staff" as "manager" | "staff",
    branchId: "",
  });

  useEffect(() => {
    if (!userData) return;
    fetchData();
  }, [userData]);

  const fetchData = async () => {
    if (!userData) return;

    try {
      const companyId = userData.companyId;

      // Fetch invitations
      const invitationsSnapshot = await getDocs(
        query(
          collection(db, "invitations"),
          where("companyId", "==", companyId)
        )
      );

      const invitationsData: Invitation[] = [];
      invitationsSnapshot.forEach((doc) => {
        const data = doc.data();
        invitationsData.push({
          id: doc.id,
          email: data.email,
          companyId: data.companyId,
          companyName: data.companyName,
          role: data.role,
          branchId: data.branchId,
          invitedBy: data.invitedBy,
          invitedByName: data.invitedByName,
          status: data.status,
          createdAt: data.createdAt?.toDate(),
          expiresAt: data.expiresAt?.toDate(),
        });
      });

      invitationsData.sort(
        (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      );
      setInvitations(invitationsData);

      // Fetch branches
      const branchesSnapshot = await getDocs(
        query(collection(db, "branches"), where("companyId", "==", companyId))
      );

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
      console.error("Error fetching data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userData) return;

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      // Get company name
      const companyDoc = await getDocs(
        query(
          collection(db, "companies"),
          where("__name__", "==", userData.companyId)
        )
      );
      let companyName = "บริษัท";
      if (!companyDoc.empty) {
        companyName = companyDoc.docs[0].data().name;
      }

      await addDoc(collection(db, "invitations"), {
        email: formData.email,
        companyId: userData.companyId,
        companyName,
        role: formData.role,
        branchId: formData.branchId || null,
        invitedBy: userData.id,
        invitedByName: userData.displayName,
        status: "pending",
        createdAt: serverTimestamp(),
        expiresAt,
      });

      toast.success("ส่งคำเชิญสำเร็จ");
      setShowInviteForm(false);
      setFormData({ email: "", role: "staff", branchId: "" });
      fetchData();
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("ส่งคำเชิญไม่สำเร็จ");
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm("ต้องการยกเลิกคำเชิญนี้?")) return;

    try {
      await updateDoc(doc(db, "invitations", invitationId), {
        status: "expired",
      });

      toast.success("ยกเลิกคำเชิญสำเร็จ");
      fetchData();
    } catch (error) {
      console.error("Error canceling invitation:", error);
      toast.error("ยกเลิกคำเชิญไม่สำเร็จ");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">เชิญผู้ใช้</h1>
          <p className="text-gray-600 mt-1">เชิญพนักงานเข้าร่วมบริษัท</p>
        </div>
        <button
          onClick={() => setShowInviteForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          ส่งคำเชิญใหม่
        </button>
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">ส่งคำเชิญ</h2>
            <form onSubmit={handleSendInvitation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  อีเมล
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  บทบาท
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as "manager" | "staff",
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="staff">พนักงาน</option>
                  <option value="manager">ผู้จัดการ</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สาขา (ถ้ามี)
                </label>
                <select
                  value={formData.branchId}
                  onChange={(e) =>
                    setFormData({ ...formData, branchId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- ไม่ระบุสาขา --</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  ส่งคำเชิญ
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-400 transition"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">คำเชิญทั้งหมด</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  อีเมล
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  บทบาท
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ผู้เชิญ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  วันที่เชิญ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invitations.map((invitation) => (
                <tr key={invitation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {invitation.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        invitation.role === "manager"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {invitation.role === "manager" ? "ผู้จัดการ" : "พนักงาน"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {invitation.branchId
                      ? branches.find((b) => b.id === invitation.branchId)
                          ?.name || "-"
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {invitation.invitedByName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {invitation.createdAt
                      ? format(invitation.createdAt, "dd MMM yyyy", {
                          locale: th,
                        })
                      : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={invitation.status} />
                  </td>
                  <td className="px-6 py-4">
                    {invitation.status === "pending" && (
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="text-red-600 hover:text-red-800 font-semibold text-sm"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: {
      label: "รอตอบรับ",
      icon: Clock,
      className: "bg-yellow-100 text-yellow-800",
    },
    accepted: {
      label: "ตอบรับแล้ว",
      icon: Check,
      className: "bg-green-100 text-green-800",
    },
    expired: {
      label: "หมดอายุ",
      icon: X,
      className: "bg-red-100 text-red-800",
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${config.className}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
