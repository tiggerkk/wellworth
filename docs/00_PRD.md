# 00 — Product Requirements (PRD)

## Overview

- **WellWorth** is a personal mobile app — a private "super-app" of self-contained modules for one household.
- It launches to a Home hub of module cards; the modules are (1) Wellness — food, supplements, and activity with full nutrient reporting — (2) Net Worth, (3) Quotes — favourite quotes from screen, page, and sound — (4) Literature — classical Chinese poems & prose with read-aloud — (5) Shows — tracking TV shows and movies watched or to watch — (6) Books — tracking books read or to read — (7) Travel — trips logged as day-by-day itineraries, a map of the places visited, and per-trip expenses — and (8) Medical — multi-year lab results and narrative reports with trend charts.
- Further modules may be added later as new cards with no structural change.
- It is delivered as an installable PWA (web app added to the iPhone/iPad home screen) so it needs no Apple Developer account and is free to run.

## Users

- **Owner + a few family members.** Each person signs in with **their own Google account** and sees
  **only their own data** (RLS-isolated per `user_id`). Access is gated to an email allowlist
  (`VITE_ALLOWED_EMAILS`); the owner is identified by `VITE_OWNER_EMAIL`.
- **First login:** the owner keeps the seeded owner profile; every other member is seeded with neutral
  defaults (never the owner's body metrics) and is **forced through a one-time onboarding wizard** to
  enter their own birthday/sex/height/weight/units before reaching the app (see `docs/03_global.md`).
- **Strictly private, no sharing.** There is no household/shared data and no shared base currency
  (everyone is HKD); those remain deferred (see `PARKED.md`).

## Goals

- Wellness: Fast daily logging of food, supplements, and activity; accurate micronutrient reporting; energy balance: calories consumed vs. BMR vs. activity, with a clear net number.
- Net Worth: Monthly (first-of-month) entry of asset values across cash, time deposits, stocks, funds, retirement funds, insurance, and properties, in HKD (base), CNY, or USD; net-worth calculation in base currency; total and by-asset-type trend graphs with a selectable time window. **Funds** import from the JPM monthly export; **insurance** is an age-resolved policy catalogue (original + anniversary schedules) with break-even / variance / surrender analytics, its own browse + New/Edit screens, and bulk/single CSV importers.
- Shows: Track **TV shows, movies, and documentaries** (incl. Chinese-language titles and Chinese documentaries / cultural programs — a documentary sub-series is just folded into its title, e.g. `国宝档案 — 从东晋到北魏`) across a single **status** (Want to Watch / Watching / Watched / Dropped); a **favourite** ♥ flag; a three-level **LGBT+ representation** rating (None / Some / Significant); pull metadata (poster, genres, director/creator, cast, seasons & episode counts) from **TMDB** on demand (Chinese-aware), with **manual entry + a pasted Poster URL** as the fallback and a **per-show Refresh from TMDB**; a Dashboard of favourites / what's in progress / recently finished, and a searchable, filterable, sortable Library. A back-catalogue of hundreds of titles is seeded via an in-app importer.
- Books: Track books across a single **status** (Want to Read / Reading / Read / Dropped); a three-level **LGBT+ representation** rating (None / Some / Significant); pull metadata (cover, authors, year, description, genres, page count) from **Google Books** (Open Library fallback) on demand; a Dashboard of what's in progress and recently read, and a searchable, filterable, sortable Library. A back-catalogue is seeded via an in-app importer.
- Quotes: Track favourite quotes (English or Chinese) from a configurable set of **source types** (seeded with TV shows, podcasts, films, books, interviews, articles, songs, videos); each filed under **exactly one** category from a configurable set (seeded with Wit, Observation, Philosophy, Love, Relationship, Growth) with optional free-form tags, and optionally **linked to a Show or Book** record; a "Moment of Zen" dashboard, a searchable/filterable Library, and a recurring **CSV import**. The **source-type and category lists are owner-configurable** (add / rename / delete / reorder in Settings; deleting an in-use value reassigns its quotes first).
- Medical: Keep a private, multi-year record of test results (blood panels, vitals, bone density, body composition, etc.) and narrative reports (MRI, imaging, eye); a **dashboard of trends** for chosen tests, values flagged high/low/abnormal against **each report's own printed reference range** (the app never computes or interprets a range — not a medical device); intake via **manual entry** or a **structured JSON/CSV import** the owner generates from a report with any vision-capable AI tool (**no in-app OCR**); cross-provider values **normalized to a canonical unit** (flagged, original preserved); originals kept as **Google Drive links**, not files. Protected by a **biometric lock**.
- Travel: Record trips as **Days → Stops** itineraries (stop types Travel / Visit / Eat / Shop / Stay / Other, with Done/Skipped marking), resolving each stop's **city → country/province** manually with a remembered-cities cache (optional keyless geocode assist); a **Dashboard** of places visited (China provinces / cities, world countries / cities) with an "N / 34" province-progress line and trip shelves; a **Map** of visited cities with a layered shaded-region overlay (China by province, other countries whole); and a per-trip **Expenses** layer (owner-configurable categories, optional reimbursement, per-currency totals and an **HKD total** via Frankfurter). A back-catalogue loads via two Settings importers (a wide CSV of expenses, and an itinerary JSON of trips).
- Literature: Read **classical Chinese poems & prose** with search, filter by curated themes/eras, a poets index, **read-aloud** (粵 Cantonese / 國 Mandarin via the Web Speech API, with an auto-loop toggle), and **favourites** (♥). The corpus is an immutable **static asset** (`public/literature/**`, generated by `npm run build:literature` from a gitignored `poems.db`) for fully-offline reading at zero DB cost; only favourites + read-aloud settings sync via Supabase. Display is Traditional/Simplified-agnostic.
- Works identically on iPhone and iPad, with data synced across both devices.
- Modular by design: each feature is a self-contained module under the Home hub, so new modules drop in as a card + route without restructuring existing ones.
- Entirely free to run; easy to maintain by one non-expert owner.

## Navigation model

- The app launches to a Home hub — a launcher of module cards (Wellness, Net Worth, Quotes, Literature, Shows, Books, Travel, Medical, and future modules), styled with the existing dark surface cards and Tabler icons.
- Selecting a module enters it; the bottom nav then shows that module's own tabs (Wellness shows Dashboard / Diary / Library / Settings; Net Worth, Shows, Books, and Quotes show their own), with a persistent way back to Home.
- Settings is global, lifted to the Home level (profile, units, account apply across all modules); a module may add its own sub-settings, reached from a **Settings tab in the module's bottom nav** (e.g. Wellness targets/display; Shows/Books/Quotes field-visibility + importer; Quotes also its configurable **Source Type & Category** lists).
- Routing is URL-driven per module (/wellness/_, /networth/_, /quotes/\_, /literature/\_, /shows/_, /books/_, /travel/\_, /medical/\_).
- On launch, the app reopens the last-used module so daily Wellness use isn't slowed by the hub.
- The hub makes adding future modules a drop-in (a `ModuleDef` + its routes).

## Global

- **Settings (global, at Home level):** Display (Font Size, Visible Modules, Units), Profile, Account —
  shared across modules.
- **Dynamic Type (accessibility):** a **Font Size** preset (Default / Large / Larger) scales all text
  **and** icons app-wide for aging eyes (stored per-profile, cross-device). Pinch-zoom also stays
  enabled everywhere.
- Cross-device sync via Supabase.

## Wellness

- Google sign-in (Supabase Auth); first login creates the user's profile.
- **Dashboard / Daily Report:** date-range averages and single-day reports with nutrient bars (red past upper limits) and an energy-balance panel.
- **Diary:** day navigation + calendar; highlighted-nutrient grid; meal/supplement/activity groups; add/expand/collapse/swipe-delete; copy-day actions; per-day report.
- **Add Food:** search (USDA), Favorites, Custom; barcode scan (Open Food Facts); food detail entry.
- **Add Activity:** personal activity library; duration-based and strength-based logging.
- **Library:** create/edit/delete custom foods, supplements, and activities (full nutrient entry).
- **Settings:** protein target override; highlighted nutrients + visible nutrients.

## Net Worth

- **Dashboard** (`/networth`): large **current total** (latest month) in HKD; a **trend line graph** (recharts) with a window selector (6M/12M/2Y/3Y/5Y/All) and a **Total ⇄ By asset type** toggle; a **latest-month per-type summary** (color dot · type · HKD · % of net worth).
- **Monthly Entry** (`/networth/entry`): month selector (prev/next), retrospective months allowed; a new month **copies the previous month forward** and auto-fetches its FX as of the first day of the month; entries **grouped by asset type** with a per-group add + inline edit (name, currency HKD/CNY/USD, value, type-specific details) + delete; editable per-currency **FX rates** (auto-fetched, override + refresh ↻; HKD = 1); live HKD total; compact **icon header actions** (Reset · Save, plus **Delete** to remove the displayed month's saved snapshot). An **Import CSV** button opens the importer.
- **Import CSV** (`/networth/import`, sheet): pick a month + upload a CSV → preview (rows, skipped rows, fetched rates, HKD total) → **Import** create-or-replaces that month (idempotent). Columns + rules: `templates/networth-import-guide.md`.
- **No separate asset library for manual assets.** Manual assets are managed inline in Monthly Entry; each month is self-contained (copy-forward carries manual holdings forward, funds as placeholders, insurance re-resolved). **Funds** are read-only rows driven by the JPM CSV import (Monthly Entry → Fund section); **insurance** rows are auto-generated from the policy catalogue, resolved by age, and frozen into the month on SAVE (or by the manual import).
- **Insurance Policies** (`/networth/insurance`): a searchable/filterable/sortable policy list (provider, surrendered, past-break-even, started range). **New / Edit Insurance** (`/networth/insurance/new`, `/networth/insurance/:id`): policy fields (provider/number/currency mandatory) + notes, an inline **SURRENDER** section, and a versioned **SCHEDULE** with an **Import Policy Schedule** add/replace importer.
- **Net Worth Settings** (`/networth/settings`): **Visible Asset Types** (reorder/show-hide) and the one-time **bulk insurance import** toggle.

## Shows

- **Dashboard** (`/shows`): shelves of **Favourites** (every ♥ title), **Up Next** (in-progress episodic title with episode progress), **Watching** (with a Watching chip + episode progress), **Want to Watch** (with a blue **Want** chip), and **Recently Watched** (last 5 by finish date), each shown only when non-empty; a **type filter** (All / TV / Movies / Docs); quick actions **Mark Watched** and **Start Watching**; a "N watched this year" stat line.
- **Entry / Edit** (`/shows/entry`, `/shows/:id`): a Chinese-aware **Search TMDB** title lookup populates metadata (poster, genres, director/creator, top cast, overview, runtime, season/episode totals) on select; a three-way **Type** (TV / Movie / Documentary), a header **favourite heart**, a **Poster URL** field (paste a direct image URL; auto-shown when TMDB has no poster, and a Settings → Visible Fields toggle — off by default — forces it always visible), a **⟳ Refresh from TMDB** button (enabled once a `tmdb_id` exists; re-pulls TMDB-sourced fields only), a **Status** dropdown (Want leaves Start Date blank) paired with the manual **star rating** (0–5, half-stars), an **LGBT+ representation** dropdown, start/finish dates (Calendar) paired on a line, episodic watched/total season & episode counts, and comments; compact **icon header actions** (Delete when editing · Reset · Create / Save). Nothing is saved until Create/Save. A new show can be prefilled via `?title=&poster=&overview=&type=`.
- **Library** (`/shows/library`): a poster-thumbnail list with search (title, director, cast) + filters (Type incl. Documentary, Genre, Rating, LGBT+, Status, **Favourites only**, start/finish date ranges) + a Sort menu; a ♥ marks favourite rows; tap a row to edit, swipe-left to delete (hard, immediate — no browser dialog).
- **Settings** (`/shows/settings`): choose which Entry fields are visible; enable a **CSV importer** (`/shows/import`) — one CSV spans English + Chinese across all three types — that matches each row against TMDB (with inline fix for ambiguous/no-match rows; niche docs import metadata-less, topped up later) and commits idempotently. Columns + rules: `templates/shows-import-guide.md`.
- **TMDB metadata only on demand**; images store just `poster_path` (URLs built from the CDN base). Imported rows carry their `start_date` (required except a not-yet-started Want) and `end_date` (watched/dropped) from the CSV, so watched titles also appear in the Dashboard's Recently Watched shelf.

## Books

- **Dashboard** (`/books`): **Favourites** (every ♥ book), **Currently Reading**, **Recently Read** (last 5 by finish date), and a **Want to Read** shelf, each shown only when non-empty; every row shows its **status chip** (same as the Library); quick actions **Mark Read** (status → read, finish date → today) and **Start Reading** (status → reading, start date → today). Cover thumbnails throughout.
- **Entry / Edit** (`/books/entry`, `/books/:id`): a title/author **Search Google Books** lookup populates metadata (cover, authors, year, description, genres, page count) on select; a header **favourite heart**, a **Status** dropdown paired with the manual **star rating** (0–5, half-stars), an **LGBT+ representation** dropdown, start/finish dates (Calendar) paired on a line, and comments; compact **icon header actions** (Delete when editing · Reset · Create / Save). Nothing is saved until Create/Save; Create requires at least a Title.
- **Library** (`/books/library`): a cover-thumbnail list with search (title, author) + filters (Genre, Rating, LGBT+, Status, Dynasty, **Favourites only**, start/finish date ranges) + a Sort menu (incl. a Dynasty sort; **Author is searched, not filtered**); a ♥ marks favourite rows; tap a row to edit, swipe-left to delete (hard, immediate — no browser dialog).
- **Settings** (`/books/settings`): choose which Entry fields are visible; enable a **CSV importer** (`/books/import`) that matches each row against Google Books (with inline fix for ambiguous/no-match rows) and commits idempotently. Columns + rules: `templates/books-import-guide.md`.
- **Metadata only on demand** from **Google Books** (Open Library fallback); `cover_url` stores a full image URL, and `google_books_id`/`open_library_id`/`isbn` are kept for a future "refresh metadata". Imported rows carry their **status** (want/reading/read/dropped), `start_date` (required except a not-yet-started Want), and `end_date` (read/dropped) from the CSV, so they sort correctly and read books appear in the Recently Read shelf.

## Quotes

- **Moment of Zen** (`/quotes`): a single random quote — favourites first, broadening to the whole pool on pull-to-refresh (or a shuffle button on non-touch); the quote text rendered large and centred (correct CJK rendering), a metadata cluster (**Author · Source type · Title**, where tapping the Title jumps to the linked Show/Book when a link exists), the single **Category** badge, any **Tags**, and a **heart** to toggle favourite instantly.
- **Library** (`/quotes/library`): real-time search across quote text, author, title, and tags; faceted filters (**Categories**, multi-select **Tags**, **Favourites** toggle, **Source type**, **Language** — the Category/Source options come from the owner's configured lists) + a **Sort menu** (Date / Category / Source type, default Date descending); a lazy-loaded list of quote snippets; tap a row to edit, swipe-left to delete (hard, immediate — no browser dialog). When opened from a Show/Book detail it is constrained to that record's quotes.
- **Add / Edit** (`/quotes/entry`, `/quotes/:id`): quote text (required), an optional **Source link** that searches local **Show** and **Book** records (binds `show_id`/`book_id` and auto-fills Source Type + Title; Author stays manual — the speaker/character), Author, **Source Type** (from the configured list), Title, one **Category** (required, from the configured list — defaults to the first value), optional **Tags** (autocomplete over existing tags), a **Language** English/Chinese toggle (auto-detected, editable), and a **Favourite** heart; compact **icon header actions** (Delete when editing · Reset · Create / Save). Accepts a `?text=&author=&title=` prefill (copy-paste / an Apple Books Shortcut) and a **Paste from clipboard** button. An **Import** button opens the importer.
- **Settings** (`/quotes/settings`): choose which Entry fields are visible; **manage the Source Type and Category lists** (add / rename / delete / reorder — deleting a value still used by quotes prompts a reassignment, and TV/Movie/Book are protected so Show/Book linking keeps working); enable a **CSV importer** (`/quotes/import`) that validates each row (Source/Category matched by key or label), optionally links the title to a Show/Book by source type, and commits idempotently (no exact duplicates). Columns + rules: `templates/quotes-import-guide.md`.
- **Cross-module links are optional enrichment.** `author`, `title`, and `source_type` are denormalised onto the quote, so a quote stays complete (and still renders) after a linked Show or Book is hard-deleted — the FK just goes null.

## Medical

- **Dashboard** (`/medical`): trend charts (recharts) for each **tracked** test across reports; latest values grouped by category, coloured by flag (high/low/abnormal) using **the report's own range**; a reports-timeline entry point.
- **Reports** (`/medical/reports`): a **searchable** (body part, narrative), **filterable** (type, provider, body part), **sortable** (date / type / provider / body part, default newest-first) list (each row date · type · provider · body part); tap → Report detail (results in the user's section + test order, filtered to the tests that report contains, each with name · value/text · unit · the report's reference range · flag; plus the narrative block and **Open original** Google Drive link[s]); swipe-left to delete (hard, cascades its results).
- **Add / Edit Report** (`/medical/entry`, `/medical/:id`): **manual** result entry, or **Import** a JSON (primary) / CSV → a **mandatory review-before-save** screen (parsed-result counts per category to catch omitted sections, uncertain rows highlighted, add/correct anything) → save + paste Drive URL[s]. Eye reports surface the six structured **refraction** values (Sphere/Cylinder/Addition × OD/OS). On the New form the **Import JSON** action is an accent link in the header; **Report Date** and **Type** share a line. Compact **icon header actions** (Delete when editing · Reset · Create / Save).
- **Settings** (`/medical/settings`): pick **tracked tests** (seeded from `default_tracked`, like Visible Nutrients); **drag-to-reorder** the category sections and tests within each (applied to the Dashboard, Report detail, **and the Entry form's result cards**); choose which **Entry fields** are visible; the importer toggle; the **biometric lock** (toggle, set/reset PIN, adjustable auto-lock timeout).
- **Intake is a structured import, not in-app OCR** (OCR mangles medical decimals); extraction is done outside the app by any vision-capable AI tool using `templates/medical-extraction-prompt.md` + `medical-import.schema.json`. **Reference ranges are stored exactly as printed**; cross-provider values are **normalized to a canonical unit** at import (flagged, original preserved). Originals are **Google Drive links**, never stored files.

## Travel

- **Dashboard** (`/travel`): six count tiles over **visited** trips, in a **3-column × 2-row** grid filled column-first — **中国省份** (China provinces, with an "N / 34" line) · **中国城市** (China cities) | **Countries** · **Cities** | **Trips This Year** · **Days Travelled** (no separate province-progress bar — it duplicated the 中国省份 tile); plus **Recently Visited / Planning / Want to Visit** shelves. The shaded province map lives on the Map screen; an **all-trips money roll-up is a non-goal** (each trip computes its own HKD total).
- **Map** (`/travel/map`): a **Leaflet** map (OSM tiles) with a markercluster **dot per visited city** (coloured by status), and a toggleable **layered region fill** — China filled by province (DataV GeoJSON) + non-China countries filled whole (Natural Earth) over visited trips. Tapping a city's dot opens the trip(s) touching it.
- **Trips** (`/travel/trips`): a **searchable** (trip name, city, companion), **filterable** (country, province, status, rating, year), **sortable** (Date / Country / Province / City / Status / Trip Name, default reverse-chronological) list; tap a row to open the Trip Builder, swipe-left to delete (hard, cascades days/stops/expenses).
- **Trip Builder** (`/travel/entry` new, `/travel/trip/:id` edit): a **✕ Close** at the top-left (back, or the Trips list on a direct load); the new screen is **header-only + Create** (a trip must exist before days/stops attach); edit shows the header (Name + Default Currency on a line, a **Status** dropdown + 0–5 half-star **Rating** on a line, Cover image URL rendered `no-referrer`, Companions + a **Track Reimburse** toggle, Notes) and two sub-tabs — **Itinerary** (Days, each with a **Calendar date chip**, drag-reorder via a Reorder-Days sheet, duplicate/delete; per-day Stops with inline add, drag-reorder, a **City picker** (remembered-cities cache + optional Nominatim assist; province snapped to a canonical name), type-specific fields, per-stop **Cost + currency** — informational only, never summed — and **Done/Skipped**) and **Expenses** (per-currency + HKD totals via the trip's first-day FX rates with per-currency manual override, a category breakdown donut, and the expense rows). Compact **icon header actions** (Delete when editing · Reset · Create / Save).
- **Settings** (`/travel/settings`): choose which **Trip Entry fields** are visible (Rating / Cover Image URL / Companions / Track Reimbursement / Notes); **manage the Expense Category list** (add / rename / delete / reorder — deleting an in-use category reassigns its expenses first; the last can't be deleted); and two **importers** (accent upload links, Trips first) — **Import JSON Trips** (an itinerary JSON array → drafts, one combined review with pooled new-city resolution) and **Import CSV Expenses** (a wide sheet, split per category, Trip-column attribution, unknown-header mapping, replace-per-trip).
- **Stop cost is informational only** (never summed); the **Expenses layer is the authoritative spend total**. Per-trip FX overrides live in the trip's Expenses tab, not Settings.

## Out of scope / non-goals

### General

- The hub is built to accept further modules as drop-in cards + routes.
- No social features, no ads, no third-party tracking.
- **No UI-language toggle yet** — the interface is English-only. An English / 繁體中文 (HK Traditional)
  toggle for UI chrome is **scoped but deferred** (see `PARKED.md`); the existing `opencc-js` plumbing is
  for user-data search only, not UI translation.

### Wellness

- No automatic step sync (HealthKit is native-only; steps are entered manually).
- Not a medical device; nutrient targets are guidance based on public DRI standards.

### Net Worth

- **Auto stock price lookup** (Alpha Vantage, free key): enter shares only, app fetches month-end price.
  Deferred — manual value entry for now. (`details.shares` is already stored to support this later.)
- **Auto fund NAV lookup** — no reliable free source for HK/China-domiciled funds; NAV/return/P&L come from the JPM monthly CSV import instead.
- **Per-asset-type stacked-area composition graph** (total split into type bands).
- **Liabilities / net-of-debt** tracking.
- **Individual-asset (sub-type) trends** — current scope aggregates at asset-type level only.
- **Multi-currency display toggle** for the dashboard.
- **Cost-basis / unrealized gain** — `details.cost` and `details.premium` are captured in the seed but not yet used; a future view could show value vs. cost per holding and total unrealized gain.

### Shows

- **Per-episode / air-schedule tracking** (TVmaze) — only season & episode _counts_ are tracked now.
- **Watch-provider / streaming availability**, **trailers**, **keywords/recommendations**.
- **Bulk "sync all" refresh** — only **per-show** Refresh from TMDB is built (the owner always knows which title needs it).
- **Auto-rematching un-linked shows to TMDB** — a show with no `tmdb_id` is upgraded only by a manual re-search.
- **Cloudflare Worker / Douban-Bilibili scraping / server-side OG parsing** — rejected (fragile, hostile targets, ends the no-backend architecture). Manual entry + a pasted poster + TMDB contribution cover the need. (If Chinese search-as-you-type ever becomes high-frequency, revisit a Worker over **Bilibili's keyless suggest endpoint** only — never a Douban scraper.)
- **Watch history / multiple rewatches** — one record per title, single start/finish.

### Books

- **Page / reading-progress, audiobooks, format, series** — deliberately omitted (status only).
- **Refresh metadata** action — `google_books_id` (and `open_library_id`/`isbn`) are stored to enable it later.
- **Discover Quotes for books** (Wikiquote auto-fetch) — parked with the Quotes module's external-fetch non-goal.
- **Reading history / multiple re-reads** — one record per book, single start/finish.

### Quotes

- **"Discover Quotes" / external quote fetch** (the Wikiquote + TV-quotes routing engine) — parked. Reliability and CORS of those sources are unproven, and manual entry + import cover the need; the `language` field is kept so routing can be added later.
- **Traditional vs Simplified** Chinese distinction — one `zh` value is enough for now.
- **Quotes from Articles** — the source type exists, but there's no data in the import file yet.
- **Direct Apple Books integration** — not possible from a PWA; copy-paste + the optional `?text=` Shortcut are the ingestion path.

### Medical

- **In-app OCR / Tesseract** — rejected (mangles decimals; dangerous for medical numbers). Extraction is done outside the app by a vision AI tool; the app imports the structured result.
- **Storing original files** — not stored; Google Drive URL(s) per report instead. (No Supabase Storage.)
- **Diagnosis / medical advice** — the app records and trends data only; it is not a medical device. Reference ranges are stored exactly as printed on each report (labs differ); the app never computes a range or interprets a result.
- **Auto stock of normal ranges / eGFR computation** — values come only from the report (or manual entry).
- **Display-only unit normalization toggle** — out of scope: cross-provider values are normalized to a canonical unit **at import** (flagged, original preserved); the app does not offer an on/off "compute another unit" view.
- **Server-verified WebAuthn / true background lock** — a PWA has no background-lock lifecycle and no relying-party backend; the biometric lock is a client-side UX gate over RLS-protected data (re-locks on cold start / idle timeout), with a mandatory PIN fallback.

### Travel

- **All-trips cross-currency spend roll-up on the Dashboard** — parked. Each trip computes its own HKD total in its Expenses tab; a cross-trip money figure would need every trip's rates loaded at once. The Dashboard shows count-based metrics only.
- **Province/state-level map fill outside China** — parked; non-China countries are filled whole (Natural Earth admin-0). The `regionName → shape` model leaves room to add admin-1 later.
- **GCJ-02 offset correction** — parked (v1). Stored coords, the GeoJSON, and OSM tiles are treated as WGS-84; the GCJ-02 visual offset over Chinese areas isn't corrected (invisible at province/country zoom).
- **Offline map** — the map needs network: OSM tiles aren't cached and the bundled `public/geo/*` GeoJSON are excluded from the PWA precache (loaded on demand with the lazy map chunk).
- **Companions/cover as structured data, photo uploads, flight/train numbers** — companions + cover are free text / a pasted URL (no file storage; no Supabase Storage).
- **Per-stop cost / time / travel-mode / from-to / local-transit fields** — removed; folded into the stop's free-text description. The Expenses layer is the sole, authoritative spend source.

## Key constraints

- Free stack, no Apple Developer account, low maintenance, multi-user-ready.
- The _runtime stack_ is free.
