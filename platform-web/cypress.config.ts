import { defineConfig } from "cypress";

// Cypress config for platform-web (Next.js 16 App Router).
//
// Two runners are configured:
//  - e2e: drives the running Next dev/prod server in a real browser.
//    Start the app first (`npm run dev`) then run `npm run cy:e2e`.
//  - component: mounts individual React components in isolation via the
//    Next.js dev-server bundler. No app server needed.
//
// `baseUrl` is read from CYPRESS_BASE_URL so the same specs can target a
// local dev server or a deployed environment (uat-app / app.fittbsa.com).
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
    fixturesFolder: "cypress/fixtures",
    // The app is auth-gated and talks to Firebase; default viewport mirrors a
    // typical desktop dashboard user.
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    retries: { runMode: 2, openMode: 0 },
  },

  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
    specPattern: "cypress/component/**/*.cy.{ts,tsx}",
    supportFile: "cypress/support/component.tsx",
    indexHtmlFile: "cypress/support/component-index.html",
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
  },
});
