# 02 — Tech Spec

## Stack

- **Frontend:** React + Vite + TypeScript (strict mode). Tailwind CSS (v4, CSS-first via
  `@tailwindcss/vite`). `vite-plugin-pwa` for install/offline. **React Router** (the unified
  `react-router` package) for routing + modal sheets. **Recharts** powers the Net Worth dashboard
  trend chart; it's **lazy-loaded** (its own chunk) so it stays out of the initial bundle.
- **Barcode:** `@zxing/browser` (`BrowserMultiFormatReader`) + `@zxing/library` decoding the device
  camera via `getUserMedia`. Requires HTTPS (localhost is exempt for dev). The scanner is lazy-loaded
  so ZXing is a separate chunk, fetched only when scanning.
- **Backend-as-a-service:** Supabase — Postgres, Auth (Google OAuth), auto-generated REST, RLS.
- **Hosting:** Vercel / Netlify / Cloudflare Pages (any free tier; HTTPS automatic).
- **Food data:** USDA FoodData Central (search + nutrients, free data.gov key, ~1000 req/hr,
  public domain); Open Food Facts (barcode lookup, free).

## Folder structure

```
src/
  components/        # shared, reusable UI only
  screens/           # one folder per screen/tab
  data/              # typed data-access layer (wraps supabase-js) — the ONLY db access
  lib/               # supabase client, units, dri, energy, met, nutrients, targets, report,
                     # date, food-api, off-api, food-search, diary-refresh, diary-clipboard, csv,
                     # networth, fx, networth-refresh, shows, shows-refresh, tmdb-api, shows-import,
                     # books, books-refresh, books-api, books-import, last-module helpers
  constants/         # global constants (groups, effort-levels, nutrient-sections, ranges,
                     # profile-defaults, seed-activities, routes, modules)
                     # routes.ts = all route paths (one source of truth); modules.ts = the
                     # Home-hub module registry (ModuleDef + moduleForPath)
                     # activity-icons.ts maps icon name strings to named Tabler imports
  types/             # database.ts (generated), domain types
  hooks/
supabase/
  migrations/        # source-of-truth SQL migrations
docs/                # the spec bundle
```

## Navigation & routing

- The app is **multi-module behind a Home hub**. Routes are **URL-namespaced per module**
  (`/wellness/*`, `/networth/*`, `/shows/*`; future `/quotes/*`) and declared as flat children of a
  single `<AppShell/>` layout in `src/router.tsx`. Path strings live in `src/constants/routes.ts`
  (one source of truth) and the hub/bottom-nav are derived from `src/constants/modules.ts`
  (`MODULES` + `moduleForPath`). Adding a module = a `ModuleDef` + its routes — no structural change.
- The index route `/` is a `RootRedirect` to the **last-used module** (`localStorage`, via
  `src/lib/last-module.ts`), falling back to `/home`. Login and the PWA `start_url`/OAuth redirect all
  land on `/` and flow through it.
