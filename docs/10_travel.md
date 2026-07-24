# 10 — Travel Module

## Screens

### Dashboard (`/travel`)

- **Six count tiles** over `status = visited` trips, **3 columns × 2 rows, filled column-first**: **中国省份** (China provinces, `N / 34` suffix) · **中国城市** (China cities) | **Countries** · **Cities** | **Trips This Year** · **Days Travelled** — distinct counts. The province count is intersected with `CHINA_PROVINCES`, so it never exceeds 34; Days Travelled is the inclusive span of dated visited trips. No standalone province-progress bar (removed — duplicated the 中国省份 tile).
- **Shelves**: **Recently Visited** (reverse-chron, with a "See all trips" link), **Planning**, **Want to Visit** — each a card row (cover thumbnail · name · date range · primary region · status chip), tapping goes to Edit Trip. Empty overall → **New Trip** CTA (shared EmptyState).
- **Status chip palette** (`TRIP_STATUS_CHIP`): Want = purple (`plan`), Planning = orange (`warning`), Visited = teal (`positive`) — via the shared `StatusChip`.

### Map (`/travel/map`)

- A **Leaflet** map (OSM tiles), lazy-loaded into its own chunk.
- A **markercluster dot per visited city** (`accent` = visited; neutral `text-secondary` = planned), placed from the city's `remembered_city` coords. A city without a cached pin shows no dot (a hint points to the picker's "Look up online").
- A **Region fill** toggle (default on): China filled by province (DataV GeoJSON) + non-China countries filled whole (Natural Earth GeoJSON), over visited trips, in the teal `positive` colour at low opacity.
- Tapping a dot opens the trip(s) touching that city (single → Edit Trip; multiple → a short list).

### Trips (`/travel/trips`)

- **Search bar**: matches trip name, city, companion; **Filter button** to the right.
- **SortControl**, **Clear Filters button**: Sort over { Date, Country, Province, City, Status, Trip Name } with an **asc/desc** toggle (country/province/city use the trip's alphabetically-first value; undated trips last); default is **Date** descending.
- **Filter panel** is label-free: **Any Country**, **Any Status**, **Any Rating** (minimum: Any / 1★+ … / 5★), **Any Year**.
- Each row carries:
  - Line 1: **cover thumbnail · trip name**.
  - Line 2: **status chip · date range · primary region**.
  - Tap → Entry/Edit; **swipe-left → Delete** (optimistic, cascades days/stops/expenses).

### Trip Entry (`/travel/entry` new, `/travel/trip/:id` edit)

Header top-left: **✕ Close** (returns to origin, Escape does the same). Edit header title is the literal **"Edit Trip"**.

- **New** (`/travel/entry`): header-only — **Trip Name** + **Default Currency** on one line, **Status** below — with **Reset** + **Create** icon actions. **Create** persists the trip and opens it for editing (days/stops need a saved trip).
- **Edit** header card — row order: **Trip Name** + **Status** on one line; **Companions** + **Rating** (0–5 half-stars) on the next (both conditional); **Notes**; **Cover Image URL** (rendered `no-referrer`, previewed). Top-right icon actions (Delete · Reset · Save); days/stops/expenses **auto-save on each change**, so Save only persists the header fields.
- Two sub-tabs: **Itinerary** and **Expenses**. When **Expenses** is selected, **Default Currency** (the currency new expense rows prefill — _not_ the reporting currency, which is always HKD) and **Track Reimburse** appear in a **compact single-row strip** immediately below the tab strip (inline labels, not stacked; always visible in this context, not gated by visible-fields settings).

**Itinerary sub-tab:**

- **Add Day** (defaults the new day's date to the previous day's date + 1) sits **bottom-right, below the last Day card** (shared Add-button style — outline `SecondaryButton`, teal `IconPlus`); the **Reorder Days** button (when >1 day, a drag-reorder sheet via shared `ReorderList`) stays at the top of the itinerary. Each **Day** card has a **collapse/expand chevron** at the left (all days expanded by default). Header row: chevron · `Day N` · tappable **Calendar date chip** (the date or "Add date" — writes `trip_day.day_date` and re-caches the trip's start/end) · spacer · **Delete** (a `ConfirmDeleteAction` — inline `Delete? ✓ ✗`, no browser dialog) · **Duplicate** (copy) · **Expenses** (`IconReceipt2`, tinted **accent/blue** — opens the day's expense modal) · **Add Stop** (green `+`).
- **Per-day Expenses modal** (`DayExpensesOverlay`, a local overlay so the builder draft survives): logs the day's spend as it's incurred. Shows only the expenses whose `expense_date` matches the day; new rows **prefill that date** (editable). It's the same shared inline editor (`ExpenseRowsEditor`) and the same lifted expense state the Expenses tab uses, so the two views stay in sync. Expenses are **never linked to stops** — the day match is a screen convenience only. The day's **date chip** and the city sub-headers render at **`text-body`** (a step up from the original caption size) for readability.
- When expanded, stops are grouped under **city-only sub-headers** for consecutive same-city stops; each run is a drag-reorder list (swipe-left on a stop reveals a Delete action that deletes on tap). Each stop row leads with the **stop-type icon** (`StopTypeIcon`, replacing the type text) then the description, with inline **done / skipped** icon toggles on the right (tap the active one to clear); skipped stops are struck through. Tap a stop to edit.
- **All Edit-Trip itinerary + expense edits are optimistic** — every action here (add/copy/delete a day, reorder, add/edit/delete a stop or expense, done/skipped) applies instantly and syncs in the background, so none of them cost a full trip reload. Other Travel screens (Map/Dashboard/Trips list) pick up the change on their next mount, not live. See tech-spec **F16b** for the mechanism and trade-off.

**Stop editor** (local overlay, not a route sheet — so the builder draft survives):

- **Type** (Travel / Visit / Eat / Shop / Stay / Other), **City** (text input + a **Lookup** button opening the City Picker), **Province / Region** + **Country** (auto-filled by lookup, editable), **Description** (carries any leg/mode/transit detail), **Details**, **Completion** (Unmarked / Done / Skipped), and a **Move to day** picker. A new stop's City/Province/Country **carry forward** from the previous stop (same day → else the most recent prior day's last stop). Top-right icon actions (Delete [editing only, inline confirm] · Reset · Create/Save) via shared **EntryHeaderActions**.

