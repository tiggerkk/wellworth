# 00 — Product Requirements (PRD)

## Overview

**WellWorth** is a personal mobile app — a private "super-app" of self-contained modules for one household. It launches to a Home hub of module cards; the modules are (1) Wellness — food, supplements, and activity with full nutrient reporting — (2) Net Worth, (3) Shows — tracking TV shows and movies watched or to watch — (4) Books — tracking books read or to read — and (5) Quotes — favourite quotes from screen, page, and sound. Further modules may be added later as new cards with no structural change. The Wellness module is modeled on the Cronometer app's look and feel, simplified to one person's needs. It is delivered as an installable PWA (web app added to the iPhone/iPad home screen) so it needs no Apple Developer account and is free to run.

## Users

- **Now:** a single owner (the primary user).
- **Later:** a few family members, each signing in with their own Google account and seeing only their own data. The schema and auth are built multi-user-ready from day one (see data model), but
  no family-only features are built in Phase 1.

## Goals

- Wellness: Fast daily logging of food, supplements, and activity; accurate micronutrient reporting; energy balance: calories consumed vs. BMR vs. activity, with a clear net number.
- Net Worth: Monthly (first-of-month) entry of asset values across cash, time deposits, stocks, mutual funds, retirement funds, insurance, and properties, in HKD (base), CNY, or USD; net-worth calculation in base currency; total and by-asset-type trend graphs with a selectable time window.
- Shows: track **TV shows, movies, and documentaries** (incl. Chinese-language titles and Chinese documentaries / cultural programs; documentaries may belong to a **master series**, e.g. 国宝档案 → 从东晋到北魏) across a single **status** (Want to Watch / Watching / Watched / Dropped); a three-level **LGBT+ representation** rating (None / Some / Significant); pull metadata (poster, genres, director/creator, cast, seasons & episode counts) from **TMDB** on demand (Chinese-aware), with **manual entry + a pasted Poster URL** as the fallback and a **per-show Refresh from TMDB**; a Dashboard of what's in progress and recently finished, and a searchable, filterable, sortable Library. A back-catalogue of hundreds of titles is seeded via an in-app importer.
- Books: track books across a single **status** (Want to Read / Reading / Read / Dropped); a three-level **LGBT+ representation** rating (None / Some / Significant); pull metadata (cover, authors, year, description, genres, page count) from **Google Books** (Open Library fallback) on demand; a Dashboard of what's in progress and recently read, and a searchable, filterable, sortable Library. A back-catalogue is seeded via an in-app importer.
- Quotes: collect favourite quotes (English or Chinese) from TV shows, films, books, podcasts, articles, videos, and songs; each filed under **exactly one** of six categories with optional free-form tags, and optionally **linked to a Show or Book** record; a "Moment of Zen" dashboard, a searchable/filterable Library, and a recurring **CSV import**.
- Works identically on iPhone and iPad, with data synced across both devices.
- Modular by design: each feature is a self-contained module under the Home hub, so new modules drop in as a card + route without restructuring existing ones.
- Entirely free to run; easy to maintain by one non-expert owner.

## Navigation model

- The app launches to a Home hub — a launcher of module cards (Wellness, Net Worth, Shows, Books, Quotes, and future modules), styled with the existing dark surface cards and Tabler icons.
- Selecting a module enters it; the bottom nav then shows that module's own tabs (Wellness keeps Dashboard / Diary / Library; Net Worth, Shows, Books, and Quotes show their own), with a persistent way back to Home.
- Settings is global, lifted to the Home level (profile, units, account apply across all modules); a module may add its own sub-settings (e.g. Wellness targets/display; Shows, Books, and Quotes field-visibility + importer).
- Routing is URL-driven per module (/wellness/_, /networth/_, /shows/_, /books/_, /quotes/\_).
- On launch, the app reopens the last-used module so daily Wellness use isn't slowed by the hub.
- The hub makes adding future modules a drop-in (a `ModuleDef` + its routes).

## Wellness

