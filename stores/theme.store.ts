import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "theme-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Hook to get actual theme (resolves 'system' to light/dark)
export const useTheme = () => {
  const { mode } = useThemeStore();
  const systemColorScheme = useColorScheme();

  const isDark =
    mode === "dark" || (mode === "system" && systemColorScheme === "dark");

  return {
    mode,
    isDark,
    colors: isDark ? darkColors : lightColors,
  };
};

// Color palettes
export const lightColors = {
  background: "#f8f9fa",
  card: "#ffffff",
  text: "#1a1a1a",
  textSecondary: "#666666",
  border: "#e8e8e8",
  primary: "#4285f4",
  success: "#4caf50",
  warning: "#ff9800",
  error: "#f44336",
  overlay: "rgba(0, 0, 0, 0.5)",
};

export const darkColors = {
  background: "#121212",
  card: "#1e1e1e",
  text: "#ffffff",
  textSecondary: "#b0b0b0",
  border: "#2c2c2c",
  primary: "#5a9fff",
  success: "#66bb6a",
  warning: "#ffa726",
  error: "#ef5350",
  overlay: "rgba(0, 0, 0, 0.7)",
};