**Expenses sub-tab** (the trip-level expenses hub):

- A single **Totals** card: per non-HKD currency, the native cost/net on line 1 and an **inline editable first-day rate + live HKD subtotal** on line 2 (HKD shows just its sum); then the **HKD total**; then a footer row — a status note ("Rates frozen at the trip's first day", or a warning naming any currency that couldn't be priced) + a small **Refresh** (↻) action. The separate "Conversion to HKD" card is gone — rates live next to the totals they drive. **Rates auto-fetch on open** (and when a new foreign currency first appears): the panel fills any **missing** rate from Frankfurter at the trip's first day without the user clicking anything, so the HKD total just works. Auto-fetch only fills **gaps** — frozen rates and manual overrides are left untouched; a currency Frankfurter can't price (offline / non-ECB) is attempted **once per mount** and then left for a manual rate (no retry loop). **Refresh** force-re-pulls every foreign currency to its latest first-day rate (overwrites manual overrides — a deliberate action).
- A **By Category (HKD)** Recharts donut (split by **category** — the totals card is the per-currency view); and the **full ledger** rendered by the shared `ExpenseRowsEditor` (below), **grouped by `expense_date` ascending** (undated last) with inline add/edit/reorder. Default Currency + Track Reimburse live in the compact strip under the tab strip (above).

**Inline expense editor** (`ExpenseRowsEditor`, shared by the per-day modal and the Expenses-tab ledger — replaces the old one-at-a-time `ExpenseEditorSheet`):

- Each row is the four core fields in this order: **Description · Category · Currency · Cost**, laid out as **always-stacked 2-line** rows (Description + expand chevron on line 1; then Category · Currency · Cost on line 2) at **every** Dynamic Type preset (tech-spec F23). Cramming all four into one line over-truncated the dropdowns and overflowed the card's right edge, so the single-line variant was dropped — the editor no longer takes a `font_size` prop. (Each field input that sits in a fixed-width `shrink-0` wrapper must be `w-full`: a bare `<input>` keeps its intrinsic ~20-char width and spills past the wrapper — see the Cost input.)
- A trailing **add row** commits new expenses without a modal (spreadsheet-style). It's visually marked as an entry affordance, not a saved expense: a **dashed** card border, and its default category/currency/cost (+ date chip) line is **dimmed until you start typing** a description/cost. In the trip ledger it carries a **date chip** — the date the new expense is filed under (defaults to the trip's start date / today; tap to pick any date, **including a new one**); in the day modal the date is fixed to the day and the chip is hidden. **Only a description is required** — a blank cost commits as **0** (editable inline afterward), so an item can be jotted down by name and priced later. A complete draft commits on **`+` / Enter** (Enter in either the description or cost field) **and auto-commits when the editor is closed/unmounts** (closing the day modal, leaving the Expenses tab) so a typed-but-uncommitted row is no longer silently lost on close. The auto-commit no-ops on an empty/incomplete row, so it never creates blank rows.
- **Tap a row to expand** a panel with: an editable **Date** (Calendar; re-dating moves the row to the end of its new date group), **reorder** up/down within the date group, the **Reimbursed** field (number or formula on `amount`; presets ½ / ⅖ / Full; live net) **only when Track Reimburse is on**, and **Delete**. (Reorder uses up/down controls, not the truncating `ReorderList`, since rows are inline-editable and expandable.)

