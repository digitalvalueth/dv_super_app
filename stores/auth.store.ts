import { db } from "@/config/firebase";
import {
  getCurrentUser,
  onAuthStateChange,
  signOut,
} from "@/services/auth.service";
import { User } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";
import { create } from "zustand";

// Module-level timer so StrictMode double-invoke doesn't create multiple timers
let _notFoundRetryTimer: ReturnType<typeof setTimeout> | null = null;
let _isInitialized = false;

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isFirebaseAuthenticated: boolean; // Firebase Auth layer (not Firestore yet)
  isDeletingAccount: boolean; // suppress notFound timer during deletion

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  initialize: () => void;
  logout: () => void;
  setDeletingAccount: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  isFirebaseAuthenticated: false,
  isDeletingAccount: false,

  setUser: (user) => set({ user, loading: false }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clearError: () => set({ error: null }),

  setDeletingAccount: (value) => set({ isDeletingAccount: value }),

  initialize: () => {
    // Guard against StrictMode double-invoke creating duplicate listeners
    if (_isInitialized) return;
    _isInitialized = true;

    set({ loading: true });

    try {
      let userUnsubscribe: (() => void) | null = null;

      const cancelRetryTimer = () => {
        if (_notFoundRetryTimer) {
          clearTimeout(_notFoundRetryTimer);
          _notFoundRetryTimer = null;
        }
      };

      // Listen to auth state changes
      onAuthStateChange(async (firebaseUser) => {
        if (firebaseUser) {
          console.log("🔐 User authenticated, setting up realtime listener...");
          set({ isFirebaseAuthenticated: true });

          // Cancel any pending retry timer from previous listener
          cancelRetryTimer();

          // Unsubscribe previous listener before setting up a new one
          if (userUnsubscribe) {
            userUnsubscribe();
            userUnsubscribe = null;
          }

          // Setup realtime listener for user document
          const userDocRef = doc(db, "users", firebaseUser.uid);

          userUnsubscribe = onSnapshot(
            userDocRef,
            { includeMetadataChanges: true },
            (docSnapshot) => {
              if (docSnapshot.exists()) {
                const userData = docSnapshot.data() as User;
                console.log("✅ User data updated:", userData.email);
                // Cancel any pending "not-found" clear
                cancelRetryTimer();
                set({ user: userData, loading: false });
              } else if (!docSnapshot.metadata.fromCache) {
                // Server confirmed document doesn't exist.
                // Wait briefly — processAppleAuth / processGoogleAuth may still
                // be creating the document (race condition on first sign-in).
                // Only start timer if one isn't already running.
                if (_notFoundRetryTimer) return;
                console.log(
                  "⚠️ User document doesn't exist (server confirmed), retrying in 3s...",
                );
                _notFoundRetryTimer = setTimeout(() => {
                  _notFoundRetryTimer = null;
                  // Suppress if account deletion is in progress
                  if (get().isDeletingAccount) return;
                  // If document still hasn't appeared, sign out completely.
                  // Just set(user:null) is NOT enough — isFirebaseAuthenticated
                  // stays true and TabLayout returns null instead of redirecting.
                  getCurrentUser().then((userData) => {
                    if (!userData) {
                      console.log(
                        "⚠️ User document still missing, signing out",
                      );
                      signOut().catch(() => {});
                    }
                  });
                }, 3000);
              }
              // If fromCache && !exists: stay loading, wait for server response
            },
            (error) => {
              console.error("❌ Error in user listener:", error);
              // Fallback to single fetch
              getCurrentUser().then((userData) => {
                set({ user: userData, loading: false });
              });
            },
          );
        } else {
          console.log("🔓 No authenticated user");
          // Cancel any pending retry timer before clearing state
          cancelRetryTimer();
          set({ isFirebaseAuthenticated: false });
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
    set({
      user: null,
      loading: false,
      isFirebaseAuthenticated: false,
      isDeletingAccount: false,
    });
  },
}));
