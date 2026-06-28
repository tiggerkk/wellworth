# WellWorth — Project Memory

WellWorth is a personal (later: small-family) wellness, net-worth, and media tracker. It is built as an installable PWA so it runs on iPhone and iPad with no Apple Developer account.

**Read the core spec docs before planning or building — not all of `/docs`.** The spec docs are the
source of truth and now carry the durable architectural constraints + "don't repeat" gotchas (formerly
in the build log).

- **Always read first (cross-cutting):** `docs/00_PRD.md` (scope + non-goals),
  `docs/01_design_system.md` (tokens, shared components, conventions), `docs/02_tech_spec.md`
  (architecture, routing, DB patterns, gotchas), and `docs/03_global.md` (navigation, onboarding,
  global Settings, the `profile` table + seeds). These four cover normal work, **including changing
  existing code**.
- **Read on demand:** a module spec (`docs/04_wellness.md` … `10_travel.md`) only when a bug or
  enhancement touches that module — see the [Modules](#modules) table below.
- **`docs/BUILD_HISTORY.md`** — non-spec chronological engineering history (build sequence + dated
  enhancement passes). **Read only when explicitly asked** to do a major refactor or regression
  analysis on an older module.
- **`docs/PARKED.md`** — deferred / out-of-scope backlog. **Read only when explicitly asked** about
  deferred work or whether something was intentionally not built.

## Keep the docs in sync (every change — without being asked)

Documentation updates are part of "done," not a follow-up. Whenever a change affects behavior, the schema, seed data, workflow, or project layout, update the relevant doc(s) **in the same task** — do
not wait to be reminded:

- **Spec docs** (`/docs/00_PRD.md`, `01_design_system.md`, `02_tech_spec.md`, `03_global.md`,
  `04_wellness.md` … `10_travel.md`) — the behavior/data source of truth. Update when a screen's
  behavior, the data model, seed data, or the design system changes.
- **`docs/BUILD_HISTORY.md`** — append the milestone/enhancement narrative + rationale for notable
  changes (schema changes, migrations, new patterns), and keep its Snapshot (test count, deploy status)
  current. Put the distilled "don't repeat" lesson + any new durable constraint in the relevant **spec
  doc** (with its `F#` anchor), not buried in the history.
- **`docs/PARKED.md`** — remove an item when it's built; add one when something is deliberately deferred or a limitation is discovered.
- **`docs/OWNER_RUNBOOK.md`** — update when setup, scripts, env vars, migrations, or deploy/reset steps change (it must still stand up the app from a fresh clone).
- **`README.md`** — update if the top-level overview or file/doc layout changes.

Write in concise bullet points and avoid long paragraphs.

Then run `npm run format` so the docs pass Prettier.

## Modules

All modules are feature-complete. Adding a module = append a `ModuleDef` to
`src/constants/modules.ts` + its routes. **Before working on a module, read its spec:**

| Module    | Routes       | Spec                |
| --------- | ------------ | ------------------- |
| Wellness  | /wellness/\* | docs/04_wellness.md |
| Net Worth | /networth/\* | docs/05_networth.md |
| Shows     | /shows/\*    | docs/06_shows.md    |
| Books     | /books/\*    | docs/07_books.md    |
| Quotes    | /quotes/\*   | docs/08_quotes.md   |
| Medical   | /medical/\*  | docs/09_medical.md  |
| Travel    | /travel/\*   | docs/10_travel.md   |

Global screens (Home hub, Onboarding, Settings): `docs/03_global.md`
Shared UI components & design tokens: `docs/01_design_system.md`
Tech stack, DB patterns, routing, shared APIs: `docs/02_tech_spec.md`

## Stack (do not substitute without asking)

See `docs/02_tech_spec.md` for the full stack, folder structure, routing, DB patterns, and shared
external APIs. Key libraries: React + Vite + TypeScript (strict), Tailwind CSS, `vite-plugin-pwa`,
React Router (`react-router`), Supabase (Postgres + Auth + Google OAuth), Recharts (charts),
Leaflet + markercluster (Travel map), `@zxing/browser` (barcode scanner).

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
  inherit Supabase's default grants, so an explicit grant migration is required (see `docs/02_tech_spec.md`).
- The client uses only the **public anon key** (RLS-respecting), injected via a `VITE_`-prefixed env var.
- The **service-role key bypasses RLS** — it must never appear in client code or the repo. Secrets in `.env` (gitignored). Only `VITE_`-prefixed vars are exposed to the browser.
- **App access is gated to an optional email allowlist** (`VITE_ALLOWED_EMAILS`): `src/lib/access.ts`
  (`isEmailAllowed`) + enforcement in `src/auth/AuthProvider.tsx` sign out any account whose email
  isn't listed (empty list ⇒ no restriction). This is a convenience layer over RLS + the Supabase/
  Google sign-up controls (see `OWNER_RUNBOOK.md` Part H3), not a replacement for them. `access.ts`
  also exposes `parseOAuthError`, which `AuthProvider` captures from the redirect URL on first render
  so Login surfaces a failed sign-in (e.g. `signup_disabled` after a `db reset` wipes `auth.users`)
  instead of looping silently.
- **Multi-member family is supported** (each member = own Google login, strictly-private data via RLS).
  `isOwnerEmail` (`VITE_OWNER_EMAIL`, falling back to a single-entry allowlist) splits first-run
  seeding: the owner gets `OWNER_PROFILE_SEED` + an `onboarded_at` stamp; non-owners get the neutral
  `MEMBER_PROFILE_SEED` (**never** the owner's body metrics) and a null `onboarded_at`, which the
  `OnboardingGate` in `AppShell` turns into a forced `Onboarding` wizard (`needsOnboarding`). The wizard
  and Settings share `ProfileMetricsFields`. `VITE_OWNER_EMAIL`/`VITE_ALLOWED_EMAILS` are build-time —
  adding a member needs a redeploy. Known limits stay in `PARKED.md` (DRI bands, global HKD base,
  no shared/household data).

## Database workflow

- Schema changes are written as **migration files** in `/supabase/migrations/` (Supabase CLI format).
  You draft the migration; the human reviews and applies it with `supabase db push`.
- **Migration filenames are `NN_<module>_<name>.sql`** — a two-digit global ordinal (apply order) +
  the module + a short name (e.g. `01_wellness_schema.sql`, `06_shows_profile_settings.sql`,
  `12_medical_seed_lab_test.sql`). The ordinal is the Supabase migration version and fixes apply order
  (dependencies: `01_wellness_schema.sql` creates `profile`, so every `*_profile_settings.sql` is later).
  A new module appends the next ordinal. Renaming/renumbering changes the version, so it only reconciles
  via a full **`supabase db reset --linked`** (a `db push` can't), which matches the owner's reset workflow.
- **Never** mutate the production schema directly, and **never drop a table**, without explicit confirmation in the conversation.
- After applying a migration, regenerate `/src/types/database.ts`.
- **Backups (free tier has none):** `scripts/db-backup.sh` (encrypted, age) + `.github/workflows/backup.yml`
  (scheduled, off-site to a private repo) + `scripts/db-restore.sh`; full setup + the two-tier restore
  (incl. the `auth.users` UUID caveat) live in **`OWNER_RUNBOOK.md` Part Q**. Schema lives in migrations,
  so backups capture **user data + `auth.users`/`auth.identities`** only.

## Naming

- Tables: singular, `snake_case` (`food`, `diary_entry`, `strength_set`).
- TS types/components: `PascalCase`. Files: `kebab-case`. Be consistent above all.

## Enforcement (these run automatically; don't rely on memory alone)

- Prettier (format), ESLint (lint, no unused, no `any`), type-check via **`npm run typecheck`** (`tsc -p tsconfig.app.json`; a bare `tsc --noEmit` checks nothing — the root `tsconfig.json` is
  references-only), and Vitest (tests). All four run via the pre-commit hook and/or CI and are wrapped by `npm run check` — code must pass them before it is considered done.
