"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { Branch, Invitation } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
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
  const [showBulkInviteForm, setShowBulkInviteForm] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    role: "employee" as "manager" | "supervisor" | "employee",
    branchId: "",
    branchIds: [] as string[],
  });

  useEffect(() => {
    if (!userData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchData = async () => {
    if (!userData) return;

    try {
      const companyId = userData.companyId;

      // ถ้าเป็น superadmin (ไม่มี companyId) ดึงทั้งหมด
      let invitationsQuery, branchesQuery;
      if (companyId) {
        invitationsQuery = query(
          collection(db, "invitations"),
          where("companyId", "==", companyId),
        );
        branchesQuery = query(
          collection(db, "branches"),
          where("companyId", "==", companyId),
        );
      } else {
        invitationsQuery = query(collection(db, "invitations"));
        branchesQuery = query(collection(db, "branches"));
      }

      // Fetch invitations
      const invitationsSnapshot = await getDocs(invitationsQuery);

      const invitationsData: Invitation[] = [];
      invitationsSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        invitationsData.push({
          id: doc.id,
          email: data.email,
          companyId: data.companyId,
          companyName: data.companyName,
          role: data.role,
          branchId: data.branchId,
          managedBranchIds: data.managedBranchIds || [],
          invitedBy: data.invitedBy,
          invitedByName: data.invitedByName,
          status: data.status,
          createdAt: data.createdAt?.toDate(),
          expiresAt: data.expiresAt?.toDate(),
        });
      });

      invitationsData.sort(
        (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
      );
      setInvitations(invitationsData);

      // Fetch branches
      const branchesSnapshot = await getDocs(branchesQuery);

      const branchesMap = new Map<string, Branch>();
      branchesSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        if (!branchesMap.has(doc.id)) {
          branchesMap.set(doc.id, {
            id: doc.id,
            companyId: data.companyId,
            companyName: data.companyName || "",
            name:
              !companyId && data.companyName
                ? `${data.name} (${data.companyName})`
                : data.name,
            address: data.address,
            createdAt: data.createdAt?.toDate(),
          });
        }
      });
      const branchesData: Branch[] = Array.from(branchesMap.values());

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

    // Validate branch selection
    if (formData.role === "employee") {
      if (!formData.branchId) {
        toast.error("กรุณาเลือกสาขาสำหรับพนักงาน");
        return;
      }
    } else {
      // supervisor or manager
      if (formData.branchIds.length === 0) {
        toast.error("กรุณาเลือกอย่างน้อย 1 สาขา");
        return;
      }
    }

    try {
      // Derive companyId from selected branch (supports super admin with no companyId)
      const selectedBranchId =
        formData.role === "employee"
          ? formData.branchId
          : formData.branchIds[0];
      const selectedBranch = branches.find((b) => b.id === selectedBranchId);
      const effectiveCompanyId =
        userData.companyId || selectedBranch?.companyId || "";

      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const body: any = {
        email: formData.email,
        name: formData.email.split("@")[0],
        role: formData.role,
        companyId: effectiveCompanyId,
      };
      if (formData.role === "employee") {
        body.branchId = formData.branchId;
      } else {
        body.managedBranchIds = formData.branchIds;
      }

      const res = await fetch("/api/invitations/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "ส่งคำเชิญไม่สำเร็จ");
      }

      toast.success("ส่งคำเชิญและอีเมลสำเร็จ");
      setShowInviteForm(false);
      setFormData({ email: "", role: "employee", branchId: "", branchIds: [] });
      fetchData();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast.error(error.message || "ส่งคำเชิญไม่สำเร็จ");
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

  const handleBulkInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userData) return;

    // Validate branch selection
    if (formData.role === "employee") {
      if (!formData.branchId) {
        toast.error("กรุณาเลือกสาขาสำหรับพนักงาน");
        return;
      }
    } else {
      if (formData.branchIds.length === 0) {
        toast.error("กรุณาเลือกอย่างน้อย 1 สาขา");
        return;
      }
    }

    // Parse emails from textarea (one per line, comma-separated, or space-separated)
    const emailList = bulkEmails
      .split(/[\n,\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email && email.includes("@"));

    if (emailList.length === 0) {
      toast.error("กรุณากรอกอีเมลอย่างน้อย 1 อีเมล");
      return;
    }

    try {
      // Derive companyId from selected branch (supports super admin with no companyId)
      const selectedBranchId =
        formData.role === "employee"
          ? formData.branchId
          : formData.branchIds[0];
      const selectedBranch = branches.find((b) => b.id === selectedBranchId);
      const effectiveCompanyId =
        userData.companyId || selectedBranch?.companyId || "";

      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      toast.loading(`กำลังส่งคำเชิญ ${emailList.length} อีเมล...`);

      for (const email of emailList) {
        try {
          const body: any = {
            email,
            name: email.split("@")[0],
            role: formData.role,
            companyId: effectiveCompanyId,
          };
          if (formData.role === "employee") {
            body.branchId = formData.branchId;
          } else {
            body.managedBranchIds = formData.branchIds;
          }

          const res = await fetch("/api/invitations/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(body),
          });

          if (res.status === 409) {
            // Already exists (user or pending invitation)
            skipCount++;
          } else if (!res.ok) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Error sending invitation to ${email}:`, error);
          errorCount++;
        }
      }

      toast.dismiss();

      if (successCount > 0) {
        toast.success(
          `ส่งคำเชิญสำเร็จ ${successCount} อีเมล${skipCount > 0 ? ` (ข้าม ${skipCount} อีเมลที่มีอยู่แล้ว)` : ""}${errorCount > 0 ? ` (ล้มเหลว ${errorCount})` : ""}`,
        );
      } else {
        toast.warning(`ไม่มีอีเมลใหม่ที่จะส่ง (ข้าม ${skipCount} อีเมล)`);
      }

      setShowBulkInviteForm(false);
      setBulkEmails("");
      setFormData({ email: "", role: "employee", branchId: "", branchIds: [] });
      fetchData();
    } catch (error) {
      console.error("Error sending bulk invitations:", error);
      toast.dismiss();
      toast.error("เกิดข้อผิดพลาดในการส่งคำเชิญ");
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            เชิญผู้ใช้
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            เชิญพนักงานเข้าร่วมบริษัท
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkInviteForm(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            <Plus className="w-5 h-5" />
            ส่งคำเชิญแบบกลุ่ม
          </button>
          <button
            onClick={() => setShowInviteForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            ส่งคำเชิญใหม่
          </button>
        </div>
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              ส่งคำเชิญ
            </h2>
            <form onSubmit={handleSendInvitation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  อีเมล
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ตำแหน่ง
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as
                        | "manager"
                        | "supervisor"
                        | "employee",
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="employee">พนักงาน</option>
                  <option value="supervisor">ผู้ดูแลสาขา</option>
                  <option value="manager">ผู้จัดการสาขา</option>
                </select>
              </div>

              {/* Branch Selection */}
              {formData.role === "employee" ? (
                // Single branch for employee
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    สาขา <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.branchId}
                    onChange={(e) =>
                      setFormData({ ...formData, branchId: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- เลือกสาขา --</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                // Multiple branches for supervisor/manager
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    สาขาที่ดูแล <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">
                      (เลือกได้มากกว่า 1)
                    </span>
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 max-h-48 overflow-y-auto p-2">
                    {branches.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                        ไม่มีสาขา
                      </p>
                    ) : (
                      branches.map((branch) => (
                        <label
                          key={branch.id}
                          className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.branchIds.includes(branch.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  branchIds: [...formData.branchIds, branch.id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  branchIds: formData.branchIds.filter(
                                    (id) => id !== branch.id,
                                  ),
                                });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-900 dark:text-white">
                            {branch.name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {formData.branchIds.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      เลือกแล้ว {formData.branchIds.length} สาขา
                    </p>
                  )}
                </div>
              )}

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
                  className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Invite Form Modal */}
      {showBulkInviteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              ส่งคำเชิญแบบกลุ่ม
            </h2>
            <form onSubmit={handleBulkInvitation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  รายการอีเมล <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">
                    (ใส่อีเมลทีละบรรทัด คั่นด้วยจุลภาค หรือเว้นวรรค)
                  </span>
                </label>
                <textarea
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  required
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com, user4@example.com"
                />
                {bulkEmails && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    พบ{" "}
                    {
                      bulkEmails
                        .split(/[\n,\s]+/)
                        .filter((e) => e.trim() && e.includes("@")).length
                    }{" "}
                    อีเมล
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ตำแหน่ง
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as
                        | "manager"
                        | "supervisor"
                        | "employee",
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="employee">พนักงาน</option>
                  <option value="supervisor">ผู้ดูแลสาขา</option>
                  <option value="manager">ผู้จัดการสาขา</option>
                </select>
              </div>

              {/* Branch Selection */}
              {formData.role === "employee" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    สาขา <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.branchId}
                    onChange={(e) =>
                      setFormData({ ...formData, branchId: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">-- เลือกสาขา --</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    สาขาที่ดูแล <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">
                      (เลือกได้มากกว่า 1)
                    </span>
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 max-h-48 overflow-y-auto p-2">
                    {branches.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                        ไม่มีสาขา
                      </p>
                    ) : (
                      branches.map((branch) => (
                        <label
                          key={branch.id}
                          className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.branchIds.includes(branch.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  branchIds: [...formData.branchIds, branch.id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  branchIds: formData.branchIds.filter(
                                    (id) => id !== branch.id,
                                  ),
                                });
                              }
                            }}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-900 dark:text-white">
                            {branch.name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {formData.branchIds.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      เลือกแล้ว {formData.branchIds.length} สาขา
                    </p>
                  )}
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold mb-1">💡 หมายเหตุ:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>ระบบจะข้ามอีเมลที่มีอยู่ในระบบแล้ว</li>
                  <li>ระบบจะข้ามอีเมลที่มีคำเชิญค้างอยู่</li>
                  <li>อีเมลจะถูกส่งไปพร้อมกัน</li>
                </ul>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  ส่งคำเชิญทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkInviteForm(false);
                    setBulkEmails("");
                  }}
                  className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitations List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            คำเชิญทั้งหมด
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  อีเมล
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  บทบาท
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ผู้เชิญ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  วันที่เชิญ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {invitations.map((invitation) => (
                <tr
                  key={invitation.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {invitation.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        invitation.role === "manager"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                          : invitation.role === "supervisor"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}
                    >
                      {invitation.role === "manager"
                        ? "ผู้จัดการสาขา"
                        : invitation.role === "supervisor"
                          ? "ผู้ดูแลสาขา"
                          : "พนักงาน"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {invitation.role === "employee" ? (
                      // Employee: single branch
                      invitation.branchId ? (
                        branches.find((b) => b.id === invitation.branchId)
                          ?.name || "-"
                      ) : (
                        "-"
                      )
                    ) : // Supervisor/Manager: multiple branches
                    invitation.managedBranchIds &&
                      invitation.managedBranchIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {invitation.managedBranchIds.map((branchId) => {
                          const branch = branches.find(
                            (b) => b.id === branchId,
                          );
                          return branch ? (
                            <span
                              key={branchId}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                            >
                              {branch.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {invitation.invitedByName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
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
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold text-sm"
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
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    accepted: {
      label: "ตอบรับแล้ว",
      icon: Check,
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    expired: {
      label: "หมดอายุ",
      icon: X,
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
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