- `AppShell` renders the per-module `BottomNav` (a leading **Home** item + the module's tabs) only
  when in a module; the hub and global Settings have none. Modal **sheets** use React Router's
  **background-location** pattern — opening a sheet stashes the current location as
  `state.background`, and `AppShell` paints that tab (via `TAB_FOR_PATH`) behind the sheet. New sheets
  live under their module's prefix and are opened with `useSheetNavigate`.

## Data flow

UI (`screens` + `components`) → `data/*` repository functions → `supabase-js` query builder →
Supabase (Postgres + RLS). Components hold no SQL and never import the Supabase client directly.

## Auth & first-run

- Supabase Auth with the Google provider. (You'll create a Google OAuth client in Google Cloud and
  paste its ID/secret into Supabase → Authentication → Providers → Google.) The client is created
  once in `src/lib/supabase.ts` with **`flowType: 'pkce'`** set explicitly — the bare supabase-js
  client otherwise defaults to the implicit flow. A SPA needs no `/auth/callback` route;
  `detectSessionInUrl` exchanges the `?code=` on load.
- On first successful login, a client-side hook (`useEnsureProfile`) seeds the owner's data: it
  creates the `profile` row (defaults from `05-seed-data.md`) **and** seeds the owner's activity
  library (the activities in `05-seed-data.md`) if the user has none. Both are idempotent
  (insert-if-missing), guarded against React StrictMode double-invoke; not DB triggers. The user then
  edits in Settings.

## Sync

Supabase is the single source of truth; all devices read/write it. Optional local caching is fine but
the cloud is authoritative (this also sidesteps iOS PWA storage eviction).

## Wellness Calculations (implement as pure helpers in `src/lib`)

- **BMR (Mifflin–St Jeor):**
  `BMR = 10*kg + 6.25*cm − 5*age − 161` (female); use `+5` instead of `−161` for male.
- **Energy (calorie) target:** `BMR × activityFactor` (default 1.4, adjustable later). Do not hardcode.
- **Activity energy (duration):** `kcal = MET × kg × hours`. Logged as a negative diary entry.
- **Activity energy (strength):** same formula `kcal = MET × kg × hours`, where MET is resolved from `activity.met_by_effort[session_effort]`. No hardcoded MET for strength activities.
- **Net energy:** `Net = Consumed − BMR − Activity`.
- **Nutrient scaling:** for a logged entry, `value = nutrientPerBasis × (amount × servingGrams) / basisGrams`, where basis is 100 g (`basisGrams = 100`) or one serving (`basisGrams = the selected serving's grams`). Supplements typically use the per-serving basis; for a per-serving food the first/selected serving's grams define the basis.
- **Targets / DRI:** computed from profile via a lookup in `src/lib/dri.ts`. **Phase 1 populates only
  the owner's band — adult female 51–70** (the lookup is keyed by sex/age band; unsupported bands
  throw with a "add a band" message). **Protein target** is overridden by `profile.protein_target_g`
  when set, else the RDA. Nutrients with only an energy-percentage guideline get **energy-derived
  soft targets** computed from the day's energy target: `fat` (35% of kcal), `saturated` (10%),
  `added_sugars` (10%). `cholesterol`/`monounsaturated`/`polyunsaturated` have no target.
