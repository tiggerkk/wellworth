# 02 — Tech Spec

## Stack

- **Frontend:** React + Vite + TypeScript (strict mode). Tailwind CSS (v4, CSS-first via
  `@tailwindcss/vite`). `vite-plugin-pwa` (`registerType: 'autoUpdate'`) for install/offline. **React
  Router** (the unified `react-router` package) for routing + modal sheets. **Recharts** powers the Net
  Worth dashboard trend chart (and the Medical + **Travel** expense-breakdown charts); it's
  **lazy-loaded** (its own chunk) so it stays out of the initial bundle.
- **Map:** **Leaflet** + `leaflet.markercluster` power the **Travel** map (imperative, no react-leaflet);
  **lazy-loaded** into its own chunk so Leaflet stays off the initial bundle.
- **Lazy chunks load via `src/lib/lazy-with-reload.ts` (`lazyWithReload`), not bare `React.lazy`.** After
  a deploy the installed PWA can reference the previous build's hashed chunk names; the missing
  `/assets/*.js` then returns the SPA fallback HTML ("'text/html' is not a valid JavaScript MIME type").
  `lazyWithReload` forces a **one-time** `location.reload()` (sessionStorage-guarded against loops) to pull
  fresh chunk names. Used by the Net Worth / Medical trend charts, the barcode scanner, and the Travel
  map + expense-breakdown chart.
- **Barcode:** `@zxing/browser` (`BrowserMultiFormatReader`) + `@zxing/library` decoding the device
  camera via `getUserMedia`. Requires HTTPS (localhost is exempt for dev). The scanner is lazy-loaded
  so ZXing is a separate chunk, fetched only when scanning.
- **Backend-as-a-service:** Supabase — Postgres, Auth (Google OAuth), auto-generated REST, RLS.
- **Hosting:** Vercel / Netlify / Cloudflare Pages (any free tier; HTTPS automatic).
- **Food data:** USDA FoodData Central (search + nutrients, free data.gov key, ~1000 req/hr,
  public domain); Open Food Facts (barcode lookup, free).
- **Map & place data (Travel):** OpenStreetMap tiles + **Leaflet** (keyless); **Nominatim** (keyless,
  on-demand) for geocode assist; bundled GeoJSON in `public/geo/` — **DataV.GeoAtlas** China provinces +
  **Natural Earth** world countries (vendored, served from our origin, excluded from the PWA precache).
  **Frankfurter** (keyless, ECB) for per-trip native→HKD FX.

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
supabase/
  migrations/        # source-of-truth SQL migrations
