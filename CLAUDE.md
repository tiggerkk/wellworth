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

- Built modules: **Wellness, Net Worth, Shows, Books, and Quotes** (all feature-complete).
- Steps are entered **manually**. Do not attempt HealthKit / native step sync (impossible in a PWA).

## App structure (multi-module — current state)

The app is a multi-module PWA behind a **Home hub** (`/home`): module cards launch into **Wellness**
(`/wellness/*`), **Net Worth** (`/networth/*`), **Shows** (`/shows/*`), **Books** (`/books/*`), or
**Quotes** (`/quotes/*`); `/` redirects to the last-used module. Adding a module is a **drop-in** —
append a `ModuleDef` to `src/constants/modules.ts` + its routes.

- **Routing:** flat children of one `<AppShell/>` in `src/router.tsx`; **all path strings live in
  `src/constants/routes.ts`** (single source of truth). `src/constants/modules.ts` (`MODULES` +
  `moduleForPath`) drives the hub cards + per-module `BottomNav`. Modal **sheets** use the
  background-location pattern (`useSheetNavigate`); `AppShell.TAB_FOR_PATH` paints the tab behind a
  sheet. `/` → `RootRedirect` (last-used module via `src/lib/last-module.ts`, else `/home`).
  **Escape-to-dismiss** is centralised in `src/hooks/useEscapeKey.ts` (one document listener over a LIFO
  stack so the innermost overlay wins): sheets/Calendar/SelectMenu close themselves, and the Add/Edit
  screens `navigate(-1)` only when nothing is layered above them.
- **Settings is split:** global `/settings` (profile, units, account) from the hub gear; per-module
  sub-settings from a gear in the module header — Wellness at `/wellness/settings` (protein target,
  nutrient display), Shows at `/shows/settings`, Books at `/books/settings`, and Quotes at
  `/quotes/settings` (each of the latter three: Entry field-visibility + CSV-importer toggle).
- **Net Worth (built):** two tables `networth_snapshot` + `asset_entry` (migration `supabase/migrations/20260615120000_networth_schema.sql`). Data:
  `src/data/networth-snapshot.ts` + `asset-entry.ts` — write path `saveSnapshotEntries` is an
  **idempotent create-or-replace per month** (reused by the importer). Calc `src/lib/networth.ts`; FX
  `src/lib/fx.ts` (Frankfurter; **currency stored as `CNY`**, no RMB→CNY map; each entry freezes
  `fx_rate_to_base` + `value_base`); refresh tick `src/lib/networth-refresh.ts`; CSV import
  `src/lib/networth-import.ts`; windows `src/constants/networth-ranges.ts`; lazy chart
  `src/components/NetWorthTrendChart.tsx`; screens `NetWorthDashboard` / `NetWorthEntry` /
  `ImportNetWorthSheet`.
- **Shows (built):** TV, movies & **documentaries**. One table `show` (migration
  `supabase/migrations/20260617120000_shows_schema.sql` — `type` ∈ `tv|movie|documentary`, an
  `is_favorite` boolean + a `(user_id, is_favorite)` index, **no** `content_rating`/`master_series`;
  `poster_path` holds **either** a TMDB path **or** a full pasted image URL) plus three `profile` columns
  `show_visible_fields` / `show_importer_enabled` / `show_poster_url_visible`
  (`20260617130000_profile_show_settings.sql`). Data `src/data/show.ts` (CRUD + idempotent
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
  (three-way Type, favourite heart, Poster URL shown only when TMDB lacks one or forced on in Settings,
  Want⇒blank Start Date, ⟳ Refresh, `?title=&poster=&overview=&type=` prefill) / `ShowsSettings` (incl. a
  Display → Visible Poster URL toggle) / `ShowsFieldsSheet` / `ImportShowsSheet` (CSV ends with an
  `is_favorite` column). **Calendar** was generalized to a presentational component with an optional
  `loadCues` (Wellness Diary injects food/activity dots; Shows date pickers pass none).
- **Books (built):** one table `book` (migration `supabase/migrations/20260620120000_books_schema.sql` —
  incl. an `is_favorite` boolean + `(user_id, is_favorite)` index) plus two `profile` columns
  `book_visible_fields` / `book_importer_enabled`
  (`20260620130000_profile_book_settings.sql`). Data `src/data/book.ts` (CRUD + idempotent
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
- **Quotes (built):** one table `quote` (migration `supabase/migrations/20260621120000_quotes_schema.sql`)
  plus two `profile` columns `quote_visible_fields` / `quote_importer_enabled`
  (`20260621130000_profile_quote_settings.sql`). The `quote` table denormalises `author`/`title`/
  `source_type` and has optional `show_id`/`book_id` FKs (**ON DELETE SET NULL**) + a generated
  `text_norm` with `UNIQUE(user_id, text_norm)` (no exact duplicates / import idempotency). Data
  `src/data/quote.ts` (CRUD + `listDistinctTags` + idempotent `saveImportedQuotes` via
  `onConflict:'user_id,text_norm'`). Pure logic `src/lib/quotes.ts` (`detectLanguage` CJK→zh,
  `quoteSearchText`, category-chip class, `LinkCandidate`/`filterLinkCandidates`, Zen `initialZenPool`/
  `nextZenPool`/`randomItem`, Library `applyLibraryView`/`quoteTags`, `QUOTE_ENTRY_FIELDS`/
  `isFieldVisible`); enums in `src/constants/quotes.ts`; refresh tick `src/lib/quotes-refresh.ts`;
  CSV importer `src/lib/quotes-import.ts` (**no external API** — links resolve against local Show/Book
  rows; CSV ends with an `is_favorite` column). **No metadata API** ("Discover Quotes" is out of scope). Quotes **re-skins Books/Shows**: it
  reuses `SelectMenu` / `SegmentedTabs` / `SwipeRow` / `Toggle` / `StatusChip` and the shared `Thumb`,
  and adds the new shared **`TagInput`**. `QuoteSourceLinkSheet` (local overlay — **not** a route sheet)
  searches local shows/books. **Moment-of-Zen** dashboard (favourites-first random + shuffle/pull-to-
  refresh). Screens `QuotesZen` / `QuotesLibrary` / `QuotesEntry` / `QuotesSettings` / `QuotesFieldsSheet`
  / `ImportQuotesSheet`.

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
