# 05 — Net Worth Module

## Screens

### Dashboard

No screen-title header (opens straight into cards). With no snapshots yet, the shared centered
**empty state** (see `docs/01_design_system.md` → EmptyState) shows (Monthly Entry icon · "No
entries yet" · "+ Monthly Entry").

- Large **current total net worth** in HKD (latest snapshot).
- **Total net-worth trend graph** with a time-window selector (windows: 6M, 12M, 2Y, 3Y, 5Y, All;
  default **All**). The window list + default live in `src/constants/networth-ranges.ts`
  (`NETWORTH_RANGES` + `NETWORTH_RANGE_DEFAULT`) — **pure UI constants**, not persisted, so editing them
  takes effect on reload with **no DB change and no other code change** (the default lives beside the list
  so the screen never hardcodes a key).
  A view toggle: **Total** ⇄ **By asset type** (one line per asset type, each the monthly sum of
  that type's `value_base`).
- A **per-asset-type summary** for the latest month: type, total HKD, % of net worth.

### Monthly Entry

- Month selector (defaults to the current month; can pick a past month for retrospective entry).
  The `‹ month ›` cluster is **centered in the header** (mirrors the Wellness Diary day nav), with
  the form actions to its right. The arrows step one month; **tapping the month label opens a
  month/year picker** (year stepper over a month grid, OK/Cancel — see
  `docs/01_design_system.md` → MonthPicker).
- On a new month, **pre-fill every entry from the most recent prior snapshot** (copy-forward), then
  re-fetch that month's FX rates and recompute `value_base`. The user edits `value_native` (and
  adds/removes entries) from there.
- The **header is pinned** — month selector, the live **NET WORTH** total in HKD, and
  **RESET**/**SAVE** stay visible while the **asset-type list scrolls** beneath. **While a month
  loads**, the month-nav header stays pinned (with a `—` total placeholder) and `Loading…` shows in
  the body below — mirroring the Wellness Diary's persistent day-nav header.
- Entries **grouped by asset type**; each row editable: name, currency, `value_native`, and the
  type-specific `details`. The row is **compact** — **Name · currency · value · delete on one
  line**; the value box is **narrow** (drops the number-spinner via `.no-spinner`) and the trash
  **hugs the right edge**. Any `details` fields flow **inline and wrap** on a second line, sharing
  it with the HKD conversion (`= HK$…`, right-aligned) — so a Stock's **Ticker (narrow, ~3 chars) ·
  Shares · `= HK$…` all share one line**. **Add entry** (pick type) / edit / **delete** (a
  `ConfirmDeleteAction` at the end of the row — inline `Delete? ✓ ✗`; omits the entry from this
  month onward — each month is self-contained).
- **Exchange rates** panel: title `EXCHANGE RATES (HKD 1.0000)`, **CNY and USD rates on one line**,
  each auto-fetched (with ↻ refetch) and overridable. Native → HKD as of the 1st of the month, via
  Frankfurter (see `docs/02_tech_spec.md` → Shared external APIs).
- **Running total in HKD** updates live as you edit.
- **RESET** and **SAVE** buttons (icon style — see `docs/01_design_system.md` → EntryHeaderActions).

---

## Net Worth Calculations (pure helpers in `src/lib/networth.ts`)

- `value_base = value_native × fx_rate_to_base` (stored at write time, frozen — immune to later
  rate revisions).
- **Total net worth** = sum of `value_base` for all entries in the latest snapshot.
- **Trend** = sum of `value_base` per month, grouped by `snapshot.month`.
- **By-type trend** = sum of `value_base` per month per `asset_type`.
- **Asset-type summary** = sum of `value_base` per `asset_type` for the latest month, % = type
  sum / total.
- These dashboard figures are **pre-aggregated in the database**, not summed client-side: the Dashboard
  reads the `networth_monthly_type_total` **view** (one row per month × asset_type, `security_invoker`
  so RLS still applies) via `listMonthlyTypeTotals`, then folds it with `foldMonthlyTotals`. The payload
  is therefore O(months × asset_types), not every holding across all history — it no longer grows with
  the number of assets. (Entry/editing still reads a single month's full `asset_entry` rows.) A month
  whose snapshot has no entries is absent from the view, so the trend only plots months with holdings.
- **Copy-forward** = clone the prior month's `asset_entry` rows (same names/currencies/details),
  then re-fetch FX and recompute `value_base`. The user only updates `value_native` for the new month.

- FX: Frankfurter returns the most recent rate on or before the requested date (handles non-trading
  days).
- Fetched rates are frozen on first write.
- HKD is always 1 (never fetched); CNY is stored as the `CNY` code (no RMB→CNY alias).
- Failures are non-fatal; the user can override manually.
- The fetched/overridden rate is written to `fx_rate_to_base` alongside `value_base`.

---

## Data model

### `networth_snapshot`

- `id` UUID PK · `user_id` UUID → auth.users
- `month` DATE — normalized to the **first day of the month**; **UNIQUE (user_id, month)**
- `created_at`, `updated_at`

### `asset_entry`

- `id` UUID PK · `user_id` UUID → auth.users
- `snapshot_id` UUID → networth_snapshot (**ON DELETE CASCADE**)
- `asset_type` TEXT — `cash | time_deposit | stock | fund | retirement | insurance | property`
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

- `asset_entry` cascades on snapshot delete.
- **No soft-delete** — each month is a complete, self-contained set of rows; deleting an entry simply
  omits it from that month, and prior months are intact.
- Migration: `supabase/migrations/03_networth_schema.sql`.

### `networth_monthly_type_total` (view)

- A `security_invoker` view: `select user_id, month, asset_type, sum(value_base) as total_base`
  grouped by `(user_id, month, asset_type)`, joining `networth_snapshot` ⨝ `asset_entry`.
- `security_invoker = true` (PG15+) makes it run as the querying user, so the base tables' RLS applies
  (no separate policy on the view). `grant select` to `anon`/`authenticated` as for the tables.
- Powers the Dashboard's trend + breakdown without fetching every holding (see Calculations above). The
  project's **first DB view** — defined in the same migration, so a `supabase db reset --linked` creates
  it and `npm run gen:types` reflects it in `src/types/database.ts`.

---

## Seed data

### Asset types (fixed enum, in this order)

`cash, time_deposit, stock, fund, retirement, insurance, property`

| Type         | `name` is       | Type-specific `details` (informational) | `value_native` holds |
| ------------ | --------------- | --------------------------------------- | -------------------- |
| cash         | institution     | —                                       | balance              |
| time_deposit | institution     | `maturity_date`                         | principal + interest |
| stock        | ticker/company  | `ticker`, `shares`                      | total value (manual) |
| fund         | fund name       | `units`, `cost` (purchase cost)         | total value (manual) |
| retirement   | provider        | —                                       | portfolio value      |
| insurance    | policy label    | `premium`, `policy_year`                | net cash value       |
| property     | address / label | —                                       | market value         |

All values are entered manually. `details` are preserved for reference only; they do **not** drive the net-worth math.

### In-app CSV importer

- Real balances stay **out of the repo**.
- The **in-app importer** reads a local CSV and creates/replaces a month's snapshot + `asset_entry`
  rows.
- It is reusable for **any** month — bulk-replacing a month's holdings rather than typing them in.
- After the initial import, copy-forward takes over month to month.
- The importer is **idempotent per month** (re-running for a month replaces that month's entries,
  never duplicating them).

- Template: `templates/networth-seed-template.csv` (sanitized example, committed). Filled copy must be gitignored (e.g. `templates/networth-seed.local.csv`).
- **Number parsing:** CSV numbers may be quoted with thousands-separator commas (e.g. `"1,234,567.89"`) — the importer strips commas (and surrounding quotes) before converting to numeric, for both `value_native` and all detail values.
- Column spec: `asset_type,name,currency,value_native,detail1_key,detail1_value,detail2_key,detail2_value`
  - `detail*` columns are optional, type-specific, stored as-is in `details`.
  - The importer asks you for the snapshot month (e.g. `2026-06`) and normalizes it to the **first day** of that month.
  - Full column rules + examples: `templates/networth-import-guide.md`. (Implemented in `src/lib/networth-import.ts` + `src/screens/ImportNetWorthSheet.tsx`.)
  - The manual importer accepts **only** manual types (`cash, time_deposit, stock, retirement, property`); `fund`/`insurance` rows are rejected (handled by their own pipelines).

---

## Funds, Insurance, Settings & Dashboards (enhancement)

### Bottom-nav tabs

`Dashboard · Monthly Entry · Insurance Policies · New Insurance · Settings` (plus Home).

### Asset types

- `mutual_fund` was **renamed to `fund`** (DB CHECK value, `ASSET_TYPES`, labels/colours/details).
  Migration `03_networth_schema.sql` edited in place (owner resets).

### Monthly Entry

- **Header**: compact `‹ month ›` with Delete/Reset/Save (`EntryHeaderActions`) to the right of the
  next-arrow; the **manual Import CSV** sits on the NET WORTH total line.
- **Exchange rates**: title `EXCHANGE RATES` + small grey `(as of 1st of the month from Frankfurter)`.
- **Collapsible asset-type sections** (chevron; Diary pattern). Sections with ≥1 entry auto-expand;
  visibility + order come from `profile.networth_visible_asset_types` / `networth_asset_type_order`.
- **Copy-forward**: manual types cloned; **fund** cloned as a placeholder (overwritten by import);
  **insurance** is NOT cloned — it is **re-resolved from the catalogue** at the month's age and
  **frozen into the snapshot on SAVE**.
- **Fund section**: read-only rows `Name (truncated) · Total Value (HKD) · Return Rate %`; header has an
  import icon → Fund CSV importer (overwrites the month's fund rows only); tap a row → Fund detail
  modal (Units · Avg Unit Cost · NAV/Unit · priced-as-of · Total Cost · P/L · Asset Class · Currency).
- **Insurance section**: auto-populated, grouped by the owner's configured provider order (orphan
  providers last), ordered by policy number within a provider;
  surrendered policies excluded from their surrender month onward; rows `Number · Name (truncated) ·
Policy Year · Premium · Cash Value (native→HKD)` with an "as of yr N" tag when carried; tap → Policy
  detail (read-only, resolved at the month's age).

### Insurance Policies (browse) + New/Edit Insurance

- **Insurance Policies** (`IconLibrary` tab): search (number/name), filters (Provider, Surrendered
  only, Past break-even only, Started date range), sort (Start Date / Policy Number / Policy Name /
  Provider, descending default). Tap → New/Edit Insurance. Mirrors Medical Reports.
- **New/Edit Insurance** (`IconFileCertificate` tab): header X · title · **Import Policy Schedule** ·
  Delete/Reset/Create/Save. Body: Provider (picked from the configured list — manage it in Settings →
  Manage Providers), Policy Number, Currency (**mandatory**; HKD/CNY/USD), Policy Name,
  Start Date, **Notes**; an inline **SURRENDER** section (surrender month + date + proceeds, all
  mandatory) with an inline-confirm **Un-Surrender**; a **SCHEDULE** section listing versions
  (selectable; editable `effective_date`; hard-delete with earliest-remaining promotion to Original).
- **Single-policy import** (local overlay): file must match Provider + Policy Number; Policy Name /
  Start Date may be overridden; currency + effective date are NOT in the file. Choose **Add new
  version** or **Replace existing version**; a brand-new policy's first import creates the **Original**.

### Insurance model + resolution (pure helpers in `src/lib/networth.ts`)

- New tables (in `03_networth_schema.sql`): `insurance_policy`, `insurance_schedule` (kind
  `original|update`, `first_year`, `effective_date`), `insurance_schedule_point` (real values only).
- **Version identity = the schedule row's id** (not the date); `effective_date` is editable and drives
  recency. **Resolved** at an age = newest-effective version with `first_year ≤ age`, value at the age
  or nearest earlier real point ("as of yr N"). **Original** (`kind: original`) is the variance
  baseline. `age = entry_year − birth_year` (birth year from `profile.birthday`, default 1974).
- Helpers: `resolvePolicyAtAge`, `originalCashValueAtAge`, `varianceAtAge`, `breakEven`,
  `surrenderGainPctPerYear`, `buildResolvedSeries`, `ageForYear`.

### Settings (`IconSettings` tab)

- **DISPLAY → Visible Asset Types** → reorder/visibility sheet (mirrors Visible Modules; ≥1 visible).
- **DISPLAY → Manage Providers** → add/rename/delete/reorder the insurance-provider list + each
  provider's **default import currency** (the Quotes/Travel configurable-list pattern; shared
  `ConfigListEditor` with a per-row currency control). Stored on `profile.insurance_providers` (JSONB
  `{key,label,defaultCurrency}[]`; NULL = the seed defaults CHUBB/BOC/Manulife in `src/lib/networth.ts`,
  resolved by `src/lib/insurance-config.ts`). Provider is **required** on every policy, so the last one
  can't be deleted; deleting an in-use provider reassigns its policies first. `insurance_policy.provider`
  has **no DB CHECK** — it stores the stable `key` (orphan keys still render via the raw-key fallback).
- **IMPORT → Enable Bulk Insurance Import** toggle (`networth_bulk_insurance_import_enabled`) →
  `Import CSV Insurance` (one-time bulk seed). Manual / fund / single-policy imports are always enabled.

### Imports

- **Manual** (`src/lib/networth-import.ts`): manual types only (`fund`/`insurance` rejected).
  `saveManualImportComplete` (`src/data/asset-entry.ts`) writes a **complete** snapshot — imported
  manual rows + the month's funds (kept, else carried forward) + insurance (kept if frozen, else
  resolved + frozen now) — so a manual import never drops funds/insurance and the Dashboard total is
  complete without a separate Monthly Entry SAVE. Re-importing keeps already-frozen fund/insurance.
- **Fund** (`src/lib/fund-import.ts`): JPM "My Portfolio" CSV — strips currency-code + commas; splits
  the NAV cell `HKD 16.43(2026/06/25)` (optional space + embedded newline) into NAV + as-of date;
  Total Value is HKD (no FX); base currency (HKD/CNY/USD) kept in `details`. Stops at the blank row +
  footer.
- **Insurance bulk** (`src/lib/insurance-import.ts`): wide sheet, 4-col blocks from col B, provider
  carried forward (label matched to the configured provider list — an **unknown provider skips its
  block** with an error until you add it in Settings), blocks without a policy number skipped, trailing
  total columns dropped; confirms per-provider currency (seeded from each provider's `defaultCurrency`;
  HKD/CNY/USD).
- **Insurance single**: narrow key/value header (Provider, Policy Number, optional Policy Name / Start
  Date) + the `Age, Policy Year, Total Premium Paid, Cash Value, Surrender Gain %/Yr` table (Surrender
  Gain ignored).

### Dashboards

- **Fund Performance** (latest month: Total Value + Return %) and the existing **By-type** trend
  (the fund value trend). **Insurance** aggregate card: current Cash Value vs Premiums (HKD) +
  past-break-even count + a lazy **Cash Value vs Total Premiums by age** chart (break-even marked).
  Per-fund / per-policy detail is the drill-in (`networth/fund/:id`, `networth/policy/:id`).

### New `profile` columns (`04_networth_profile_settings.sql`)

`networth_visible_asset_types text[]` (NULL = all) · `networth_asset_type_order text[]` (NULL =
canonical) · `networth_bulk_insurance_import_enabled boolean NOT NULL DEFAULT true`.
