# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FITT BSA — a multi-tenant retail operations platform for พิธาน (Phithan). It started as an AI stock-counting app and grew into a "super app." The repo is a single Git repo containing **four independent apps** that share one Firebase backend (project `fittbsa`):

| App | Path | Stack | Purpose |
|-----|------|-------|---------|
| Mobile super-app | repo root (`app/`, `services/`, `stores/`) | Expo / React Native (expo-router) | Field staff: stock counting, check-in, delivery receiving, daily sales |
| Platform web | `platform-web/` | Next.js 16 App Router (Cloud Run) | Vendor-center dashboards, super-admin, reports, ERP integration. **Most active area.** |
| Cloud Functions | `functions/` | Firebase Functions (Node 20, TS) | Scheduled auto-assign, missing-checkin alerts, account-deletion cascade |
| Speech-to-text | `speech-to-text/` | Standalone Expo app | Voice utility (separate, rarely touched) |

`admin-web/` is **legacy** (only a stale `.next/` build output remains, no `package.json`) — superseded by `platform-web`. Don't extend it.

Each app has its **own `package.json` and `node_modules`** — there is no workspace/monorepo tooling. Run npm commands from inside the relevant app directory.

The README.md is partially outdated (describes the original single-purpose counting app, not the current super-app structure).

## Commands

Run from the **app directory**, not repo root (except the mobile app, which is the root).

**Mobile app (repo root):**
```bash
npm start              # expo start (dev server)
npm run ios            # expo run:ios
npm run android        # expo run:android
npm run lint           # expo lint
npm run seed           # tsx scripts/seed-data.ts  (also seed:companies/branches/products)
npm run copy:prod      # copy data dev → prod
```

**Platform web (`cd platform-web`):**
```bash
npm run dev            # next dev
npm run build          # next build
npm run lint           # eslint
npm run migrate:fix-image-urls
npm run migrate:phithan-eod-branch-codes
```

**Cloud Functions (`cd functions`):**
```bash
npm run build          # tsc → lib/
npm run deploy         # firebase deploy --only functions
npm run deploy:prod    # firebase use prod && deploy && firebase use dev
```

There is **no test suite** in any app. "Verify" means building/linting and running the app.

## Environments & the named-database model

Firebase project is always `fittbsa`. Dev vs prod is **not** separate projects — it's selected by **environment variables choosing a named Firestore database and a Storage bucket**:

| | Firestore DB | Storage bucket | Web Cloud Run | URL |
|--|--|--|--|--|
| Dev/sandbox | `fittsuperapp-dev` | `fittbsa-app-sandbox` | `fittbsa-admin-web-dev` | uat-app.fittbsa.com |
| Prod | `fittsuperapp-prod` | `fittbsa-app-prod` | `fittbsa-admin-web-prod` | app.fittbsa.com |

The database ID is read from an env var, **not hardcoded**:
- Mobile: `EXPO_PUBLIC_FIRESTORE_DATABASE_ID` → `config/firebase.ts` calls `getFirestore(app, databaseId)`
- Web: `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` → `platform-web/lib/firebase.ts` (client) and `platform-web/lib/firebase-admin.ts` (admin)

If you write Firestore access code, you must pass the database ID — the default `"(default)"` database is **not** where the data lives. `firebase.json` deploys the same `firestore.rules`/indexes to both named databases.

- Mobile build profiles live in `eas.json` (`development`/`preview` = sandbox, `production` = prod) and `app.config.js` swaps native Google config files by `APP_ENV`.
- Web deploys via `cloudbuild-sandbox.yaml` / `cloudbuild-production.yaml` (Docker → Cloud Run, asia-southeast1); secrets (Firebase admin creds, Resend, Phithan SQL, Watson) come from Cloud Build, not committed.

## Domain model

Authoritative type definitions: **`types/index.ts`** (mobile). Core entities:

- **Org hierarchy:** `Company` → `Branch` (has geofence: lat/lng/radius) → users. Multi-tenant; nearly every query is scoped by `companyId` and often `branchId`.
- **Roles** (`UserRole`): `employee` < `supervisor` < `manager` < `admin` < `super_admin`. `employee`/`supervisor`/`manager` are **branch-scoped**; `admin`/`super_admin` are company/platform-scoped. Full permission matrix in `docs/PHITHAN_ROLES_MATRIX.md`. Note the mobile `types/index.ts` enum may omit `manager` even though the platform uses it — check the actual data.
- **Branch scoping fields:** `branchId` (primary) + `branchIds[]` (multi-branch); managers carry `managedBranchIds[]`; supervisors carry `supervisorId`. When adding features, respect these — see the latest commits about supervisor/manager assignment scoping.
- **Counting flow:** `Product` → `UserAssignment` (who counts what, where, by when) → `CountingSession` (one submission, with AI + manual counts, `variance`, status) → `ShopCountConfirmed` (final confirmed count fed back to Phithan ITP). Periods are **half-monthly**: `periodId` like `2026-03-H2` (H1 = 1–15, H2 = 16–EOM) with grace/lock dates managed by `counting-period.service.ts`.
- **Other workflows:** `CheckIn` (attendance, photo + GPS watermark), `Shipment`/`DeliveryReceive`, `DailySale`, `Notification`, `PromptTemplate` (Gemini prompts stored in Firestore).

