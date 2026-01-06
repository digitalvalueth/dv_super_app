import { CountingHistory, CountingSession } from "@/types";
import { create } from "zustand";

interface CountingState {
  currentSession: Partial<CountingSession> | null;
  history: CountingHistory[];
  loading: boolean;
  error: string | null;

  // Actions
  setCurrentSession: (session: Partial<CountingSession> | null) => void;
  setHistory: (history: CountingHistory[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearSession: () => void;
}

export const useCountingStore = create<CountingState>((set) => ({
  currentSession: null,
  history: [],
  loading: false,
  error: null,

  setCurrentSession: (session) => set({ currentSession: session }),

  setHistory: (history) => set({ history, loading: false }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clearError: () => set({ error: null }),

  clearSession: () => set({ currentSession: null }),
}));