- Google sign-in (Supabase Auth); first login creates the user's profile.
- **Diary:** day navigation + calendar; highlighted-nutrient grid; meal/supplement/activity groups; add/expand/collapse/swipe-delete; copy-day actions; per-day report.
- **Add Food:** search (USDA), Favorites, Custom; barcode scan (Open Food Facts); food detail entry.
- **Add Activity:** personal activity library; duration-based and strength-based logging.
- **Dashboard / Daily Report:** date-range averages and single-day reports with nutrient bars (red past upper limits) and an energy-balance panel.
- **Library:** create/edit/delete custom foods, supplements, and activities (full nutrient entry).
- **Settings (global, at Home level):** profile; units; account — shared across modules. Wellness-specific settings (protein target override; nutrient highlight + visibility) live as the Wellness module's own sub-settings.
- Cross-device sync via Supabase.

## Net Worth

- **Dashboard** (`/networth`): large **current total** (latest month) in HKD; a **trend line graph** (recharts) with a window selector (6M/12M/2Y/3Y/5Y/All) and a **Total ⇄ By asset type** toggle; a **latest-month per-type summary** (color dot · type · HKD · % of net worth).
- **Monthly Entry** (`/networth/entry`): month selector (prev/next), retrospective months allowed; a new month **copies the previous month forward** and auto-fetches its FX as of the first day of the month; entries **grouped by asset type** with a per-group add + inline edit (name, currency HKD/CNY/USD, value, type-specific details) + delete; editable per-currency **FX rates** (auto-fetched, override + refresh ↻; HKD = 1); live HKD total; **RESET / SAVE**. An **Import CSV** button opens the importer.
- **Import CSV** (`/networth/import`, sheet): pick a month + upload a CSV → preview (rows, skipped rows, fetched rates, HKD total) → **Import** create-or-replaces that month (idempotent). Columns + rules: `templates/networth-import-guide.md`.
- **No separate asset library.** Assets are managed inline in the Monthly Entry screen; each month is self-contained (copy-forward carries holdings month to month).

## Shows

- **Dashboard** (`/shows`): shelves of **Favourites** (every ♥ title), **Up Next** (in-progress episodic title with episode progress), **Watching** (with a Watching chip + episode progress), **Want to Watch**, and **Recently Watched** (last 5 by finish date), each shown only when non-empty; a **type filter** (All / TV / Movies / Docs); quick actions **Mark Watched** and **Start Watching**; a "N watched this year" stat line; a `+` to a blank Entry.
- **Entry / Edit** (`/shows/entry`, `/shows/:id`): a Chinese-aware **Search TMDB** title lookup populates metadata (poster, genres, director/creator, top cast, overview, runtime, season/episode totals) on select; a three-way **Type** (TV / Movie / Documentary), a header **favourite heart**, a **Poster URL** field (paste a direct image URL) shown only when TMDB supplied no poster or when forced on via Settings, a **⟳ Refresh from TMDB** button (enabled once a `tmdb_id` exists; re-pulls TMDB-sourced fields only), Status (Want leaves Start Date blank), manual **star rating** (0–5, half-stars), a three-way **LGBT+ representation** control, start/finish/last-update dates (Calendar), episodic watched/total counts, and comments; **RESET / CREATE / SAVE**. Nothing is saved until CREATE/SAVE. A new show can be prefilled via `?title=&poster=&overview=&type=`.
- **Library** (`/shows/library`): a poster-thumbnail list with search (title, director, cast) + filters (Type incl. Documentary, Genre, Rating, LGBT+, Status, **Favourites only**, start/finish date ranges) + a Sort menu; a ♥ marks favourite rows; tap a row to edit, swipe-left to delete (hard, with confirm).
- **Settings** (`/shows/settings`): choose which Entry fields are visible; enable a **CSV importer** (`/shows/import`) — one CSV spans English + Chinese across all three types — that matches each row against TMDB (with inline fix for ambiguous/no-match rows; niche docs import metadata-less, topped up later) and commits idempotently. Columns + rules: `templates/shows-import-guide.md`.
- **TMDB metadata only on demand**; images store just `poster_path` (URLs built from the CDN base). Imported rows have NULL dates, so they live in the Library, not the Dashboard's recent shelf.

## Books

