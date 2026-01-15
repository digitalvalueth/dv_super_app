"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { Branch, Product } from "@/types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Barcode, Edit2, Package, Plus, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  code: string;
}

export default function ProductsPage() {
  const { userData } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    productId: "",
    name: "",
    description: "",
    barcode: "",
    sellerCode: "",
    category: "",
    beforeCount: 0,
    companyId: "",
    branchId: "",
  });

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

      let productsQuery, branchesQuery;

      if (companyId) {
        productsQuery = query(
          collection(db, "products"),
          where("companyId", "==", companyId)
        );
        branchesQuery = query(
          collection(db, "branches"),
          where("companyId", "==", companyId)
        );
      } else {
        productsQuery = query(collection(db, "products"));
        branchesQuery = query(collection(db, "branches"));
      }

      // Fetch products
      const productsSnapshot = await getDocs(productsQuery);
      const productsData: Product[] = [];
      const categoriesSet = new Set<string>();
      const companiesMap = new Map<string, Company>();

      productsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.category) categoriesSet.add(data.category);

        // Collect companies
        if (data.companyId) {
          companiesMap.set(data.companyId, {
            id: data.companyId,
            name: data.companyName || "",
            code: data.companyCode || "",
          });
        }

        productsData.push({
          id: doc.id,
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
          updatedAt: data.updatedAt?.toDate(),
        });
      });

      setProducts(productsData);
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
          code: data.code,
          address: data.address,
          createdAt: data.createdAt?.toDate(),
        });
      });
      setBranches(branchesData);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("ไม่สามารถดึงข้อมูลสินค้าได้");
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === "all" || product.category === filterCategory;
    const matchesCompany =
      filterCompany === "all" || product.companyId === filterCompany;
    return matchesSearch && matchesCategory && matchesCompany;
  });

  const handleAddProduct = async () => {
    if (!userData || !formData.name.trim() || !formData.productId.trim()) {
      toast.error("กรุณากรอกรหัสสินค้าและชื่อสินค้า");
      return;
    }

    const targetCompanyId = isSuperAdmin
      ? formData.companyId
      : userData.companyId;

    if (!targetCompanyId) {
      toast.error("กรุณาเลือกบริษัท");
      return;
    }

    try {
      await addDoc(collection(db, "products"), {
        productId: formData.productId.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        barcode: formData.barcode.trim() || null,
        sellerCode: formData.sellerCode.trim() || null,
        category: formData.category.trim() || null,
        beforeCount: formData.beforeCount || 0,
        companyId: targetCompanyId,
        branchId: formData.branchId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("เพิ่มสินค้าสำเร็จ");
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("ไม่สามารถเพิ่มสินค้าได้");
    }
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      productId: product.productId || "",
      name: product.name,
      description: product.description || "",
      barcode: product.barcode || "",
      sellerCode: product.sellerCode || "",
      category: product.category || "",
      beforeCount: product.beforeCount || 0,
      companyId: product.companyId || "",
      branchId: product.branchId || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct || !formData.name.trim()) {
      toast.error("กรุณากรอกชื่อสินค้า");
      return;
    }

    try {
      await updateDoc(doc(db, "products", selectedProduct.id), {
        productId: formData.productId.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        barcode: formData.barcode.trim() || null,
        sellerCode: formData.sellerCode.trim() || null,
        category: formData.category.trim() || null,
        beforeCount: formData.beforeCount || 0,
        branchId: formData.branchId || null,
        updatedAt: serverTimestamp(),
      });

      toast.success("อัปเดตสินค้าสำเร็จ");
      setShowEditModal(false);
      setSelectedProduct(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("ไม่สามารถอัปเดตสินค้าได้");
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      await deleteDoc(doc(db, "products", selectedProduct.id));
      toast.success("ลบสินค้าสำเร็จ");
      setShowDeleteConfirm(false);
      setSelectedProduct(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("ไม่สามารถลบสินค้าได้");
    }
  };

  const resetForm = () => {
    setFormData({
      productId: "",
      name: "",
      description: "",
      barcode: "",
      sellerCode: "",
      category: "",
      beforeCount: 0,
      companyId: companies[0]?.id || "",
      branchId: "",
    });
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            จัดการสินค้า
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            จัดการสินค้าและรหัสสินค้าของบริษัท
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          เพิ่มสินค้า
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัส, บาร์โค้ด..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทุกหมวดหมู่</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {products.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                สินค้าทั้งหมด
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Barcode className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {categories.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                หมวดหมู่
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สินค้า
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  รหัส/บาร์โค้ด
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  หมวดหมู่
                </th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  จำนวนก่อนหน้า
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden">
                        {product.imageURL ? (
                          <Image
                            src={product.imageURL}
                            alt={product.name}
                            fill
                            className="rounded-lg object-cover"
                            unoptimized
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {product.description || "-"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <div>
                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                        {product.productId}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {product.barcode || "-"}
                      </p>
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4">
                    {product.category ? (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                        {product.category}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {product.beforeCount ?? "-"}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
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
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">ไม่พบสินค้า</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
            >
              เพิ่มสินค้าใหม่
            </button>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <ProductModal
          title="เพิ่มสินค้าใหม่"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleAddProduct}
          onClose={() => {
            setShowAddModal(false);
            resetForm();
          }}
          submitLabel="เพิ่มสินค้า"
          isSuperAdmin={isSuperAdmin}
          companies={companies}
          branches={branches}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProduct && (
        <ProductModal
          title="แก้ไขสินค้า"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleUpdateProduct}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
            resetForm();
          }}
          submitLabel="บันทึก"
          isSuperAdmin={isSuperAdmin}
          companies={companies}
          branches={branches}
          isEdit
        />
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              ยืนยันการลบ
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              คุณต้องการลบสินค้า <strong>{selectedProduct.name}</strong>{" "}
              ใช่หรือไม่?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedProduct(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteProduct}
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

// Product Modal Component
interface ProductModalProps {
  title: string;
  formData: {
    productId: string;
    name: string;
    description: string;
    barcode: string;
    sellerCode: string;
    category: string;
    beforeCount: number;
    companyId: string;
    branchId: string;
  };
  setFormData: React.Dispatch<
    React.SetStateAction<ProductModalProps["formData"]>
  >;
  onSubmit: () => void;
  onClose: () => void;
  submitLabel: string;
  isSuperAdmin: boolean;
  companies: Company[];
  branches: Branch[];
  isEdit?: boolean;
}

function ProductModal({
  title,
  formData,
  setFormData,
  onSubmit,
  onClose,
  submitLabel,
  isSuperAdmin,
  companies,
  branches,
  isEdit,
}: ProductModalProps) {
  const filteredBranches = branches.filter(
    (b) => !formData.companyId || b.companyId === formData.companyId
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h2>

        <div className="space-y-4">
          {/* Company selector for superadmin */}
          {isSuperAdmin && !isEdit && companies.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                บริษัท <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.companyId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    companyId: e.target.value,
                    branchId: "",
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">เลือกบริษัท</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                รหัสสินค้า <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.productId}
                onChange={(e) =>
                  setFormData({ ...formData, productId: e.target.value })
                }
                placeholder="เช่น SK-C-250"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                หมวดหมู่
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                placeholder="เช่น SK"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ชื่อสินค้า <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="ชื่อสินค้า"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              รายละเอียด
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={2}
              placeholder="รายละเอียดสินค้า..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                บาร์โค้ด
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) =>
                  setFormData({ ...formData, barcode: e.target.value })
                }
                placeholder="8859109897033"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                รหัสผู้ขาย
              </label>
              <input
                type="text"
                value={formData.sellerCode}
                onChange={(e) =>
                  setFormData({ ...formData, sellerCode: e.target.value })
                }
                placeholder="283160"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                จำนวนก่อนหน้า
              </label>
              <input
                type="number"
                value={formData.beforeCount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    beforeCount: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                สาขา (ถ้ามี)
              </label>
              <select
                value={formData.branchId}
                onChange={(e) =>
                  setFormData({ ...formData, branchId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">-- ไม่ระบุ --</option>
                {filteredBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ยกเลิก
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
