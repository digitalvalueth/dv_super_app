"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  Calendar,
  Check,
  Eye,
  FileText,
  MapPin,
  Package,
  Plus,
  Search,
  Truck,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ShipmentProduct {
  productId: string;
  productName: string;
  productSKU?: string;
  quantity: number;
  unit: string;
}

interface Shipment {
  id?: string;
  trackingNumber: string;
  companyId: string;
  branchId: string;
  branchName: string;
  products: ShipmentProduct[];
  totalItems: number;
  deliveryPersonName?: string;
  deliveryCompany?: string;
  deliveryPhone?: string;
  status: string;
  estimatedDelivery?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface DeliveryReceive {
  id?: string;
  shipmentId: string;
  trackingNumber: string;
  branchId: string;
  branchName: string;
  products: ShipmentProduct[];
  totalItems: number;
  receivedBy: string;
  receivedByName: string;
  receivedAt: string;
  imageUrl: string;
  watermarkData?: {
    timestamp?: string;
    location?: string;
    coordinates?: { latitude: number; longitude: number };
    employeeName?: string;
    employeeId?: string;
    deviceModel?: string;
  };
  notes?: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit?: string;
}

export default function DeliveryPage() {
  const { userData } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"shipments" | "receives">(
    "receives",
  );
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [receives, setReceives] = useState<DeliveryReceive[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceive, setSelectedReceive] =
    useState<DeliveryReceive | null>(null);
  const [filterDate, setFilterDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Mock shipment dialog
  const [showMockDialog, setShowMockDialog] = useState(false);
  const [mockBranchId, setMockBranchId] = useState("");
  const [mockBranchName, setMockBranchName] = useState("");
  const [mockProducts, setMockProducts] = useState<
    { productId: string; quantity: number }[]
  >([{ productId: "", quantity: 1 }]);
  const [isCreating, setIsCreating] = useState(false);

  // Branches for dropdown
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // Stats
  const [stats, setStats] = useState({
    totalShipments: 0,
    pendingShipments: 0,
    totalReceives: 0,
    todayReceives: 0,
  });

  useEffect(() => {
    if (!userData) return;
    fetchData();
    fetchProducts();
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, filterDate]);

  const fetchProducts = async () => {
    if (!userData) return;

    try {
      const companyId = userData.companyId;
      let productsQuery;

      if (companyId) {
        productsQuery = query(
          collection(db, "products"),
          where("companyId", "==", companyId),
        );
      } else {
        productsQuery = query(collection(db, "products"));
      }

      const snapshot = await getDocs(productsQuery);
      const productsData: Product[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({
          id: doc.id,
          name: data.name,
          sku: data.sku,
          unit: data.unit || "ชิ้น",
        });
      });

      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchBranches = async () => {
    if (!userData) return;

    try {
      const companyId = userData.companyId;
      let branchesQuery;

      if (companyId) {
        branchesQuery = query(
          collection(db, "branches"),
          where("companyId", "==", companyId),
        );
      } else {
        branchesQuery = query(collection(db, "branches"));
      }

      const snapshot = await getDocs(branchesQuery);
      const branchesData: { id: string; name: string }[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        branchesData.push({
          id: doc.id,
          name: data.name,
        });
      });

      setBranches(branchesData);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchData = async () => {
    if (!userData) return;

    try {
      setLoading(true);
      const companyId = userData.companyId;

      // Parse date
      const selectedDate = new Date(filterDate);
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch shipments
      let shipmentsQuery;
      if (companyId) {
        shipmentsQuery = query(
          collection(db, "shipments"),
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        );
      } else {
        shipmentsQuery = query(
          collection(db, "shipments"),
          orderBy("createdAt", "desc"),
        );
      }

      const shipmentsSnapshot = await getDocs(shipmentsQuery);
      const shipmentsData: Shipment[] = [];

      shipmentsSnapshot.forEach((doc) => {
        const data = doc.data();
        shipmentsData.push({
          id: doc.id,
          trackingNumber: data.trackingNumber,
          companyId: data.companyId,
          branchId: data.branchId,
          branchName: data.branchName,
          products: data.products || [],
          totalItems: data.totalItems || 0,
          deliveryPersonName: data.deliveryPersonName,
          deliveryCompany: data.deliveryCompany,
          deliveryPhone: data.deliveryPhone,
          status: data.status,
          estimatedDelivery: data.estimatedDelivery?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        });
      });

      setShipments(shipmentsData);

      // Fetch delivery receives for today
      let receivesQuery;
      if (companyId) {
        receivesQuery = query(
          collection(db, "deliveryReceives"),
          where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
          where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
          orderBy("createdAt", "desc"),
        );
      } else {
        receivesQuery = query(
          collection(db, "deliveryReceives"),
          where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
          where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
          orderBy("createdAt", "desc"),
        );
      }

      const receivesSnapshot = await getDocs(receivesQuery);
      const receivesData: DeliveryReceive[] = [];

      receivesSnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter by company if needed
        if (companyId && data.branchId) {
          // We can check branch belongs to company, but for now just include all
        }
        receivesData.push({
          id: doc.id,
          shipmentId: data.shipmentId,
          trackingNumber: data.trackingNumber,
          branchId: data.branchId,
          branchName: data.branchName,
          products: data.products || [],
          totalItems: data.totalItems || 0,
          receivedBy: data.receivedBy,
          receivedByName: data.receivedByName,
          receivedAt: data.receivedAt,
          imageUrl: data.imageUrl,
          watermarkData: data.watermarkData,
          notes: data.notes,
          status: data.status,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        });
      });

      setReceives(receivesData);

      // Calculate stats
      const pendingShipments = shipmentsData.filter(
        (s) => s.status === "pending" || s.status === "in_transit",
      );

      setStats({
        totalShipments: shipmentsData.length,
        pendingShipments: pendingShipments.length,
        totalReceives: receivesData.length,
        todayReceives: receivesData.length,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMockShipment = async () => {
    if (!mockBranchId || mockProducts.some((p) => !p.productId)) {
      toast.error("กรุณาเลือกสาขาและสินค้าให้ครบถ้วน");
      return;
    }

    try {
      setIsCreating(true);

      // Build products list
      const shipmentProducts: ShipmentProduct[] = mockProducts
        .filter((p) => p.productId)
        .map((p) => {
          const product = products.find((prod) => prod.id === p.productId);
          const shipmentProduct: ShipmentProduct = {
            productId: p.productId,
            productName: product?.name || "Unknown",
            quantity: p.quantity,
            unit: product?.unit || "ชิ้น",
          };
          // Only add SKU if it exists
          if (product?.sku) {
            shipmentProduct.productSKU = product.sku;
          }
          return shipmentProduct;
        });

      // Generate tracking number
      const trackingNumber = `TH${Date.now()}${Math.random().toString().slice(2, 6)}`;

      const newShipment = {
        trackingNumber,
        companyId: userData?.companyId || "",
        branchId: mockBranchId,
        branchName: mockBranchName,
        products: shipmentProducts,
        totalItems: shipmentProducts.reduce((sum, p) => sum + p.quantity, 0),
        deliveryPersonName: `พนักงานส่ง ${Math.floor(Math.random() * 100)}`,
        deliveryCompany: "Demo Logistics",
        deliveryPhone: `08${Math.floor(Math.random() * 100000000)
          .toString()
          .padStart(8, "0")}`,
        status: "in_transit",
        estimatedDelivery: Timestamp.fromDate(
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        ),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, "shipments"), newShipment);

      toast.success("สร้าง Mock Shipment สำเร็จ");
      setShowMockDialog(false);
      setMockBranchId("");
      setMockBranchName("");
      setMockProducts([{ productId: "", quantity: 1 }]);
      fetchData();
    } catch (error) {
      console.error("Error creating mock shipment:", error);
      toast.error("เกิดข้อผิดพลาดในการสร้าง Shipment");
    } finally {
      setIsCreating(false);
    }
  };

  const formatTime = (date: Date | undefined) => {
    if (!date) return "-";
    return format(date, "HH:mm", { locale: th });
  };

  const formatDateTime = (date: Date | undefined) => {
    if (!date) return "-";
    return format(date, "d MMM yyyy HH:mm", { locale: th });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
            รอจัดส่ง
          </span>
        );
      case "in_transit":
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
            กำลังจัดส่ง
          </span>
        );
      case "delivered":
        return (
          <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
            ส่งถึงแล้ว
          </span>
        );
      case "received":
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
            รับแล้ว
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 rounded-full">
            {status}
          </span>
        );
    }
  };

  // Filter data
  const filteredReceives = receives.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.trackingNumber?.toLowerCase().includes(term) ||
      r.branchName?.toLowerCase().includes(term) ||
      r.receivedByName?.toLowerCase().includes(term)
    );
  });

  const filteredShipments = shipments.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.trackingNumber?.toLowerCase().includes(term) ||
      s.branchName?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            กำลังโหลดข้อมูล...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            รับสินค้า
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            จัดการการรับสินค้าและติดตามพัสดุ
          </p>
        </div>
        <button
          onClick={() => setShowMockDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          สร้าง Mock Shipment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalShipments}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                พัสดุทั้งหมด
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.pendingShipments}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">รอรับ</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.todayReceives}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                รับวันนี้
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalReceives}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                รับทั้งหมด
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("receives")}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "receives"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            รายการรับสินค้า
          </button>
          <button
            onClick={() => setActiveTab("shipments")}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "shipments"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            พัสดุทั้งหมด
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              วันที่
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ค้นหา Tracking, สาขา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Receives Table */}
      {activeTab === "receives" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Tracking
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    สาขา
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    ผู้รับ
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    จำนวน
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    เวลา
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    ดำเนินการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredReceives.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                      <p>ไม่พบข้อมูลการรับสินค้า</p>
                    </td>
                  </tr>
                ) : (
                  filteredReceives.map((receive) => (
                    <tr
                      key={receive.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {receive.trackingNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {receive.branchName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {receive.receivedByName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {receive.totalItems} ชิ้น
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {formatTime(receive.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <button
                            onClick={() => setSelectedReceive(receive)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          >
                            <Eye className="w-5 h-5" />
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
      )}

      {/* Shipments Table */}
      {activeTab === "shipments" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Tracking
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    สาขา
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    จำนวน
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    ผู้จัดส่ง
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    สถานะ
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    สร้างเมื่อ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      <Truck className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                      <p>ไม่พบข้อมูลพัสดุ</p>
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((shipment) => (
                    <tr
                      key={shipment.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {shipment.trackingNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shipment.branchName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shipment.totalItems} ชิ้น
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shipment.deliveryPersonName ||
                            shipment.deliveryCompany}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(shipment.status)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {formatDateTime(shipment.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receive Detail Modal */}
      {selectedReceive && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  รายละเอียดการรับสินค้า
                </h2>
                <button
                  onClick={() => setSelectedReceive(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Tracking */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <Package className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-sm text-blue-600">Tracking Number</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {selectedReceive.trackingNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Image */}
              {selectedReceive.imageUrl && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    รูปภาพหลักฐาน
                  </h3>
                  <div className="relative aspect-video rounded-xl overflow-hidden">
                    <Image
                      src={selectedReceive.imageUrl}
                      alt="Delivery receive"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    สาขา
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedReceive.branchName}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ผู้รับ
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedReceive.receivedByName}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    เวลา
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDateTime(selectedReceive.createdAt)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    จำนวนรวม
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedReceive.totalItems} ชิ้น
                  </p>
                </div>
              </div>

              {/* Products */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  รายการสินค้า
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
                  {selectedReceive.products.map((product, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {product.productName}
                        </p>
                        {product.productSKU && (
                          <p className="text-sm text-gray-500">
                            SKU: {product.productSKU}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold text-blue-600">
                        {product.quantity} {product.unit}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location */}
              {selectedReceive.watermarkData?.location && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    ตำแหน่ง
                  </h3>
                  <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
                    <p className="text-gray-700 dark:text-gray-300">
                      {selectedReceive.watermarkData.location}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedReceive.notes && (
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        หมายเหตุ
                      </p>
                      <p className="text-amber-800 dark:text-amber-300">
                        {selectedReceive.notes}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mock Shipment Dialog */}
      {showMockDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  สร้าง Mock Shipment
                </h2>
                <button
                  onClick={() => setShowMockDialog(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Branch Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    สาขา
                  </label>
                  <select
                    value={mockBranchId}
                    onChange={(e) => {
                      setMockBranchId(e.target.value);
                      const branch = branches.find(
                        (b) => b.id === e.target.value,
                      );
                      setMockBranchName(branch?.name || "");
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">เลือกสาขา</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Products */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    สินค้า
                  </label>
                  <div className="space-y-2">
                    {mockProducts.map((mp, index) => (
                      <div key={index} className="flex gap-2">
                        <select
                          value={mp.productId}
                          onChange={(e) => {
                            const updated = [...mockProducts];
                            updated[index].productId = e.target.value;
                            setMockProducts(updated);
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="">เลือกสินค้า</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={mp.quantity}
                          onChange={(e) => {
                            const updated = [...mockProducts];
                            updated[index].quantity =
                              parseInt(e.target.value) || 1;
                            setMockProducts(updated);
                          }}
                          min={1}
                          className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        {mockProducts.length > 1 && (
                          <button
                            onClick={() => {
                              setMockProducts(
                                mockProducts.filter((_, i) => i !== index),
                              );
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      setMockProducts([
                        ...mockProducts,
                        { productId: "", quantity: 1 },
                      ])
                    }
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    + เพิ่มสินค้า
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowMockDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleCreateMockShipment}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isCreating ? "กำลังสร้าง..." : "สร้าง Shipment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