- **Dashboard** (`/books`): **Favourites** (every ♥ book), **Currently Reading**, **Recently Read** (last 5 by finish date), and a **Want to Read** shelf, each shown only when non-empty; quick actions **Mark Read** (status → read, finish date → today) and **Start Reading** (status → reading, start date → today); a `+` to a blank Entry. Cover thumbnails throughout.
- **Entry / Edit** (`/books/entry`, `/books/:id`): a title/author **Search Google Books** lookup populates metadata (cover, authors, year, description, genres, page count) on select; a header **favourite heart**, Status, manual **star rating** (0–5, half-stars), a three-way **LGBT+ representation** control, start/finish/last-update dates (Calendar), and comments; **RESET / CREATE / SAVE**. Nothing is saved until CREATE/SAVE; CREATE requires at least a Title.
- **Library** (`/books/library`): a cover-thumbnail list with search (title, author) + filters (Genre, Rating, LGBT+, Status, Author, **Favourites only**, start/finish date ranges) + a Sort menu; a ♥ marks favourite rows; tap a row to edit, swipe-left to delete (hard, with confirm).
- **Settings** (`/books/settings`): choose which Entry fields are visible; enable a **CSV importer** (`/books/import`) that matches each row against Google Books (with inline fix for ambiguous/no-match rows) and commits idempotently. Columns + rules: `templates/books-import-guide.md`.
- **Metadata only on demand** from **Google Books** (Open Library fallback); `cover_url` stores a full image URL, and `google_books_id`/`open_library_id`/`isbn` are kept for a future "refresh metadata". Imported rows get `status = read` with the file's finish date and NULL start/last-update dates, so they live in the Library and the Recently Read shelf, not as in-progress.

## Quotes

- **Moment of Zen** (`/quotes`): a single random quote — favourites first, broadening to the whole pool on pull-to-refresh (or a shuffle button on non-touch); the quote text rendered large and centred (correct CJK rendering), a metadata cluster (**Author · Source type · Title**, where tapping the Title jumps to the linked Show/Book when a link exists), the single **Category** badge, any **Tags**, and a **heart** to toggle favourite instantly.
- **Library** (`/quotes/library`): real-time search across quote text, author, title, and tags; faceted filters (the six **Categories**, multi-select **Tags**, **Favourites** toggle, **Source type**, **Language**); a lazy-loaded list of quote snippets; tap a row to edit, swipe-left to delete (hard, with confirm). When opened from a Show/Book detail it is constrained to that record's quotes.
- **Add / Edit** (`/quotes/entry`, `/quotes/:id`): quote text (required), an optional **Source link** that searches local **Show** and **Book** records (binds `show_id`/`book_id` and auto-fills Source Type + Title; Author stays manual — the speaker/character), Author, Source Type (TV Show / Movie / Book / Podcast / Article / Video / Song), Title, one **Category** (required), optional **Tags** (autocomplete over existing tags), **Language** (auto-detected, editable), and a **Favourite** toggle; **RESET / CREATE / SAVE**. Accepts a `?text=&author=&title=` prefill (copy-paste / an Apple Books Shortcut) and a **Paste from clipboard** button. An **Import** button opens the importer.
- **Settings** (`/quotes/settings`): choose which Entry fields are visible; enable a **CSV importer** (`/quotes/import`) that validates each row, optionally links the title to a Show/Book by source type, and commits idempotently (no exact duplicates). Columns + rules: `templates/quotes-import-guide.md`.
- **Cross-module links are optional enrichment.** `author`, `title`, and `source_type` are denormalised onto the quote, so a quote stays complete (and still renders) after a linked Show or Book is hard-deleted — the FK just goes null.

## Out of scope / non-goals

### General

- The hub is built to accept further modules as drop-in cards + routes.
- No social features, no ads, no third-party tracking.

### Wellness

- No automatic step sync (HealthKit is native-only; steps are entered manually).
- Not a medical device; nutrient targets are guidance based on public DRI standards.

### Net Worth

- **Auto stock price lookup** (Alpha Vantage, free key): enter shares only, app fetches month-end price.
  Deferred — manual value entry for now. (`details.shares` is already stored to support this later.)
- **Mutual fund NAV lookup** — no reliable free source for HK/China-domiciled funds; manual only.
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

## Key constraints

- Free stack, no Apple Developer account, low maintenance, multi-user-ready.
- The _runtime stack_ is free.
