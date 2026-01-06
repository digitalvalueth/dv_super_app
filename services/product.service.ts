import { db } from "@/config/firebase";
import { Product, ProductWithAssignment, UserAssignment } from "@/types";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

/**
 * Get all products for a company
 */
export const getProducts = async (companyId: string): Promise<Product[]> => {
  try {
    const productsRef = collection(db, "products");
    const q = query(productsRef, where("companyId", "==", companyId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data() as Product);
  } catch (error) {
    console.error("Error getting products:", error);
    throw error;
  }
};

/**
 * Get single product by ID
 */
export const getProductById = async (
  productId: string
): Promise<Product | null> => {
  try {
    const productDoc = await getDoc(doc(db, "products", productId));

    if (productDoc.exists()) {
      return productDoc.data() as Product;
    }

    return null;
  } catch (error) {
    console.error("Error getting product:", error);
    throw error;
  }
};

/**
 * Get user's assigned products (monthly counting list)
 */
export const getUserAssignedProducts = async (
  userId: string
): Promise<UserAssignment[]> => {
  try {
    const assignmentsRef = collection(db, "userAssignments");
    const q = query(
      assignmentsRef,
      where("userId", "==", userId),
      orderBy("status", "asc"), // pending first
      orderBy("dueDate", "asc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data() as UserAssignment);
  } catch (error) {
    console.error("Error getting user assignments:", error);
    throw error;
  }
};

/**
 * Get products with assignment status (combined data for UI)
 */
export const getProductsWithAssignments = async (
  userId: string
): Promise<ProductWithAssignment[]> => {
  try {
    // Get user assignments
    const assignments = await getUserAssignedProducts(userId);

    // Get product details
    const productIds = assignments.map((a) => a.productId);
    const products: ProductWithAssignment[] = [];

    for (const assignment of assignments) {
      const product = await getProductById(assignment.productId);

      if (product) {
        products.push({
          ...product,
          assignment,
          status: assignment.status,
          beforeCountQty: assignment.beforeCountQty,
          lastCountedAt: assignment.countedAt,
        });
      }
    }

    return products;
  } catch (error) {
    console.error("Error getting products with assignments:", error);
    throw error;
  }
};

/**
 * Search products by name or SKU
 */
export const searchProducts = async (
  companyId: string,
  searchTerm: string
): Promise<Product[]> => {
  try {
    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("companyId", "==", companyId)
      // Note: Firestore doesn't support full-text search
      // You'll need to implement this client-side or use Algolia
    );

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map((doc) => doc.data() as Product);

    // Client-side filter
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.barcode.includes(term)
    );
  } catch (error) {
    console.error("Error searching products:", error);
    throw error;
  }
};
