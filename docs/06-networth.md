# 06 — Net Worth (Phase 2)

Self-contained spec for the Net Worth module. It slots into the existing app as a module under the top-level Home hub and follows all Phase-1 conventions (design system, RLS, metric/native storage, data-access
layer, RESET/SAVE patterns). Data model and seed are included here so the Phase-1 `03`/`05` files don't need editing.

## Overview & scope

- Track total net worth over time, entered **manually**, roughly **monthly** (no set day).
- Each entry is tagged to a month and **treated as the first day of that month**; retrospective months allowed. (Using the 1st means the reference FX rate already exists whenever you enter,
  even mid-month — unlike month-end, which wouldn't be known until the month closed.)
- Adding a new month **copies the previous month's entries and values** for editing (copy-forward).
- **Asset-only** — no liabilities.
- Base currency **HKD**; entries may be in **HKD, CNY, or USD**.
- Lives as a **module** under the top-level Home hub, with its own `/networth/*` routes and bottom-nav tabs.
- **No separate asset library.** Assets are managed inline in the Monthly Entry screen; each month is self-contained (copy-forward carries holdings month to month).

## Asset types (fixed enum in this order)

`cash, time_deposit, stock, mutual_fund, retirement, insurance, property`

| Type         | `name` is      | Type-specific `details` (informational unless noted) | `value_native` holds |
| ------------ | -------------- | ---------------------------------------------------- | -------------------- |
| cash         | institution    | —                                                    | balance              |
| time_deposit | institution    | `maturity_date`                                      | principal + interest |
| stock        | ticker/company | `ticker`, `shares`                                   | total value (manual) |
| mutual_fund  | fund name      | `units`, `cost` (purchase cost)                      | total value (manual) |
| retirement   | provider       | —                                                    | portfolio value      |
| insurance    | policy label   | `premium`, `policy_year`                             | net cash value       |
| property     | address/label  | —                                                    | market value         |

All values are entered manually (see Parked for deferred auto-lookup). The `details` fields are preserved for reference but do **not** drive the value or the net-worth math. The `details` JSONB is
open-ended — the import accepts whatever `detailN_key`/`detailN_value` pairs appear in the CSV, so new keys can be added later without a schema change.

## Currencies & FX

- Native currency per entry: HKD / CNY / USD.
- **FX auto-fetched** from **Frankfurter** (`https://api.frankfurter.dev`, keyless, ECB-sourced) for the snapshot's date (the **first of the month**), native → HKD. Example: `/v1/2026-06-01?from=USD&to=HKD`. Frankfurter (ECB-sourced) quotes the renminbi under the ISO code **`CNY`** — which is exactly the currency code we store — so no code translation is needed. If the 1st is a non-trading day, Frankfurter returns the most recent rate on or before it.
- The user can **override** any rate per currency per month (pencil affordance).
- The rate used is **stored on each entry** (`fx_rate_to_base`) and `value_base` is computed and stored, so history is immune to later FX revisions. HKD→HKD rate = 1.

## Screens

### Home hub & module entry

Net Worth is one card on the top-level **Home hub**. Entering it swaps the bottom nav to Net Worth's own two tabs (Dashboard + Monthly Entry), with a persistent way back to Home; the Net Worth tabs never appear in the Wellness nav, and vice-versa. See `00-PRD.md` → Navigation model.

### Net Worth Dashboard

- Large **current total net worth** in HKD (latest snapshot).
- **Total net-worth trend graph** with a time-window selector (reuse the Wellness range-picker pattern; suggested windows: 6M, 12M, 2Y, 3Y, 5Y, All).
- A view toggle on the trend graph: **Total** ⇄ **By asset type** (one line per asset type, each the monthly sum of that type's `value_base`).
- A **per-asset-type summary** for the latest month: type, total HKD, % of net worth.

### Monthly Entry

- Month selector (defaults to the current month; can pick a past month for retrospective entry).
- On a new month, **pre-fill every entry from the most recent prior snapshot** (copy-forward), then re-fetch that month's FX rates and recompute `value_base`.
- Entries **grouped by asset type**; each row editable: name, currency, `value_native`, and the type-specific `details`. **Add entry** (pick type) / edit / **delete** (delete just omits it from this
  month onward — each month is self-contained).
- FX rate per currency shown inline, auto-fetched, with override.
- **Running total in HKD** updates live as you edit.
- **RESET** and **SAVE** buttons, matching Phase-1 conventions.

## Data model (2 new tables — namespaced, `user_id` + RLS, consistent with Phase 1)

### networth_snapshot

- `id` UUID PK
- `user_id` UUID → auth.users
- `month` DATE — normalized to the **first day of the month**; **UNIQUE (user_id, month)**
- `created_at`, `updated_at` TIMESTAMPTZ

### asset_entry

- `id` UUID PK
- `user_id` UUID → auth.users
- `snapshot_id` UUID → networth_snapshot (ON DELETE CASCADE)
- `asset_type` TEXT — the enum above
- `name` TEXT
- `currency` TEXT — 'HKD' | 'CNY' | 'USD'
- `details` JSONB — type-specific fields (maturity_date, ticker, shares, units, …)
- `value_native` NUMERIC — value in the entry's own currency
- `fx_rate_to_base` NUMERIC — native → HKD rate used (1 for HKD)
- `value_base` NUMERIC — value_native × fx_rate_to_base (stored)
- `sort_order` INT NULL
- `created_at`, `updated_at`
- Index on (`user_id`, `snapshot_id`).

No `asset` table and no soft-delete: each month is a complete, self-contained set of `asset_entry` rows, so deleting an entry simply means it is absent from that month forward; prior months are intact.

## Calculations

- `value_base = value_native × fx_rate_to_base` (HKD ⇒ rate 1).
- **Net worth(month)** = `SUM(value_base)` over that snapshot's entries.
- **Asset-type trend** = group a snapshot's entries by `asset_type`, `SUM(value_base)` per type, per month. (Grouping is by the fixed enum, so renaming a holding never breaks the lines.)
- FX fetched native → HKD as of the snapshot's date (**first of the month**; most recent rate on or before it if the 1st is a non-trading day); override allowed.

## Copy-forward rule

Creating a new snapshot duplicates all `asset_entry` rows from the most recent prior snapshot, then re-fetches the new month's FX rates and recomputes `value_base`. The user edits `value_native` (and
adds/removes entries) from there.

## Seed & import (in-app CSV importer)

Your real balances stay **out of the repo**. An **in-app importer** (in the Net Worth module, signed in as you) reads a local CSV and creates/replaces a month's snapshot + `asset_entry` rows. It is reusable for **any** month — not just the first — so you can bulk-replace a month's holdings instead of typing them in. After the initial import, copy-forward takes over month to month. The importer is **idempotent per month** (re-running for a month replaces that month's entries, never duplicating them).

- File: `templates/networth-seed-template.csv` — a **sanitized example** is committed; your **filled** copy must stay gitignored (see `.gitignore`; keep it as e.g. `templates/networth-seed.local.csv`). Confirm each `value_native`.
- **Number parsing:** some CSV numbers are quoted with thousands-separator commas (e.g. `"1,234,567.89"`) while others are plain (e.g. `999.99`). The importer **must strip commas (and surrounding quotes) before converting to numeric**, for both `value_native` and all detail values.
- **Gitignore the filled CSV** (it contains private financial data).
- Column spec:
  `asset_type,name,currency,value_native,detail1_key,detail1_value,detail2_key,detail2_value`
  - `detail*` columns are optional, type-specific, and stored as-is in `details` (e.g. `maturity_date`, `ticker`, `shares`, `units`, `cost`, `premium`, `policy_year`). Extra detail pairs are allowed.
  - The importer asks you for the snapshot month (e.g. `2026-06`) and normalizes it to the **first day** of that month.

## Parked (Net Worth — see PARKED.md)

- **Auto stock price lookup** (Alpha Vantage, free key): enter shares only, app fetches month-end price.
  Deferred — manual value entry for now. (`details.shares` is already stored to support this later.)
- **Mutual fund NAV lookup** — no reliable free source for HK/China-domiciled funds; manual only.
- **Per-asset-type stacked-area composition graph** (total split into type bands).
- **Liabilities / net-of-debt** tracking.
- **Individual-asset (sub-type) trends** — current scope aggregates at asset-type level only.
- **Multi-currency display toggle** for the dashboard.
- **Cost-basis / unrealized gain** — `details.cost` and `details.premium` are captured in the seed but not yet used; a future view could show value vs. cost per holding and total unrealized gain.
