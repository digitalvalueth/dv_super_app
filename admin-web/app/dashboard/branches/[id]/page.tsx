"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { Assignment, Branch, Product, User } from "@/types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Edit,
  Loader2,
  Mail,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  User as UserIcon,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UserWithAssignments extends User {
  assignments?: Assignment[];
}

export default function BranchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.id as string;
  const { userData } = useAuthStore();

  const [branch, setBranch] = useState<Branch | null>(null);
  const [users, setUsers] = useState<UserWithAssignments[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithAssignments | null>(
    null
  );
  const [assignmentForm, setAssignmentForm] = useState({
    productIds: [] as string[],
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [existingAssignment, setExistingAssignment] =
    useState<Assignment | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [assignedSearchTerm, setAssignedSearchTerm] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("employee");
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    if (!branchId || !userData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, userData]);

  const fetchData = async () => {
    if (!branchId) return;

    try {
      // Fetch branch
      const branchDoc = await getDoc(doc(db, "branches", branchId));
      if (!branchDoc.exists()) {
        toast.error("ไม่พบสาขา");
        router.push("/dashboard/branches");
        return;
      }

      const branchData = branchDoc.data();

      // Fetch company name
      let companyName = "";
      if (branchData.companyId) {
        const companyDoc = await getDoc(
          doc(db, "companies", branchData.companyId)
        );
        if (companyDoc.exists()) {
          companyName = companyDoc.data().name || "";
        }
      }

      setBranch({
        id: branchDoc.id,
        companyId: branchData.companyId,
        companyName: companyName,
        name: branchData.name,
        code: branchData.code,
        address: branchData.address,
        phone: branchData.phone,
        createdAt: branchData.createdAt?.toDate(),
      });

      const companyId = branchData.companyId;

      // Fetch users in this branch
      const usersQuery = query(
        collection(db, "users"),
        where("branchId", "==", branchId)
      );
      const usersSnapshot = await getDocs(usersQuery);

      const usersData: UserWithAssignments[] = [];
      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        usersData.push({
          id: docSnap.id,
          uid: data.uid,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          role: data.role || "employee",
          status: data.status || "active",
          companyId: data.companyId,
          branchId: data.branchId,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        });
      });

      // Fetch assignments for each user
      const assignmentsQuery = query(
        collection(db, "assignments"),
        where("branchId", "==", branchId)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);

      const assignmentsMap = new Map<string, Assignment[]>();
      assignmentsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const userId = data.userId;
        if (userId) {
          const existing = assignmentsMap.get(userId) || [];
          existing.push({
            id: docSnap.id,
            assignmentId: data.assignmentId || docSnap.id,
            companyId: data.companyId,
            branchId: data.branchId,
            userId: data.userId,
            productIds: data.productIds || [],
            month: data.month,
            year: data.year,
            status: data.status || "pending",
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          });
          assignmentsMap.set(userId, existing);
        }
      });

      // Attach assignments to users
      const usersWithAssignments = usersData.map((user) => ({
        ...user,
        assignments: assignmentsMap.get(user.id) || [],
      }));
      setUsers(usersWithAssignments);

      // Fetch products for this company
      let productsQuery;
      if (companyId) {
        productsQuery = query(
          collection(db, "products"),
          where("companyId", "==", companyId)
        );
      } else {
        productsQuery = query(collection(db, "products"));
      }

      const productsSnapshot = await getDocs(productsQuery);
      const productsData: Product[] = [];
      productsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        productsData.push({
          id: docSnap.id,
          productId: data.productId || data.sku || "",
          companyId: data.companyId,
          branchId: data.branchId,
          name: data.name,
          description: data.description,
          barcode: data.barcode,
          sellerCode: data.sellerCode,
          category: data.category,
          beforeCount: data.beforeCount,
          imageURL: data.imageURL,
          createdAt: data.createdAt?.toDate(),
        });
      });
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching branch data:", error);
      toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (
    user: UserWithAssignments,
    assignmentId?: string
  ) => {
    setSelectedUser(user);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // If editing specific assignment
    if (assignmentId) {
      const existing = user.assignments?.find((a) => a.id === assignmentId);
      if (existing) {
        setExistingAssignment(existing);
        setSelectedAssignmentId(assignmentId);
        setAssignmentForm({
          productIds: existing.productIds || [],
          month: existing.month,
          year: existing.year,
        });
      }
    } else {
      // Check if user already has assignment for current month/year
      const existing = user.assignments?.find(
        (a) => a.month === currentMonth && a.year === currentYear
      );

      if (existing) {
        setExistingAssignment(existing);
        setSelectedAssignmentId(existing.id);
        setAssignmentForm({
          productIds: existing.productIds || [],
          month: existing.month,
          year: existing.year,
        });
      } else {
        setExistingAssignment(null);
        setSelectedAssignmentId(null);
        setAssignmentForm({
          productIds: [],
          month: currentMonth,
          year: currentYear,
        });
      }
    }

    setProductSearchTerm("");
    setAssignedSearchTerm("");
    setShowAssignModal(true);
  };

  // Check if assignment exists for selected month/year
  const checkExistingAssignment = (month: number, year: number) => {
    if (!selectedUser) return;

    const existing = selectedUser.assignments?.find(
      (a) =>
        a.month === month && a.year === year && a.id !== selectedAssignmentId
    );

    if (existing) {
      toast.warning(`มีการมอบหมายงานสำหรับเดือนนี้แล้ว กำลังโหลดข้อมูล...`);
      setExistingAssignment(existing);
      setSelectedAssignmentId(existing.id);
      setAssignmentForm((prev) => ({
        ...prev,
        productIds: existing.productIds || [],
      }));
    } else if (
      selectedAssignmentId &&
      (month !== existingAssignment?.month || year !== existingAssignment?.year)
    ) {
      // Switching to a new month/year, clear selection
      setExistingAssignment(null);
      setSelectedAssignmentId(null);
      setAssignmentForm((prev) => ({
        ...prev,
        productIds: [],
      }));
    }
  };

  const handleAddProduct = (productId: string) => {
    if (!assignmentForm.productIds.includes(productId)) {
      setAssignmentForm((prev) => ({
        ...prev,
        productIds: [...prev.productIds, productId],
      }));
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setAssignmentForm((prev) => ({
      ...prev,
      productIds: prev.productIds.filter((id) => id !== productId),
    }));
  };

  const handleAddAllProducts = () => {
    const availableIds = availableProducts.map((p) => p.productId);
    setAssignmentForm((prev) => ({
      ...prev,
      productIds: [...new Set([...prev.productIds, ...availableIds])],
    }));
  };

  const handleRemoveAllProducts = () => {
    setAssignmentForm((prev) => ({
      ...prev,
      productIds: [],
    }));
  };

  // Products that are NOT yet assigned
  const availableProducts = products.filter(
    (p) =>
      !assignmentForm.productIds.includes(p.productId) &&
      (productSearchTerm === "" ||
        p.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        p.productId?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(productSearchTerm.toLowerCase()))
  );

  // Products that ARE assigned
  const assignedProducts = products.filter(
    (p) =>
      assignmentForm.productIds.includes(p.productId) &&
      (assignedSearchTerm === "" ||
        p.name?.toLowerCase().includes(assignedSearchTerm.toLowerCase()) ||
        p.productId?.toLowerCase().includes(assignedSearchTerm.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(assignedSearchTerm.toLowerCase()))
  );

  const handleSaveAssignment = async () => {
    if (!selectedUser || !branch) return;

    if (assignmentForm.productIds.length === 0) {
      toast.error("กรุณาเลือกอย่างน้อย 1 สินค้า");
      return;
    }

    setSubmitting(true);

    try {
      if (existingAssignment) {
        // Update existing
        await updateDoc(doc(db, "assignments", existingAssignment.id), {
          productIds: assignmentForm.productIds,
          month: assignmentForm.month,
          year: assignmentForm.year,
          updatedAt: serverTimestamp(),
        });
        toast.success("อัปเดตการมอบหมายสำเร็จ");
      } else {
        // Create new
        await addDoc(collection(db, "assignments"), {
          companyId: branch.companyId,
          branchId: branch.id,
          userId: selectedUser.id,
          productIds: assignmentForm.productIds,
          month: assignmentForm.month,
          year: assignmentForm.year,
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success("มอบหมายงานสำเร็จ");
      }

      setShowAssignModal(false);
      setSelectedUser(null);
      setExistingAssignment(null);
      setSelectedAssignmentId(null);
      fetchData();
    } catch (error) {
      console.error("Error saving assignment:", error);
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignment: Assignment) => {
    if (!confirm("คุณต้องการลบการมอบหมายนี้ใช่หรือไม่?")) return;

    try {
      await deleteDoc(doc(db, "assignments", assignment.id));
      toast.success("ลบการมอบหมายสำเร็จ");
      fetchData();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast.error("เกิดข้อผิดพลาดในการลบ");
    }
  };

  // ==================== Invite Employee ====================
  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("กรุณากรอกอีเมล");
      return;
    }

    if (!branch) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    setSendingInvite(true);

    try {
      // Check if user already exists
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", inviteEmail.toLowerCase().trim())
      );
      const usersSnapshot = await getDocs(usersQuery);

      let targetUserId: string | null = null;

      if (!usersSnapshot.empty) {
        // User exists - check if already in this branch
        const existingUser = usersSnapshot.docs[0];
        const existingUserData = existingUser.data();

        if (existingUserData.branchId === branchId) {
          toast.error("ผู้ใช้นี้อยู่ในสาขานี้แล้ว");
          setSendingInvite(false);
          return;
        }

        // Use uid field (Firebase Auth UID) for notifications
        targetUserId = existingUserData.uid || existingUser.id;
      }

      // Create invitation record
      const invitationData = {
        email: inviteEmail.toLowerCase().trim(),
        companyId: branch.companyId,
        branchId: branch.id,
        branchName: branch.name,
        role: inviteRole,
        status: "pending",
        invitedBy: userData?.id || "",
        invitedByName: userData?.displayName || userData?.email || "",
        targetUserId: targetUserId, // null if user doesn't exist yet
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      const inviteRef = await addDoc(
        collection(db, "invitations"),
        invitationData
      );

      // If user exists, send in-app notification
      if (targetUserId) {
        await addDoc(collection(db, "notifications"), {
          userId: targetUserId,
          type: "company_invite",
          title: "คำเชิญเข้าร่วมสาขา",
          message: `คุณได้รับคำเชิญให้เข้าร่วมสาขา ${branch.name}`,
          data: {
            invitationId: inviteRef.id,
            companyId: branch.companyId,
            companyName: branch.companyName || "",
            branchId: branch.id,
            branchName: branch.name,
            role: inviteRole,
            actionRequired: true,
            actionType: "accept_reject",
          },
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      // Send email invitation
      try {
        await fetch("/api/invitations/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: inviteEmail.toLowerCase().trim(),
            inviterName: userData?.displayName || userData?.email || "Admin",
            branchName: branch.name,
            role: inviteRole,
            invitationId: inviteRef.id,
          }),
        });
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't fail the whole operation if email fails
      }

      toast.success(
        targetUserId
          ? "ส่งคำเชิญสำเร็จ! ผู้ใช้จะได้รับการแจ้งเตือนในแอป"
          : "ส่งคำเชิญสำเร็จ! ระบบจะส่ง email เชิญให้ผู้ใช้"
      );

      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("employee");
    } catch (error) {
      console.error("Error sending invite:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งคำเชิญ");
    } finally {
      setSendingInvite(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            เสร็จสิ้น
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
            <Loader2 className="w-3 h-3" />
            กำลังดำเนินการ
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-full">
            <ClipboardList className="w-3 h-3" />
            รอดำเนินการ
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<
      string,
      { bg: string; text: string; label: string }
    > = {
      super_admin: {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-700 dark:text-purple-400",
        label: "Super Admin",
      },
      admin: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
        label: "Admin",
      },
      supervisor: {
        bg: "bg-orange-100 dark:bg-orange-900/30",
        text: "text-orange-700 dark:text-orange-400",
        label: "Supervisor",
      },
      manager: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400",
        label: "Manager",
      },
      employee: {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-400",
        label: "Employee",
      },
      staff: {
        bg: "bg-gray-100 dark:bg-gray-700",
        text: "text-gray-700 dark:text-gray-400",
        label: "Staff",
      },
    };
    const config = roleConfig[role] || roleConfig.staff;
    return (
      <span
        className={`px-2 py-1 ${config.bg} ${config.text} text-xs rounded-full`}
      >
        {config.label}
      </span>
    );
  };

  const getMonthName = (month: number) => {
    const months = [
      "มกราคม",
      "กุมภาพันธ์",
      "มีนาคม",
      "เมษายน",
      "พฤษภาคม",
      "มิถุนายน",
      "กรกฎาคม",
      "สิงหาคม",
      "กันยายน",
      "ตุลาคม",
      "พฤศจิกายน",
      "ธันวาคม",
    ];
    return months[month - 1];
  };

  // Get product by productId (SKU)
  const getProductById = (productId: string) => {
    return products.find((p) => p.productId === productId);
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

  if (!branch) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">ไม่พบข้อมูลสาขา</p>
        <Link
          href="/dashboard/branches"
          className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
        >
          กลับไปหน้าสาขา
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/branches"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            {branch.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            รายละเอียดสาขาและการมอบหมายงาน
          </p>
        </div>
      </div>

      {/* Branch Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                รหัสสาขา
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {branch.code || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ที่อยู่
              </p>
              <p className="font-medium text-gray-900 dark:text-white flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <span>{branch.address || "-"}</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                โทรศัพท์
              </p>
              <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{branch.phone || "-"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {users.length}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">พนักงาน</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {products.length}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              สินค้าทั้งหมด
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {users.reduce(
                (acc, u) =>
                  acc +
                  (u.assignments?.filter((a) => a.status === "completed")
                    .length || 0),
                0
              )}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              งานสำเร็จ
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {users.reduce(
                (acc, u) =>
                  acc +
                  (u.assignments?.filter((a) => a.status === "pending")
                    .length || 0),
                0
              )}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              รอดำเนินการ
            </p>
          </div>
        </div>
      </div>

      {/* Users Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                พนักงานในสาขา ({users.length} คน)
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาพนักงาน..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">เชิญพนักงาน</span>
              </button>
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shrink-0 relative overflow-hidden">
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || ""}
                      fill
                      className="rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-lg">
                      {user.displayName?.charAt(0) ||
                        user.email?.charAt(0) ||
                        "?"}
                    </span>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {user.displayName || user.email}
                    </p>
                    {getRoleBadge(user.role || "employee")}
                    {user.assignments && user.assignments.length > 0 && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                        {user.assignments.length} งาน
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openAssignModal(user)}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">มอบหมายงาน</span>
                  </button>
                  <button
                    onClick={() =>
                      setExpandedUser(expandedUser === user.id ? null : user.id)
                    }
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title={expandedUser === user.id ? "ซ่อนงาน" : "ดูงาน"}
                  >
                    {expandedUser === user.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Assignments */}
              {expandedUser === user.id && (
                <div className="mt-4 ml-16 space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    งานที่มอบหมาย ({user.assignments?.length || 0} รายการ)
                  </p>
                  {user.assignments && user.assignments.length > 0 ? (
                    user.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {getMonthName(assignment.month)}{" "}
                                {assignment.year + 543}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {assignment.productIds?.length || 0} สินค้า
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(assignment.status || "pending")}
                            <button
                              onClick={() =>
                                openAssignModal(user, assignment.id)
                              }
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="แก้ไข"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAssignment(assignment)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Show assigned products */}
                        <div className="flex flex-wrap gap-2">
                          {assignment.productIds
                            ?.slice(0, 5)
                            .map((productId) => {
                              const product = getProductById(productId);
                              return product ? (
                                <span
                                  key={productId}
                                  className="px-2 py-1 bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded border border-gray-200 dark:border-gray-500"
                                >
                                  {product.name}
                                </span>
                              ) : null;
                            })}
                          {(assignment.productIds?.length || 0) > 5 && (
                            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded">
                              +{(assignment.productIds?.length || 0) - 5} รายการ
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                      ยังไม่มีงานที่มอบหมาย
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              ไม่พบพนักงานในสาขานี้
            </p>
          </div>
        )}
      </div>

      {/* Assignment Modal - Large & User Friendly */}
      {showAssignModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-blue-600 to-purple-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center relative overflow-hidden">
                    {selectedUser.photoURL ? (
                      <Image
                        src={selectedUser.photoURL}
                        alt=""
                        fill
                        className="rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <UserIcon className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {existingAssignment
                        ? "แก้ไขการมอบหมายงาน"
                        : "มอบหมายงานใหม่"}
                    </h2>
                    <p className="text-white/80 text-sm">
                      {selectedUser.displayName || selectedUser.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedUser(null);
                    setExistingAssignment(null);
                    setSelectedAssignmentId(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Month/Year Selection */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ช่วงเวลา:
                  </span>
                </div>
                <div className="flex gap-3">
                  <select
                    value={assignmentForm.month}
                    onChange={(e) => {
                      const month = parseInt(e.target.value);
                      setAssignmentForm((prev) => ({ ...prev, month }));
                      checkExistingAssignment(month, assignmentForm.year);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getMonthName(i + 1)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignmentForm.year}
                    onChange={(e) => {
                      const year = parseInt(e.target.value);
                      setAssignmentForm((prev) => ({ ...prev, year }));
                      checkExistingAssignment(assignmentForm.month, year);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() + i - 1;
                      return (
                        <option key={year} value={year}>
                          พ.ศ. {year + 543}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {existingAssignment && (
                  <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-sm rounded-full">
                    กำลังแก้ไขงานเดิม
                  </span>
                )}
              </div>
            </div>

            {/* Main Content - Two Columns */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-700">
              {/* Left Column - Available Products */}
              <div className="flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Package className="w-5 h-5 text-gray-500" />
                      สินค้าที่ยังไม่ได้มอบหมาย
                      <span className="text-sm font-normal text-gray-500">
                        ({products.length - assignmentForm.productIds.length}{" "}
                        รายการ)
                      </span>
                    </h3>
                    <button
                      onClick={handleAddAllProducts}
                      className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      เพิ่มทั้งหมด
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาสินค้า..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {availableProducts.length > 0 ? (
                    <div className="space-y-1">
                      {availableProducts.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg group cursor-pointer"
                          onClick={() => handleAddProduct(product.productId)}
                        >
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden">
                            {product.imageURL ? (
                              <Image
                                src={product.imageURL}
                                alt=""
                                fill
                                className="rounded-lg object-cover"
                                unoptimized
                              />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {product.productId}{" "}
                              {product.category && `• ${product.category}`}
                            </p>
                          </div>
                          <button className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
                      <CheckCircle className="w-12 h-12 mb-2 text-green-500" />
                      <p>เพิ่มสินค้าทั้งหมดแล้ว!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Assigned Products */}
              <div className="flex flex-col overflow-hidden bg-blue-50/50 dark:bg-blue-900/10">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-blue-500" />
                      สินค้าที่มอบหมาย
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                        {assignmentForm.productIds.length}
                      </span>
                    </h3>
                    {assignmentForm.productIds.length > 0 && (
                      <button
                        onClick={handleRemoveAllProducts}
                        className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        ลบทั้งหมด
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาในรายการที่เลือก..."
                      value={assignedSearchTerm}
                      onChange={(e) => setAssignedSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {assignedProducts.length > 0 ? (
                    <div className="space-y-1">
                      {assignedProducts.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg group border border-blue-200 dark:border-blue-800"
                        >
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden">
                            {product.imageURL ? (
                              <Image
                                src={product.imageURL}
                                alt=""
                                fill
                                className="rounded-lg object-cover"
                                unoptimized
                              />
                            ) : (
                              <Package className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {product.productId}{" "}
                              {product.category && `• ${product.category}`}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              handleRemoveProduct(product.productId)
                            }
                            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
                      <ArrowLeft className="w-12 h-12 mb-2 text-gray-300 dark:text-gray-600" />
                      <p className="text-center">
                        คลิกที่สินค้าด้านซ้าย
                        <br />
                        เพื่อเพิ่มเข้ารายการ
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  เลือกแล้ว{" "}
                  <strong className="text-blue-600 dark:text-blue-400">
                    {assignmentForm.productIds.length}
                  </strong>{" "}
                  จาก {products.length} สินค้า
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedUser(null);
                      setExistingAssignment(null);
                      setSelectedAssignmentId(null);
                    }}
                    className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSaveAssignment}
                    disabled={
                      submitting || assignmentForm.productIds.length === 0
                    }
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 transition-colors"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {existingAssignment ? "บันทึกการแก้ไข" : "มอบหมายงาน"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Employee Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-green-600 to-emerald-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      เชิญพนักงานใหม่
                    </h2>
                    <p className="text-white/80 text-sm">{branch?.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setInviteRole("employee");
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Info Alert */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  ระบบจะส่งคำเชิญไปยังอีเมลที่ระบุ
                  หากผู้ใช้มีบัญชีอยู่แล้วจะได้รับการแจ้งเตือนในแอป
                </p>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  อีเมลพนักงาน <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="employee@example.com"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ตำแหน่ง
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                >
                  <option value="employee">พนักงาน (Employee)</option>
                  <option value="supervisor">หัวหน้างาน (Supervisor)</option>
                  <option value="admin">ผู้ดูแลสาขา (Admin)</option>
                </select>
              </div>

              {/* Notification Options */}
              <div className="pt-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  วิธีการแจ้งเตือน
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <input
                      type="checkbox"
                      defaultChecked
                      disabled
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <Mail className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      ส่ง Email เชิญ
                    </span>
                    <span className="ml-auto text-xs text-green-600 dark:text-green-400 font-medium">
                      ✓ พร้อมใช้งาน
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <input
                      type="checkbox"
                      defaultChecked
                      disabled
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <Send className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      In-App Notification (ถ้ามีบัญชี)
                    </span>
                    <span className="ml-auto text-xs text-green-600 dark:text-green-400 font-medium">
                      ✓ พร้อมใช้งาน
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setInviteRole("employee");
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={sendingInvite || !inviteEmail.trim()}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {sendingInvite ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  ส่งคำเชิญ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
