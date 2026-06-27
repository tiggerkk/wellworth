# 02 — Tech Spec

## Stack

- **Frontend:** React + Vite + TypeScript (strict mode). Tailwind CSS (v4, CSS-first via
  `@tailwindcss/vite`). `vite-plugin-pwa` (`registerType: 'autoUpdate'`) for install/offline. **React
  Router** (the unified `react-router` package) for routing + modal sheets. **Recharts** powers the Net
  Worth dashboard trend chart (and the Medical + Travel expense-breakdown charts); it's
  **lazy-loaded** (its own chunk) so it stays out of the initial bundle.
- **Map:** **Leaflet** + `leaflet.markercluster` power the **Travel** map (imperative, no react-leaflet);
  **lazy-loaded** into its own chunk so Leaflet stays off the initial bundle.
- **Lazy chunks load via `src/lib/lazy-with-reload.ts` (`lazyWithReload`), not bare `React.lazy`.** After
  a deploy the installed PWA can reference the previous build's hashed chunk names; the missing
  `/assets/*.js` then returns the SPA fallback HTML ("'text/html' is not a valid JavaScript MIME type").
  `lazyWithReload` forces a **one-time** `location.reload()` (sessionStorage-guarded against loops) to
  pull fresh chunk names. Used by the Net Worth / Medical trend charts, the barcode scanner, and the
  Travel map + expense-breakdown chart.
- **Barcode:** `@zxing/browser` (`BrowserMultiFormatReader`) + `@zxing/library` decoding the device
  camera via `getUserMedia`. Requires HTTPS (localhost is exempt for dev). The scanner is lazy-loaded
  so ZXing is a separate chunk, fetched only when scanning.
- **F3** — `@zxing/browser@0.2` peers `@zxing/library@^0.22`: keep `@zxing/library` pinned at `0.22`.
  Bumping it needs a matching `@zxing/browser` move, or `npm install` requires `--legacy-peer-deps`.
