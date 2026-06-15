# 06 — Net Worth (Phase 2)

Self-contained spec for the Net Worth module. It slots into the existing app behind a top-level mode
switch and follows all Phase-1 conventions (design system, RLS, metric/native storage, data-access
layer, RESET/SAVE patterns). Data model and seed are included here so the Phase-1 `03`/`05` files
don't need editing.

## Overview & scope

- Track total net worth over time, entered **manually**, roughly **monthly** (no set day).
- Each entry is tagged to a month and **treated as month-end**; retrospective months allowed.
- Adding a new month **copies the previous month's entries and values** for editing (copy-forward).
- **Asset-only** — no liabilities.
- Base currency **HKD**; entries may be in **HKD, RMB, or USD**.
- Lives behind a **mode switch** (Wellness ⇄ Net Worth) at the top level.
- **No separate asset library.** Assets are managed inline in the Monthly Entry screen; each month is
  self-contained (copy-forward carries holdings month to month).

## Asset types (fixed enum)

`cash, time_deposit, stock, mutual_fund, retirement, insurance, property`

| Type         | `name` is      | Type-specific `details`            | `value_native` holds |
| ------------ | -------------- | ---------------------------------- | -------------------- |
| cash         | institution    | —                                  | balance              |
| time_deposit | institution    | `maturity_date`                    | principal + interest |
| stock        | ticker/company | `ticker`, `shares` (informational) | total value (manual) |
| mutual_fund  | fund name      | `units` (informational)            | total value (manual) |
| retirement   | provider       | —                                  | portfolio value      |
| insurance    | policy label   | —                                  | net cash value       |
| property     | address/label  | —                                  | market value         |

All values are entered manually (see Parked for deferred auto-lookup). `details` fields like `shares`
and `units` are stored for reference but do not drive the value.

## Currencies & FX

- Native currency per entry: HKD / RMB / USD.
- **FX auto-fetched** from **Frankfurter** (`https://api.frankfurter.dev`, keyless, ECB-sourced) for
  the snapshot's month-end date, native → HKD. Example: `/v1/2026-05-31?from=USD&to=HKD`.
- The user can **override** any rate per currency per month (pencil affordance).
- The rate used is **stored on each entry** (`fx_rate_to_base`) and `value_base` is computed and
  stored, so history is immune to later FX revisions. HKD→HKD rate = 1.

## Screens

### Mode switch (top level)

A toggle between **Wellness** and **Net Worth**. Net Worth has its own two screens below; it does not
appear in the Wellness bottom-nav.

### Net Worth Dashboard

- Large **current total net worth** in HKD (latest snapshot).
- **Total net-worth trend graph** with a time-window selector (reuse the Wellness range-picker pattern;
  suggested windows: 6M, 12M, 2Y, 3Y, 5Y, All).
- A view toggle on the trend graph: **Total** ⇄ **By asset type** (one line per asset type, each the
  monthly sum of that type's `value_base`).
- A **per-asset-type summary** for the latest month: type, total HKD, % of net worth.

### Monthly Entry

- Month selector (defaults to the current month; can pick a past month for retrospective entry).
- On a new month, **pre-fill every entry from the most recent prior snapshot** (copy-forward), then
  re-fetch that month's FX rates and recompute `value_base`.
- Entries **grouped by asset type**; each row editable: name, currency, `value_native`, and the
  type-specific `details`. **Add entry** (pick type) / edit / **delete** (delete just omits it from this
  month onward — each month is self-contained).
- FX rate per currency shown inline, auto-fetched, with override.
- **Running total in HKD** updates live as you edit.
- **RESET** and **SAVE** buttons, matching Phase-1 conventions.

## Data model (2 new tables — namespaced, `user_id` + RLS, consistent with Phase 1)

### networth_snapshot

- `id` UUID PK
- `user_id` UUID → auth.users
- `month` DATE — normalized to month-end; **UNIQUE (user_id, month)**
- `created_at`, `updated_at` TIMESTAMPTZ

### asset_entry

- `id` UUID PK
- `user_id` UUID → auth.users
- `snapshot_id` UUID → networth_snapshot (ON DELETE CASCADE)
- `asset_type` TEXT — the enum above
- `name` TEXT
- `currency` TEXT — 'HKD' | 'RMB' | 'USD'
- `details` JSONB — type-specific fields (maturity_date, ticker, shares, units, …)
- `value_native` NUMERIC — value in the entry's own currency
- `fx_rate_to_base` NUMERIC — native → HKD rate used (1 for HKD)
- `value_base` NUMERIC — value_native × fx_rate_to_base (stored)
- `sort_order` INT NULL
- `created_at`, `updated_at`
- Index on (`user_id`, `snapshot_id`).

No `asset` table and no soft-delete: each month is a complete, self-contained set of `asset_entry`
rows, so deleting an entry simply means it is absent from that month forward; prior months are intact.

## Calculations

- `value_base = value_native × fx_rate_to_base` (HKD ⇒ rate 1).
- **Net worth(month)** = `SUM(value_base)` over that snapshot's entries.
- **Asset-type trend** = group a snapshot's entries by `asset_type`, `SUM(value_base)` per type, per
  month. (Grouping is by the fixed enum, so renaming a holding never breaks the lines.)
- FX fetched native → HKD as of the snapshot month-end (nearest prior business day if the exact date
  is a non-trading day); override allowed.

## Copy-forward rule

Creating a new snapshot duplicates all `asset_entry` rows from the most recent prior snapshot, then
re-fetches the new month's FX rates and recomputes `value_base`. The user edits `value_native` (and
adds/removes entries) from there.

## Seed (one-time import via a gitignored CSV)

Your real balances stay **out of the repo**. Claude Code writes a one-time import script that reads a
local CSV and creates your first snapshot + `asset_entry` rows. After that, copy-forward takes over and
the CSV is never needed again.

- File: `networth-seed-template.csv` (provided alongside this doc). Add the target month and fill in
  the blank `value_native` cells (stocks and funds — enter their total current value).
- **Gitignore the filled CSV** (it contains private financial data).
- Column spec:
  `asset_type,name,currency,value_native,detail1_key,detail1_value,detail2_key,detail2_value`
  - `detail*` columns are optional and type-specific (e.g. `maturity_date`, `ticker`, `shares`, `units`).
  - Stocks/funds: leave `value_native` blank in the template and fill with the holding's total value.
  - The import script asks you for the snapshot month (e.g. `2026-05`) and normalizes it to month-end.

## Parked (Net Worth — see PARKED.md)

- **Auto stock price lookup** (Alpha Vantage, free key): enter shares only, app fetches month-end price.
  Deferred — manual value entry for now. (`details.shares` is already stored to support this later.)
- **Mutual fund NAV lookup** — no reliable free source for HK/China-domiciled funds; manual only.
- **Per-asset-type stacked-area composition graph** (total split into type bands).
- **Liabilities / net-of-debt** tracking.
- **Individual-asset (sub-type) trends** — current scope aggregates at asset-type level only.
- **Multi-currency display toggle** for the dashboard.
