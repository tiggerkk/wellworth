# 05 — Net Worth Module

## Screens

### Dashboard

No screen-title header (opens straight into cards). The root is a full-height flex column
(`min-h-full flex flex-col`) so the shared **empty state** (see `docs/01_design_system.md` →
EmptyState) is **truly vertically centered** with no snapshots yet (Monthly Entry icon · "No
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
- **Liquid Only toggle** (top-right of the current-total card): when ON, the current total, the trend
  graph, and the By-type summary are computed over the **liquid** asset types only (non-liquid types
  zeroed via `restrictTotals`, so percentages recompute against the liquid total). State is shared with
  Monthly Entry and persisted in `localStorage` (`wellworth:networth-liquid-only`, via `useLiquidOnly`).

### Monthly Entry

- Month selector (defaults to the current month; can pick a past month for retrospective entry).
  The `‹ month ›` cluster is **centered in the header**, with the form actions to its right. The arrows
  step one month; **tapping the month label opens a month/year picker** (year stepper over a month grid,
  OK/Cancel — see `docs/01_design_system.md` → MonthPicker). The selected month **persists for the
  browser-tab session** (`useSessionState`, key `networth-entry-month`) so it survives the unmount when an Import
  sheet opens over the entry and closes — the entry stays on the imported month instead of snapping
  back to the current one. (The background-location tab is re-rendered from a static element map, so
  plain `useState` would reset; a fresh tab still defaults to the current month.)
- On a new month, **pre-fill every entry from the most recent prior snapshot** (copy-forward), then
  re-fetch that month's FX rates and recompute `value_base`. The user edits `value_native` (and
  adds/removes entries) from there.
