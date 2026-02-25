import { User } from "@/types";
import { User as FirebaseUser } from "firebase/auth";
import { create } from "zustand";

interface AuthState {
  user: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  // Active company context (used when user belongs to multiple companies)
  activeCompanyId: string | null;
  activeCompanyName: string | null;
  setUser: (user: FirebaseUser | null) => void;
  setUserData: (userData: User | null) => void;
  setLoading: (loading: boolean) => void;
  setActiveCompany: (id: string, name: string) => void;
  clearActiveCompany: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userData: null,
  loading: true,
  activeCompanyId: null,
  activeCompanyName: null,
  setUser: (user) => set({ user }),
  setUserData: (userData) => set({ userData }),
  setLoading: (loading) => set({ loading }),
  setActiveCompany: (id, name) =>
    set({ activeCompanyId: id, activeCompanyName: name }),
  clearActiveCompany: () =>
    set({ activeCompanyId: null, activeCompanyName: null }),
  logout: () =>
    set({
      user: null,
      userData: null,
      activeCompanyId: null,
      activeCompanyName: null,
    }),
}));
