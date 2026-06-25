# WellWorth — Project Memory

WellWorth is a personal (later: small-family) wellness, net-worth, and media tracker, styled after
Cronometer. It is built as an installable PWA so it runs on iPhone and iPad with no Apple Developer account.

**Read `/docs` before planning or building.** The six spec docs there are the source of truth:
`00-PRD.md`, `01-screens.md`, `02-tech-spec.md`, `03-data-model.md`, `04-design-system.md`, `05-seed-data.md`.
(`docs/BUILD-LOG.md` is a non-spec engineering history — build sequence, rationale, and past-failure warnings — not a source of truth for behavior.)

**Before changing existing code, read `docs/BUILD-LOG.md`** to understand how the app was built and
which past approaches failed (and see `docs/PARKED.md` for what's intentionally deferred).

## Keep the docs in sync (every change — without being asked)

Documentation updates are part of "done," not a follow-up. Whenever a change affects behavior, the schema, seed data, workflow, or project layout, update the relevant doc(s) **in the same task** — do
not wait to be reminded:

- **Spec docs** (`/docs/00-PRD.md … 05-seed-data.md`) — the behavior/data source of truth. Update when a screen's behavior, the data model, seed data, or the design system changes.
- **`docs/BUILD-LOG.md`** — append the rationale for notable changes (schema changes, migrations, new patterns) and add any new "don't repeat this" lesson to its Failures list. Keep the Snapshot facts
  current (test count, deploy status).
- **`docs/PARKED.md`** — remove an item when it's built; add one when something is deliberately deferred or a limitation is discovered.
- **`docs/OWNER-RUNBOOK.md`** — update when setup, scripts, env vars, migrations, or deploy/reset steps change (it must still stand up the app from a fresh clone).
- **`README.md`** — update if the top-level overview or file/doc layout changes.

Then run `npm run format` so the docs pass Prettier.

## Scope discipline

- Built modules: **Wellness, Net Worth, Shows, Books, Quotes, Medical, and Travel** (all feature-complete).
- Steps are entered **manually**. Do not attempt HealthKit / native step sync (impossible in a PWA).

## App structure (multi-module — current state)

The app is a multi-module PWA behind a **Home hub** (`/home`): module cards launch into **Wellness**
(`/wellness/*`), **Net Worth** (`/networth/*`), **Shows** (`/shows/*`), **Books** (`/books/*`),
**Quotes** (`/quotes/*`), **Medical** (`/medical/*`), or **Travel** (`/travel/*`); `/` redirects to the
last-used module. Adding a module is a **drop-in** — append a `ModuleDef` to `src/constants/modules.ts` +
its routes.

- **Routing:** flat children of one `<AppShell/>` in `src/router.tsx`; **all path strings live in
  `src/constants/routes.ts`** (single source of truth). `src/constants/modules.ts` (`MODULES` +
  `moduleForPath`) drives the hub cards + per-module `BottomNav` (Shows/Books/Quotes/Medical each append
  a **New X** tab — reusing the module's hub icon — and a **Settings** tab to their `tabs`, so the
  Dashboard/Zen/Library/Reports screens carry no title/New/Settings header of their own; Wellness orders
  its tabs **Dashboard, Diary, Library, Settings**, Medical **Dashboard, Reports, New Medical, Settings**).
  Modal
  **sheets** use the
  background-location pattern (`useSheetNavigate`); `AppShell.TAB_FOR_PATH` paints the tab behind a
  sheet. `/` → `RootRedirect` (last-used module via `src/lib/last-module.ts`, else `/home`).
  **Escape-to-dismiss** is centralised in `src/hooks/useEscapeKey.ts` (one document listener over a LIFO
  stack so the innermost overlay wins): sheets/Calendar/SelectMenu close themselves, and the Add/Edit
  screens `navigate(-1)` only when nothing is layered above them.
- **Shared New/Edit header actions:** every Entry/Edit form's top-right actions are the shared
  `src/components/EntryHeaderActions.tsx` (compact **icon** buttons — Delete [trash, editing-only, with a
  two-step inline confirm] · Reset [undo] · Create [plus] / Save [floppy]) — reuse it, don't re-roll a
  header. Empty Dashboards/Libraries use the shared `src/components/EmptyState.tsx` ("No X yet / + New X").
  The shared `Calendar` header opens a year/month picker; `SelectMenu` flips its menu upward near a
  viewport edge. (Full catalogue: `docs/04-design-system.md`.)
- **Settings is split:** global `/settings` (profile, units, account) from the hub gear; per-module
  sub-settings — Wellness from a **Settings tab in the module bottom nav** at `/wellness/settings`
  (protein target, nutrient display); Shows/Books/Quotes from a **Settings tab in the module bottom nav** at
  `/shows/settings`, `/books/settings`, and `/quotes/settings` (each of the latter three: Entry
  field-visibility + CSV-importer toggle); **Medical** from its Settings tab at `/medical/settings`
  (Tracked Tests, Display Order drag-reorder, the biometric/PIN Lock, Visible Fields, importer toggle —
  reached via the `settings*` sheet routes).
- **Net Worth (built):** two tables `networth_snapshot` + `asset_entry` (migration `supabase/migrations/03_networth_schema.sql`). Data:
  `src/data/networth-snapshot.ts` + `asset-entry.ts` — write path `saveSnapshotEntries` is an
  **idempotent create-or-replace per month** (reused by the importer). Calc `src/lib/networth.ts`; FX
  `src/lib/fx.ts` (Frankfurter; **currency stored as `CNY`**, no RMB→CNY map; each entry freezes
  `fx_rate_to_base` + `value_base`); refresh tick `src/lib/networth-refresh.ts`; CSV import
  `src/lib/networth-import.ts`; windows `src/constants/networth-ranges.ts`; lazy chart
  `src/components/NetWorthTrendChart.tsx`; screens `NetWorthDashboard` / `NetWorthEntry` /
  `ImportNetWorthSheet`.
- **Shows (built):** TV, movies & **documentaries**. One table `show` (migration
  `supabase/migrations/04_shows_schema.sql` — `type` ∈ `tv|movie|documentary`, an
  `is_favorite` boolean + a `(user_id, is_favorite)` index, a nullable CHECK-constrained `dynasty`
  (Chinese titles only — the shared `src/constants/dynasty.ts` `DYNASTIES`), **no** `content_rating`;
  `poster_path` holds **either** a TMDB path **or** a full pasted image URL) plus three `profile` columns
  `show_visible_fields` / `show_importer_enabled` / `show_poster_url_visible`
  (`05_shows_profile_settings.sql`). Data `src/data/show.ts` (CRUD + idempotent
  `saveImportedShows`, dedup on lower(title)). Pure logic `src/lib/shows.ts`
  (status/type/LGBT+ enums, `usesEpisodes` (TV + documentary), status-chip palette, `posterUrl` +
  `isAbsoluteUrl` (pasted URL passthrough), `buildRefreshPatch` (per-show Refresh merge — TMDB fields
  only, preserves owner fields + a manual poster), transitions `markWatched`/`startWatching`, selectors
  `applyLibraryView` (incl. `favoritesOnly` filter)/`recentlyWatched`/`favoriteShows`,
  `SHOW_ENTRY_FIELDS`/`isFieldVisible`); refresh tick `src/lib/shows-refresh.ts`. **TMDB** browser client
  `src/lib/tmdb-api.ts` (`VITE_TMDB_API_KEY`; **Chinese-aware** — `containsCjk`/`tmdbLanguage` send
  `language=zh-CN`; documentary → `/tv` via `endpointFor`; search + details on demand; `refreshFromTmdb`;
  persist only on CREATE/SAVE); CSV importer `src/lib/shows-import.ts`. Posters render with
  `referrerpolicy="no-referrer"` (set on the shared `Thumb`). Components `StarRating` / `ShowTypeBadge`
  (TV/Movie/Documentary glyphs) / `StatusChip` / `PosterThumb` / `SelectMenu` / `TitleSearchSheet` (local
  overlay — **not** a route sheet, so the Entry form survives). Screens `ShowsDashboard` (Favourites shelf;
  watching rows show the Watching chip + progress) / `ShowsLibrary` (favourites filter) / `ShowsEntry`
  (three-way Type, favourite heart, Poster URL field auto-shown when TMDB has no poster + a
  Visible-Fields toggle `show_poster_url_visible` (off by default) that forces it always visible,
  Want⇒blank Start Date, ⟳ Refresh, `?title=&poster=&overview=&type=` prefill) / `ShowsSettings` /
  `ShowsFieldsSheet` (incl. the Poster URL toggle) / `ImportShowsSheet` (CSV ends with an `is_favorite`
  column). **Calendar** was generalized to a presentational component with an optional
  `loadCues` (Wellness Diary injects food/activity dots; Shows date pickers pass none).
- **Books (built):** one table `book` (migration `supabase/migrations/06_books_schema.sql` —
  incl. an `is_favorite` boolean + `(user_id, is_favorite)` index, and a nullable CHECK-constrained
  `dynasty` (Chinese titles only — shared `src/constants/dynasty.ts`)) plus two `profile` columns
  `book_visible_fields` / `book_importer_enabled`
  (`07_books_profile_settings.sql`). Data `src/data/book.ts` (CRUD + idempotent
  `saveImportedBooks`). Pure logic `src/lib/books.ts` (status/LGBT+ enums, status-chip palette,
  transitions `markRead`/`startReading`, selectors `applyLibraryView` (incl. `favoritesOnly` filter)/
  `recentlyRead`/`currentlyReading`/`wantToRead`/`favoriteBooks`,
  `bookGenres`/`bookAuthors`, `BOOK_ENTRY_FIELDS`/`isFieldVisible`); refresh tick
  `src/lib/books-refresh.ts`. **Google Books** (Open Library fallback) browser client
  `src/lib/books-api.ts` (**optional** `VITE_GOOGLE_BOOKS_API_KEY` — never throws when unset; search +
  details on demand; `cover_url` is a full image URL, no CDN base; persist only on CREATE/SAVE);
  CSV importer `src/lib/books-import.ts`. Books **re-skins Shows**: it reuses `StarRating` / `Calendar` /
  `SegmentedTabs` / `SelectMenu` / `SwipeRow`, the shared `Thumb` (via `CoverThumb`), the presentational
  `StatusChip`, and `BookSearchSheet` (local overlay — **not** a route sheet, so the Entry form
  survives). No type badge (all books). Favourites mirror Shows/Quotes (heart in Entry header,
  Favourites filter + Dashboard shelf, trailing `is_favorite` importer column). Screens
  `BooksDashboard` / `BooksLibrary` / `BooksEntry` / `BooksSettings` / `BooksFieldsSheet` /
  `ImportBooksSheet`.
- **Quotes (built):** one table `quote` (migration `supabase/migrations/08_quotes_schema.sql`)
  plus four `profile` columns `quote_visible_fields` / `quote_importer_enabled` /
  `quote_source_types` / `quote_categories` (`09_quotes_profile_settings.sql`). The `quote`
  table denormalises `author`/`title`/`source_type` and has optional `show_id`/`book_id` FKs (**ON
  DELETE SET NULL**) + a generated `text_norm` with `UNIQUE(user_id, text_norm)` (no exact duplicates /
  import idempotency). **`source_type` + `category` are owner-configurable** (no CHECK constraint):
  add/rename/delete/reorder in Quotes Settings, stored as JSONB arrays on the two `profile` columns
  (`quote_source_types` = `{key,label,linkKind}`, `quote_categories` = `{key,label}`; NULL ⇒ the
  canonical seed defaults). `quote.source_type`/`category` store the stable `key`; **TV/Movie/Book are
  protected from deletion** (their `linkKind` drives Show/Book auto-linking); deleting an in-use value
  reassigns its quotes first (`countQuotesByField`/`reassignQuoteField`). Data `src/data/quote.ts` (CRUD
  - `listDistinctTags` + count/reassign + idempotent `saveImportedQuotes` via
    `onConflict:'user_id,text_norm'`). Pure logic `src/lib/quotes.ts` (`detectLanguage` CJK→zh,
    `quoteSearchText`, category-chip class, `LinkCandidate`/`filterLinkCandidates`, Zen `initialZenPool`/
    `nextZenPool`/`randomItem`, Library `applyLibraryView`/`quoteTags`, `QUOTE_ENTRY_FIELDS`/
    `isFieldVisible`) + `src/lib/quotes-config.ts` (the configurable-list model: defaults, partial-tolerant
    `effectiveSourceTypes`/`effectiveCategories`, tolerant `*Label` lookups with raw-key fallback, `linkKindFor`,
    `matchKeyOrLabel`, `generateKey`, add/rename/remove/reorder transforms); enums (seed defaults only) in
    `src/constants/quotes.ts`; refresh tick `src/lib/quotes-refresh.ts`; CSV importer
    `src/lib/quotes-import.ts` (**no external API** — Source/Category match a configured key **or** label,
    unknown rows skip; links resolve against local Show/Book rows; CSV ends with an `is_favorite` column).
    **No metadata API** ("Discover Quotes" is out of scope). Quotes **re-skins Books/Shows**: it reuses
    `SelectMenu` / `SegmentedTabs` / `SwipeRow` / `Toggle` / `StatusChip` / `ReorderList` and the shared
    `Thumb`, and adds the shared **`TagInput`** + **`QuoteListEditor`** (add/rename/delete/reorder editor).
    `QuoteSourceLinkSheet` (local overlay — **not** a route sheet) searches local shows/books.
    **Moment-of-Zen** dashboard (favourites-first random + shuffle/pull-to-refresh). Screens `QuotesZen` /
    `QuotesLibrary` / `QuotesEntry` / `QuotesSettings` / `QuotesFieldsSheet` / `QuoteSourceTypesSheet` /
    `QuoteCategoriesSheet` / `ImportQuotesSheet`.
- **Medical (built):** multi-year lab results + narrative reports. Three tables `medical_lab_test`
  (reference/seed, read-only to clients), `medical_report`, `medical_result` (migrations
  `10_medical_schema.sql` + `11_medical_seed_lab_test.sql`) plus nine `profile.medical_*`
  columns (`12_medical_profile_settings.sql`: tracked tests, section/test order, visible fields,
  importer toggle, and the four lock columns). **Reference ranges are stored exactly as printed** (the app
  never computes a range); cross-provider values are **normalized to each test's canonical `default_unit`
  at import** (flagged `normalized`, original kept in `value_num_original`/`unit_original`). Data
  `src/data/medical.ts` (`saveReport`/`saveReportResults` idempotent delete-then-insert,
  `saveImportedReport` idempotent on date+type, `listResultsWithReportMeta`). Pure logic
  `src/lib/medical.ts` (the `MEDICAL_LAB_TESTS` seed source-of-truth + drift test, enums, `labTestByKey`,
  `orderResultsForDisplay`, flag colours, `EYE_REFRACTION_*`), `medical-units.ts` (`normalizeResult`),
  `medical-import.ts` (tolerant JSON repair + `matchTestKey`), `medical-draft.ts` (shared draft + the
  `MedicalResultCard` editor, reused by the importer), `medical-trends.ts` (Dashboard derivations),
  `medical-order.ts` (M5 reorder model), `medical-lock.ts` (PBKDF2 PIN + timeout/idle + flags),
  `medical-webauthn.ts` (optional platform-authenticator unlock), `medical-refresh.ts`. **Intake** is a
  structured **JSON/CSV import** produced outside the app by any vision AI (no in-app OCR — it mangles
  decimals); originals are **Google Drive links**, never stored files. **Dashboard** = inline-SVG
  sparkline grid (tap → lazy-recharts `MedicalTrendChart`) + latest-value-per-test by category + reports
  timeline (`useMedicalTrends`, `Sparkline`, `constants/medical-ranges.ts`). **Display order** is a
  drag-to-reorder sheet over the in-house `ReorderList`. A **biometric/PIN lock** (`MedicalLockProvider`
  gate in `AppShell`, `MedicalLockScreen`, `PinInput`) is a **client-side UX gate over RLS-protected
  data**, not a server-verified boundary. Eye reports get a structured **refraction grid**
  (`EyeRefractionFields`). Screens `MedicalDashboard` / `MedicalReports` / `MedicalReportDetail` /
  `MedicalEntry` / `MedicalSettings` / `MedicalFieldsSheet` / `MedicalTrackedTestsSheet` /
  `MedicalOrderSheet` / `MedicalLockSheet` / `ImportMedicalSheet`.
- **Travel (built):** trips as **Days → Stops** itineraries + a visited-places map + a per-trip expenses
  layer. **Five tables** `trip` / `trip_day` / `stop` / `trip_expense` / `remembered_city` (migration
  `supabase/migrations/13_travel_schema.sql`; hard delete cascades trip → day → stop and
  trip → expense) + two `profile` columns `travel_expense_categories` (JSONB) + `travel_visible_fields`
  (`text[]`, **NULL = all visible**, Trip-form field visibility)
  (`14_travel_profile_settings.sql`). **Expense categories are the Quotes pattern** — a `{key,label}`
  JSONB list on profile (no table); `trip_expense.category` stores the stable key; edited via the shared
  **`ConfigListEditor`** (the generalized former `QuoteListEditor`, decoupled via `count`/`reassign`/
  `onChanged` props — also used by Quotes). Data `src/data/travel.ts` (trip/day/stop/expense CRUD +
  reorder + `getTripBundle` + `recomputeTripDates` + `listTripFacetRows` + `rememberCity` +
  category count/reassign). Pure logic: `src/lib/travel.ts` (row aliases, status palette, trip-list
  filter/sort — incl. rating filter + companion search + `sortField`×`sortDir` — facets, and
  `TRIP_ENTRY_FIELDS` + `isFieldVisible`), `travel-stats.ts` (visited-only distinct counts; `CHINA_PROVINCE_TOTAL = 34`),
  `places.ts` (`snapProvince` to a canonical `CHINA_PROVINCES` name + on-demand Nominatim `geocodeCity`),
  `travel-geo.ts` (`resolveCountryName` + bundled-GeoJSON URLs), `trip-fx.ts` (per-trip first-day rates on
  `fetchRateToHkdOn`), `expenses.ts` (per-currency + HKD totals, breakdown, `formatMoney`), `reimburse.ts`
  (safe mini-parser, **never `eval`**), `travel-config.ts` (category list helpers), `travel-expense-import.ts`
  (wide CSV → split expenses), `itinerary-import.ts` (tolerant JSON → trip drafts), `travel-refresh.ts`.
  Constants in `src/constants/travel.ts` (enums + labels, `CURRENCIES`, `TRAVEL_EXPENSE_CATEGORIES`,
  `CHINA_PROVINCES`). **Map** = **Leaflet** (lazy `TravelMapCanvas`) over OSM tiles + markercluster dots +
  a layered `regionName → shape` fill (DataV China provinces + Natural Earth world countries, vendored in
  `public/geo/`, **not** precached; a build-time `travel-geo.test.ts` asserts the names line up).
  **Stop cost is informational only — never summed**; the Expenses layer is the authoritative spend total.
  Local overlays (not route sheets, so the Builder draft survives): `CitySearchSheet` / `StopEditorSheet` /
  `ExpenseEditorSheet` + the in-file Reorder-Days sheet. Screens `TravelDashboard` / `TravelMap` /
  `TravelTrips` / `TripBuilder` / `TravelSettings` / `TravelFieldsSheet` / `TravelCategoriesSheet` /
  `ImportTravelExpensesSheet` /
  `ImportTravelTripsSheet`. Per-trip **FX overrides** live in the Expenses tab, not Settings. CSV/JSON
  importers in Settings (`travel-expenses-template.csv`, `travel-itinerary.schema.json` + prompt in
  `templates/`; real `travel-expenses*.csv` gitignored).

## Stack (do not substitute without asking)

- React + Vite + TypeScript (strict), Tailwind CSS, `vite-plugin-pwa`, React Router (the unified
  `react-router` package — import from `react-router`).
- Supabase (Postgres + Auth + Google OAuth) for data, auth, and cross-device sync.
- `@zxing/library` + `@zxing/browser` for barcode scanning. **Recharts** powers the Net Worth dashboard
  trend chart (and the Medical + Travel breakdown charts), lazy-loaded into its own chunk.
- **Leaflet** + `leaflet.markercluster` power the **Travel** map (imperative, no react-leaflet;
  lazy-loaded into its own chunk via `src/components/TravelMapCanvas`). OSM tiles + keyless **Nominatim**
  (on-demand geocode assist); the China-province + world-country GeoJSON are **vendored** in `public/geo/`.
- Food data: USDA FoodData Central (search) + Open Food Facts (barcode). FX: keyless **Frankfurter**
  (ECB) for Net Worth native→HKD rates and Travel per-trip first-day rates (`src/lib/fx.ts` +
  `src/lib/trip-fx.ts`).

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
- **App access is gated to an optional email allowlist** (`VITE_ALLOWED_EMAILS`): `src/lib/access.ts`
  (`isEmailAllowed`) + enforcement in `src/auth/AuthProvider.tsx` sign out any account whose email
  isn't listed (empty list ⇒ no restriction). This is a convenience layer over RLS + the Supabase/
  Google sign-up controls (see `OWNER-RUNBOOK.md` Part H3), not a replacement for them. `access.ts`
  also exposes `parseOAuthError`, which `AuthProvider` captures from the redirect URL on first render
  so Login surfaces a failed sign-in (e.g. `signup_disabled` after a `db reset` wipes `auth.users`)
  instead of looping silently.

## Database workflow

- Schema changes are written as **migration files** in `/supabase/migrations/` (Supabase CLI format).
  You draft the migration; the human reviews and applies it with `supabase db push`.
- **Migration filenames are `NN_<module>_<name>.sql`** — a two-digit global ordinal (apply order) +
  the module + a short name (e.g. `01_wellness_schema.sql`, `05_shows_profile_settings.sql`,
  `11_medical_seed_lab_test.sql`). The ordinal is the Supabase migration version and fixes apply order
  (dependencies: `01_wellness_schema.sql` creates `profile`, so every `*_profile_settings.sql` is later).
  A new module appends the next ordinal. Renaming/renumbering changes the version, so it only reconciles
  via a full **`supabase db reset --linked`** (a `db push` can't), which matches the owner's reset workflow.
- **Never** mutate the production schema directly, and **never drop a table**, without explicit confirmation in the conversation.
- After applying a migration, regenerate `/src/types/database.ts`.

## Naming

- Tables: singular, `snake_case` (`food`, `diary_entry`, `strength_set`).
- TS types/components: `PascalCase`. Files: `kebab-case`. Be consistent above all.

## Enforcement (these run automatically; don't rely on memory alone)

- Prettier (format), ESLint (lint, no unused, no `any`), type-check via **`npm run typecheck`** (`tsc -p tsconfig.app.json`; a bare `tsc --noEmit` checks nothing — the root `tsconfig.json` is
  references-only), and Vitest (tests). All four run via the pre-commit hook and/or CI and are wrapped by `npm run check` — code must pass them before it is considered done.
