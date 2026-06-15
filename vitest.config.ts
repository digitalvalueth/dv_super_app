import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    // Pure-logic tests only — no React Native / expo imports in modules under
    // test, so node env runs them without the RN/jest preset.
    environment: "node",
    include: ["{services,utils,lib,hooks,app}/**/*.{test,spec}.ts", "__tests__/**/*.{test,spec}.ts"],
    exclude: ["node_modules/**", "platform-web/**", "functions/**", "speech-to-text/**", "dist/**"],
  },
  resolve: {
    alias: { "@": root },
  },
});
