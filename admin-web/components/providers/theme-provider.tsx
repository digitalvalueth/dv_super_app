"use client";

import { useThemeStore } from "@/stores/theme.store";
import { useEffect, useState } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Get theme from localStorage or use system preference
    const storedTheme = localStorage.getItem("super-fitt-theme");
    let initialTheme: "light" | "dark" = "light";

    if (storedTheme) {
      try {
        const parsed = JSON.parse(storedTheme);
        initialTheme = parsed.state?.theme || "light";
      } catch (e) {
        console.error("Error parsing theme:", e);
      }
    } else {
      // Check system preference
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        initialTheme = "dark";
      }
    }

    console.log("Initial theme on mount:", initialTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(initialTheme);

    // Update store if different
    const currentTheme = useThemeStore.getState().theme;
    if (currentTheme !== initialTheme) {
      useThemeStore.getState().setTheme(initialTheme);
    }
  }, []);

  // Listen to theme changes from store
  useEffect(() => {
    if (!mounted) return;

    const unsubscribe = useThemeStore.subscribe((state) => {
      console.log("Theme changed to:", state.theme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(state.theme);
    });

    return () => unsubscribe();
  }, [mounted]);

  return <>{children}</>;
}