- The **header is pinned** — month selector, the live **NET WORTH** total in HKD, and
  **RESET**/**SAVE** stay visible while the **asset-type list scrolls** beneath. **While a month
  loads**, the month-nav header stays pinned (with a `—` total placeholder) and `Loading…` shows in
  the body below.
- Entries **grouped by asset type**; each row editable: name, currency, `value_native`, and the
  type-specific `details`. The row is **compact** — **Name · currency · value · delete on one
  line**; the value box (`w-24`, drops the number-spinner via `.no-spinner`) fits a 7-figure amount,
  and the trash **hugs the right edge** (`pr-1`). Any `details` fields flow **inline and wrap** on a
  second line, sharing it with the HKD conversion (`= HK$…`, right-aligned) — so a Stock's **Ticker
  (narrow `w-16`, ~3 chars) · Shares · `= HK$…` all share one line**; the Time Deposit **Maturity
  Date** field is **wider (`w-40`)** to show a full date. **Add entry** (pick type) / edit / **delete** (a
  `ConfirmDeleteAction` at the end of the row — inline `Delete? ✓ ✗`; omits the entry from this
  month onward — each month is self-contained).
- **Exchange rates** panel: title `EXCHANGE RATES (HKD 1.0000)`, **CNY and USD rates on one line**,
  each auto-fetched (with ↻ refetch) and overridable. Native → HKD as of the 1st of the month, via
  Frankfurter (see `docs/02_tech_spec.md` → Shared external APIs).
- **Running total in HKD** updates live as you edit.
- **Liquid Only toggle** (header, beside Import CSV): when ON, non-liquid sections **stay visible and
  editable** but are **excluded from the header total** and marked with an **"Excluded"** pill;
  saving is unaffected (the toggle only changes the displayed total, never what's persisted). State
  is shared with the Dashboard (`useLiquidOnly`, `localStorage`).
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

**Liquid vs non-liquid** — for the "Liquid Only" view toggle (Dashboard + Monthly Entry). Defaults
(`DEFAULT_LIQUID_ASSET_TYPES` in `src/lib/networth.ts`): liquid = `cash, time_deposit, stock, fund`;
non-liquid = `retirement, insurance, property`. Owner-reclassifiable in Settings → Liquid Assets
(`profile.networth_liquid_asset_types`; NULL = the defaults). Classification is independent of
manual-vs-auto editability — `fund` is liquid though auto-managed.

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

`Dashboard · Monthly Entry · Insurance Policies · Settings` (plus Home). New Insurance is **not** a
tab — it's the teal **+ New Insurance** action on the Insurance Policies result-count row (and the
empty-state action).

### Asset types

- `mutual_fund` was **renamed to `fund`** (DB CHECK value, `ASSET_TYPES`, labels/colours/details).
  Migration `03_networth_schema.sql` edited in place (owner resets).

### Monthly Entry

- **Header**: compact `‹ month ›` with Delete/Reset/Save (`EntryHeaderActions`) to the right of the
  next-arrow; the **manual Import CSV** sits on the NET WORTH total line.
- **Exchange rates**: title `EXCHANGE RATES` + small grey `(as of 1st of the month from Frankfurter)`.
- **Collapsible asset-type sections** (chevron; Diary pattern). On first visit (fresh tab) sections with ≥1 entry auto-expand. Expand/collapse state **persists for the browser-tab session** (`useSessionState`, key `networth-entry-expanded`) — when switching months, each section restores its last toggled state regardless of whether it has entries; a fresh tab re-derives the initial state from the current month's data.
- **Copy-forward**: manual types cloned; **fund** cloned as a placeholder (overwritten by import);
  **insurance** is NOT cloned — it is **re-resolved from the catalogue** at the month's age and
  **frozen into the snapshot on SAVE**.
- **SAVE enablement (`needsFreeze`)**: SAVE is normally gated on the form being **dirty**, but the
  loader also enables it when the displayed rows differ from what's **persisted** — i.e. live insurance
  was injected into a saved snapshot that had **none frozen** (e.g. created by the manual CSV import,
  which never freezes insurance), or it's a brand-new (copy-forward) month with no snapshot yet. Without
  this, the live total (incl. resolved insurance) reads **higher** than the saved snapshot the Dashboard
  shows, yet SAVE stays disabled so the gap can't be reconciled. Pressing SAVE freezes the rows and the
  Dashboard then matches. Cleared once SAVE persists the new baseline.
- **Fund section**: read-only rows `Name (truncated) · Total Value (HKD) · Return Rate %`; header
  import icon (**accent**) → Fund CSV importer (overwrites the month's fund rows only); tap a row →
  Fund detail modal (Units · Avg Unit Cost · NAV/Unit · priced-as-of · Total Cost · P/L · Asset
  Class · Currency). The Fund detail body (shared `FundDetail`, used by both the local modal and the
  routed drill-in) carries a **4px left stripe in `ASSET_TYPE_COLORS.fund`** (same hue as the Fund
  dot/section), shows **HKD amounts as `HK$1,234`** (`formatHkd`, matching the Dashboard / Monthly
  Entry) — a non-HKD base currency (USD/CNY unit cost + NAV) keeps its `CODE 1,234` prefix + decimals —
  and the priced-as-of date via the global **`formatFullDate`** (**`Jun 25, 2026`** — MMM DD, YYYY; the
  importer stores `YYYY/MM/DD`). The local modal reserves `pt-[env(safe-area-inset-top)]` so its header
  clears the iOS status bar, and closes on **Esc** (`useEscapeKey`) to follow the routed `Sheet`, which
  closes on Esc + browser-back for free (only the read-only body is shared via `FundDetail`; the wrappers differ).
- **Insurance section**: auto-populated, grouped by the owner's configured provider order (orphan
  providers last), ordered by policy number within a provider;
  terminated (surrendered **or** matured) policies excluded from their effective month onward; rows `Number · Name (truncated) ·
Policy Year · Premium · Cash Value (native→HKD)` with an "as of yr N" tag when carried; tap → Policy
  detail (read-only, resolved at the month's age). The Policy detail's schedule table (shared
  `PolicyDetail`, titled **SCHEDULE**) adds a right-most **GAIN %/Yr** column.
- **Each asset-type section has a colored left stripe + tinted header** (the `MedicalSection`
  pattern: 4px left stripe + `color-mix … 14%` header tint) keyed to `ASSET_TYPE_COLORS` (the same
  per-type palette as the Dashboard "By asset type" dots — defined in `src/lib/networth.ts`), and the
  **Import CSV** action is **accent**. `ASSET_TYPE_COLORS` hues are ordered so **consecutive** asset
  types contrast (green → blue → gold → purple → orange → rose → grey) — no two adjacent sections share
  a warm/cool band.
- **Gain/loss percentages read green/red across Net Worth** via `gainLossClass(n)`
  (`src/lib/networth.ts`): teal positive, red negative, muted zero. Applied to fund Return Rate
  (Monthly Entry rows, Fund detail, Dashboard Fund performance), fund Profit / Loss (Fund detail), and
  Surrender Gain %/Yr (Policy detail + both schedule tables). The **By-asset-type share %** stays
  neutral — it is an allocation, not a gain/loss.

### Insurance Policies (browse) + New/Edit Insurance

- **Insurance Policies** (`IconLibrary` tab): search (number/name/**notes**), filters — line 1
  Provider + **Past Break-Even Only**, line 2 an **All / Matured / Surrendered** `SegmentedTabs`
  status toggle (`criteria.status`), line 3 Started date range, line 4 sort + Clear Filters. Sort
  (Start Date / Policy Number / Policy Name / Provider, descending default). Tap → New/Edit Insurance.
  A teal **`+ New Insurance`** action sits at the right edge of the `ResultCount` row (and is the
  `EmptyState` action). Each row shows the provider plus status **badges** (`StatusChip`):
  **Surrendered** = grey (`bg-track`), **Matured** = blue (`bg-accent`), **Past Break Even** =
  teal (`bg-positive`). (Both filter + badges read `policy.termination_kind`.)
  - **"Past break-even" is relative to the current age**, not "ever breaks even": `breakEven` returns
    the first qualifying age across the WHOLE resolved series (incl. future ages), so the
    badge/filter/dashboard-count use **`hasBrokenEven(schedules, currentAge)`** (its break-even age ≤
    current age). `applyInsuranceView` takes `currentAge` for the same reason. (Past bug: every policy
    that would _eventually_ break even read "Past break even".)
- **New/Edit Insurance** (`IconFileCertificate` tab): header X · title · **Schedule** (import) ·
  Delete/Reset/Create/Save. It's a plain route screen (not a `Sheet`), so it registers
  **`useEscapeKey(() => navigate(-1))`** itself for laptop Esc-to-close (an open Calendar / SelectMenu /
  import overlay sits above it on the shared LIFO stack and consumes Esc first). Body: Provider (picked from the configured list — manage it in Settings →
  Manage Providers) + Currency (**mandatory**; HKD/CNY/USD) on one line (equal-height controls so the
  dropdown and segmented toggle align); Policy Number + Start Date on one line; Policy Name;
  **Notes** (2-row textarea); a **TERMINATION** area (surrender **or** maturity — mutually exclusive).
  When active, two pill buttons: **Mark Surrendered** (grey text) and **Mark Matured** (blue text);
  choosing one opens its section (titled **Surrender** / **Maturity**) — **{kind} Date** +
  **{kind} Effective From** on one line (setting/changing the Date auto-syncs Effective From, still
  overridable) + **Actual Proceeds**, all mandatory; helper "Enter the cash received {into|as} Cash
  in Monthly Entry." When terminated, the section shows with an **Un-Surrender / Un-Mature** pill
  (clears all four `termination_*` fields). A policy can't be both at once (single `termination_kind`).
  Then a **SCHEDULE**
  section listing versions (the selected version's editable `effective_date` is the first field, the
  version dropdown to its right, then a hard-delete that promotes the earliest remaining to Original).
  Unset date fields read **"Set date"** in muted `text-tertiary` (the Shows Entry pattern). The
  SCHEDULE table adds a right-most **GAIN %/Yr** column (Surrender Gain %/Yr per point).
- **Single-policy import** (local overlay): file must match Provider + Policy Number; Policy Name /
  Start Date / **Notes** may be overridden; **maturity is auto-detected** (same rule as the bulk
  seed); currency + effective date are NOT in the file. Choose **Add new version** or **Replace
  existing version**; a brand-new policy's first import creates the **Original**. Closes on its X /
  **Esc** (`useEscapeKey(onClose)`) — the innermost overlay, so Esc closes it before the form.

### Insurance model + resolution (pure helpers in `src/lib/networth.ts`)

- New tables (in `03_networth_schema.sql`): `insurance_policy`, `insurance_schedule` (kind
  `original|update`, `first_year`, `effective_date`), `insurance_schedule_point` (real values only).
- **Termination** (surrender or maturity, mutually exclusive) on `insurance_policy`:
  `termination_kind` (`surrendered|matured`, CHECK), `termination_date`, `termination_effective_date`,
  `termination_proceeds` — a policy is terminated iff `termination_effective_date` is set (CHECK ties
  it to `termination_kind`), and it is **excluded from the monthly total from that date's month**
  (`buildResolvedInsuranceEntries` in `asset-entry.ts` + the Monthly Entry copy in `NetWorthEntry.tsx`).
  Set/cleared via `setTermination` / `clearTermination`, or written directly by `savePolicyFields`
  from the Edit screen. Imports auto-detect maturity (`detectMaturity` in `insurance-import.ts`).
- **Version identity = the schedule row's id** (not the date); `effective_date` is editable and drives
  recency. **Resolved** at an age = newest-effective version with `first_year ≤ age`, value at the age
  or nearest earlier real point ("as of yr N"). **Original** (`kind: original`) is the variance
  baseline. `age = entry_year − birth_year` (birth year from `profile.birthday`, default 1974).
- Helpers: `resolvePolicyAtAge`, `originalCashValueAtAge`, `varianceAtAge`, `breakEven`,
  `surrenderGainPctPerYear`, `buildResolvedSeries`, `ageForYear`.

### Settings (`IconSettings` tab)

- **DISPLAY → Visible Asset Types** → reorder/visibility sheet (≥1 visible).
- **DISPLAY → Liquid Assets** → per-asset-type liquid/non-liquid toggles
  (`NetWorthLiquidAssetTypesSheet`). Drives the "Liquid Only" view toggle; saved to
  `profile.networth_liquid_asset_types` (NULL = defaults: cash/time_deposit/stock/fund).
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
  HKD/CNY/USD). **Header rows are now provider · name · number:date · notes · sub-header** (a
  per-policy **Notes** row before the sub-header). **Maturity auto-detected** (`detectMaturity`): a
  block whose schedule ends before the owner's current age (from `profile.birthday`) → Matured,
  proceeds = last cash value, date = start month/day + year `start_year + last policy_year`.
- **Insurance single**: header (Provider, Policy Number, optional Policy Name / Start Date / **Notes**)
  - the `Age, Policy Year, Total Premium Paid, Cash Value, Surrender Gain %/Yr` table (Surrender Gain
    ignored); maturity auto-detected the same way. **Two header layouts are accepted** (auto-detected by
    whether col A holds labels): the documented **key/value** header, and the **stacked block** layout the
    wide spreadsheet exports for one policy (col A blank; provider / name / `number: date` / notes in col
    B). Block fields are identified by content (the `number: date` row, the provider-matching cell), so
    the optional notes row may be absent.

### Dashboards

- **Fund Performance** (latest month: Total Value + Return %) and the existing **By-type** trend
  (the fund value trend). **Insurance** aggregate card: current Cash Value vs Premiums (HKD) +
  past-break-even count + a lazy **Cash Value vs Total Premiums by age** chart (break-even marked).
  Per-fund / per-policy detail is the drill-in (`networth/fund/:id`, `networth/policy/:id`).

### New `profile` columns (`04_networth_profile_settings.sql`)

`networth_visible_asset_types text[]` (NULL = all) · `networth_asset_type_order text[]` (NULL =
canonical) · `networth_liquid_asset_types text[]` (NULL = code defaults cash/time_deposit/stock/fund) ·
`networth_bulk_insurance_import_enabled boolean NOT NULL DEFAULT true`.