- **Upper limits / red bars:** each upper limit is **scope-tagged** (`total` | `cdrr` | `supplemental`
  | `guidance`). A bar turns red only when the value exceeds a limit whose scope is `total`, `cdrr`
  (sodium's chronic-disease-risk ceiling, 2300 mg), or `guidance` (e.g. added sugars > 10% kcal).
  Limits that apply only to supplemental/synthetic forms — magnesium (350), niacin (35), folic acid
  (1000), vitamin E (1000), preformed vitamin A (3000) — are stored for reference but **never** turn a
  food-intake bar red (a normal diet routinely exceeds them). Logic: `ulScope` in `src/lib/dri.ts` +
  `isOverUpperLimit` in `src/lib/nutrients.ts`.
- **Units:** stored metric; convert at display only via `src/lib/units.ts`. `1 oz = 28.3495 g`,
  `1 lb = 453.592 g`, `1 inch = 2.54 cm`, `1 fl oz = 29.5735 ml`. kcal/nutrient amounts are
  unit-independent. In Imperial mode, **Settings shows height in inches and weight in lb** (decimal);
  food nutrient amounts and the per-100 g basis are not re-expressed in imperial.

## Net Worth Calculations

- `value_base = value_native × fx_rate_to_base` (HKD ⇒ rate 1).
- **Net worth(month)** = `SUM(value_base)` over that snapshot's entries.
- **Asset-type trend** = group a snapshot's entries by `asset_type`, `SUM(value_base)` per type, per month. (Grouping is by the fixed enum, so renaming a holding never breaks the lines.)
- **Data:** `src/data/networth-snapshot.ts` + `src/data/asset-entry.ts`. Write path
  `saveSnapshotEntries(userId, month, rows)` = get-or-create the month's snapshot, delete its `asset_entry` rows, insert the new set — **idempotent per month** (reused by the CSV importer). The dashboard reads via `listSnapshotsWithEntries` (one embedded `networth_snapshot → asset_entry` select; slice the window client-side).
- **Calc:** `src/lib/networth.ts` — `ASSET_TYPES`/labels, `DETAIL_FIELDS`, `valueBase`/`totalBase`/`groupByType`/`typeTotals`/`typeBreakdown`, `formatHkd`/`formatHkdCompact`, `ASSET_TYPE_COLORS`.
- **FX:** `src/lib/fx.ts` — keyless **Frankfurter** native → HKD for the month's 1st (most recent rate on or before it if the 1st is a non-trading day); **CNY is the stored code**; HKD = 1; failures non-fatal. The rate + `value_base` are **frozen** on each `asset_entry`, so saved months are immune to later revisions.
- **Refresh:** `src/lib/networth-refresh.ts` (`bumpNetWorth`/`useNetWorthVersion`), separate from the Wellness `diary-refresh` tick.
- **CSV import:** `src/lib/networth-import.ts` (`parseNetWorthCsv` + `stripNumber` — strips
  thousands commas/quotes from values and detail values) + `src/screens/ImportNetWorthSheet.tsx`.
- **UI:** `NetWorthDashboard` (recharts trend via the **lazy** `src/components/NetWorthTrendChart`, own chunk; windows in `src/constants/networth-ranges.ts`), `NetWorthEntry` (copy-forward, grouped inline edit, manual+auto FX, RESET/SAVE).

## Shows

- **Data:** `src/data/show.ts` — `listShows`/`getShow`/`createShow`/`updateShow`/`deleteShow` over the
  single `show` table (hard delete; nothing references the row). `src/lib/shows-refresh.ts`
  (`bumpShows`/`useShowsVersion`) is the module's data-changed tick.
- **Logic** (`src/lib/shows.ts`, pure + tested): the `type`/`status`/`lgbtq_rep` unions + label maps,
  the status-chip palette, `posterUrl` (built from the fixed TMDB CDN base), and transitions/selectors —
  `startWatching` (status `watching` + `start_date = today`), `markWatched` (status `watched` +
  `end_date = today` + TV watched counts → totals), `progressLabel`, `isUpNext` (status `watching`,
  TV, episodes remaining), `recentlyWatched`, `countWatchedThisYear`.
- **UI:** `ShowsDashboard` (Up Next / Watching / Want / Recently-Watched shelves + type filter + Mark
  Watched / Start Watching quick actions), `ShowsLibrary` (search + swipe-delete list), `ShowsEntry`
  (create/edit form with TMDB title search; outer-loader + inner-form with dirty RESET/SAVE). The
  Type/Status/LGBT+ controls reuse `SegmentedTabs`; dates reuse the generalized `Calendar`; posters
  use the shared `PosterThumb`. **TMDB** client + `TitleSearchSheet` live in `src/lib/tmdb-api.ts` and
  `src/components/TitleSearchSheet.tsx`.
- **Settings (split, like Wellness):** `ShowsSettings` (gear in the Shows headers) hosts **Entry field
  visibility** (`ShowsFieldsSheet`, a route sheet of toggles) + an **importer enable** toggle. Both
  prefs sync on `profile` — `show_visible_fields` (`text[]`, **NULL = all visible**) and
  `show_importer_enabled` (`boolean`); saved via `useProfileEditor`. Entry reads them through
  `useProfile` + the pure `isFieldVisible` helper.
- **CSV importer (in-app):** enabled by the Settings toggle → `ImportShowsSheet`. Pure
  parse/build in `src/lib/shows-import.ts` (`parseShowsCsv` via the shared `src/lib/csv.ts`,
  `buildImportRow`, `dedupKey`); the sheet resolves each row against TMDB (`searchTitles` top hit +
  `getTitleDetails`, small concurrency pool) with an inline fix (`TitleSearchSheet`) for no-match /
  review rows; commit is the **idempotent** `saveImportedShows` (`src/data/show.ts`) — dedup on
  `type` + lower(title), update-not-duplicate. Imported rows get **NULL dates**. Sanitized template +
  guide in `templates/`.

## Books

_Books re-skins Shows (see the Shows section); only the differences are noted._

- **Data:** `src/data/book.ts` — `listBooks`/`getBook`/`createBook`/`updateBook`/`deleteBook` over the
  single `book` table (hard delete; nothing references the row). `src/lib/books-refresh.ts`
  (`bumpBooks`/`useBooksVersion`) is the module's data-changed tick.
- **Logic** (`src/lib/books.ts`, pure + tested): the `status`/`lgbtq_rep` unions + label maps (the
  generated types surface the CHECK columns as plain `string`), the `BOOK_STATUS_CHIP` palette,
  `bookSearchText` (title + authors), and the transitions `startReading` (status `reading` +
  `start_date = today`) and `markRead` (status `read` + `end_date = today`). No watched-count logic —
  books are status-only. The 3-value `LGBTQ_REP*` enum is defined locally (not imported from `shows.ts`)
  to keep the modules decoupled. Dashboard selectors `currentlyReading`/`recentlyRead`/`wantToRead`/
  `countReadThisYear` mirror the Shows ones; the Library view is `applyLibraryView(books, criteria)`
  (query over title+authors; Status/Genre/Rating-min/LGBT+/**Author** filters; start & finish date
  ranges; sort field×dir, nulls-last, stable title tiebreak) with `bookGenres`/`bookAuthors` driving the
  facet dropdowns. The **Author** filter + sort field are the only divergence from the Shows view (which
  has Type instead).
- **UI:** `BooksEntry` (create/edit form; outer-loader + inner-form with the `JSON.stringify` dirty
  RESET/SAVE; Status/LGBT+ reuse `SegmentedTabs`, dates reuse `Calendar`, rating reuses `StarRating`).
  `BooksLibrary` (search + a collapsible filter panel of `SelectMenu`s + a Sort menu + cover rows;
  swipe-delete). `BooksDashboard` (Currently Reading / Recently Read / Want to Read shelves + Mark Read
  / Start Reading quick actions + an "N read this year" stat; no type filter).
- **Shared 2:3 thumbnail:** the poster/cover tile was extracted into a presentational
  `src/components/Thumb.tsx` (`url` + `className`); `PosterThumb` (Shows, TMDB sizing via `posterUrl`)
  and `CoverThumb` (Books, the full `cover_url`) both render it. `StatusChip` was likewise made
  presentational (`label` + palette `className`) so Shows and Books share one chip — neither duplicates
  the visual.
- **Metadata:** `src/lib/books-api.ts` — **Google Books** search/details with an **Open Library**
  fallback (and ISBN/cover lookup); the local `BookSearchSheet` overlay (not a route sheet) populates
  the Entry form on select; persisted only on CREATE/SAVE. `cover_url` stores a **full image URL** (no
  CDN base; Google thumbnails are normalized `http→https`). Optional `VITE_GOOGLE_BOOKS_API_KEY` raises
  quota — `books-api.ts` **never throws when it's unset** (unlike `tmdb-api.ts`), since the API works
  keyless. Pure mappers are unit-tested; the network calls are not (matching `tmdb-api`/`food-api`/`fx`).
  - **Rate-limit handling:** the keyless quota is low, so a 429 surfaces as a distinct
    `BookSearchRateLimitError` and **does not** fall back to Open Library (a 429 means "slow down", not
    "no results" — and OL is unreachable from some regions). `searchBooks`/`getBookDetails` accept an
    `AbortSignal`; the search overlay debounces 600 ms and **cancels the in-flight request** on the next
    keystroke; the importer uses a small pool (3) and **retries a row on 429 with backoff**. The fix for
    sustained 429s is to set the (free) `VITE_GOOGLE_BOOKS_API_KEY`.
  - **Result ranking** (`rankSearchResults`, pure + tested): the **interactive** overlay re-ranks the
    fetched hits — titles that **start with** the typed query first, then titles that **contain** it,
    then the rest; within a tier, **year descending** (undated last), stable on the upstream relevance
    order. The importer does **not** re-rank (its query is `"title author"`, so it keeps Google's raw top
    hit).
- **Settings (split, like Shows):** `BooksSettings` (gear in the Books headers) hosts **Entry field
  visibility** (`BooksFieldsSheet`, a route sheet of toggles over `BOOK_ENTRY_FIELDS`, auto-saving via
  `useProfileEditor`) + an **importer enable** toggle. Both prefs sync on `profile` —
  `book_visible_fields` (`text[]`, **NULL = all visible**) and `book_importer_enabled` (`boolean`).
  Entry reads them through `useProfile` + the pure `isFieldVisible` helper (Title/Status/Search always
  shown).
- **CSV importer (in-app):** enabled by the Settings toggle → `ImportBooksSheet`. Pure
  parse/build in `src/lib/books-import.ts` (`parseBooksCsv` via the shared `src/lib/csv.ts`,
  `buildImportRow`, `dedupKey`) — columns `title,author,rating,lgbtq_rep,end_date`; the sheet resolves
  each row against Google Books (`searchBooks` of `title author` top hit + `getBookDetails`, a small
  concurrency pool) with an inline fix (`BookSearchSheet`) for no-match / review rows; commit is the
  **idempotent** `saveImportedBooks` (`src/data/book.ts`) — dedup on lower(title) + lower(author),
  update-not-duplicate. Every imported row is **Read** with **NULL `start_date`/`last_update_date`**
  (`end_date` from the file). Reuses the in-house RFC-4180 parser `src/lib/csv.ts` (**not Papa Parse** —
  verified sufficient for the quoted/embedded-comma cells in the real Quotes seed). Sanitized template +
  guide in `templates/`.

## External APIs

- **Called directly from the browser** (no server proxy): the USDA key is a `VITE_` var and Open Food Facts allows browser requests. Results are cached into `food` on favorite/log to limit calls.
- **USDA FoodData Central** (`api.nal.usda.gov/fdc/v1`): free `api.data.gov` key. **Search uses POST** `/foods/search` with a JSON body — the GET form 400s when `dataType` includes `"Survey (FNDDS)"`. `searchFoods` issues **two POST searches** — the whole-food databases
  (`Foundation`/`SR Legacy`/`Survey (FNDDS)`) and `Branded` — and merges them whole-foods-first.
  This is deliberate: a single combined search ranks the thousands of identical Branded exact-name products (8000+ for "blueberries") above every varied whole-food entry, so they'd be the only thing on the page. Branded duplicates (same name + brand) are then collapsed and capped. The UI sorts the merged list (with local foods) by name-match relevance, so search only needs to guarantee variety. USDA matches **whole tokens**, so a partial word ("blueberr") returns nothing; `searchFoods` therefore wildcards the last word at a stem (`food-search.ts#toUsdaWildcardQuery`: "blueberry", "blueberries", "blueberrie", "blueberr" → `blueberr*`) so partial/plural input all returns the same set. Over-broad recall is fine — the UI scorer re-filters to the typed term.
  Detail is `GET /food/{fdcId}`. Map nutrients on the stable INFOODS **`nutrient.number`** (e.g. 208 energy kcal — not 268 kJ; 320 vitamin A µg RAE — not 318 IU; 435 folate µg DFE; 328 vitamin D µg; 312 copper mg). USDA amounts are per 100 g. When a USDA (or OFF) food is favorited or logged, cache a copy into `food` (`source`, `external_id`); plain search hits aren't persisted.
- **Open Food Facts** (`world.openfoodfacts.org/api/v2/product/{barcode}.json`): free, global. **Every `*_100g` value is in grams** (including vitamins/minerals) → scale to our mg (×1000) / µg (×1e6). Sodium = `salt_100g / 2.5 × 1000` when `sodium_100g` is absent. All fields optional/sparse. Scanned products save into Custom.
- The **complete** nutrient mappings are the source of truth in code: USDA `nutrient.number` → our key in `src/lib/food-api.ts`, and Open Food Facts key → our key (with the per-field scale factor) in `src/lib/off-api.ts`. The owner-band DRI target/UL values are tabulated in `05-seed-data.md` and live in `src/lib/dri.ts`.
- **Frankfurter** (`api.frankfurter.dev/v1/{date}?from={CNY|USD}&to=HKD`): **keyless**, ECB-sourced, CORS-enabled — used by **Net Worth** for native→HKD FX as of the **1st of the month** (it returns the most recent rate on/before a non-trading day). CNY is the stored code; HKD = 1 is never fetched. The fetched rate is **frozen** onto each `asset_entry` (`fx_rate_to_base`/`value_base`) so saved months are immune to later revisions; the user can override per currency. Helpers + a small cache live in `src/lib/fx.ts`.
- **TMDB** (`api.themoviedb.org/3`): free v3 `api_key` (one signup), a `VITE_` var, **called directly from the browser** (CORS-enabled) — same pattern as USDA. Used by **Shows**, two-step on-demand only: **search** per the Type toggle (`GET /search/{movie|tv}?query=…` → title, year, `poster_path`) and **details on select** (`GET /{movie|tv}/{id}?append_to_response=credits,external_ids` → genres, overview, runtime, movie director from `credits.crew`/TV `created_by`, top ~10 cast, TV `number_of_seasons`/`number_of_episodes`, `imdb_id`). Images store only `poster_path`; URLs are built from the fixed CDN base `https://image.tmdb.org/t/p/{size}{path}` (`posterUrl` in `src/lib/shows.ts`). The client + pure mappers live in `src/lib/tmdb-api.ts`; nothing persists until CREATE/SAVE. `content_rating` is not fetched (deferred).
- **Google Books** (`www.googleapis.com/books/v1`) + **Open Library** (`openlibrary.org`,
  `covers.openlibrary.org`): both **keyless-capable, CORS-enabled, browser-direct**, used by **Books**,
  two-step on-demand only. **Search** `GET /volumes?q=…` (Google) → title, authors, year (from
  `publishedDate`), `imageLinks.thumbnail`; **on empty/error it falls back** to Open Library
  `GET /search.json?q=…` (→ `author_name`, `first_publish_year`, `cover_i`, `isbn`). **Details on
  select** `GET /volumes/{id}` (Google `volumeInfo`) or `GET /works/{id}.json` (Open Library; merged
  with the carried search fields). Mapped into `book` columns in `src/lib/books-api.ts` (cover forced
  to https; ISBN prefers ISBN_13; OL `subjects`/Google `categories` → `genres`, capped). The optional
  `VITE_GOOGLE_BOOKS_API_KEY` only raises quota — the client never requires it. Nothing persists until
  CREATE/SAVE.

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

## Database workflow

**Schema changes ship as migration files** in `supabase/migrations/` (timestamp-prefixed,
`YYYYMMDDHHMMSS_name.sql`), reviewed and applied by you with `supabase db push` (remote-only — no
local Docker stack). RLS is enabled in the first migration for every table, **and migrations must
`GRANT` table privileges (select/insert/update/delete) to the `anon`/`authenticated` roles** — RLS
alone is insufficient because raw-SQL-migration tables don't inherit Supabase's default grants.
Enumerated TEXT columns use `CHECK` constraints (not Postgres enums); `updated_at` is maintained by
the `moddatetime` trigger. Regenerate `src/types/database.ts` (`npm run gen:types`) after each push.

## Quality gates (run automatically)

Prettier, ESLint (no unused, no `any`), `tsc --noEmit`, and Vitest for the calculation helpers.
Wire them into a pre-commit hook and/or CI so they always run.
