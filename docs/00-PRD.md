# 00 — Product Requirements (PRD)

## Overview

**WellWorth** is a personal mobile app for tracking (1) Wellness — food, supplements, and activity
with full nutrient reporting — and (2) Net Worth. It is modeled on the Cronometer app's look and
feel, simplified to one person's needs. It is delivered as an installable **PWA** (web app added to
the iPhone/iPad home screen) so it needs no Apple Developer account and is free to run.

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
- Entirely free to run; easy to maintain by one non-expert owner.

## Phase 1 scope — Wellness (build this)

- Google sign-in (Supabase Auth); first login creates the user's profile.
- **Diary:** day navigation + calendar; highlighted-nutrient grid; meal/supplement/activity groups;
  add/expand/collapse/swipe-delete; copy-day actions; per-day report.
- **Add Food:** search (USDA), Favorites, Custom; barcode scan (Open Food Facts); food detail entry.
- **Add Activity:** personal activity library; duration-based and strength-based logging.
- **Dashboard / Daily Report:** date-range averages and single-day reports with nutrient bars
  (red past upper limits) and an energy-balance panel.
- **Library:** create/edit/delete custom foods, supplements, and activities (full nutrient entry).
- **Settings:** profile; protein target override; nutrient highlight + visibility; units; account.
- Cross-device sync via Supabase.

## Phase 2 — Net Worth (do NOT build yet)

Monthly entry of asset values (cash, time deposits, mutual funds, retirement, insurance, stock
options, real estate) in HKD (base), RMB, or USD; net-worth calculation in base currency; a trend
graph with selectable time window. Separate tables; shares only auth/profile and the app shell.

## Out of scope / non-goals

- No automatic step sync (HealthKit is native-only; steps are entered manually).
- No social features, no ads, no third-party tracking.
- Not a medical device; nutrient targets are guidance based on public DRI standards.

## Key constraints

- Free stack, no Apple Developer account, low maintenance, multi-user-ready.
- The _runtime stack_ is free.
