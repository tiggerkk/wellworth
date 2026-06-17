# 00 — Product Requirements (PRD)

## Overview

**WellWorth** is a personal mobile app — a private "super-app" of self-contained modules for one household. It launches to a Home hub of module cards; the modules are (1) Wellness — food, supplements, and activity with full nutrient reporting — (2) Net Worth, and (3) Shows — tracking TV shows and movies watched or to watch. Further modules (e.g. inspirational quotes) may be added later as new cards with no structural change. The Wellness module is modeled on the Cronometer app's look and feel, simplified to one person's needs. It is delivered as an installable PWA (web app added to the iPhone/iPad home screen) so it needs no Apple Developer account and is free to run.

## Users

- **Now:** a single owner (the primary user).
- **Later:** a few family members, each signing in with their own Google account and seeing only their own data. The schema and auth are built multi-user-ready from day one (see data model), but
  no family-only features are built in Phase 1.

## Goals

- Wellness: Fast daily logging of food, supplements, and activity; accurate micronutrient reporting; energy balance: calories consumed vs. BMR vs. activity, with a clear net number.
- Net Worth: Monthly (first-of-month) entry of asset values across cash, time deposits, stocks, mutual funds, retirement funds, insurance, and properties, in HKD (base), CNY, or USD; net-worth calculation in base currency; total and by-asset-type trend graphs with a selectable time window.
- Shows: track TV shows and movies across a single **status** (Want to Watch / Watching / Watched / Dropped); a three-level **LGBT+ representation** rating (None / Some / Significant); pull metadata (poster, genres, director/creator, cast, seasons & episode counts) from **TMDB** on demand; a Dashboard of what's in progress and recently finished, and a searchable, filterable, sortable Library. A back-catalogue of hundreds of titles is seeded via an in-app importer.
- Works identically on iPhone and iPad, with data synced across both devices.
- Modular by design: each feature is a self-contained module under the Home hub, so new modules drop in as a card + route without restructuring existing ones.
- Entirely free to run; easy to maintain by one non-expert owner.

## Navigation model

- The app launches to a Home hub — a launcher of module cards (Wellness, Net Worth, Shows, and future modules), styled with the existing dark surface cards and Tabler icons.
- Selecting a module enters it; the bottom nav then shows that module's own tabs (Wellness keeps Dashboard / Diary / Library; Net Worth and Shows show their own), with a persistent way back to Home.
- Settings is global, lifted to the Home level (profile, units, account apply across all modules); a module may add its own sub-settings (e.g. Wellness targets/display; Shows field-visibility + importer).
- Routing is URL-driven per module (/wellness/_, /networth/_, /shows/_, future /quotes/_).
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

- **Dashboard** (`/shows`): shelves of **Up Next** (in-progress TV with episode progress), **Watching**, **Want to Watch**, and **Recently Watched** (last 5 by finish date), each shown only when non-empty; a **type filter** (All / TV / Movies); quick actions **Mark Watched** and **Start Watching**; a "N watched this year" stat line; a `+` to a blank Entry.
- **Entry / Edit** (`/shows/entry`, `/shows/:id`): a **Search TMDB** title lookup populates metadata (poster, genres, director/creator, top cast, overview, runtime, season/episode totals) on select; Type (TV/Movie), Status, manual **star rating** (0–5, half-stars), a three-way **LGBT+ representation** control, start/finish/last-update dates (Calendar), TV watched/total counts, and comments; **RESET / CREATE / SAVE**. Nothing is saved until CREATE/SAVE.
- **Library** (`/shows/library`): a poster-thumbnail list with search (title, director, cast) + filters (Type, Genre, Rating, LGBT+, Status, start/finish date ranges) + a Sort menu; tap a row to edit, swipe-left to delete (hard, with confirm).
- **Settings** (`/shows/settings`): choose which Entry fields are visible; enable a one-off **CSV importer** (`/shows/import`) that matches each row against TMDB (with inline fix for ambiguous/no-match rows) and commits idempotently. Columns + rules: `templates/shows-import-guide.md`.
- **TMDB metadata only on demand**; images store just `poster_path` (URLs built from the CDN base). Imported rows have NULL dates, so they live in the Library, not the Dashboard's recent shelf.

## Out of scope / non-goals

### General

- Future modules (quotes, etc.) are noted as direction only — not built now. The hub is built to accept them later.
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
- **Refresh metadata** action (re-pull a show that added a season) — `tmdb_id` is stored to enable it later.
- **Watch history / multiple rewatches** — one record per title, single start/finish.

## Key constraints

- Free stack, no Apple Developer account, low maintenance, multi-user-ready.
- The _runtime stack_ is free.
