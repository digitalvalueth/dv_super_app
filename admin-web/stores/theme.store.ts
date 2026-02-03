import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "light",
      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === "light" ? "dark" : "light";
        console.log("Theme toggling from", currentTheme, "to", newTheme);

        // Apply to DOM immediately
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(newTheme);

        set({ theme: newTheme });
      },
      setTheme: (theme) => {
        console.log("Setting theme to:", theme);
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(theme);
        set({ theme });
      },
    }),
    {
      name: "super-fitt-theme",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
