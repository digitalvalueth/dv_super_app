import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    // Pure-logic tests only — no jsdom/React rendering. Keep modules under
    // test free of next/react-native imports so this stays fast and simple.
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: { "@": root },
  },
});