## Mobile app architecture

- **Routing** is expo-router file-based (`app/`). Route groups: `(login)`, `(tabs)` (home / services / settings), `(mini-apps)` (one Stack per feature: `stock-counter`, `check-in`, `delivery-receive`, `daily-sale`, …), plus `invitation/[token]`, `pending-approval`, `onboarding`. The mini-app launcher grid is driven by `constants/mini-apps.ts`.
- **Stock-counter flow:** products list → `camera` (capture + native barcode scan) → `preview` (review/edit) → `result` (save). Lives in `app/(mini-apps)/stock-counter/`.
- **Service layer (`services/`)** holds all business logic and Firebase/Gemini calls — UI components call services, not Firestore directly. Key ones: `auth.service.ts`, `counting.service.ts`, `gemini.service.ts`, `product.service.ts`, `counting-period.service.ts`, `shopCountConfirmed.service.ts`, `checkin.service.ts`, `image.service.ts` (compression presets), `prompt.service.ts` (remote Gemini prompts).
- **State** is Zustand (`stores/`), one store per domain: `auth.store.ts` (Firebase auth + realtime user-doc listener), `product`, `counting`, `checkin`, `delivery`, `theme`, `language`.
- **Auth guarding:** `auth.store.ts` watches the user doc; if `status` becomes `inactive`/`suspended` it **blocks access in-place** (routes to `pending-approval`) rather than signing out, to avoid redirect flicker. New users land in a pending-approval state until an admin approves.

## Platform-web architecture

- **App Router areas** (`platform-web/app/`): `dashboard-vendor-center/*` (the main, heavily-edited dashboard — reports, products, sales, AI tools, store locations), `super-admin/*` (platform admin), `stock-counter/*`, plus `login`/`pending-approval`/`unauthorized`/`invitation/[token]`. Root `page.tsx` is a persona-based router that sends each role to its area.
- **API routes (`app/api/`):** Firebase **Admin SDK** backend-for-frontend. Most verify a Firebase `Bearer` ID token (`adminAuth.verifyIdToken`) then re-check role/company from the `users` doc. Notable groups: `watson/*` (supplier invoice/price/promotion Excel imports), `phithan/*` + `phithan-eod` (ERP sync, stock comparison), `supervisor/*` (assignment approval/override), `ai-insights` (Gemini business analytics), `exports/*` (PDF/Excel jobs), `invitations/*`. A small set (e.g. `employee-photos`, the public `openapi.yaml` spec) are **Open APIs for external systems** — those use API-key style auth rather than user tokens.
- **Firebase:** client SDK in `lib/firebase.ts`, admin in `lib/firebase-admin.ts` — both honor the named-database env var.
- **Phithan ERP** (`lib/phithan-db.ts`): Azure **SQL Server** (`mssql`) is the master ERP for employee roster, reorder data, and stock reconciliation. Firestore holds the real-time app data; Phithan is the source/sink for official inventory. Connecting requires the deploy environment's IP to be allowlisted (see `scripts/setup-cloud-nat.sh`).
- **Email:** invitations go through the external **DMAIL** service (`lib/email.ts`), with Resend as fallback.
- **Reports:** `exceljs`/`jspdf` generate exports; `xlsx` parses uploaded Watson Excel files.
- **Company/module gating:** `companies.enabledModules[]` controls which apps a company sees; a user's `moduleAccess[]` must be a subset, with an optional per-module email `moduleWhitelist`. Multi-company users switch via `activeCompanyId` in the Zustand auth store.
- **UI stack:** Tailwind v4, radix-ui, lucide-react, recharts, sonner. State in `stores/` (auth, theme, sidebar).

## Cloud Functions

Source in `functions/src/` (codebase name `fittbsa` in `firebase.json`). Exports include: scheduled `autoAssign` (2nd & 17th @ 01:00 Bangkok — generates counting assignments per company, matching the H1/H2 period boundaries), scheduled `checkMissingCheckIn`, Firestore-triggered `onCheckInWrite` and `processAccountDeletion`, and callable `getServerTime`. Build with `tsc` before deploying; functions are excluded from the root tsconfig/eslint.

## Conventions worth knowing

- **Both** the mobile and web app use the `@/*` → repo-root path alias (separate tsconfigs).
- Gemini work: model is `gemini-3-flash-preview` at temperature 0; the **API key is fetched at runtime from Firestore** (`appConfig/gemini`, 5-min cache) so it can rotate without an app rebuild, falling back to an env var. Prompts are also stored in Firestore (`PromptTemplate`) and editable by admins — don't hardcode prompts.
- Photos in check-in/delivery/counting carry a **watermark payload** (timestamp, GPS, user, device) stored alongside the image.
- Firestore security is enforced in `firestore.rules` (role + company-scoped, ~21KB) and Storage in `storage.rules` (per-`userId`/`companyId` paths, size + MIME limits). Update these when adding collections or storage paths.
- Much of the UI text, commit messages, and docs are in **Thai** — that's expected, not noise.
