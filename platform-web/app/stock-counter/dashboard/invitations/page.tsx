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
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Check, Clock, Plus, UserCheck, UserX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function InvitationsPage() {
  const { userData } = useAuthStore();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supervisors, setSupervisors] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showBulkInviteForm, setShowBulkInviteForm] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [companyDisplayName, setCompanyDisplayName] = useState("");
  // Branch search states for combobox
  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchMultiSearch, setBranchMultiSearch] = useState("");
  // Supervisor search states for combobox
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    role: "employee" as "manager" | "supervisor" | "employee",
    branchId: "",
    branchIds: [] as string[],
    // Phithan fields
    baCode: "",
    fullName: "",
    supervisorId: "",
  });

  useEffect(() => {
    if (!userData) return;
    fetchData();

    // Fetch company display name
    if (userData.companyName) {
      setCompanyDisplayName(userData.companyName);
    } else if (userData.companyId) {
      getDoc(doc(db, "companies", userData.companyId)).then((snap) => {
        if (snap.exists()) setCompanyDisplayName(snap.data()?.name || "");
      });
    }
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

      const invitationsData: (Invitation & {
        baCode?: string;
        fullName?: string;
        supervisorId?: string;
        userId?: string;
        userStatus?: string;
      })[] = [];
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
          baCode: data.baCode || "",
          fullName: data.fullName || "",
          supervisorId: data.supervisorId || "",
        });
      });

      invitationsData.sort(
        (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
      );

      // ดึง user ที่ตอบรับ invitation แล้ว เพื่อหา status (active/inactive)
      const acceptedEmails = invitationsData
        .filter((inv) => inv.status === "accepted")
        .map((inv) => inv.email);
      if (acceptedEmails.length > 0) {
        // Firestore 'in' query รองบิลสูงสุด 30 ตัว — แบ่งเป็น chunk
        const userMap = new Map<string, { id: string; status: string }>();
        for (let i = 0; i < acceptedEmails.length; i += 30) {
          const chunk = acceptedEmails.slice(i, i + 30);
          const usersSnap = await getDocs(
            query(collection(db, "users"), where("email", "in", chunk)),
          );
          usersSnap.forEach((d) => {
            const u = d.data() as any;
            if (u.email) {
              userMap.set(u.email, {
                id: d.id,
                status: u.status || "active",
              });
            }
          });
        }
        invitationsData.forEach((inv) => {
          const u = userMap.get(inv.email);
          if (u) {
            inv.userId = u.id;
            inv.userStatus = u.status;
          }
        });
      }

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

      // Fetch supervisors (สำหรับ dropdown ตอนเชิญ employee)
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
      const supervisorsData: { id: string; name: string; email: string }[] = [];
      supervisorsSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        supervisorsData.push({
          id: data.uid || doc.id,
          name: data.fullName || data.name || data.displayName || data.email,
          email: data.email,
        });
      });
      setSupervisors(supervisorsData);
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
        name: formData.fullName.trim() || formData.email.split("@")[0],
        role: formData.role,
        companyId: effectiveCompanyId,
        baCode: formData.baCode.trim() || undefined,
        fullName: formData.fullName.trim() || undefined,
        supervisorId:
          formData.role === "employee" && formData.supervisorId
            ? formData.supervisorId
            : undefined,
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
      setFormData({
        email: "",
        role: "employee",
        branchId: "",
        branchIds: [],
        baCode: "",
        fullName: "",
        supervisorId: "",
      });
      setBranchSearch("");
      setBranchMultiSearch("");
      setShowBranchDropdown(false);
      setSupervisorSearch("");
      setShowSupervisorDropdown(false);
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

  const handleToggleUserStatus = async (
    userId: string,
    currentStatus: string,
  ) => {
    const next = currentStatus === "active" ? "inactive" : "active";
    const verb = next === "active" ? "เปิด" : "ปิด";
    if (!confirm(`ต้องการ${verb}การใช้งานบัญชีนี้?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), {
        status: next,
      });
      toast.success(`${verb}การใช้งานสำเร็จ`);
      fetchData();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("ไม่สามารถเปลี่ยนสถานะได้");
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
      setFormData({
        email: "",
        role: "employee",
        branchId: "",
        branchIds: [],
        baCode: "",
        fullName: "",
        supervisorId: "",
      });
      setBranchSearch("");
      setBranchMultiSearch("");
      setShowBranchDropdown(false);
      setSupervisorSearch("");
      setShowSupervisorDropdown(false);
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              ส่งคำเชิญ
            </h2>
            {(companyDisplayName || userData?.role === "super_admin") && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                คุณกำลังส่งคำเชิญเข้าร่วมบริษัท{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {userData?.companyName || "(ทุกบริษัท)"}
                </span>
              </p>
            )}
            <form onSubmit={handleSendInvitation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  อีเมล <span className="text-red-500">*</span>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    รหัส BA
                  </label>
                  <input
                    type="text"
                    value={formData.baCode}
                    onChange={(e) =>
                      setFormData({ ...formData, baCode: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="เช่น BA001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น สมชาย ใจดี"
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
                // Single branch for employee — searchable combobox
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    สาขา <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={
                        showBranchDropdown
                          ? branchSearch
                          : formData.branchId
                            ? branches.find((b) => b.id === formData.branchId)
                                ?.name || branchSearch
                            : branchSearch
                      }
                      onChange={(e) => {
                        setBranchSearch(e.target.value);
                        setFormData({ ...formData, branchId: "" });
                        setShowBranchDropdown(true);
                      }}
                      onFocus={() => setShowBranchDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowBranchDropdown(false), 150)
                      }
                      placeholder="พิมพ์เพื่อค้นหาสาขา..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {showBranchDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {branches.filter((b) =>
                          b.name
                            .toLowerCase()
                            .includes(branchSearch.toLowerCase()),
                        ).length === 0 ? (
                          <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            ไม่พบสาขา
                          </p>
                        ) : (
                          branches
                            .filter((b) =>
                              b.name
                                .toLowerCase()
                                .includes(branchSearch.toLowerCase()),
                            )
                            .map((branch) => (
                              <button
                                key={branch.id}
                                type="button"
                                onMouseDown={() => {
                                  setFormData({
                                    ...formData,
                                    branchId: branch.id,
                                  });
                                  setBranchSearch("");
                                  setShowBranchDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-600 ${
                                  formData.branchId === branch.id
                                    ? "bg-blue-50 dark:bg-blue-900/30 font-medium text-blue-600 dark:text-blue-400"
                                    : "text-gray-900 dark:text-white"
                                }`}
                              >
                                {branch.name}
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>
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
                  <div className="mb-1">
                    <input
                      type="text"
                      value={branchMultiSearch}
                      onChange={(e) => setBranchMultiSearch(e.target.value)}
                      placeholder="พิมพ์เพื่อกรองสาขา..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 max-h-48 overflow-y-auto p-2">
                    {branches.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                        ไม่มีสาขา
                      </p>
                    ) : (
                      branches
                        .filter((b) =>
                          b.name
                            .toLowerCase()
                            .includes(branchMultiSearch.toLowerCase()),
                        )
                        .map((branch) => (
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
                                    branchIds: [
                                      ...formData.branchIds,
                                      branch.id,
                                    ],
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

              {/* Supervisor dropdown — for employee only */}
              {formData.role === "employee" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supervisor (ผู้ดูแล)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={
                        showSupervisorDropdown
                          ? supervisorSearch
                          : formData.supervisorId
                            ? (() => {
                                const s = supervisors.find(
                                  (s) => s.id === formData.supervisorId,
                                );
                                return s
                                  ? `${s.name} (${s.email})`
                                  : supervisorSearch;
                              })()
                            : supervisorSearch
                      }
                      onChange={(e) => {
                        setSupervisorSearch(e.target.value);
                        setFormData({ ...formData, supervisorId: "" });
                        setShowSupervisorDropdown(true);
                      }}
                      onFocus={() => setShowSupervisorDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowSupervisorDropdown(false), 150)
                      }
                      placeholder="พิมพ์ชื่อหรืออีเมล Supervisor..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {showSupervisorDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        <button
                          type="button"
                          onMouseDown={() => {
                            setFormData({ ...formData, supervisorId: "" });
                            setSupervisorSearch("");
                            setShowSupervisorDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                          -- ไม่ระบุ --
                        </button>
                        {supervisors
                          .filter((s) => {
                            const q = supervisorSearch.toLowerCase();
                            return (
                              s.name.toLowerCase().includes(q) ||
                              s.email.toLowerCase().includes(q)
                            );
                          })
                          .map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={() => {
                                setFormData({
                                  ...formData,
                                  supervisorId: s.id,
                                });
                                setSupervisorSearch("");
                                setShowSupervisorDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-600 ${
                                formData.supervisorId === s.id
                                  ? "bg-blue-50 dark:bg-blue-900/30 font-medium text-blue-600 dark:text-blue-400"
                                  : "text-gray-900 dark:text-white"
                              }`}
                            >
                              <span className="font-medium">{s.name}</span>
                              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                ({s.email})
                              </span>
                            </button>
                          ))}
                        {supervisors.filter((s) => {
                          const q = supervisorSearch.toLowerCase();
                          return (
                            s.name.toLowerCase().includes(q) ||
                            s.email.toLowerCase().includes(q)
                          );
                        }).length === 0 && (
                          <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            ไม่พบ Supervisor
                          </p>
                        )}
                      </div>
                    )}
                  </div>
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              ส่งคำเชิญแบบกลุ่ม
            </h2>
            {(companyDisplayName || userData?.role === "super_admin") && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                คุณกำลังส่งคำเชิญเข้าร่วมบริษัท{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {companyDisplayName || "(ทุกบริษัท)"}
                </span>
              </p>
            )}
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
                // Single branch for employee — searchable combobox
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    สาขา <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={
                        showBranchDropdown
                          ? branchSearch
                          : formData.branchId
                            ? branches.find((b) => b.id === formData.branchId)
                                ?.name || branchSearch
                            : branchSearch
                      }
                      onChange={(e) => {
                        setBranchSearch(e.target.value);
                        setFormData({ ...formData, branchId: "" });
                        setShowBranchDropdown(true);
                      }}
                      onFocus={() => setShowBranchDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowBranchDropdown(false), 150)
                      }
                      placeholder="พิมพ์เพื่อค้นหาสาขา..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    {showBranchDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {branches.filter((b) =>
                          b.name
                            .toLowerCase()
                            .includes(branchSearch.toLowerCase()),
                        ).length === 0 ? (
                          <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            ไม่พบสาขา
                          </p>
                        ) : (
                          branches
                            .filter((b) =>
                              b.name
                                .toLowerCase()
                                .includes(branchSearch.toLowerCase()),
                            )
                            .map((branch) => (
                              <button
                                key={branch.id}
                                type="button"
                                onMouseDown={() => {
                                  setFormData({
                                    ...formData,
                                    branchId: branch.id,
                                  });
                                  setBranchSearch("");
                                  setShowBranchDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-purple-50 dark:hover:bg-gray-600 ${
                                  formData.branchId === branch.id
                                    ? "bg-purple-50 dark:bg-purple-900/30 font-medium text-purple-600 dark:text-purple-400"
                                    : "text-gray-900 dark:text-white"
                                }`}
                              >
                                {branch.name}
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    สาขาที่ดูแล <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">
                      (เลือกได้มากกว่า 1)
                    </span>
                  </label>
                  <div className="mb-1">
                    <input
                      type="text"
                      value={branchMultiSearch}
                      onChange={(e) => setBranchMultiSearch(e.target.value)}
                      placeholder="พิมพ์เพื่อกรองสาขา..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 max-h-48 overflow-y-auto p-2">
                    {branches.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                        ไม่มีสาขา
                      </p>
                    ) : (
                      branches
                        .filter((b) =>
                          b.name
                            .toLowerCase()
                            .includes(branchMultiSearch.toLowerCase()),
                        )
                        .map((branch) => (
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
                                    branchIds: [
                                      ...formData.branchIds,
                                      branch.id,
                                    ],
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
                  อีเมล / ชื่อ-สกุล
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  รหัสพนักงาน
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
              {invitations.map((invitation) => {
                const inv = invitation as typeof invitation & {
                  baCode?: string;
                  fullName?: string;
                  userId?: string;
                  userStatus?: string;
                };
                return (
                  <tr
                    key={invitation.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-6 py-4 text-sm">
                      <div className="text-gray-900 dark:text-gray-100">
                        {invitation.email}
                      </div>
                      {inv.fullName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {inv.fullName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-blue-600 dark:text-blue-400">
                      {inv.baCode || "-"}
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
                      {inv.userStatus === "inactive" && (
                        <span className="mt-1 inline-block px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          บัญชีถูกปิดใช้งาน
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {invitation.status === "pending" && (
                          <button
                            onClick={() =>
                              handleCancelInvitation(invitation.id)
                            }
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold text-sm"
                          >
                            ยกเลิก
                          </button>
                        )}
                        {invitation.status === "accepted" && inv.userId && (
                          <button
                            onClick={() =>
                              handleToggleUserStatus(
                                inv.userId!,
                                inv.userStatus || "active",
                              )
                            }
                            className={`flex items-center gap-1 text-sm font-semibold ${
                              inv.userStatus === "inactive"
                                ? "text-green-600 hover:text-green-800 dark:text-green-400"
                                : "text-orange-600 hover:text-orange-800 dark:text-orange-400"
                            }`}
                            title={
                              inv.userStatus === "inactive"
                                ? "เปิดใช้งานบัญชี"
                                : "ปิดใช้งานบัญชี"
                            }
                          >
                            {inv.userStatus === "inactive" ? (
                              <>
                                <UserCheck className="w-4 h-4" />
                                เปิดใช้งาน
                              </>
                            ) : (
                              <>
                                <UserX className="w-4 h-4" />
                                ปิดใช้งาน
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
