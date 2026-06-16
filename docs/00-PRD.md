# 00 — Product Requirements (PRD)

## Overview

**WellWorth** is a personal mobile app — a private "super-app" of self-contained modules for one household. It launches to a Home hub of module cards; the first two modules are (1) Wellness — food, supplements, and activity with full nutrient reporting — and (2) Net Worth. Further modules (e.g. TV shows watched, inspirational quotes) may be added later as new cards with no structural change. The Wellness module is modeled on the Cronometer app's look and feel, simplified to one person's needs. It is delivered as an installable PWA (web app added to the iPhone/iPad home screen) so it needs no Apple Developer account and is free to run.

## Users

- **Now:** a single owner (the primary user).
- **Later:** a few family members, each signing in with their own Google account and seeing only their own data. The schema and auth are built multi-user-ready from day one (see data model), but
  no family-only features are built in Phase 1.

## Goals

- Wellness: Fast daily logging of food, supplements, and activity; accurate micronutrient reporting; energy balance: calories consumed vs. BMR vs. activity, with a clear net number.
- Net Worth: Monthly (first-of-month) entry of asset values across cash, time deposits, stocks, mutual funds, retirement funds, insurance, and properties, in HKD (base), CNY, or USD; net-worth calculation in base currency; total and by-asset-type trend graphs with a selectable time window.
- Works identically on iPhone and iPad, with data synced across both devices.
- Modular by design: each feature is a self-contained module under the Home hub, so new modules drop in as a card + route without restructuring existing ones.
- Entirely free to run; easy to maintain by one non-expert owner.

## Navigation model

- The app launches to a Home hub — a launcher of module cards (Wellness, Net Worth, and future modules), styled with the existing dark surface cards and Tabler icons.
- Selecting a module enters it; the bottom nav then shows that module's own tabs (Wellness keeps Dashboard / Diary / Library; Net Worth shows its own), with a persistent way back to Home.
- Settings is global, lifted to the Home level (profile, units, account apply across all modules); a module may add its own sub-settings.
- Routing is URL-driven per module (/wellness/_, /networth/_, future /shows/_, /quotes/_).
- On launch, the app reopens the last-used module so daily Wellness use isn't slowed by the hub.
- Build only the Wellness and Net Worth cards now; the hub must make adding future modules a drop-in.

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

## Out of scope / non-goals

### General

- Future modules (TV shows, quotes, etc.) are noted as direction only — not built now. The hub is built to accept them later.
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

## Key constraints

- Free stack, no Apple Developer account, low maintenance, multi-user-ready.
- The _runtime stack_ is free.
