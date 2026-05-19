"use client";

import { db } from "@/lib/firebase";
import { notifyBranchAssigned, notifyBranchRemoved } from "@/lib/notifications";
import { useAuthStore } from "@/stores/auth.store";
import { User } from "@/types";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Building2, Check, ChevronDown, ChevronRight, Edit2, Network, Search, Shield, UserCog, Users2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ActiveTab = "manager-supervisor" | "supervisor-branch";

interface Branch {
  id: string;
  name: string;
  code: string;
  companyId: string;
}

interface ManagerWithBranches extends User {
  managedBranches?: Branch[];
}

export default function ManagersPage() {
  const { userData } = useAuthStore();
  const [managers, setManagers] = useState<ManagerWithBranches[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManager, setSelectedManager] =
    useState<ManagerWithBranches | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("manager-supervisor");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Supervisor assignment modal (for Manager → Supervisor)
  const [showSupModal, setShowSupModal] = useState(false);
  const [selectedSupIds, setSelectedSupIds] = useState<string[]>([]);
  const [supModalSearch, setSupModalSearch] = useState("");

  const isSuperAdmin = userData?.role === "super_admin";
  const canManageManagers =
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
      console.log("Fetching managers data for:", { companyId, isSuperAdmin });

      // Fetch branches
      let branchesQuery;
      if (companyId) {
        branchesQuery = query(
          collection(db, "branches"),
          where("companyId", "==", companyId),
        );
      } else {
        branchesQuery = query(collection(db, "branches"));
      }

      const branchesSnapshot = await getDocs(branchesQuery);
      const branchesData: Branch[] = [];
      branchesSnapshot.forEach((doc) => {
        branchesData.push({
          id: doc.id,
          ...(doc.data() as any),
        } as Branch);
      });
      setBranches(branchesData);

      // Fetch managers + supervisors
      let managersQuery;
      if (companyId) {
        managersQuery = query(
          collection(db, "users"),
          where("companyId", "==", companyId),
          where("role", "in", ["supervisor", "manager"]),
        );
      } else {
        managersQuery = query(
          collection(db, "users"),
          where("role", "in", ["supervisor", "manager"]),
        );
      }

      const managersSnapshot = await getDocs(managersQuery);
      const managersData: ManagerWithBranches[] = [];

      managersSnapshot.forEach((doc) => {
        const data = doc.data() as User;
        const managerBranches = branchesData.filter((branch) =>
          data.managedBranchIds?.includes(branch.id),
        );

        managersData.push({
          ...data,
          id: doc.id,
          managedBranches: managerBranches,
        });
      });

      console.log("Managers fetched:", managersData.length);
      console.log("Branches fetched:", branchesData.length);

      setManagers(managersData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleEditBranches = (manager: ManagerWithBranches) => {
    setSelectedManager(manager);
    setSelectedBranchIds(manager.managedBranchIds || []);
    setModalSearchTerm("");
    setShowEditModal(true);
  };

  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
  };

  const handleSubmit = async () => {
    if (!selectedManager) return;

    try {
      const prevIds = selectedManager.managedBranchIds || [];
      const nextIds = selectedBranchIds;

      const userRef = doc(db, "users", selectedManager.id);
      await updateDoc(userRef, {
        managedBranchIds: nextIds,
      });

      // หา branch ที่เพิ่มใหม่และถูกถอดออก
      const addedIds = nextIds.filter((id) => !prevIds.includes(id));
      const removedIds = prevIds.filter((id) => !nextIds.includes(id));

      const getBranchName = (id: string) =>
        branches.find((b) => b.id === id)?.name || id;

      const actorName = userData?.name || userData?.email || "Admin";
      const actorId = userData?.id || "";
      const companyId = userData?.companyId;

      // ส่ง notification แบบ fire-and-forget
      if (addedIds.length > 0) {
        notifyBranchAssigned({
          managerId: selectedManager.id,
          managerName: selectedManager.name || "",
          branchNames: addedIds.map(getBranchName),
          actorId,
          actorName,
          companyId,
        }).catch(console.error);
      }
      if (removedIds.length > 0) {
        notifyBranchRemoved({
          managerId: selectedManager.id,
          removedBranchNames: removedIds.map(getBranchName),
          actorId,
          actorName,
          companyId,
        }).catch(console.error);
      }

      toast.success("อัปเดตสาขาที่ดูแลเรียบร้อยแล้ว");
      setShowEditModal(false);
      setSelectedManager(null);
      fetchData();
    } catch (error) {
      console.error("Error updating manager:", error);
      toast.error("เกิดข้อผิดพลาดในการอัปเดต");
    }
  };

  // ── Computed: split by role ──
  const onlyManagers = useMemo(() => managers.filter((m) => m.role === "manager"), [managers]);
  const onlySupervisors = useMemo(() => managers.filter((m) => m.role === "supervisor"), [managers]);

  const filteredManagers = managers.filter(
    (manager) =>
      manager.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Filter branches for current user's company
  const availableBranches = branches.filter((branch) =>
    isSuperAdmin ? true : branch.companyId === userData?.companyId,
  );

  // Filter branches in the modal by search term
  const filteredModalBranches = useMemo(() => {
    if (!modalSearchTerm.trim()) return availableBranches;
    const term = modalSearchTerm.toLowerCase();
    return availableBranches.filter(
      (b) =>
        b.name?.toLowerCase().includes(term) ||
        b.code?.toLowerCase().includes(term),
    );
  }, [availableBranches, modalSearchTerm]);

  // ── Tree helpers ──
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getSupervisorsForManager = (mgr: ManagerWithBranches) => {
    const ids = mgr.managedSupervisorIds || [];
    return onlySupervisors.filter((s) => ids.includes(s.uid || s.id));
  };

  const getBranchCountForManager = (mgr: ManagerWithBranches) => {
    const sups = getSupervisorsForManager(mgr);
    const allBranchIds = new Set<string>();
    sups.forEach((s) => s.managedBranchIds?.forEach((id) => allBranchIds.add(id)));
    return allBranchIds.size;
  };

  // Supervisors not assigned to any manager
  const unassignedSupervisors = useMemo(() => {
    const assignedIds = new Set<string>();
    onlyManagers.forEach((m) => m.managedSupervisorIds?.forEach((id) => assignedIds.add(id)));
    return onlySupervisors.filter((s) => !assignedIds.has(s.uid || s.id));
  }, [onlyManagers, onlySupervisors]);

  // ── Supervisor assignment modal handlers ──
  const handleEditSupervisors = (mgr: ManagerWithBranches) => {
    setSelectedManager(mgr);
    setSelectedSupIds(mgr.managedSupervisorIds || []);
    setSupModalSearch("");
    setShowSupModal(true);
  };

  const handleSubmitSupervisors = async () => {
    if (!selectedManager) return;
    try {
      const userRef = doc(db, "users", selectedManager.id);
      await updateDoc(userRef, { managedSupervisorIds: selectedSupIds });
      toast.success("อัปเดต Supervisor ที่ดูแลเรียบร้อย");
      setShowSupModal(false);
      setSelectedManager(null);
      fetchData();
    } catch (error) {
      console.error("Error updating supervisor assignments:", error);
      toast.error("เกิดข้อผิดพลาดในการอัปเดต");
    }
  };

  const filteredSupModalList = useMemo(() => {
    const term = supModalSearch.toLowerCase();
    const list = onlySupervisors;
    if (!term) return list;
    return list.filter(
      (s) => s.name?.toLowerCase().includes(term) || s.email?.toLowerCase().includes(term),
    );
  }, [onlySupervisors, supModalSearch]);

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

  // ตรวจสอบสิทธิ์ - เฉพาะ Admin และ Super Admin เท่านั้น
  if (!canManageManagers) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto mt-12">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8">
            <div className="text-center">
              <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Shield className="w-8 h-8 text-red-600 dark:text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                ไม่มีสิทธิ์เข้าถึง
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                หน้านี้เฉพาะ <strong>Admin</strong> และ{" "}
                <strong>Super Admin</strong> เท่านั้น
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


  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">จัดการทีมงาน</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">โครงสร้าง Manager → Supervisor → สาขา</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button onClick={() => setActiveTab("manager-supervisor")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "manager-supervisor" ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900"}`}>
          <Network className="w-4 h-4" />Manager → Supervisor
        </button>
        <button onClick={() => setActiveTab("supervisor-branch")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "supervisor-branch" ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900"}`}>
          <Building2 className="w-4 h-4" />Supervisor → สาขา
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="ค้นหาชื่อ, อีเมล..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: <UserCog className="w-6 h-6 text-purple-600" />, bg: "bg-purple-100 dark:bg-purple-900/30", label: "Manager", value: onlyManagers.length },
          { icon: <Shield className="w-6 h-6 text-green-600" />, bg: "bg-green-100 dark:bg-green-900/30", label: "Supervisor", value: onlySupervisors.length },
          { icon: <Building2 className="w-6 h-6 text-blue-600" />, bg: "bg-blue-100 dark:bg-blue-900/30", label: "สาขาทั้งหมด", value: availableBranches.length },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className={`${s.bg} p-3 rounded-lg`}>{s.icon}</div>
              <div><p className="text-sm text-gray-600 dark:text-gray-400">{s.label}</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Tab 1: Manager → Supervisor ═══ */}
      {activeTab === "manager-supervisor" && (
        <div className="space-y-3">
          {onlyManagers.filter((m) => m.name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.email?.toLowerCase().includes(searchTerm.toLowerCase())).map((mgr) => {
            const sups = getSupervisorsForManager(mgr);
            const branchCount = getBranchCountForManager(mgr);
            const isExp = expandedIds.has(mgr.id);
            return (
              <div key={mgr.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50" onClick={() => toggleExpand(mgr.id)}>
                  {isExp ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />}
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg shrink-0"><UserCog className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{mgr.fullName || mgr.name || mgr.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{mgr.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"><Users2 className="w-3.5 h-3.5" />{sups.length} Sup</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"><Building2 className="w-3.5 h-3.5" />{branchCount} สาขา</span>
                    <button onClick={(e) => { e.stopPropagation(); handleEditSupervisors(mgr); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="จัดการ Supervisor"><Edit2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {isExp && (
                  <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3 space-y-2">
                    {sups.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">ยังไม่ได้กำหนด Supervisor — กดปุ่ม ✏️ เพื่อเพิ่ม</p>
                    ) : sups.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-lg"><Shield className="w-4 h-4 text-green-600 dark:text-green-400" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.fullName || s.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.email}</p>
                        </div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{s.managedBranchIds?.length || 0} สาขา</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {onlyManagers.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <UserCog className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">ยังไม่มี Manager</p>
            </div>
          )}
          {/* Unassigned supervisors */}
          {unassignedSupervisors.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Supervisor อิสระ (ยังไม่ถูกกำหนดให้ Manager)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {unassignedSupervisors.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.fullName || s.name}</p><p className="text-xs text-gray-500 truncate">{s.email}</p></div>
                    <span className="text-xs text-amber-600 shrink-0 ml-auto">{s.managedBranchIds?.length || 0} สาขา</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab 2: Supervisor → สาขา ═══ */}
      {activeTab === "supervisor-branch" && (
        <div className="space-y-3">
          {onlySupervisors.filter((s) => s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.email?.toLowerCase().includes(searchTerm.toLowerCase())).map((sup) => {
            const isExp = expandedIds.has(sup.id);
            const supBranches = sup.managedBranches || [];
            return (
              <div key={sup.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50" onClick={() => toggleExpand(sup.id)}>
                  {isExp ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />}
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg shrink-0"><Shield className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{sup.fullName || sup.name || sup.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{sup.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shrink-0"><Building2 className="w-3.5 h-3.5" />{supBranches.length} สาขา</span>
                  <button onClick={(e) => { e.stopPropagation(); handleEditBranches(sup); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition shrink-0" title="จัดการสาขา"><Edit2 className="w-4 h-4" /></button>
                </div>
                {isExp && (
                  <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3">
                    {supBranches.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">ยังไม่ได้กำหนดสาขา</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">{supBranches.map((b) => (<span key={b.id} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">{b.name}</span>))}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {onlySupervisors.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">ยังไม่มี Supervisor</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Modal: Assign Supervisors to Manager ═══ */}
      {showSupModal && selectedManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">จัดการ Supervisor</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">สำหรับ {selectedManager.fullName || selectedManager.name}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="ค้นหา Supervisor..." value={supModalSearch} onChange={(e) => setSupModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                {filteredSupModalList.map((s) => {
                  const isSel = selectedSupIds.includes(s.uid || s.id);
                  return (
                    <button key={s.id} onClick={() => setSelectedSupIds((prev) => isSel ? prev.filter((id) => id !== (s.uid || s.id)) : [...prev, s.uid || s.id])}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${isSel ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-gray-200 dark:border-gray-600 hover:border-gray-300 bg-white dark:bg-gray-700"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSel ? "bg-green-100" : "bg-gray-100 dark:bg-gray-600"}`}><Shield className={`w-5 h-5 ${isSel ? "text-green-600" : "text-gray-500"}`} /></div>
                        <div className="text-left"><p className="font-semibold text-gray-900 dark:text-white">{s.fullName || s.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{s.email}</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600">{s.managedBranchIds?.length || 0} สาขา</span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSel ? "border-green-500 bg-green-500" : "border-gray-300"}`}>{isSel && <Check className="w-4 h-4 text-white" />}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">เลือกแล้ว: <span className="font-semibold">{selectedSupIds.length}</span> Supervisor</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowSupModal(false); setSelectedManager(null); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 transition">ยกเลิก</button>
                <button onClick={handleSubmitSupervisors} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal: Assign Branches to Supervisor ═══ */}
      {showEditModal && selectedManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">จัดการสาขาที่ดูแล</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedManager.fullName || selectedManager.name}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="ค้นหาสาขา..." value={modalSearchTerm} onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                {filteredModalBranches.map((branch) => {
                  const isSel = selectedBranchIds.includes(branch.id);
                  return (
                    <button key={branch.id} onClick={() => handleToggleBranch(branch.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${isSel ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-600 hover:border-gray-300 bg-white dark:bg-gray-700"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSel ? "bg-blue-100" : "bg-gray-100 dark:bg-gray-600"}`}><Building2 className={`w-5 h-5 ${isSel ? "text-blue-600" : "text-gray-500"}`} /></div>
                        <div className="text-left"><p className="font-semibold text-gray-900 dark:text-white">{branch.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{branch.code}</p></div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSel ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>{isSel && <Check className="w-4 h-4 text-white" />}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">เลือกแล้ว: <span className="font-semibold">{selectedBranchIds.length}</span> สาขา</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowEditModal(false); setSelectedManager(null); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 transition">ยกเลิก</button>
                <button onClick={handleSubmit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
