# 05 — Net Worth Module

## Screens

### Dashboard

No screen-title header (opens straight into cards). With no snapshots yet, the shared centered
**empty state** (see `docs/01-design-system.md` → EmptyState) shows (Monthly Entry icon · "No
entries yet" · "+ Monthly Entry").

- Large **current total net worth** in HKD (latest snapshot).
- **Total net-worth trend graph** with a time-window selector (windows: 6M, 12M, 2Y, 3Y, 5Y, All).
  A view toggle: **Total** ⇄ **By asset type** (one line per asset type, each the monthly sum of
  that type's `value_base`).
- A **per-asset-type summary** for the latest month: type, total HKD, % of net worth.

### Monthly Entry

- Month selector (defaults to the current month; can pick a past month for retrospective entry).
  The `‹ month ›` arrows step one month; **tapping the month label opens a month/year picker**
  (year stepper over a month grid, OK/Cancel — see `docs/01-design-system.md` → MonthPicker).
- On a new month, **pre-fill every entry from the most recent prior snapshot** (copy-forward), then
  re-fetch that month's FX rates and recompute `value_base`. The user edits `value_native` (and
  adds/removes entries) from there.
- The **header is pinned** — month selector, the live **NET WORTH** total in HKD, and
  **RESET**/**SAVE** stay visible while the **asset-type list scrolls** beneath.
- Entries **grouped by asset type**; each row editable: name, currency, `value_native`, and the
  type-specific `details`. **Add entry** (pick type) / edit / **delete** (omits the entry from this
  month onward — each month is self-contained).
- **Exchange rates** panel: title `EXCHANGE RATES (HKD 1.0000)`, **CNY and USD rates on one line**,
  each auto-fetched (with ↻ refetch) and overridable. Native → HKD as of the 1st of the month, via
  Frankfurter (see `docs/02-tech-spec.md` → Shared external APIs).
- **Running total in HKD** updates live as you edit.
- **RESET** and **SAVE** buttons (icon style — see `docs/01-design-system.md` → EntryHeaderActions).

---

## Net Worth Calculations (pure helpers in `src/lib/networth.ts`)

- `value_base = value_native × fx_rate_to_base` (stored at write time, frozen — immune to later
  rate revisions).
- **Total net worth** = sum of `value_base` for all entries in the latest snapshot.
- **Trend** = sum of `value_base` per month, grouped by `snapshot.month`.
- **By-type trend** = sum of `value_base` per month per `asset_type`.
- **Asset-type summary** = sum of `value_base` per `asset_type` for the latest month, % = type
  sum / total.
- **Copy-forward** = clone the prior month's `asset_entry` rows (same names/currencies/details),
  then re-fetch FX and recompute `value_base`. The user only updates `value_native` for the new month.

FX: Frankfurter returns the most recent rate on or before the requested date (handles non-trading
days). Fetched rates are frozen on first write. HKD is always 1 (never fetched); CNY is stored as
the `CNY` code (no RMB→CNY alias). Failures are non-fatal; the user can override manually. The
fetched/overridden rate is written to `fx_rate_to_base` alongside `value_base`.

---

## Data model

### `networth_snapshot`

- `id` UUID PK · `user_id` UUID → auth.users
- `month` DATE — normalized to the **first day of the month**; **UNIQUE (user_id, month)**
- `created_at`, `updated_at`

### `asset_entry`

- `id` UUID PK · `user_id` UUID → auth.users
- `snapshot_id` UUID → networth_snapshot (**ON DELETE CASCADE**)
- `asset_type` TEXT — `cash | time_deposit | stock | mutual_fund | retirement | insurance | property`
  (CHECK)
- `name` TEXT — institution, fund name, address, etc.
- `currency` TEXT — `'HKD' | 'CNY' | 'USD'`
- `details` JSONB — type-specific informational fields (maturity_date, ticker, shares, units, cost,
  premium, policy_year, …). The import accepts whatever `detailN_key`/`detailN_value` pairs appear in
  the CSV, so new keys can be added without a schema change. Never used in the net-worth math.
- `value_native` NUMERIC — value in the entry's own currency
- `fx_rate_to_base` NUMERIC — native → HKD rate used (1 for HKD), frozen at write time
- `value_base` NUMERIC — `value_native × fx_rate_to_base` (stored)
- `sort_order` INT NULL
- `created_at`, `updated_at`
- Index on (`user_id`, `snapshot_id`)

`asset_entry` cascades on snapshot delete. **No soft-delete** — each month is a complete,
self-contained set of rows; deleting an entry simply omits it from that month, and prior months
are intact. Migration: `supabase/migrations/03_networth_schema.sql`.

---

## Seed data

### Asset types (fixed enum, in this order)

`cash, time_deposit, stock, mutual_fund, retirement, insurance, property`

| Type         | `name` is       | Type-specific `details` (informational) | `value_native` holds |
| ------------ | --------------- | --------------------------------------- | -------------------- |
| cash         | institution     | —                                       | balance              |
| time_deposit | institution     | `maturity_date`                         | principal + interest |
| stock        | ticker/company  | `ticker`, `shares`                      | total value (manual) |
| mutual_fund  | fund name       | `units`, `cost` (purchase cost)         | total value (manual) |
| retirement   | provider        | —                                       | portfolio value      |
| insurance    | policy label    | `premium`, `policy_year`                | net cash value       |
| property     | address / label | —                                       | market value         |

All values are entered manually. `details` are preserved for reference only; they do **not** drive the net-worth math.

### In-app CSV importer

Real balances stay **out of the repo**. The **in-app importer** reads a local CSV and creates/replaces
a month's snapshot + `asset_entry` rows. It is reusable for **any** month — bulk-replacing a month's
holdings rather than typing them in. After the initial import, copy-forward takes over month to month.
The importer is **idempotent per month** (re-running for a month replaces that month's entries, never
duplicating them).

- Template: `templates/networth-seed-template.csv` (sanitized example, committed). Filled copy must be gitignored (e.g. `templates/networth-seed.local.csv`).
- **Number parsing:** CSV numbers may be quoted with thousands-separator commas (e.g. `"1,234,567.89"`) — the importer strips commas (and surrounding quotes) before converting to numeric, for both `value_native` and all detail values.
- Column spec: `asset_type,name,currency,value_native,detail1_key,detail1_value,detail2_key,detail2_value`
  - `detail*` columns are optional, type-specific, stored as-is in `details`.
  - The importer asks you for the snapshot month (e.g. `2026-06`) and normalizes it to the **first day** of that month.
  - Full column rules + examples: `templates/networth-import-guide.md`. (Implemented in `src/lib/networth-import.ts` + `src/screens/ImportNetWorthSheet.tsx`.)
