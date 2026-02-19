"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { Product } from "@/types";
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
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Package,
  Search,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PendingProduct extends Product {
  id: string;
  createdByName?: string;
  createdBy?: string;
  createdAt?: Date;
  branchName?: string;
}

export default function PendingProductsPage() {
  const { userData } = useAuthStore();
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(
    null,
  );
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!userData) return;
    fetchPendingProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchPendingProducts = async () => {
    try {
      const companyId = userData?.companyId;

      let productsQuery;
      if (companyId) {
        productsQuery = query(
          collection(db, "products"),
          where("companyId", "==", companyId),
          where("status", "==", "pending_verification"),
        );
      } else {
        // Super admin - see all
        productsQuery = query(
          collection(db, "products"),
          where("status", "==", "pending_verification"),
        );
      }

      const snapshot = await getDocs(productsQuery);
      const productsData: PendingProduct[] = [];

      // Fetch branch names
      const branchesSnapshot = await getDocs(collection(db, "branches"));
      const branchMap = new Map<string, string>();
      branchesSnapshot.forEach((doc) => {
        branchMap.set(doc.id, doc.data().name);
      });

      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        productsData.push({
          id: doc.id,
          productId: data.productId,
          companyId: data.companyId,
          branchId: data.branchId,
          branchName: data.branchId ? branchMap.get(data.branchId) : undefined,
          sku: data.productId,
          name: data.name,
          description: data.description,
          barcode: data.barcode,
          category: data.category,
          series: data.series,
          imageUrl: data.imageUrl || data.imageURL,
          status: data.status,
          isUserCreated: data.isUserCreated,
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          createdAt: data.createdAt?.toDate(),
        });
      });

      // Sort by createdAt desc
      productsData.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching pending products:", error);
      toast.error("ไม่สามารถดึงข้อมูลสินค้าได้");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (product: PendingProduct) => {
    if (!userData) return;

    setProcessing(true);

    try {
      // Update product status
      await updateDoc(doc(db, "products", product.id), {
        status: "verified",
        verifiedBy: userData.uid,
        verifiedByName: userData.displayName || userData.email,
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Auto-assign to the employee who created it
      if (product.createdBy) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Check existing assignment
        const existingQuery = query(
          collection(db, "assignments"),
          where("userId", "==", product.createdBy),
          where("month", "==", currentMonth),
          where("year", "==", currentYear),
        );
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
          // Add to existing assignment
          const existingDoc = existingSnapshot.docs[0];
          const existingData = existingDoc.data();
          const productIds = existingData.productIds || [];

          if (!productIds.includes(product.productId)) {
            await updateDoc(doc(db, "assignments", existingDoc.id), {
              productIds: [...productIds, product.productId],
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          // Create new assignment
          await addDoc(collection(db, "assignments"), {
            companyId: product.companyId,
            branchId: product.branchId,
            userId: product.createdBy,
            productIds: [product.productId],
            month: currentMonth,
            year: currentYear,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      toast.success(
        `ยืนยันสินค้า "${product.name}" สำเร็จ และมอบหมายให้ ${product.createdByName} นับแล้ว`,
      );

      // Remove from list
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (error) {
      console.error("Error verifying product:", error);
      toast.error("ไม่สามารถยืนยันสินค้าได้");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProduct || !userData) return;

    setProcessing(true);

    try {
      await updateDoc(doc(db, "products", selectedProduct.id), {
        status: "rejected",
        rejectionReason: rejectReason || "ไม่พบในคลังสินค้า",
        verifiedBy: userData.uid,
        verifiedByName: userData.displayName || userData.email,
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success(`ปฏิเสธสินค้า "${selectedProduct.name}" แล้ว`);

      // Remove from list
      setProducts((prev) => prev.filter((p) => p.id !== selectedProduct.id));
      setShowRejectModal(false);
      setSelectedProduct(null);
      setRejectReason("");
    } catch (error) {
      console.error("Error rejecting product:", error);
      toast.error("ไม่สามารถปฏิเสธสินค้าได้");
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.productId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.createdByName?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/products"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">สินค้ารอตรวจสอบ</h1>
          <p className="text-gray-600 mt-1">
            สินค้าที่พนักงานเพิ่มเข้ามา รอตรวจสอบกับคลังสินค้า
          </p>
        </div>
        {products.length > 0 && (
          <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-full font-semibold">
            {products.length} รายการ
          </span>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า, รหัส, บาร์โค้ด, ชื่อพนักงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            ไม่มีสินค้ารอตรวจสอบ
          </h3>
          <p className="text-gray-500">
            สินค้าที่พนักงานเพิ่มจะแสดงที่นี่เพื่อรอการตรวจสอบจากคลัง
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Product Image */}
              <div className="aspect-square bg-gray-100 relative">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-16 h-16 text-gray-300" />
                  </div>
                )}
                {/* Status Badge */}
                <div className="absolute top-2 right-2 px-3 py-1 bg-orange-500 text-white text-sm rounded-full flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  รอตรวจสอบ
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    รหัส: {product.productId}
                  </p>
                  {product.barcode && (
                    <p className="text-sm text-gray-500">
                      Barcode: {product.barcode}
                    </p>
                  )}
                </div>

                {/* Added by */}
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                  <User className="w-4 h-4" />
                  <div>
                    <span className="font-medium">{product.createdByName}</span>
                    {product.branchName && (
                      <span className="text-gray-400">
                        {" "}
                        • {product.branchName}
                      </span>
                    )}
                    {product.createdAt && (
                      <p className="text-xs text-gray-400">
                        {format(product.createdAt, "dd MMM yyyy HH:mm", {
                          locale: th,
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category & Series */}
                <div className="flex flex-wrap gap-2">
                  {product.category && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {product.category}
                    </span>
                  )}
                  {product.series && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                      Series: {product.series}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleVerify(product)}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    ยืนยัน
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setShowRejectModal(true);
                    }}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    ปฏิเสธ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  ปฏิเสธสินค้า
                </h3>
                <p className="text-sm text-gray-500">{selectedProduct.name}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เหตุผลในการปฏิเสธ
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="เช่น ไม่พบสินค้าในคลัง, ข้อมูลไม่ถูกต้อง..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedProduct(null);
                  setRejectReason("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? "กำลังดำเนินการ..." : "ยืนยันปฏิเสธ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
