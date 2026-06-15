# WellWorth — Project Memory

WellWorth is a personal (later: small-family) wellness and net-worth tracker, styled after Cronometer.
It is built as an installable PWA so it runs on iPhone and iPad with no Apple Developer account.

**Read `/docs` before planning or building.** The seven spec docs there are the source of truth:
`00-PRD.md`, `01-screens.md`, `02-tech-spec.md`, `03-data-model.md`, `04-design-system.md`, `05-seed-data.md`, `06-networth.md`.
(`docs/BUILD-LOG.md` is a non-spec engineering history — build sequence, rationale, and past-failure warnings — not a source of truth for behavior.)

**Before changing existing code, read `docs/BUILD-LOG.md`** to understand how Phase 1 was built and
which past approaches failed (and see `docs/PARKED.md` for what's intentionally deferred).

## Keep the docs in sync (every change — without being asked)

Documentation updates are part of "done," not a follow-up. Whenever a change affects behavior, the schema, seed data, workflow, or project layout, update the relevant doc(s) **in the same task** — do
not wait to be reminded:

- **Spec docs** (`/docs/00-PRD.md … 06-networth.md`) — the behavior/data source of truth. Update when a screen's behavior, the data model, seed data, or the design system changes.
- **`docs/BUILD-LOG.md`** — append the rationale for notable changes (schema changes, migrations, new patterns) and add any new "don't repeat this" lesson to its Failures list. Keep the Snapshot facts
  current (test count, deploy status).
- **`docs/PARKED.md`** — remove an item when it's built; add one when something is deliberately deferred or a limitation is discovered.
- **`docs/OWNER-RUNBOOK.md`** — update when setup, scripts, env vars, migrations, or deploy/reset steps change (it must still stand up the app from a fresh clone).
- **`README.md`** — update if the top-level overview or file/doc layout changes.

Then run `npm run format` so the docs pass Prettier.

## Scope discipline

- Build **Wellness and Net Worth**.
- Steps are entered **manually**. Do not attempt HealthKit / native step sync (impossible in a PWA).

## App structure (multi-module — current state)

The app is a multi-module PWA behind a **Home hub** (`/home`): module cards launch into **Wellness**
(`/wellness/*`) or **Net Worth** (`/networth/*`); `/` redirects to the last-used module. Adding a
module is a **drop-in** — append a `ModuleDef` to `src/constants/modules.ts` + its routes.

- **Routing:** flat children of one `<AppShell/>` in `src/router.tsx`; **all path strings live in
  `src/constants/routes.ts`** (single source of truth). `src/constants/modules.ts` (`MODULES` +
  `moduleForPath`) drives the hub cards + per-module `BottomNav`. Modal **sheets** use the
  background-location pattern (`useSheetNavigate`); `AppShell.TAB_FOR_PATH` paints the tab behind a
  sheet. `/` → `RootRedirect` (last-used module via `src/lib/last-module.ts`, else `/home`).
- **Settings is split:** global `/settings` (profile, units, account) from the hub gear; Wellness
  sub-settings at `/wellness/settings` (protein target, nutrient display) from a gear in the Wellness
  header.
- **Net Worth (Phase 2, built):** two tables `networth_snapshot` + `asset_entry` (schema in
  `06-networth.md`; migration `supabase/migrations/20260615120000_networth_schema.sql`). Data:
  `src/data/networth-snapshot.ts` + `asset-entry.ts` — write path `saveSnapshotEntries` is an
  **idempotent create-or-replace per month** (reused by the importer). Calc `src/lib/networth.ts`; FX
  `src/lib/fx.ts` (Frankfurter; **currency stored as `CNY`**, no RMB→CNY map; each entry freezes
  `fx_rate_to_base` + `value_base`); refresh tick `src/lib/networth-refresh.ts`; CSV import
  `src/lib/networth-import.ts`; windows `src/constants/networth-ranges.ts`; lazy chart
  `src/components/NetWorthTrendChart.tsx`; screens `NetWorthDashboard` / `NetWorthEntry` /
  `ImportNetWorthSheet`.

## Stack (do not substitute without asking)

- React + Vite + TypeScript (strict), Tailwind CSS, `vite-plugin-pwa`, React Router (the unified
  `react-router` package — import from `react-router`).
- Supabase (Postgres + Auth + Google OAuth) for data, auth, and cross-device sync.
- `@zxing/library` + `@zxing/browser` for barcode scanning. **Recharts** powers the Net Worth dashboard
  trend chart (lazy-loaded into its own chunk via `src/components/NetWorthTrendChart`).
- Food data: USDA FoodData Central (search) + Open Food Facts (barcode). FX: keyless **Frankfurter**
  (ECB) for Net Worth native→HKD rates (`src/lib/fx.ts`).

## Architecture rules (always apply)

- **No SQL in the front end.** Components never call Supabase directly and never contain SQL.
  All DB access goes through a typed data-access layer in `/src/data/*` that wraps the `supabase-js` query builder. Raw SQL lives **only** in `/supabase/migrations/`.
- **Generated DB types are the contract.** Keep `/src/types/database.ts` generated from the schema; regenerate after every schema change. Never hand-edit it.
- **Shared UI only.** Reusable components live in `/src/components`; never duplicate UI. Global constants in `/src/constants`; pure helpers in `/src/lib` or `/src/utils`.
- **Clarity and DRY, but never sacrifice runtime performance to reuse code.** If reuse would add meaningful overhead on a hot path, prefer a fast purpose-built implementation and note why.
- **Units are stored in metric** (kg, cm, g, ml, per-100g). Convert to the user's chosen display unit only at the UI boundary, through a single `units` helper. Never store imperial.
- **Every async view has explicit loading, empty, and error states.**

## Security (non-negotiable)

- RLS is ON for every table from its first migration; policy = `user_id = auth.uid()` for user-owned tables. Child tables without their own `user_id` (`serving`, `strength_set`) enforce ownership via
  an `EXISTS` check against their parent.
- **Migrations must also `GRANT` table privileges to the `anon`/`authenticated` roles.** RLS gates _rows_; the role still needs table-level access. Tables created by raw-SQL migrations do **not**
  inherit Supabase's default grants, so an explicit grant migration is required (see `03-data-model.md`).
- The client uses only the **public anon key** (RLS-respecting), injected via a `VITE_`-prefixed env var.
- The **service-role key bypasses RLS** — it must never appear in client code or the repo. Secrets in `.env` (gitignored). Only `VITE_`-prefixed vars are exposed to the browser.

## Database workflow

- Schema changes are written as **migration files** in `/supabase/migrations/` (Supabase CLI format).
  You draft the migration; the human reviews and applies it with `supabase db push`.
- **Never** mutate the production schema directly, and **never drop a table**, without explicit confirmation in the conversation.
- After applying a migration, regenerate `/src/types/database.ts`.

## Naming

- Tables: singular, `snake_case` (`food`, `diary_entry`, `strength_set`).
- TS types/components: `PascalCase`. Files: `kebab-case`. Be consistent above all.

## Enforcement (these run automatically; don't rely on memory alone)

- Prettier (format), ESLint (lint, no unused, no `any`), type-check via **`npm run typecheck`** (`tsc -p tsconfig.app.json`; a bare `tsc --noEmit` checks nothing — the root `tsconfig.json` is
  references-only), and Vitest (tests). All four run via the pre-commit hook and/or CI and are wrapped by `npm run check` — code must pass them before it is considered done.