### City Picker (modal, from a Stop's City Lookup)

- Seeded with the stop's current City; searches as you type: **remembered cities** match instantly, and a **Nominatim** lookup runs automatically (debounced) and lists **Search results**.
- Selecting any result resolves City / Province / Country (province snapped to **CHINA_PROVINCES** for China), caches it in `remembered_city`, and returns it to the stop.
- Manual entry is the fallback: the **Enter manually…** disclosure toggle at the bottom is **collapsed by default** (preventing accidental use when search results are present); it **auto-expands when search finds nothing**.
- When expanded: Country (defaults to `中国`, recognised by `isChina()`), Province (a CHINA_PROVINCES select for China, else free text), and a **Use "city"** PrimaryButton.

### Settings (`/travel/settings`)

- **DISPLAY → Visible Fields**: uses **VisibleFieldsSheet** over the optional Trip-form fields in form order: **Rating, Cover Image URL, Companions, Track Reimbursement, Notes**. Stored on `profile.travel_visible_fields` (**NULL = all visible**); auto-saves per toggle. Trip Name, Default Currency, and Status are always shown.
- **VALUES → Expense Categories**: uses **ConfigListEditor** to add / rename / delete / drag-reorder / color-pick the list (stored on `profile.travel_expense_categories`). Deleting a category still used by expenses prompts a **reassignment** first; the last category can't be deleted.
- **Import → Enable Bulk Trips Import** (`profile.travel_importer_enabled`, **on by default**): a single toggle that surfaces **both** launchers below. When off, a secondary note ("Turn this on to bulk-seed your trips from a JSON / CSV.") replaces them.
- **Import → Import JSON Trips** (listed first): a JSON array of trips → one combined review (per-trip day/stop counts + a pooled **new-cities** list with optional per-city geocode) → import as drafts.
- **Import → Import CSV Expenses** (listed second): a wide sheet (Trip, Date, category columns…, Cost, Re-imbursed) → detected-columns + **unknown-header mapping** + per-trip preview + **replace-per-trip** → import. Columns + rules: `templates/travel-expenses-import-guide.md`.
- **FX overrides** are per-trip and live in the trip's Expenses tab — not here.

---

## Visual design (Travel-specific)

