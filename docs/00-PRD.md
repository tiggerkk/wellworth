# 00 — Product Requirements (PRD)

## Overview

**WellWorth** is a personal mobile app — a private "super-app" of self-contained modules for one household. It launches to a Home hub of module cards; the first two modules are (1) Wellness — food, supplements, and activity with full nutrient reporting — and (2) Net Worth. Further modules (e.g. TV shows watched, inspirational quotes) may be added later as new cards with no structural change. The Wellness module is modeled on the Cronometer app's look and feel, simplified to one person's needs. It is delivered as an installable PWA (web app added to the iPhone/iPad home screen) so it needs no Apple Developer account and is free to run.

## Users

- **Now:** a single owner (the primary user).
- **Later:** a few family members, each signing in with their own Google account and seeing only
  their own data. The schema and auth are built multi-user-ready from day one (see data model), but
  no family-only features are built in Phase 1.

## Goals

- Fast daily logging of food, supplements, and activity.
- Accurate micronutrient reporting (the reason we use a real food database, not manual entry alone).
- Energy balance: calories consumed vs. BMR vs. activity, with a clear net number.
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

## Phase 1 scope — Wellness (build this)

- Google sign-in (Supabase Auth); first login creates the user's profile.
- **Diary:** day navigation + calendar; highlighted-nutrient grid; meal/supplement/activity groups; add/expand/collapse/swipe-delete; copy-day actions; per-day report.
- **Add Food:** search (USDA), Favorites, Custom; barcode scan (Open Food Facts); food detail entry.
- **Add Activity:** personal activity library; duration-based and strength-based logging.
- **Dashboard / Daily Report:** date-range averages and single-day reports with nutrient bars (red past upper limits) and an energy-balance panel.
- **Library:** create/edit/delete custom foods, supplements, and activities (full nutrient entry).
- **Settings (global, at Home level):** profile; units; account — shared across modules. Wellness-specific settings (protein target override; nutrient highlight + visibility) live as the Wellness module's own sub-settings.
- Cross-device sync via Supabase.

## Phase 2 — Net Worth

Monthly (first-of-month) entry of asset values across cash, time deposits, stocks, mutual funds, retirement funds, insurance, and properties, in HKD (base), CNY, or USD; net-worth calculation in base currency; total and by-asset-type trend graphs with a selectable time window. Full design in 06-networth.md. A Net Worth card on the Home hub; its own tables; shares only auth/profile and the app shell.

## Out of scope / non-goals

- No automatic step sync (HealthKit is native-only; steps are entered manually).
- No social features, no ads, no third-party tracking.
- Not a medical device; nutrient targets are guidance based on public DRI standards.
- Future modules (TV shows, quotes, etc.) are noted as direction only — not built now. The hub is built to accept them later.

## Key constraints

- Free stack, no Apple Developer account, low maintenance, multi-user-ready.
- The _runtime stack_ is free.
