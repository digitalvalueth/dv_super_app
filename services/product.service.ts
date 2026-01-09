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
    console.log("🔍 Fetching assignments for user:", userId);

    // Get assignments for this user
    const assignmentsRef = collection(db, "assignments");
    const q = query(assignmentsRef, where("userId", "==", userId));
    const assignmentSnapshot = await getDocs(q);

    console.log("📋 Found assignments:", assignmentSnapshot.size);

    if (assignmentSnapshot.empty) {
      console.log("⚠️ No assignments found for user");
      return [];
    }

    const products: ProductWithAssignment[] = [];

    // For each assignment, get the assigned products
    for (const assignmentDoc of assignmentSnapshot.docs) {
      const assignment = assignmentDoc.data();
      const productIds = assignment.productIds || [];

      console.log(
        `📦 Processing ${productIds.length} products from assignment:`,
        assignment.assignmentId
      );

      // Get all products
      for (const productId of productIds) {
        try {
          // Query products by productId field
          const productsRef = collection(db, "products");
          const productQuery = query(
            productsRef,
            where("productId", "==", productId)
          );
          const productSnapshot = await getDocs(productQuery);

          if (!productSnapshot.empty) {
            const productDoc = productSnapshot.docs[0];
            const productData = productDoc.data();

            products.push({
              id: productDoc.id, // Document ID
              productId: productData.productId, // SK-C-250
              name: productData.name,
              sku: productData.productId,
              barcode: productData.barcode,
              description: productData.description,
              category: productData.category,
              companyId: productData.companyId,
              branchId: productData.branchId,
              imageUrl: productData.imageUrl,
              createdAt: productData.createdAt?.toDate() || new Date(),
              updatedAt: productData.updatedAt?.toDate() || new Date(),
              status: "pending", // Default status
              beforeCountQty: productData.beforeCount || 0,
            });
          } else {
            console.log(`⚠️ Product not found: ${productId}`);
          }
        } catch (error) {
          console.error(`❌ Error fetching product ${productId}:`, error);
        }
      }
    }

    console.log(`✅ Loaded ${products.length} products with assignments`);
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
