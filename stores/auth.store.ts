import { db } from "@/config/firebase";
import { getCurrentUser, onAuthStateChange } from "@/services/auth.service";
import { User } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";
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
  initialize: () => void;
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

  initialize: () => {
    set({ loading: true });

    try {
      let userUnsubscribe: (() => void) | null = null;

      // Listen to auth state changes
      onAuthStateChange(async (firebaseUser) => {
        if (firebaseUser) {
          console.log("🔐 User authenticated, setting up realtime listener...");

          // Setup realtime listener for user document
          const userDocRef = doc(db, "users", firebaseUser.uid);
          userUnsubscribe = onSnapshot(
            userDocRef,
            (docSnapshot) => {
              if (docSnapshot.exists()) {
                const userData = docSnapshot.data() as User;
                console.log("✅ User data updated:", userData.email);
                set({ user: userData, loading: false });
              } else {
                console.log("⚠️ User document doesn't exist");
                set({ user: null, loading: false });
              }
            },
            (error) => {
              console.error("❌ Error in user listener:", error);
              // Fallback to single fetch
              getCurrentUser().then((userData) => {
                set({ user: userData, loading: false });
              });
            }
          );
        } else {
          console.log("🔓 No authenticated user");
          // Cleanup user listener if exists
          if (userUnsubscribe) {
            userUnsubscribe();
            userUnsubscribe = null;
          }
          set({ user: null, loading: false });
        }
      });

      // Cleanup function (not returned, handled by store itself)
      // Store will call authUnsubscribe and userUnsubscribe when needed
    } catch (error: any) {
      console.error("❌ Auth initialization error:", error);
      set({ error: error.message, user: null, loading: false });
    }
  },

  logout: () => {
    set({ user: null, loading: false });
  },
}));
