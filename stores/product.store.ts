import { Product, ProductWithAssignment } from "@/types";
import { create } from "zustand";

interface ProductState {
  products: ProductWithAssignment[];
  selectedProduct: Product | null;
  loading: boolean;
  error: string | null;

  // Actions
  setProducts: (products: ProductWithAssignment[]) => void;
  setSelectedProduct: (product: Product | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  updateProductStatus: (
    productId: string,
    status: "pending" | "in_progress" | "completed"
  ) => void;
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  selectedProduct: null,
  loading: false,
  error: null,

  setProducts: (products) => set({ products, loading: false }),

  setSelectedProduct: (product) => set({ selectedProduct: product }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clearError: () => set({ error: null }),

  updateProductStatus: (productId, status) =>
    set((state) => ({
      products: state.products.map((p) =>
        p.id === productId ? { ...p, status } : p
      ),
    })),
}));