- **Stop-type icons** (Tabler, via the shared `StopTypeIcon` component): Travel = `IconPlaneTilt`, Visit = `IconCamera`, Eat = `IconBowlChopsticks`, Shop = `IconBrandShopee`, Stay = `IconBed`, Other = `IconMapPin`. Each is **tinted per kind** from `STOP_TYPE_COLORS` (`constants/travel.ts` — design-token CSS vars). `StopTypeIcon` sets the color itself (callers pass layout classes only). In the Edit-Travel Entry, each stop row leads with this icon (replacing the type **text**), followed by the description; the type still names the row via `aria-label`.
- **Completion**: Done = a teal fill (`positive`); Skipped = a solid grey fill (`bg-text-secondary`) with the struck-through stop row.
- **Trip cover**: a rounded image rendered `referrerpolicy="no-referrer"` (thumbnail in lists, larger in the header); a neutral placeholder when null (the shared `Thumb`).
- **Status chip palette** (`TRIP_STATUS_CHIP`): Want = purple (`plan`), Planning = orange (`warning`), Visited = teal (`positive`) — via the shared `StatusChip`.
- **Map**: Leaflet over OSM tiles; **accent** dots (`accent` = visited) / **neutral** dots (`text-secondary` = planned), clustered; the visited-region fill is `positive` at low opacity.
- **Map overlay z-index (F14):** any DOM overlay over the Leaflet map (e.g. the multi-trip chooser) needs an explicit `z-index` above Leaflet's controls (`.leaflet-top/.leaflet-bottom` are `z-index:1000`) — use `z-[1100]`; otherwise the controls paint over it and swallow taps.
- **Expense breakdown**: a small Recharts donut over the categories (HKD-equivalent), lazy-loaded into its own chunk. **Slice colours are stable _per category_** — each expense category carries a chosen `color` (see the category editor below), resolved by `categoryColor(list, key)` and passed through the slice, so a category is the same hue on every trip. `TravelExpenseChart` still keeps an accent-led, design-token-driven **fallback** palette (`COLORS[i % …]`) used only for a slice with no explicit colour. Independent of the `STOP_TYPE_COLORS` above (stop kinds and expense categories are separate taxonomies).
- **Reorder / category editors**: drag handles via the shared `ReorderList`; the category editor is the shared `ConfigListEditor`. Each category row also has a **colour picker** (`ColorPicker` via the editor's `rowExtra` slot) that sets the category's donut colour from the `TRAVEL_CATEGORY_COLORS` swatch palette; the choice is stored per entry on `profile.travel_expense_categories` (alongside `key`/`label`, no migration — JSONB). Seed defaults + new categories get a distinct default swatch (`defaultCategories` / `addCategory`, palette-cycled); legacy entries with no stored colour fall back to a deterministic position-based swatch via `categoryColor`.

---

## External APIs (Travel-only)

**Nominatim** (`nominatim.openstreetmap.org/search`): **keyless** OSM geocoder, CORS-enabled. Called debounced from the City Picker's online-search path. Returns the best-match candidate for a city string: lat/lng + `country`, `province`-equivalent (snapped via `snapProvince` to `CHINA_PROVINCES` for China results). Results cached in `remembered_city` to avoid re-lookups. Helper: `src/lib/places.ts` (`geocodeCity`).

**OpenStreetMap tiles** (`tile.openstreetmap.org`): rendered by the lazy-loaded Leaflet map (`TravelMapCanvas`). Attribution required on the map. No key.

**GeoJSON assets** (static, bundled in `public/geo/`, served from our own origin — **not** PWA precached, loaded on demand by the lazy map chunk):

- `public/geo/china-provinces.geojson` — DataV.GeoAtlas China province shapes (Chinese province names). Matched to `CHINA_PROVINCES` via `snapProvince`.
- `public/geo/world-countries.geojson` — Natural Earth 110m admin-0, public domain. Matched via `resolveCountryName` + `COUNTRY_ALIASES` in `src/lib/travel-geo.ts`.
- A build-time test (`travel-geo.test.ts`) asserts the GeoJSON names line up with `CHINA_PROVINCES` / `COUNTRY_ALIASES`. Run it if you update either file.

**Frankfurter** (shared with Net Worth, see `docs/02_tech_spec.md` → Shared external APIs): `fetchRateToHkdOn(currency, date)` fetches the per-trip first-day rates. Helper: `src/lib/trip-fx.ts`. Per-trip FX rates are frozen in `trip.fx_rates` on first fetch and are overridable per-currency in the Expenses tab. The **first fetch is automatic** — the Expenses tab fills missing rates on open (gaps only, once per mount); the **Refresh** action force-re-pulls them.

---

## Data model

### `trip`

- `id` UUID PK · `user_id` UUID → auth.users
- `name` TEXT · `status` TEXT — `'want' | 'planning' | 'visited'` (CHECK)
- `base_currency` TEXT DEFAULT 'CNY'
- `cover_url` TEXT NULL — pasted image URL, rendered `referrerpolicy="no-referrer"`
- `companions` TEXT NULL · `rating` NUMERIC NULL (0–5 in 0.5 steps, CHECK) · `notes` TEXT NULL
- `track_reimbursement` BOOLEAN NOT NULL DEFAULT false
- `fx_rates` JSONB NOT NULL DEFAULT '{}' — `{ currency: rate_to_HKD }` frozen at the trip's first day (+ any manual overrides); HKD is implicitly 1
- `start_date` DATE NULL · `end_date` DATE NULL — **cached** from the day dates (`recomputeTripDates`); not entered manually
- `created_at`, `updated_at` · Index on (`user_id`, `status`), (`user_id`, `start_date`)

### `trip_day`

- `id` · `user_id` · `trip_id` UUID → trip (**ON DELETE CASCADE**)
- `day_date` DATE NULL (nullable while planning) · `sort_order` INT NOT NULL · `label` TEXT NULL
- `created_at`, `updated_at` · Index on (`trip_id`, `sort_order`)

### `stop`

- `id` · `user_id` · `trip_day_id` UUID → trip_day (**ON DELETE CASCADE**)
- `type` TEXT — `'travel' | 'visit' | 'eat' | 'shop' | 'stay' | 'other'` (CHECK)
- `city` TEXT NULL · `country` TEXT NULL · `province` TEXT NULL — carry forward from the previous stop; `city`/`province`/`country` snapped to `CHINA_PROVINCES` for China results
- `description` TEXT NULL — free text; carries any leg/mode/transit detail
- `details` TEXT NULL
- `completion` TEXT NULL — `'done' | 'skipped'` (CHECK; NULL = unmarked)
- `sort_order` INT NOT NULL
- `created_at`, `updated_at` · Index on (`trip_day_id`, `sort_order`)

Removed fields (simplification pass — folded into `description`): `time`, `cost`, `cost_currency`, `local_transit`, `travel_mode`, `from_loc`, `to_loc`. The Expenses layer is the sole spend source.

### `trip_expense`

- `id` · `user_id` · `trip_id` UUID → trip (**ON DELETE CASCADE**)
- `expense_date` DATE NULL · `description` TEXT NOT NULL
- `category` TEXT NOT NULL — the stable **key** from `profile.travel_expense_categories` (**no FK**; orphan-tolerant via the raw-key fallback in `src/lib/travel-config.ts`)
- `cost` NUMERIC NOT NULL · `currency` TEXT NOT NULL (set from the trip's base currency)
- `reimbursed_formula` TEXT NULL — a number or arithmetic expr on `amount` (safe mini-parser via `src/lib/reimburse.ts`, **never `eval`**) · `reimbursed_amount` NUMERIC NULL (the evaluated value)
- `sort_order` INT NOT NULL DEFAULT 0 — manual order **within a (`trip_id`, `expense_date`) group** (the inline editor's up/down reorder); a new/re-dated row lands at the end of its date group
- `created_at`, `updated_at` · Index on (`trip_id`, `expense_date`, `sort_order`) (a left-prefix of the old `(trip_id, expense_date)` lookup), (`trip_id`, `category`)

### `remembered_city`

- `id` · `user_id` · `city` TEXT · `country` TEXT · `province` TEXT NULL · `lat`/`lng` NUMERIC NULL
- `city_norm` TEXT GENERATED ALWAYS AS `lower(btrim(city))` STORED
- UNIQUE (`user_id`, `city_norm`) — backed by the generated column (an inline UNIQUE can't hold an expression)
- `created_at`, `updated_at`

Standard rules on all five tables: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, CHECK on enum columns, `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`. **Hard delete** (deleting a trip cascades its days → stops and its expenses). Migration: `supabase/migrations/14_travel_schema.sql`. Profile columns added by `supabase/migrations/15_travel_profile_settings.sql`.

---

## Seed data

### Expense categories (seed defaults)

Applied when `profile.travel_expense_categories` is NULL. Stored in `src/constants/travel.ts` as `TRAVEL_EXPENSE_CATEGORIES`. The labels double as the wide-CSV importer's recognized category headers.

| key           | label         |
| ------------- | ------------- |
| restaurant    | Restaurant    |
| takeout       | Take-out      |
| groceries     | Groceries     |
| shopping      | Shopping      |
| activity      | Activity      |
| local_transit | Local Transit |
| flight_train  | Flight/Train  |
| hotel         | Hotel         |

### Geographic constants

- **`CHINA_PROVINCES`** — 34 province-level divisions (bare canonical names, including Hong Kong & Macau). Shared vocabulary for the city resolver, the province fill layer, the `snapProvince` normalizer, and the "N / 34" denominator in Dashboard counts.
- **`remembered_city`** is populated on first use (manual confirm or geocode) — no up-front seed.

### GeoJSON assets

Static in `public/geo/`, served from our origin, **excluded from the PWA precache**, loaded on demand by the lazy Leaflet chunk:

- `china-provinces.geojson` — DataV.GeoAtlas, Chinese province names
- `world-countries.geojson` — Natural Earth 110m admin-0, public domain

A build-time test asserts the names line up with `CHINA_PROVINCES` / `COUNTRY_ALIASES`.

### Import templates

Real trip/expense data stays **out of the repo**; only sanitized templates are tracked.

- `templates/travel-expenses-template.csv` + `travel-expenses-import-guide.md` — wide expenses CSV (tracked). Real `travel-expenses*.csv` are **gitignored**.
- `templates/travel.schema.json` + `travel-prompt.md` — the travel JSON array shape + model-agnostic extraction prompt (tracked). Produced outside the app from freeform text by any AI tool; imported as drafts.