docs/                # the spec bundle
```

## Navigation & routing

- The app is **multi-module behind a Home hub**. Routes are **URL-namespaced per module**
  (`/wellness/*`, `/networth/*`, `/shows/*`, `/books/*`, `/quotes/*`, `/medical/*`, `/travel/*`) and declared as flat children of a
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
- **Escape-to-dismiss** is centralised in `useEscapeKey` (`src/hooks/useEscapeKey.ts`): one document
  listener over a LIFO handler stack, so the innermost overlay wins. Route `Sheet`s + local search
  sheets close themselves, the `Calendar` closes, an open `SelectMenu` collapses, and the Add/Edit
  screens `navigate(-1)` only when nothing is layered above them.

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
- **Access control + error surfacing (`src/lib/access.ts`, enforced in `AuthProvider`).** An optional
  build-time email allowlist (`VITE_ALLOWED_EMAILS`, parsed by `parseAllowlist`/`isEmailAllowed`) signs
  out any account whose email isn't listed (empty ⇒ no restriction) — a convenience layer over RLS +
  Supabase's sign-up controls, not a replacement (see `OWNER-RUNBOOK.md` H3). `parseOAuthError` reads an
  error the provider hands back on the redirect (`?error=…`/`#error=…`, captured during the first render
  before the router strips it) so Login explains a failed sign-in instead of looping silently — most
  notably `signup_disabled` after a `db reset --linked` wipes `auth.users` while sign-ups are off.

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
- **UI:** `NetWorthDashboard` (recharts trend via the **lazy** `src/components/NetWorthTrendChart`, own chunk; windows in `src/constants/networth-ranges.ts`), `NetWorthEntry` (copy-forward, grouped inline edit, manual+auto FX, the shared `EntryHeaderActions` header — Reset/Save + a Delete that removes the displayed month's snapshot).

## Shows

- **Data:** `src/data/show.ts` — `listShows`/`getShow`/`createShow`/`updateShow`/`deleteShow` over the
  single `show` table (hard delete; nothing references the row). `src/lib/shows-refresh.ts`
  (`bumpShows`/`useShowsVersion`) is the module's data-changed tick.
- **Logic** (`src/lib/shows.ts`, pure + tested): the `type`/`status`/`lgbtq_rep` unions + label maps
  (`type` includes **documentary**), the status-chip palette, `usesEpisodes` (TV + documentary carry the
  season/episode UI), `posterUrl` (an absolute pasted URL is returned as-is; a TMDB path gets the fixed
  CDN base — `isAbsoluteUrl` distinguishes them), `buildRefreshPatch` (the per-show Refresh merge:
  TMDB-sourced fields only, preserving owner fields + a manual poster), the `favoritesOnly`
  `LibraryCriteria` filter, and transitions/selectors — `startWatching`, `markWatched` (status `watched`
  - `end_date = today` + episodic watched counts → totals), `favoriteShows`, `progressLabel`, `isUpNext`,
    `recentlyWatched`, `countWatchedThisYear`.
- **TMDB (Chinese-aware)** (`src/lib/tmdb-api.ts`): a query/title containing CJK is sent with
  `language=zh-CN` (`containsCjk`/`tmdbLanguage`), so results + stored metadata use the Chinese title.
  `documentary` shares the `/tv` endpoint (`endpointFor`). `refreshFromTmdb(show)` re-pulls a title that
  already has a `tmdb_id` (Chinese-aware via its stored title) → fresh `ShowMetadata`; the pure
  `buildRefreshPatch` decides the diff and the data layer persists it. Persists only on CREATE/SAVE.
- **Posters:** every `<img>` bound to `poster_path` sets `referrerpolicy="no-referrer"` (added once on the
  shared `Thumb`, plus the Entry detail `<img>`), so hotlink-protected CDNs (a pasted Douban/streaming
  poster) still serve. The app stores image URLs/paths only, never files.
- **UI:** `ShowsDashboard` (Favourites / Up Next / Watching / Want / Recently-Watched shelves + type
  filter incl. Docs + Mark Watched / Start Watching quick actions; a shared `ShowStatusChip` puts the
  status pill on every row, watching rows additionally show season·episode progress, ♥ marks
  favourites), `ShowsLibrary` (search + swipe-delete list +
  documentary type filter + a **Favourites only** filter + ♥ on rows; the filter UI is the shared icon
  `FilterToggleButton` + `FilterPanel` + a `SortControl` whose fields include a **Dynasty** sort),
  `ShowsEntry` (create/edit form
  with a header **favourite heart**, Chinese-aware TMDB title search, a **Poster URL** field (auto-shown
  when TMDB has no poster; its Visible-Fields toggle — **off by default** — forces it always visible), a
  **⟳ Refresh from TMDB** button enabled once
  `tmdb_id` is set, status-driven Start-Date defaulting (Want ⇒ blank), and
  `?title=&poster=&overview=&type=` **prefill**; outer-loader + inner-form whose header is the shared
  `EntryHeaderActions` — icon Reset/Create/Save + a Delete when editing). **Type** reuses `SegmentedTabs`
  (three-way); **Status** and **LGBT+** are now `SelectMenu` dropdowns; dates reuse the generalized
  `Calendar` (its header opens a year-stepper + month grid); posters use the shared `PosterThumb`. **TMDB** client + `TitleSearchSheet` live in
  `src/lib/tmdb-api.ts` and `src/components/TitleSearchSheet.tsx`.
- **Settings (split, like Wellness):** `ShowsSettings` (gear in the Shows headers) hosts **Entry field
  visibility** (`ShowsFieldsSheet`, a route sheet of toggles — including the **Poster URL** toggle) and
  an **importer enable** toggle. Prefs sync on `profile` — `show_visible_fields` (`text[]`, **NULL = all
  visible**, default-on), `show_poster_url_visible` (`boolean`, **default off** — backs the Poster URL
  toggle, which can't live in the default-on `show_visible_fields`; means "force always visible", and the
  field still auto-shows when TMDB has no poster), and `show_importer_enabled` (`boolean`); saved via
  `useProfileEditor`. Entry reads them through `useProfile` + the pure `isFieldVisible` helper (Poster URL
  uses `show_poster_url_visible || no-TMDB-poster`).
- **CSV importer (in-app):** enabled by the Settings toggle → `ImportShowsSheet`. One CSV covers English +
  Chinese across all three types. Pure parse/build in `src/lib/shows-import.ts` (`parseShowsCsv` via the
  shared `src/lib/csv.ts`, `buildImportRow`, `dedupKey`); the sheet resolves each row against TMDB
  (Chinese-aware `searchTitles` top hit + `getTitleDetails`, small concurrency pool) with an inline fix
  (`TitleSearchSheet`) for no-match / review rows — a niche documentary with no match imports with null
  TMDB metadata + null poster (top up later via a pasted Poster URL or Refresh). The CSV's trailing
  `is_favorite` column is carried through. Commit is the **idempotent** `saveImportedShows`
  (`src/data/show.ts`) — dedup on lower(title), update-not-duplicate. Imported rows get **NULL dates**.
  Sanitized template + guide in `templates/`.

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
  `countReadThisYear` (plus `favoriteBooks`) mirror the Shows ones; the Library view is
  `applyLibraryView(books, criteria)` (query over title+authors; Status/Genre/Rating-min/LGBT+/Dynasty
  filters + a `favoritesOnly` toggle; start & finish date ranges; sort field×dir incl. a **Dynasty** sort,
  nulls-last, stable title tiebreak) with `bookGenres` driving the genre facet. **Author is searched, not
  filtered** (the filter was dropped — too many values — and `bookAuthors` is no longer used by the view),
  but remains a **sort** field; that Author sort and the absence of Type are the only divergences from the
  Shows view.
- **UI:** `BooksEntry` (create/edit form with a header **favourite heart**; outer-loader + inner-form
  with the `JSON.stringify` dirty check + the shared `EntryHeaderActions` header (icons + Delete when
  editing); Status/LGBT+ are now `SelectMenu` dropdowns, dates reuse `Calendar`, rating reuses
  `StarRating`). `BooksLibrary` (search + a collapsible filter panel of `SelectMenu`s + a
  **Favourites only** toggle + a Sort menu + cover rows with ♥; swipe-delete). `BooksDashboard`
  (Favourites / Currently Reading / Recently Read / Want to Read shelves + Mark Read / Start Reading
  quick actions + an "N read this year" stat; no type filter; a shared `BookStatusChip` puts the
  status pill on every row, like the Library).
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
  `buildImportRow`, `dedupKey`) — columns `title,author,rating,lgbtq_rep,end_date,is_favorite`; the sheet resolves
  each row against Google Books (`searchBooks` of `title author` top hit + `getBookDetails`, a small
  concurrency pool) with an inline fix (`BookSearchSheet`) for no-match / review rows; commit is the
  **idempotent** `saveImportedBooks` (`src/data/book.ts`) — dedup on lower(title) + lower(author),
  update-not-duplicate. Every imported row is **Read** with **NULL `start_date`/`last_update_date`**
  (`end_date` from the file). Reuses the in-house RFC-4180 parser `src/lib/csv.ts` (**not Papa Parse** —
  verified sufficient for the quoted/embedded-comma cells in the real Quotes seed). Sanitized template +
  guide in `templates/`.

## Quotes

_Quotes re-skins Books/Shows; only the differences are noted. There is **no external metadata API** —
"Discover Quotes" external fetch is out of scope._

- **Data:** `src/data/quote.ts` — `listQuotes`/`getQuote`/`createQuote`/`updateQuote`/`deleteQuote`
  (hard delete) over the single `quote` table, plus `listDistinctTags` (Entry autocomplete),
  `countQuotesByField`/`reassignQuoteField` (the delete-a-value migration for configurable lists), and the
  idempotent `saveImportedQuotes`. `src/lib/quotes-refresh.ts` (`bumpQuotes`/`useQuotesVersion`) is the
  module's data-changed tick.
- **Configurable lists** (`src/lib/quotes-config.ts`, pure + tested): Source Type and Category are
  **owner-configurable** — stored as JSONB arrays on `profile.quote_source_types` (`{key,label,linkKind}`)
  / `quote_categories` (`{key,label}`); `quote.source_type`/`category` store the stable `key` (no DB CHECK).
  `effectiveSourceTypes`/`effectiveCategories` resolve the override (NULL ⇒ the seed defaults in
  `src/constants/quotes.ts`; a non-null override is **authoritative** so a deleted default doesn't
  resurrect); `sourceTypeLabel`/`categoryLabel` fall back to the raw key (orphan tolerance); `linkKindFor`
  drives Show/Book linking; `matchKeyOrLabel` resolves an import cell; `generateKey` + add/rename/remove/
  reorder transforms; `isProtectedSourceKey` (tv/movie/book — undeletable so linking can't break).
- **Logic** (`src/lib/quotes.ts`, pure + tested): `detectLanguage(text)` (any CJK char ⇒ `zh`, else
  `en`); `quoteSearchText`; the `QUOTE_CATEGORY_CHIP` chip class (a single neutral palette — per-category
  colours are an optional, deferred nicety); the Library view `applyLibraryView(quotes, criteria)`
  (query over text+author+title+tags; Category / **multi-select Tags = OR** / Favourites / Source type /
  Language — Category/Source compare configured keys; plus the `showId`/`bookId` URL constraint) with
  `quoteTags` driving the tag facet, **plus a Sort menu** (Date = `created_at` / Category / Source Type,
  default Date descending; Category/Source sort on the stored key). The
  cross-module linker model is `LinkCandidate` + `filterLinkCandidates` (the screen maps `ShowRow`/`BookRow`
  → candidates, so `quotes.ts` stays decoupled from `shows.ts`/`books.ts`). The Zen randomiser is
  `initialZenPool` (favourites first, else all), `nextZenPool` (whole pool minus current — no immediate
  repeat), and `randomItem(items, random = Math.random)` (random injected for deterministic tests). Field
  visibility is `QUOTE_ENTRY_FIELDS` + the pure `isFieldVisible` (NULL prefs ⇒ all visible).
- **UI:** `QuotesEntry` (create/edit form; the outer loader fetches the quote **and** the profile once,
  passing the effective Source Type/Category lists down; inner-form with the `JSON.stringify` dirty check
  - the shared `EntryHeaderActions` header (icons + Delete when editing); Source Type/Category reuse
    `SelectMenu` with options from the configured lists — **Category defaults to the first value** like
    Source Type, no blank sentinel; Language reuses `SegmentedTabs` (an English/Chinese toggle), a header
    favourite heart; a **`23505` unique-violation** on save → inline "You already have this quote.").
    `QuotesLibrary` (search + a collapsible facet panel of `SelectMenu`s + a Favourites `Toggle` +
    Tag toggle-chips; swipe-delete; a "Quotes from this title" banner when constrained). `QuotesZen`
    (favourites-first random card; a **Shuffle** button + a hand-rolled **pull-to-refresh** Pointer-Events
    gesture on an inner scroller; metadata cluster with a title-as-`Link` to `/shows/:id` / `/books/:id`
    when linked; an optimistic favourite heart). A new **`TagInput`** component (chips + autocomplete,
    commit on Enter/comma) is shared by the Entry form (and the Library facet).
- **Cross-module linker:** `src/components/QuoteSourceLinkSheet.tsx` — a **local** `fixed inset-0`
  overlay (not a route sheet, which would remount Entry and lose the draft) that loads the user's `show`
  - `book` rows, maps them to `LinkCandidate`s (show thumb via `posterUrl`, book via `cover_url`), and
    returns the pick. Selecting binds `show_id`/`book_id` + denormalises Title/Source Type (+Author for a
    Book; a Show leaves Author for the speaker). The denormalised `author`/`title`/`source_type` mean a
    quote survives a linked record's hard-delete (the FK just nulls — `ON DELETE SET NULL`).
- **Apple Books / external ingestion:** the Add/Edit route reads `?text=&author=&title=` query params to
  prefill the form (copy-paste, or an optional Apple Books **Shortcut** that opens that URL — see the
  runbook). A **Paste from clipboard** button fills Quote Text from `navigator.clipboard`. No direct
  Apple Books API exists.
- **Settings (split, like Shows/Books — a Settings tab in the bottom nav):** `QuotesSettings` hosts
  **Entry field visibility** (`QuotesFieldsSheet`, a route sheet of toggles over `QUOTE_ENTRY_FIELDS`,
  auto-saving via `useProfileEditor`), a **Values** section that manages the **Source Type** and
  **Category** lists (`QuoteSourceTypesSheet`/`QuoteCategoriesSheet` route sheets over the shared
  **`QuoteListEditor`**: add/rename/inline-edit + drag-reorder via `ReorderList` (extended with a
  per-row `renderTrailing` slot) + delete; deleting an in-use value opens a reassignment picker that
  bulk-moves quotes then removes the value, the last value can't be deleted, and tv/movie/book are
  delete-protected), and an **importer enable** toggle. Prefs sync on `profile` —
  `quote_visible_fields` (`text[]`, **NULL = all visible**), `quote_source_types`/`quote_categories`
  (`jsonb`, **NULL = seed defaults**), and `quote_importer_enabled` (`boolean`). Entry reads visibility
  through `useProfile` + `isFieldVisible` (Quote Text + Category always shown).
- **CSV importer (in-app):** enabled by the Settings toggle → `ImportQuotesSheet`. Pure parse/validate
  in `src/lib/quotes-import.ts` (`parseQuotesCsv(rows, sourceTypes, categories)` via the shared
  `src/lib/csv.ts`; columns `Quote,Author,Source,Title,Category,Tags,is_favorite`; **Category/Source
  matched against the configured lists by key OR label (case-insensitive) via `matchKeyOrLabel`**, unknown
  ⇒ skip-with-error; **Tags read-whole-cell-then-split-on-`,`**, Language auto-detected, the trailing
  `is_favorite` boolean carried through), `partitionNewRows` (existing + in-file dedup on
  `lower(trim(text))`), and `buildTitleIndex`/`resolveLink` (optional Title→Show/Book link **by the source
  type's `linkKind`**: show→Show, book→Book, none→neither). The sheet (which also reads the profile lists)
  loads existing-norms + the local title index once (no external API, no concurrency pool), previews
  **new / duplicate / flagged** counts, and commits
  via the **idempotent** `saveImportedQuotes` — `upsert(..., { onConflict: 'user_id,text_norm',
ignoreDuplicates: true })` = the spec's `ON CONFLICT DO NOTHING`. Sanitized template + guide in
  `templates/`.

## Medical

_Feature-complete (M1–M7). Key tech decisions (the build history is in BUILD-LOG → "Medical Build
Sequence"):_

- **Intake is a structured import, not in-app OCR.** Extraction is done **outside** the app by any
  vision-capable AI tool (model-agnostic prompt + JSON schema in `templates/`); the app imports the
  result. OCR (Tesseract) is rejected — it mangles medical decimals (LDL 2.9 → 29). The importer (M3)
  accepts **JSON (primary)** + **CSV** (RFC-4180, the schema's `x-csv-equivalent` header), with a
  **tolerant JSON-repair** pre-pass for the observed AI glitch (a stray quote after a number, e.g.
  `8.6"`, and the resulting missing comma) before `JSON.parse`; an unparseable file shows a specific
  error. **Decimals are preserved exactly** — never re-derived.
- **Unit normalization (cross-provider).** Each `medical_lab_test.default_unit` is the **canonical
  unit**. At import a result is converted to it: the normalized value is stored in `value_num`/`unit`,
  `normalized` is set true, and the **printed original is preserved** in
  `value_num_original`/`unit_original`; `ref_low`/`ref_high` are converted by the same factor while
  `ref_text` stays verbatim. Conversions that change the number are a small explicit table (e.g.
  Haemoglobin & MCHC `g/L→g/dL` ÷10, uric acid `µmol/L→mmol/L` ÷1000); the rest are label-only
  canonicalizations so points trend together (`µmol/L`≡`umol/L`, `international unit/L`≡`U/L`,
  `K/mcl`≡`K/uL`, `ng/mL`≡`µg/L`, `kU/L`≡`U/mL`). Pure converter in `src/lib/medical-units.ts` (unit
  tested), applied in `medical-import.ts` and surfaced on the review screen. This **amends** the global
  "never recompute" rule to "unit conversion is an explicit, flagged, reversible transform"; the app
  still never **invents/derives** clinical values (no eGFR, no computed ranges).
- **Review-before-save is mandatory** and its real job is catching **omitted sections** — the review
  screen shows parsed-result **counts per category**, highlights `uncertain` rows, and allows
  add/correct before anything is written. Each result fuzzy-matches a `test_key` (case-insensitive,
  ignoring the Chinese portion + punctuation, via a provider name-alias map); unmatched names keep their
  printed `test_name`/`category` with `test_key` NULL.
- **Display ordering.** Render results/dashboard by the user's `medical_section_order` +
  `medical_test_order` when set, else by each test's seeded `category` + `sort_order`. Report detail
  shows the canonical order filtered to the tests present, so every report reads consistently regardless
  of provider layout. The single read-path helper `orderResultsForDisplay(results, sectionOrder?,
testOrder?)` is **tolerant** (unknown categories/tests sort last); `trackedSeries` (Dashboard grid) +
  `latestByCategory` take the same overrides, and the **New/Edit form's result cards** order the same way
  (`MedicalEntry` wraps its list in `orderResultsForDisplay` — purely presentational, keyed by
  `clientId`), so all four surfaces order identically. The drag-reorder sheet is now reached from a
  **Display** Settings section labelled "Tests Display Order" (secondary "(Dashboard, Report & Entry)"). The overrides are
  edited by **drag-to-reorder** (M5): `MedicalOrderSheet` (`/medical/settings/order`) over the reusable
  in-house **`ReorderList`** (Pointer Events, no dnd dependency — `touch-action:none` on the drag handle
  only); pure model helpers in `src/lib/medical-order.ts` keep the saved override complete + de-duped
  (`flattenTestOrder` re-groups the flat `medical_test_order` by the current section order on every save).
- **Biometric lock (M6, built).** A **client-side UX gate** over RLS-protected data (no relying-party
  backend). The **mandatory PIN** is the dependable path: `src/lib/medical-lock.ts` hashes it with
  salted **PBKDF2-SHA-256** via `crypto.subtle` (`pbkdf2$<iters>$<salt>$<hash>`; only the hash is
  stored in `medical_lock_pin_hash`). The optional faster unlock is a WebAuthn **platform authenticator**
  (`src/lib/medical-webauthn.ts`; `userVerification:'required'`, feature-detected via
  `isUserVerifyingPlatformAuthenticatorAvailable()`, id in `medical_lock_webauthn_id`) used as a **local**
  user-verification check (the assertion is never server-verified) that **always degrades to the PIN** on
  any failure — so biometric can't cause a lockout. The lifecycle lives in `MedicalLockProvider`
  (`useMedicalLock`): it re-locks on **cold start** (sessionStorage cleared) and per
  `medical_lock_timeout_minutes` on **idle** (finite minutes, since the last Medical interaction), on
  **background/leave** (Immediately = 0), or never (Indefinite = NULL; UI default 5). A persistent
  `enabledHint` (localStorage) engages the gate synchronously before the profile loads (no content
  flash). `AppShell` renders `MedicalLockScreen` whenever `locked && inMedical` (covering tabs **and**
  sheets). Honest limitation: a PWA has no true background-lock lifecycle and WebAuthn is unreliable in
  an installed iOS PWA — hence PIN-first. No new dependency (Web Crypto + WebAuthn are built in).
- **Data layer (`src/data/medical.ts`).** A report is a **parent + children** write: `saveReport`
  create-or-updates the `medical_report` row, then `saveReportResults` does an **idempotent
  delete-then-insert** of its `medical_result` rows (mirrors `asset-entry.saveSnapshotEntries`;
  non-transactional — the accepted solo-app trade-off — and reused by the M3 importer). The
  `medical_lab_test` reference is **not fetched at runtime**: the static `MEDICAL_LAB_TESTS` in
  `src/lib/medical.ts` (identical to the seed, guarded by the `medical.test.ts` drift check) is the
  read-only source for the test picker + the `orderResultsForDisplay` section/sort ordering. Module
  refresh uses a `medical-refresh.ts` tick (`bumpMedical`/`useMedicalVersion`), like the other modules.
- **Dashboard trends (data/presentation split).** The Dashboard's data side is one hook
  `useMedicalTrends` over pure helpers in `src/lib/medical-trends.ts` (`buildTrendSeries`,
  `latestResultPerTest`, `latestByCategory`, `trackedSeries`). It loads everything in **one pass** —
  `data/medical.ts` `listResultsWithReportMeta` flattens each `medical_result` with its report's date
  via an embedded select (parent→children, like `asset-entry.listSnapshotsWithEntries`), plus
  `listReports` for the timeline — then derives client-side (no per-test query → no N+1). Presentation
  consumes **only** the hook, so an alternate trend layout is a drop-in component over the same data.
  The grid draws cheap **inline-SVG** sparklines (`components/Sparkline.tsx`, no dependency); **recharts
  loads only on expand** — `components/MedicalTrendChart.tsx` is lazy-imported into its own chunk (same
  pattern as `NetWorthTrendChart`), with a time window from `constants/medical-ranges.ts`. **Latest
  values** show the most-recent value **per test** across all reports (a heterogeneous history means the
  newest report alone would omit most tests). **Tracked tests** come from `profile.medical_tracked_tests`
  (else `defaultTrackedTestKeys()`), seeded on first run in `ensureOwnerProfile` like `visible_nutrients`.
- **Reports list** (`MedicalReports`): a searchable / filterable / sortable list via the pure
  `applyReportView` — search **body part + narrative**, filter **type / provider / body part**, sort
  **Date / Type / Provider / Body Part** (default Date desc) — using the shared `FilterToggleButton` /
  `FilterPanel` / `SortControl`. `reportProviders` / `reportBodyParts` derive the filter options.
- **Routing.** A report has a **read-only detail** at `/medical/:id` and the **Add/Edit form** at
  `/medical/entry` (new) and `/medical/:id/edit` (edit) — the detail's Edit button opens the latter.
- **No new external API.** No Tesseract, no Supabase Storage; originals are Google Drive URL(s) on
  `medical_report.document_urls`.

## Travel

- **Constants** (`src/constants/travel.ts`): the stop-type / status / travel-mode / completion enums +
  labels; `TRAVEL_EXPENSE_CATEGORIES` (seed defaults for the configurable list); `CURRENCIES` (the
  picker shortlist); and **`CHINA_PROVINCES`** — the 34 province-level divisions as bare canonical names
  (no 省/市/自治区/特别行政区 suffix). `CHINA_PROVINCES` is the single source of truth for the city
  resolver, the shaded map, and the "N / 34" denominator.
- **City resolution** (`src/lib/places.ts`): manual + the **`remembered_city`** cache. `snapProvince`
  maps any province/admin-1 string (typed, cached, or geocoded) to a canonical `CHINA_PROVINCES` value
  (Chinese suffix-strip + an explicit alias table for the ethnic-qualified autonomous regions + English
  admin-1 names), or null for a foreign region (kept verbatim). `geocodeCity` calls **Nominatim**
  on-demand (assist-only; never per-keystroke) and snaps the suggested province. The city picker always
  allows manual entry — geocoding is never a hard dependency.
- **Map fill** (`src/lib/travel-geo.ts` + `src/components/TravelMapCanvas.tsx`): two **vendored** GeoJSON
  in `public/geo/` back a layered `regionName → shape` fill — China by province (DataV, matched via
  `snapProvince`) and non-China countries whole (Natural Earth, matched via `resolveCountryName` +
  `COUNTRY_ALIASES`). A **build-time test** (`travel-geo.test.ts`) asserts every `CHINA_PROVINCES` and
  every alias target resolves in the bundled files, so a name drift fails the build rather than silently
  leaving a region unshaded. WGS-84 throughout; the GCJ-02 offset isn't corrected (v1).
- **HKD trip total** (`src/lib/trip-fx.ts` + `src/lib/expenses.ts`): per-currency totals stay native; the
  HKD total converts each via `trip.fx_rates` (HKD = 1). `fetchRateToHkdOn(currency, date)` (added to the
  shared `src/lib/fx.ts`) fetches one rate per currency at the **trip's first day** (`tripFirstDay` =
  start date, else earliest dated expense, else today); rates are frozen on `trip.fx_rates`. A currency
  Frankfurter can't price (non-ECB, e.g. TWD/VND) is surfaced for a **manual override**. The category
  breakdown is in HKD (so cross-currency categories combine).
- **Reimbursement** (`src/lib/reimburse.ts`): `evalReimbursement(formula, amount)` is a **safe
  recursive-descent parser** over `+ - * / ( )`, numbers, and `amount` (presets ½ / ⅖ / Full) — **never
  `eval`**. Returns null on a parse error or non-finite result (e.g. `amount/0`); rounds to cents. Shown
  only when the trip's Track Reimbursement toggle is on.
- **Expense categories** (`src/lib/travel-config.ts`): the Quotes pattern — a `{key,label}` JSONB list on
  `profile.travel_expense_categories`; `trip_expense.category` stores the stable key. Add/rename/delete/
  reorder via the shared `ConfigListEditor` (the generalized former `QuoteListEditor`, decoupled via
  `count`/`reassign`/`onChanged` props); deleting an in-use category reassigns its expenses first; the
  last can't be deleted; orphan keys still render via the raw-key fallback.
- **Expense CSV import** (`src/lib/travel-expense-import.ts`; RFC-4180 via `parseCsv`, UTF-8, dates
  `YYYY-MM-DD`, thousands-commas/currency-symbols stripped). A **wide** sheet
  (`Trip, Date, Restaurant…Flight/Train, Cost, Re-imbursed`): each filled category column → an expense (a
  multi-category row **splits**); `Cost` is cross-checked against the category sum (warning, not error);
  `Re-imbursed` is allocated **pro-rata**; rows attribute to a trip by name (created if missing);
  **unknown headers are surfaced** for mapping (or skip), never dropped; additive with an opt-in
  **replace-per-trip**. Amounts use the trip's base currency (no currency column).
- **Itinerary AI-import** (`src/lib/itinerary-import.ts`): a **JSON array of trips**
  (`templates/travel-itinerary.schema.json`, prompt `templates/travel-itinerary-prompt.md`) with the same
  tolerant repair as Medical (stray quote after a number, missing comma; clear line/column error
  otherwise). Validates each trip into a draft (safe enum fallbacks, null dates preserved, province
  snapped for China). **One combined review** (per-trip day/stop counts + a pooled new-cities list with
  optional per-city geocode) writes trips → ordered days → ordered stops as **drafts** (finished in the
  Trip Builder) and caches the new cities. Intended as a one-time back-catalogue load.
- **Trip list + field visibility** (`src/lib/travel.ts`): `applyTripList(trips, facetsByTrip, criteria)`
  filters (status / country / province / year / **rating-min**) + searches (trip name / itinerary city /
  **companions**) + sorts (`sortField`×`sortDir`: Date / Country / Province / City / Status / Trip Name;
  country/province/city use the alphabetically-first itinerary facet, undated trips last). `TravelTrips`
  drives it through the shared `FilterToggleButton` / `FilterPanel` / `SortControl` (an icon Filter button
  - a pane + a Sort control, like the other modules). Optional Trip-form fields (Rating, Cover URL,
    Companions, Track Reimbursement, Notes) are gated by `TRIP_ENTRY_FIELDS` + the pure `isFieldVisible` over
    `profile.travel_visible_fields` (**NULL = all visible**, default-on), edited in the shared
    **`VisibleFieldsSheet`** (`TravelFieldsSheet`, a Travel Settings → **Entry Form** route sheet); the Trip
    Builder header reads them through `useProfile`.
- **Counts** (`src/lib/travel-stats.ts`): China Provinces / China Cities / Countries / Cities are
  distinct over `status = 'visited'` trips (`isChinaCountry`; province count intersected with
  `CHINA_PROVINCES`); plus trips-this-year and inclusive days-travelled. (An all-trips money roll-up is a
  non-goal.) Refresh tick: `src/lib/travel-refresh.ts` (`bumpTravel` / `useTravelVersion`).

## External APIs

- **Called directly from the browser** (no server proxy): the USDA key is a `VITE_` var and Open Food Facts allows browser requests. Results are cached into `food` on favorite/log to limit calls.
- **USDA FoodData Central** (`api.nal.usda.gov/fdc/v1`): free `api.data.gov` key. **Search uses POST** `/foods/search` with a JSON body — the GET form 400s when `dataType` includes `"Survey (FNDDS)"`. `searchFoods` issues **two POST searches** — the whole-food databases
  (`Foundation`/`SR Legacy`/`Survey (FNDDS)`) and `Branded` — and merges them whole-foods-first.
  This is deliberate: a single combined search ranks the thousands of identical Branded exact-name products (8000+ for "blueberries") above every varied whole-food entry, so they'd be the only thing on the page. Branded duplicates (same name + brand) are then collapsed and capped. The UI sorts the merged list (with local foods) by name-match relevance, so search only needs to guarantee variety. USDA matches **whole tokens**, so a partial word ("blueberr") returns nothing; `searchFoods` therefore wildcards the last word at a stem (`food-search.ts#toUsdaWildcardQuery`: "blueberry", "blueberries", "blueberrie", "blueberr" → `blueberr*`) so partial/plural input all returns the same set. Over-broad recall is fine — the UI scorer re-filters to the typed term.
  Detail is `GET /food/{fdcId}`. Map nutrients on the stable INFOODS **`nutrient.number`** (e.g. 208 energy kcal — not 268 kJ; 320 vitamin A µg RAE — not 318 IU; 435 folate µg DFE; 328 vitamin D µg; 312 copper mg). USDA amounts are per 100 g. When a USDA (or OFF) food is favorited or logged, cache a copy into `food` (`source`, `external_id`); plain search hits aren't persisted.
- **Open Food Facts** (`world.openfoodfacts.org/api/v2/product/{barcode}.json`): free, global. **Every `*_100g` value is in grams** (including vitamins/minerals) → scale to our mg (×1000) / µg (×1e6). Sodium = `salt_100g / 2.5 × 1000` when `sodium_100g` is absent. All fields optional/sparse. Scanned products save into Custom.
- The **complete** nutrient mappings are the source of truth in code: USDA `nutrient.number` → our key in `src/lib/food-api.ts`, and Open Food Facts key → our key (with the per-field scale factor) in `src/lib/off-api.ts`. The owner-band DRI target/UL values are tabulated in `05-seed-data.md` and live in `src/lib/dri.ts`.
- **Frankfurter** (`api.frankfurter.dev/v1/{date}?from={CNY|USD}&to=HKD`): **keyless**, ECB-sourced, CORS-enabled — used by **Net Worth** for native→HKD FX as of the **1st of the month** (it returns the most recent rate on/before a non-trading day). CNY is the stored code; HKD = 1 is never fetched. The fetched rate is **frozen** onto each `asset_entry` (`fx_rate_to_base`/`value_base`) so saved months are immune to later revisions; the user can override per currency. Helpers + a small cache live in `src/lib/fx.ts`. **Travel** reuses the same client via `fetchRateToHkdOn(currency, date)` — an arbitrary currency at the **trip's first day** (one rate per currency, frozen on `trip.fx_rates`), with a manual override for currencies the ECB set doesn't price.
- **Nominatim** (`nominatim.openstreetmap.org/search`, **keyless**, CORS-enabled): used by **Travel** as an **on-demand** geocode assist only (a button, never per-keystroke, so within the usage policy), suggesting country / admin-1 / coords for a new city to confirm. Browser-direct; identified by the app's Referer. Manual entry always works if it's unavailable.
- **OpenStreetMap tiles** (`tile.openstreetmap.org`, keyless, attributed) render the **Travel** Leaflet map. The two province/country **GeoJSON are vendored** in `public/geo/` (not a runtime API) and fetched from our own origin by the lazy map chunk.
- **TMDB** (`api.themoviedb.org/3`): free v3 `api_key` (one signup), a `VITE_` var, **called directly from the browser** (CORS-enabled) — same pattern as USDA. Used by **Shows**, two-step on-demand only: **search** per the Type toggle (`GET /search/{movie|tv}?query=…` → title, year, `poster_path`) and **details on select** (`GET /{movie|tv}/{id}?append_to_response=credits,external_ids` → genres, overview, runtime, movie director from `credits.crew`/TV `created_by`, top ~10 cast, TV `number_of_seasons`/`number_of_episodes`, `imdb_id`). **Chinese-aware:** a CJK query/title adds `language=zh-CN`; the **documentary** type uses the `/tv` endpoint. A per-show **`refreshFromTmdb`** re-pulls the same details for a stored `tmdb_id`. Images store only a URL/path — `poster_path` is **either** a TMDB path (URL built from the fixed CDN base `https://image.tmdb.org/t/p/{size}{path}`) **or** a full pasted image URL; `posterUrl`/`isAbsoluteUrl` (in `src/lib/shows.ts`) disambiguate, and every poster `<img>` uses `referrerpolicy="no-referrer"`. The client + pure mappers live in `src/lib/tmdb-api.ts`; nothing persists until CREATE/SAVE.
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
Enumerated TEXT columns use `CHECK` constraints (not Postgres enums) — **except** the **owner-configurable**
`quote.source_type`/`category`, which are plain TEXT (no CHECK) validated in-app against the configurable
lists (see Quotes). `updated_at` is maintained by the `moddatetime` trigger. Regenerate
`src/types/database.ts` (`npm run gen:types`) after each push.

## Quality gates (run automatically)

Prettier, ESLint (no unused, no `any`), `tsc --noEmit`, and Vitest for the calculation helpers.
Wire them into a pre-commit hook and/or CI so they always run.
