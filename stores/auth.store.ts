import { getCurrentUser, onAuthStateChange } from "@/services/auth.service";
import { User } from "@/types";
import { create } from "zustand";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  initialize: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user, loading: false }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clearError: () => set({ error: null }),

  initialize: async () => {
    set({ loading: true });

    try {
      // Listen to auth state changes
      const unsubscribe = onAuthStateChange(async (firebaseUser) => {
        if (firebaseUser) {
          console.log("🔐 User authenticated, fetching user data...");
          const userData = await getCurrentUser();
          set({ user: userData, loading: false });
        } else {
          console.log("🔓 No authenticated user");
          set({ user: null, loading: false });
        }
      });

      // Return unsubscribe function for cleanup
      return unsubscribe;
    } catch (error: any) {
      console.error("❌ Auth initialization error:", error);
      set({ error: error.message, user: null, loading: false });
    }
  },

  logout: () => {
    set({ user: null, loading: false });
  },
}));
