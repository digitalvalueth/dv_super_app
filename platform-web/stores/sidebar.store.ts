import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SidebarStore {
  collapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set, get) => ({
      collapsed: false,
      toggleSidebar: () => {
        set({ collapsed: !get().collapsed });
      },
      setCollapsed: (collapsed) => {
        set({ collapsed });
      },
    }),
    {
      name: "super-fitt-sidebar",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