- **Chinese search (Traditional⇄Simplified agnostic):** every search bar matches across scripts.
  **Local filters** normalize both query and row text with the sync `foldZh` (`src/lib/zh-fold.ts`),
  a single-char Traditional→Simplified fold over the generated `src/constants/zh-fold-map.ts` (built
  by `scripts/gen-zh-fold-map.mjs` from OpenCC's HK+TW+TWP dicts; ~60KB, always resident). **Remote
  searches** issue the query in both scripts and merge — `src/lib/zh-query.ts` (`searchZhVariants`),
  using `opencc-js` (HK Traditional) for the Simplified→Traditional direction. `opencc-js` (~1.12MB)
  is **lazy-loaded** via `import('opencc-js')` (`src/lib/zh-convert.ts`) into its own `opencc-*.js`
  chunk (`build.rollupOptions.output.manualChunks`) and **excluded from the PWA precache**
  (`workbox.globIgnores: ['**/opencc-*.js']`), so it only loads on the first Chinese remote search. It
  is **not** wrapped in `lazyWithReload`; a failed `import()` falls back to the typed query.
- **Backend-as-a-service:** Supabase — Postgres, Auth (Google OAuth), auto-generated REST, RLS.
- **Hosting:** Vercel / Netlify / Cloudflare Pages (any free tier; HTTPS automatic).
- **F10** (TypeScript) — under TS 6 a bare `Uint8Array` is `Uint8Array<ArrayBufferLike>`, which is NOT
  assignable to WebCrypto / WebAuthn `BufferSource` params: annotate byte helpers feeding those APIs as
  `Uint8Array<ArrayBuffer>`. Don't use `as unknown as` casts.

## Folder structure

```
src/
  components/        # shared, reusable UI only
  screens/           # one folder per screen/tab
  data/              # typed data-access layer (wraps supabase-js) — the ONLY db access
  lib/               # supabase client, units, dri, energy, met, nutrients, targets, report,
                     # date, food-api, off-api, food-search, diary-refresh, diary-clipboard, csv,
                     # networth, fx, networth-refresh, shows, shows-refresh, tmdb-api, shows-import,
                     # books, books-refresh, books-api, books-import, quotes, quotes-refresh,
                     # quotes-import, travel, travel-config, travel-refresh, travel-stats,
                     # travel-geo, places, trip-fx, expenses, reimburse, travel-expense-import,
                     # itinerary-import, last-module helpers
  constants/         # global constants (groups, effort-levels, nutrient-sections, ranges,
                     # profile-defaults, seed-activities, routes, modules)
                     # routes.ts = all route paths (one source of truth); modules.ts = the
                     # Home-hub module registry (ModuleDef + moduleForPath)
                     # activity-icons.ts maps icon name strings to named Tabler imports
  types/             # database.ts (generated), domain types
  hooks/
public/              # static assets: app/PWA icons (generated — see scripts/gen-icons.mjs), map geojson
scripts/             # gen-icons.mjs (app icons), gen-zh-fold-map.mjs, db-backup/db-restore
supabase/
  migrations/        # source-of-truth SQL migrations
docs/                # the spec bundle
```

## Navigation & routing

- The app is **multi-module behind a Home hub**. Routes are **URL-namespaced per module**
  (`/wellness/*`, `/networth/*`, `/shows/*`, `/books/*`, `/quotes/*`, `/medical/*`, `/travel/*`) and
  declared as flat children of a single `<AppShell/>` layout in `src/router.tsx`. Path strings live in
  `src/constants/routes.ts` (one source of truth) and the hub/bottom-nav are derived from
  `src/constants/modules.ts` (`MODULES` + `moduleForPath`). Adding a module = a `ModuleDef` + its
  routes — no structural change.
- The index route `/` is a `RootRedirect` to the **last-used module** (`localStorage`, via
  `src/lib/last-module.ts`), falling back to `/home`. Login and the PWA `start_url`/OAuth redirect all
  land on `/` and flow through it.
- `AppShell` renders the per-module `BottomNav` (a leading **Home** item + the module's tabs) only
  when in a module; the hub and global Settings have none. Modal **sheets** use React Router's
  **background-location** pattern — opening a sheet stashes the current location as
  `state.background`, and `AppShell` paints that tab (via `TAB_FOR_PATH`) behind the sheet. New sheets
  live under their module's prefix and are opened with `useSheetNavigate`.
- **Escape-to-dismiss** is centralised in `useEscapeKey` (`src/hooks/useEscapeKey.ts`): one document
  listener over a LIFO handler stack, so the innermost overlay wins. Route `Sheet`s + local search
  sheets close themselves, the `Calendar` closes, an open `SelectMenu` collapses, and the Add/Edit
  screens `navigate(-1)` only when nothing is layered above them.
- **Session-persistent list state** — `useSessionState(key, initial)` (`src/hooks/useSessionState.ts`)
  is a `useState` drop-in backed by `sessionStorage` (resilient to disabled storage, with an object
  schema-drift merge). The Library/Reports/Trips screens hold their criteria object (search + filters
  - sort) in it, so a list's view survives the full-route-swap remount when the user opens an item
    and returns. Keys: `wellworth:{shows,books,quotes}-library`, `wellworth:medical-reports`,
    `wellworth:travel-trips`.

## Data flow

UI (`screens` + `components`) → `data/*` repository functions → `supabase-js` query builder →
Supabase (Postgres + RLS). Components hold no SQL and never import the Supabase client directly.

- **F4** — `useAsync(fn)` takes a single `useCallback`-stable `fn` and exposes `refetch` — NOT a `deps`
  array (the react-hooks lint rule rejects a variable deps array). Memoize `fn` at the call site.
- **F8 + F13** — `useAsync` keeps the PREVIOUS `data` while a refetch is in flight (it flips
  `loading=true` but retains the old `data`). Therefore:
  - Gate a view on `!loading` ONLY when the loaded subject's IDENTITY changes (and key the component by
    it) — e.g. Net Worth Monthly Entry switching months (**F8**).
  - NEVER gate on `!loading` when a child holds unsaved LOCAL state across a same-subject refetch — it
    unmounts the child and discards edits (**F13**, Travel Trip Builder); instead render once `data`
    exists and show a first-load spinner only when `loading && !data`.
  - Rule: a gate keyed on a fetched value reads `data`, never `loading`.

## Auth & first-run

- Supabase Auth with the Google provider. The client is created once in `src/lib/supabase.ts` with
  **`flowType: 'pkce'`** set explicitly — the bare supabase-js client otherwise defaults to the
  implicit flow. A SPA needs no `/auth/callback` route; `detectSessionInUrl` exchanges the `?code=`
  on load.
- On first successful login, a client-side hook (`useEnsureProfile`) seeds the user's data: it
  creates the `profile` row **and** seeds the starter activity library if the user has none. Both are
  idempotent (insert-if-missing), guarded against React StrictMode double-invoke; not DB triggers.
  `ensureOwnerProfile(userId, email)` **branches on the owner** (`isOwnerEmail`, see below): the owner
  gets the full `OWNER_PROFILE_SEED` and an `onboarded_at` stamp; every other member gets the neutral
  `MEMBER_PROFILE_SEED` (no body metrics) with `onboarded_at` left null. When it creates a new row it
  bumps the shared refresh tick so the onboarding gate re-reads it.
- **Multi-member onboarding gate (`OnboardingGate` in `AppShell`).** A new member's null
  `onboarded_at` (`needsOnboarding` in `access.ts`) forces a full-screen `Onboarding` wizard to
  collect their own birthday/sex/height/weight/units before the app — never inheriting the owner's
  metrics. The gate shows a splash while the profile is loading/being created (it keys off the
  resolved `data`, not `loading`, so background refetches don't flash it) and passes the owner /
  already-onboarded members straight through. Completing the wizard stamps `onboarded_at`, which
  dismisses the gate. The wizard and Settings share `ProfileMetricsFields` (one home for the
  metric↔imperial conversion + the shared `Calendar` birthday picker). Owner detection:
  `VITE_OWNER_EMAIL`, falling back to a single-entry `VITE_ALLOWED_EMAILS` so a lone-user build needs
  no extra config.
- **Access control + error surfacing (`src/lib/access.ts`, enforced in `AuthProvider`).** An optional
  build-time email allowlist (`VITE_ALLOWED_EMAILS`, parsed by `parseAllowlist`/`isEmailAllowed`) signs
  out any account whose email isn't listed (empty ⇒ no restriction) — a convenience layer over RLS +
  Supabase's sign-up controls. `parseOAuthError` reads an error the provider hands back on the redirect
  (`?error=…`/`#error=…`, captured during the first render before the router strips it) so Login
  explains a failed sign-in instead of looping silently — most notably `signup_disabled` after a
  `db reset --linked` wipes `auth.users` while sign-ups are off.

## Sync

Supabase is the single source of truth; all devices read/write it. The cloud is authoritative (this
also sidesteps iOS PWA storage eviction).

## Database conventions

- **Table naming:** singular, `snake_case` (`food`, `diary_entry`, `show`).
- **Migration filenames:** `NN_<module>_<name>.sql` — a two-digit global ordinal (apply order) + the
  module + a short name (e.g. `01_wellness_schema.sql`, `05_shows_profile_settings.sql`). The ordinal
  is the Supabase migration version and fixes apply order. New modules append the next ordinal.
- **Every user-owned table** carries a `user_id` UUID → `auth.users.id` `ON DELETE CASCADE` and four
  RLS policies (select/insert/update/delete) using `(select auth.uid()) = user_id`. Child tables
  without their own `user_id` enforce ownership with an `EXISTS` check against their parent.
- **RLS + GRANT:** RLS is enabled in the first migration for every table, **and** that migration also
  `GRANT`s table privileges to the `anon`/`authenticated` roles — RLS gates rows; the role still needs
  table-level access. Raw-SQL-migration tables do NOT inherit Supabase's default grants.
- **Enumerated TEXT columns** use `CHECK` constraints (not Postgres enums). **Exception:** columns
  whose allowed values are owner-configurable (e.g. `quote.source_type`/`category`,
  `trip_expense.category`) use plain TEXT with no CHECK — validation moves to the app.
- **`updated_at`** is maintained by the `moddatetime` trigger on every table.
- **Reference tables** (`nutrient`, `medical_lab_test`) have RLS on with a SELECT-only policy for
  `anon`/`authenticated`; no write policies — rows written only by migrations.
- After applying a migration, regenerate `src/types/database.ts` (`npm run gen:types`).
- **Never drop a table** without explicit confirmation. Schema changes are migration files in
  `supabase/migrations/`; the human applies them with `supabase db push`.
- **F7** (security) — gitignore any private-data file (real balances, watch/reading history, quote
  collection, lab results + report PDFs, trip/expense files) BEFORE the first `git add`: gitignore only
  stops FUTURE commits; a committed file persists in pushed history and must be purged with
  `git filter-repo --invert-paths` + force-push. Tracked templates must be sanitized example data, never
  real values (sanitize example numbers in docs too).

## Cross-module relationships

`profile` 1—_ `food`, `activity`, `diary_entry` · `food` 1—_ `serving` · `food` 1—_ `diary_entry` ·
`activity` 1—_ `diary_entry` · `diary_entry` 1—_ `strength_set` · `profile` 1—_ `show` ·
`profile` 1—_ `book` · `profile` 1—_ `quote` · `show` 1—_ `quote` and `book` 1—_ `quote`
(both optional, **ON DELETE SET NULL** — quote survives a linked show/book deletion) ·
`profile` 1—_ `medical_report` · `medical_report` 1—_ `medical_result` ·
`medical_lab_test` 1—_ `medical_result` (optional; `test_key` NULL for ad-hoc tests) ·
`profile` 1—_ `trip` · `trip` 1—_ `trip_day` 1—_ `stop` · `trip` 1—_ `trip_expense` ·
`profile` 1—_ `remembered_city`. Travel expense categories are a JSONB list on `profile`, not a table.

## Multi-user readiness

- Because every table carries `user_id` and RLS isolates rows by `auth.uid()`, additional family
  members work with no schema change: they sign in with their own Google account and get their own
  `profile` and data automatically.
- A future "shared household custom foods" feature would be an additive change (e.g. a nullable
  `household_id` + a shared-visibility policy), not a rebuild.

## Shared external APIs

**Called directly from the browser** (no server proxy); CORS-enabled.

- **CJK queries** (remote searches only — local filters use `zh-fold`): a query containing CJK is
  fired in **both** scripts — Simplified (the typed form) + HK-Traditional (via lazy `opencc-js`) —
  and results merged + de-duped (`searchZhVariants` in `src/lib/zh-query.ts`). Applies to each
  module's remote search API; see the respective module spec for which API is searched.
- **Frankfurter** (`api.frankfurter.dev/v1/{date}?from={currency}&to=HKD`): **keyless**, ECB-sourced,
  CORS-enabled. Returns the most recent rate on or before the requested date (handles non-trading days).
  The fetched rate is **frozen** on first write so saved records are immune to later rate revisions.
  Helpers + a small cache live in `src/lib/fx.ts` (Net Worth) and `src/lib/trip-fx.ts` (Travel).
  `fetchRateToHkdOn(currency, date)` is the shared fetch interface. HKD is always 1 (never fetched);
  CNY is stored as the `CNY` code, not `RMB`. Failures are non-fatal; the user can override manually.

## Environment variables

`.env` (gitignored). Only `VITE_`-prefixed vars reach the browser.

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...     # public, RLS-respecting — safe in the client
VITE_USDA_API_KEY=...          # data.gov key
VITE_TMDB_API_KEY=...          # themoviedb.org v3 key (public, client-side) — Shows
VITE_GOOGLE_BOOKS_API_KEY=...  # optional, raises Google Books quota — Books
# service-role key is NEVER placed here or anywhere in the client
```

## Quality gates

- **Prettier** (format).
- **ESLint** (no unused, no `any`).
- **F5** — type-check with `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) or `tsc -b`. A bare
  `tsc --noEmit` checks nothing — the root `tsconfig.json` is references-only (`files: []`).
- **Vitest** for the calculation helpers.
- Wire them into a pre-commit hook and/or CI via `npm run check`.
