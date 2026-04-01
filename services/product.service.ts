import { db } from "@/config/firebase";
import { getEffectiveCountingPeriod } from "@/services/counting-period.service";
import { Product, ProductWithAssignment, UserAssignment } from "@/types";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
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
  productId: string,
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
  userId: string,
): Promise<UserAssignment[]> => {
  try {
    const assignmentsRef = collection(db, "userAssignments");
    const q = query(
      assignmentsRef,
      where("userId", "==", userId),
      orderBy("status", "asc"), // pending first
      orderBy("dueDate", "asc"),
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
  userId: string,
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
      const assignmentId = assignmentDoc.id; // Get assignment document ID
      const productIds = assignment.productIds || [];

      console.log(
        `📦 Processing ${productIds.length} products from assignment:`,
        assignmentId,
      );

      // Get all products
      for (const productId of productIds) {
        try {
          // Query products by productId field
          const productsRef = collection(db, "products");
          const productQuery = query(
            productsRef,
            where("productId", "==", productId),
          );
          const productSnapshot = await getDocs(productQuery);

          if (!productSnapshot.empty) {
            const productDoc = productSnapshot.docs[0];
            const productData = productDoc.data();

            // Debug: Log image fields
            console.log(`🖼️ Product ${productData.productId} image fields:`, {
              imageUrl: productData.imageUrl,
              imageURL: productData.imageURL,
              combined: productData.imageUrl || productData.imageURL,
            });

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
              // Support both imageUrl and imageURL for backward compatibility
              imageUrl: productData.imageUrl || productData.imageURL,
              createdAt: productData.createdAt?.toDate() || new Date(),
              updatedAt: productData.updatedAt?.toDate() || new Date(),
              status: "pending", // Default status
              assignmentStatus: assignment.status || "pending",
              beforeCountQty: productData.beforeCount || 0,
              // Include assignment info
              assignment: {
                id: assignmentId,
                userId: assignment.userId,
                productId: productData.productId,
                status: assignment.status || "pending",
              } as any,
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
  searchTerm: string,
): Promise<Product[]> => {
  try {
    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("companyId", "==", companyId),
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
        p.barcode.includes(term),
    );
  } catch (error) {
    console.error("Error searching products:", error);
    throw error;
  }
};

/**
 * Setup realtime listener for products with assignments
 * OPTIMIZED: Uses batch queries instead of individual product queries
 * Returns unsubscribe function
 */
export const subscribeToProductsWithAssignments = (
  userId: string,
  onUpdate: (products: ProductWithAssignment[]) => void,
  onError?: (error: Error) => void,
  companyId?: string,
): Unsubscribe => {
  console.log("🔔 Setting up realtime products listener for user:", userId);

  let assignmentUnsubscribe: Unsubscribe | null = null;
  let isDisposed = false;

  const initialize = async () => {
    try {
      const now = new Date();
      const fallbackHalf = now.getDate() <= 15 ? 1 : 2;
      const effectivePeriod = companyId
        ? await getEffectiveCountingPeriod(companyId, now, { userId })
        : null;

      const targetMonth = effectivePeriod?.month ?? now.getMonth() + 1;
      const targetYear = effectivePeriod?.year ?? now.getFullYear();
      const targetHalf = effectivePeriod?.half ?? fallbackHalf;

      if (isDisposed) return;

      console.log("📆 Loading assignments for period:", {
        month: targetMonth,
        year: targetYear,
        half: targetHalf,
        periodId: effectivePeriod?.periodId,
        isLateSubmission: effectivePeriod?.isLateSubmission ?? false,
        isTemporaryOverride: effectivePeriod?.isTemporaryOverride ?? false,
      });

      const assignmentsRef = collection(db, "assignments");
      const q = query(
        assignmentsRef,
        where("userId", "==", userId),
        where("month", "==", targetMonth),
        where("year", "==", targetYear),
        where("half", "==", targetHalf),
      );

      assignmentUnsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          console.log(`📋 Assignments updated: ${snapshot.size} items`);

          if (snapshot.empty) {
            console.log("⚠️ No assignments found");
            onUpdate([]);
            return;
          }

          const products: ProductWithAssignment[] = [];

          // Collect all product IDs and their assignment info
          const productAssignmentMap = new Map<
            string,
            {
              assignmentId: string;
              userId: string;
              isCompleted: boolean;
              isInProgress: boolean;
              isNotAvailable: boolean;
            }
          >();

          for (const assignmentDoc of snapshot.docs) {
            const assignment = assignmentDoc.data();
            const assignmentId = assignmentDoc.id;
            const productIds = assignment.productIds || [];
            const completedProductIds = assignment.completedProductIds || [];
            const inProgressProductIds = assignment.inProgressProductIds || [];
            const notAvailableProductIds =
              assignment.notAvailableProductIds || [];

            for (const productId of productIds) {
              productAssignmentMap.set(productId, {
                assignmentId,
                userId: assignment.userId,
                isCompleted: completedProductIds.includes(productId),
                isInProgress: inProgressProductIds.includes(productId),
                isNotAvailable: notAvailableProductIds.includes(productId),
              });
            }
          }

          // OPTIMIZED: Batch fetch products (max 30 per batch due to Firestore 'in' limit)
          const allProductIds = Array.from(productAssignmentMap.keys());
          const batchSize = 30;
          const batches = [];

          for (let i = 0; i < allProductIds.length; i += batchSize) {
            batches.push(allProductIds.slice(i, i + batchSize));
          }

          console.log(
            `📦 Fetching ${allProductIds.length} products in ${batches.length} batch(es)`,
          );

          for (const batch of batches) {
            try {
              const productsRef = collection(db, "products");
              const productQuery = query(
                productsRef,
                where("productId", "in", batch),
              );
              const productSnapshot = await getDocs(productQuery);

              for (const productDoc of productSnapshot.docs) {
                const productData = productDoc.data();

                // Filter by companyId to prevent cross-company duplicates
                if (
                  companyId &&
                  productData.companyId &&
                  productData.companyId !== companyId
                ) {
                  continue;
                }

                const assignmentInfo = productAssignmentMap.get(
                  productData.productId,
                );

                if (!assignmentInfo) continue;

                // Determine status
                let status:
                  | "pending"
                  | "in_progress"
                  | "completed"
                  | "not_available" = "pending";
                if (assignmentInfo.isCompleted) {
                  status = "completed";
                } else if (assignmentInfo.isNotAvailable) {
                  status = "not_available";
                } else if (assignmentInfo.isInProgress) {
                  status = "in_progress";
                }

                products.push({
                  id: productDoc.id,
                  productId: productData.productId,
                  name: productData.name,
                  sku: productData.productId,
                  barcode: productData.barcode,
                  description: productData.description,
                  category: productData.category,
                  companyId: productData.companyId,
                  branchId: productData.branchId,
                  imageUrl: productData.imageUrl || productData.imageURL,
                  createdAt: productData.createdAt?.toDate() || new Date(),
                  updatedAt: productData.updatedAt?.toDate() || new Date(),
                  status: status,
                  assignmentStatus: status,
                  beforeCountQty: productData.beforeCount || 0,
                  assignment: {
                    id: assignmentInfo.assignmentId,
                    userId: assignmentInfo.userId,
                    productId: productData.productId,
                    status: status,
                  } as any,
                });
              }
            } catch (error) {
              console.error(`❌ Error fetching product batch:`, error);
            }
          }

          console.log(`✅ Loaded ${products.length} products with assignments`);
          onUpdate(products);
        },
        (error) => {
          console.error("❌ Error in products listener:", error);
          if (onError) onError(error);
        },
      );
    } catch (error) {
      console.error("❌ Error resolving effective assignment period:", error);
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  };

  void initialize();

  return () => {
    isDisposed = true;
    if (assignmentUnsubscribe) {
      assignmentUnsubscribe();
    }
  };
};
