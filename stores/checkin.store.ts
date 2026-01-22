import { CheckIn } from "@/types";
import { create } from "zustand";

interface CheckInState {
  // Today's status
  todayCheckIn: CheckIn | null;
  todayCheckOut: CheckIn | null;

  // History
  history: CheckIn[];

  // Loading states
  loading: boolean;
  submitting: boolean;
  error: string | null;

  // Actions
  setTodayCheckIn: (checkIn: CheckIn | null) => void;
  setTodayCheckOut: (checkOut: CheckIn | null) => void;
  setHistory: (history: CheckIn[]) => void;
  setLoading: (loading: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useCheckInStore = create<CheckInState>((set) => ({
  todayCheckIn: null,
  todayCheckOut: null,
  history: [],
  loading: false,
  submitting: false,
  error: null,

  setTodayCheckIn: (checkIn) => set({ todayCheckIn: checkIn }),

  setTodayCheckOut: (checkOut) => set({ todayCheckOut: checkOut }),

  setHistory: (history) => set({ history, loading: false }),

  setLoading: (loading) => set({ loading }),

  setSubmitting: (submitting) => set({ submitting }),

  setError: (error) => set({ error, loading: false, submitting: false }),

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      todayCheckIn: null,
      todayCheckOut: null,
      history: [],
      loading: false,
      submitting: false,
      error: null,
    }),
}));
