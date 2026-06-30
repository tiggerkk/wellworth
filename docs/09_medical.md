# 09 — Medical Module

## Screens

### Dashboard (`/medical`)

No screen-title header. Explicit loading / empty / error states; empty (no reports yet) → the shared
**EmptyState** (see `docs/01_design_system.md`): "No medical reports yet" · "+ New Medical Report".

When there is data, three sections:

- **Trends** — a two-column grid of **sparkline cards**, one per **tracked** test that has numeric
  data (ordered by canonical section + sort order). Each card: test name, **latest value** (+ unit,
  coloured by the latest flag), and a small **inline-SVG** sparkline (no chart library; shared
  `Sparkline` component). Tapping a card opens a bottom-sheet with the full trend chart (lazy-loaded
  Recharts, `MedicalTrendChart`): flag-coloured points, an optional shaded **reference band** from
  the latest printed range, and a time-window selector (1Y / 2Y / 3Y / 5Y / All; default **All**).
  Escape/tap-outside closes. The window list + default live in `src/constants/medical-ranges.ts`
  (`MEDICAL_RANGES` + `MEDICAL_RANGE_DEFAULT`) — **pure UI constants**, not persisted, so editing them
  takes effect on reload with **no DB change and no other code change** (the default lives beside the list
  so the screen never hardcodes a key).
- **Latest Report** button — directly under the Trends grid (only when ≥1 report): an accent-styled
  button (`IconReportMedical`) linking straight to the **newest** report's detail (`recentReports[0]`,
  reports are newest-first). A shortcut to the most-recent report even though Latest-values mixes tests
  across reports.
- **Latest values by category** — for **every** test recorded, its **most recent** value across all
  reports (not just the newest report — a heterogeneous history means the latest report may omit most
  tests), grouped under **collapsible, color-accented category sections** (shared **`MedicalSection`** —
  left chevron, per-category colored left stripe + tinted header; default **expanded**) in the user's
  display order. Each row is the shared **`MedicalValueRow`** (also used by the View Report `ResultRow`):
  test name + the (often long, wrapping) printed reference range in the **flexible left column**, value
  (+ unit, **coloured by flag**) in a `shrink-0` right column with `items-start` — so a long range wraps
  under the name instead of squeezing the name or pushing the value off the right edge.
- **Recent reports** — up to five newest reports (date · type · provider · body part) linking to
  Report detail, with a **View all reports** row when there are more. (Plain `SectionCard` — **not**
  category-colored, unlike Latest values.)

Tracked tests are chosen in Medical Settings → Tracked Tests (seeded from `default_tracked`).

### Reports (`/medical/reports`)

- Searchable/filterable/sortable list (no screen-title header), newest report-date first by default.
- A **Search bar** (placeholder "Search body part, narrative") with an **icon-only Filter button** to
  its right (see `docs/01_design_system.md` → FilterToggleButton). Empty → shared **EmptyState**;
  active search/filter with no matches → "No matches."
- Shared **FilterPanel** (label-free): **Any Type**, **Any Provider** (providers present in your own
  reports), **Any Body Part** — footer carries the **SortControl** next to **Clear Filters**.
- Sort over { Date, Type, Provider, Body Part } with **asc/desc** toggle (newest-first within ties);
  default: **Date** descending.
- Each row: **full date** (with year — reports span years), the **type** label, and
  `provider · body part` as a secondary line. Tap → Report detail; **swipe-left → Delete**
  (hard; tapping the revealed Delete acts immediately — no browser dialog; the FK cascades the
  report's results). The delete is **optimistic** — the row drops from local
  state instantly, the DB delete runs in the background (no `bumpMedical()` → full-list refetch; bump
  only on error). See tech-spec F16b.
- New reports from the **New Medical** bottom-nav tab.

_Search, filter, and sort persist for the **browser-tab session** (`useSessionState`)._

### Report detail (`/medical/:id`)

- Read-only. Header: a top-left **X** (`navigate(-1)` + **Esc** — closes back to wherever it was opened
  from, Reports list **or** Dashboard; same convention as `PolicyDetailSheet`/the Add-Edit screens, not
  a back-arrow); **Date - Type** (e.g. `May 4, 2026 - Health Screening`, with `· body part` when
  relevant) on line 1; **Provider** as secondary text on line 2; an **Edit** (pencil icon) action.
- Below: **Open original** link(s) for each Google Drive URL (`target="_blank" rel="noreferrer"`); a
  **Narrative** block when present; then **results grouped under collapsible, color-accented category
  sections** (shared **`MedicalSection`**, `variant="card"` — left chevron, per-category colored left
  stripe + tinted header; default **expanded**, tap header to collapse) in the seeded section + sort
  order (filtered to the tests this report contains).
- Each result row: `test name · reference range` on the left, `value (+ unit)` on the right — value
  **coloured by flag** (high/abnormal = `danger` red, low = `info` blue).
- A "normalized from …" note when the value was unit-converted on import; a still-flagged row is
  **accent-tinted** with a **`Review – <reason>`** marker (accent, read-only — no button here); see the
  review lifecycle under Add / Edit Report.

### Add / Edit Report (`/medical/entry`, `/medical/:id/edit`)

- Reached from the **New Medical** tab (new) or Report detail **Edit** button.
- On the New form, an **Import JSON** accent link sits in the **header** between the title and action
  icons (when the importer is enabled).
- Top-right icon actions (Delete when editing · Reset · Create/Save) via shared **EntryHeaderActions**.
- Close (✕)/Escape returns without saving.
- **Parent fields:** **Report Date** (Calendar; defaults today) + **Type** (dropdown) share one line;
  **Provider** below; then **Body Part** (shown for mri/ultrasound/mammogram/other), **Narrative**, and
  **Document Links** (repeatable Google Drive URL rows). Optional fields hidden when trimmed in Medical
  Settings → Visible Fields; Date/Type/Results are always shown.
- **Results:** an **Add Result** button opens a searchable **test picker** (the seeded reference
  grouped by category) or **Add custom test** (an ad-hoc row with editable name + category). Result
  cards render in the owner's **Tests Display Order** (same `orderResultsForDisplay` as Dashboard +
  Report detail) and are **grouped under collapsible, color-accented category sections** (shared
  **`MedicalSection`**, `variant="bare"` — a colored header **bar** above the existing result-card
  stack, so the per-result cards aren't double-wrapped; `groupResultsByCategory`, like Report detail),
  so an added test slots into its section/test position, not the end. Each result card also carries a
  **4px left stripe in its category's `MEDICAL_CATEGORY_COLOR`** (same hue as the section header it
  sits under), so individual cards read as part of their group. Each result
  card edits the value (number and/or text, per the test's `value_kind`), unit, and flag
  (none/high/low/abnormal) on **one line** (Value · Unit · Flag), then reference range (as printed);
  rows can be removed. The category isn't shown per-card for a matched row (the section header carries
  it); a **custom** row keeps a category picker. Manual values are stored as-entered (no unit
  normalization — that's the importer's job).
- **Review ("uncertain") lifecycle:** there is **no manual uncertain toggle** — the owner never sets it
  by hand. A row is flagged for review when the **importer** raises `uncertain` (see Import); a flagged
  card is **accent-tinted** (`bg-accent/10`, accent border) and shows **`Review – <reason>`** (accent)
  as its **last row** with a **Mark Reviewed** pill button (`bg-input` accent, like the Shows importer's
  controls). The flag clears on **Mark Reviewed** _or_ on **editing any field** of the row (so reviewing it
  — here or back in Edit Report after an unreviewed import — resolves it). The `<reason>` is derived
  from row state (`medicalReviewReason`): `no numeric value` (numeric test, no number), `unmatched test`
  (name matched no reference test), else `check value` (the AI's low-confidence flag). Same editor + flag
  behaviour on the Import review screen.
- Deleting a report here returns to the **Reports list** (not the now-deleted read-only detail).
- **Eye reports** (type = eye) surface a dedicated **Eye Refraction** grid above the results: a row
  per eye (OD / OS) × **Sphere / Cylinder / Addition** (dioptres). Each cell edits the `value_num`
  of the matching `eye`-category `medical_result` row (created on first input, removed when cleared),
  so the six values store + trend like any measurement. IOP / other eye findings go through the generic
  results list as usual.

### Import (sheet, from Medical Settings)

- Reached from **Medical Settings → Import JSON / CSV Medical** or the **Import** button on the New-Report
  form (both gated by the importer toggle). Upload a `.json` (preferred) or `.csv` file produced
  outside the app by an AI vision tool (see `templates/medical-extraction-prompt.md`).
- The parse applies **tolerant JSON repair** (auto-fixes a stray quote after a number, e.g. `8.6"`);
  an unparseable file shows a specific error (line/column).
- Each result is **matched to a reference test** (fuzzy, CJK-aware, via the provider-alias map in
  `src/lib/medical-import.ts`) and **unit-normalized** to the test's canonical unit (flagged, original
  kept).
- **Flagged for review** (`uncertain`): set from the AI's file flag (the extraction prompt marks an
  unreadable/low-confidence value) **or** an app-side rule in `makeResult` — a **numeric** test that
  imported with no number, or a name that matched **no** reference test. These surface as
  `Review – <reason>` in the editor (see Add / Edit Report) and clear on review.
- The **review** shows **counts per category** (to catch a skipped section) and a **"· N to review"**
  tally, every parsed row in the same editor as manual entry — now **grouped under category headers**
  (display order) like Report detail — (edit/add/remove; review + normalized noted), and the report
  header where you **paste the Drive link(s)**.
- **Save** writes idempotently: a report with the same date + type is **replaced**, so re-importing
  the same file never duplicates.

### Settings (`/medical/settings`)

Sections in order: **Display**, **Report / Entry Form**, **Import**, **Security**.

- **Display → Tracked Tests** (secondary text "(Dashboard)"): choose which tests trend on the Dashboard.
  A sheet grouping the reference tests by category with a toggle each; persisted to
  `medical_tracked_tests` (seeded from `default_tracked` on first run).
- **Display → Tests Display Order** (secondary text "(Dashboard, Report & Entry)"): drag-to-reorder
  the category **sections** and the **tests within a section** via the shared `ReorderList`. A
  **Sections** list reorders categories; a **Tests in section** list (gated by a category picker)
  reorders tests within it. Saved as `medical_section_order` / `medical_test_order` and applied to the
  **Dashboard, Report detail, and the New/Edit form's result cards** (all three call
  `orderResultsForDisplay`); an unset/partial override falls back to the seeded order.
- **Report / Entry Form → Visible Fields**: shared `VisibleFieldsSheet` over the optional Report
  fields (Provider, Body Part, Narrative, Document Links). Date and Type are always shown.
- **Import → Enable Medical Import** (**on by default**): surfaces the **Import JSON / CSV Medical** launcher.
- **Security → Lock** (**last section**): set up / change / turn off the module **PIN**, register an
  optional **Face ID / Touch ID** unlock (hidden where the device has no platform authenticator), and
  choose the **auto-lock** timeout (Immediately / 1 / 5 / 15 min / Only on app restart).

### Lock screen

- Shown over the whole Medical module when it's locked — on cold start and after the chosen idle
  timeout (always re-locks on restart).
- A **mandatory PIN** is always available; if a biometric unlock was registered it is **auto-attempted**
  on appearance and re-tryable via a button, silently falling back to the PIN on any failure.
- A small **"Forgot PIN? Sign out"** escape avoids a hard lockout.
- The lock is a client-side UX convenience gate on this device — the data is already private to the
  account via RLS; it is **not** a server-verified boundary.
- Implementation: `src/lib/medical-lock.ts` (PBKDF2 PIN + timeout/idle), `src/lib/medical-webauthn.ts`
  (platform authenticator).
- Components: `MedicalLockScreen` / `PinInput` (see `docs/01_design_system.md`).

---

## Tech details

- **No in-app OCR** — intake is a structured JSON/CSV file produced outside the app by any vision AI;
  originals are Google Drive links, never stored files.
- **Reference ranges** are stored exactly as printed (the app never computes a range).
- **Unit normalization** (`src/lib/medical-units.ts`, `normalizeResult`): cross-provider values are
  normalized to each test's canonical `default_unit` at import; flagged `normalized = true`, original
  kept in `value_num_original`/`unit_original` (auditable/reversible).
- **Test matching** (`src/lib/medical-import.ts`, `matchTestKey`): fuzzy, CJK-aware, with a
  provider-alias map so provider-specific names resolve to canonical keys.
- **Dashboard derivations** (`src/lib/medical-trends.ts`, `useMedicalTrends`): computes the latest
  value per test, the sparkline data points per tracked test, and the recent reports list. The hook
  loads **three bounded queries**, never every historical result: `listLatestResultPerTest` (the
  `medical_latest_result` view — latest per test, for the latest-values card),
  `listTrackedResultSeries(trackedKeys)` (history for just the tracked tests — the sparklines), and
  `listReports` (the timeline). So the payload doesn't grow with every test's full history.
- **Display order** (`src/lib/medical-order.ts`): `orderResultsForDisplay` merges personal overrides
  with the seeded section/test order.
- **Eye refraction** (`EYE_REFRACTION_*` in `src/lib/medical.ts`): the six test keys
  `sphere_od, cylinder_od, addition_od, sphere_os, cylinder_os, addition_os` are stored as normal
  `medical_result` rows (category `eye`) but surfaced in a structured grid in Add/Edit; their values
  trend like any measurement.
- **MEDICAL_LAB_TESTS** in `src/lib/medical.ts` is the **front-end source of truth** for the test
  reference; `src/lib/medical.test.ts` cross-checks it against the DB so they can't drift. Seeded by
  `supabase/migrations/12_medical_seed_lab_test.sql` (idempotent `ON CONFLICT (key) DO UPDATE`).

---

## Data model

### `medical_lab_test` (reference / seed — not user data; RLS on, read-only to clients)

- `key` TEXT PK — e.g. `'ldl_cholesterol'`
- `display_name` TEXT · `default_unit` TEXT NULL — the **canonical unit** the importer normalizes
  values to; chosen from consistent HK convention where one exists
- `category` TEXT — one of 18 values (CHECK): `general | vitals | lipids | glucose | liver | renal |
electrolytes | cbc | thyroid | bone | tumour_markers | hepatitis | inflammation | urine | stool |
imaging | eye | other`
- `sort_order` INT — within category; seeded from the provider order (10, 20, 30, …)
- `default_tracked` BOOLEAN NOT NULL DEFAULT false — appears on the Dashboard by default
- `value_kind` TEXT — `'numeric' | 'qualitative' | 'either'` (CHECK)
- RLS enabled with a single permissive SELECT policy for `anon`/`authenticated` (no write policies —
  read-only to clients; rows written only by migrations). `GRANT SELECT` only.

### `medical_report` (one row per visit / document set)

- `id` UUID PK · `user_id` UUID → auth.users (ON DELETE CASCADE)
- `report_date` DATE
- `report_type` TEXT — `'health_screening' | 'mri' | 'ultrasound' | 'mammogram' | 'eye' | 'other'`
  (CHECK)
- `body_part` TEXT NULL · `provider` TEXT NULL · `narrative` TEXT NULL
- `document_urls` TEXT[] NOT NULL DEFAULT '{}' — Google Drive link(s); never a stored file
- `created_at`, `updated_at` · Index on (`user_id`, `report_date`)

### `medical_result` (one row per test per report)

- `id` UUID PK · `user_id` UUID → auth.users (ON DELETE CASCADE)
- `report_id` UUID → medical_report (**ON DELETE CASCADE** — deleting a report hard-deletes its results)
- `test_key` TEXT NULL → medical_lab_test.key — null for ad-hoc tests not in the reference
- `test_name` TEXT — display name as printed/captured (may be bilingual)
- `category` TEXT (same 18-value CHECK)
- `value_num` NUMERIC NULL — normalized to the test's canonical unit
- `value_text` TEXT NULL
- `unit` TEXT NULL — canonical unit after normalization
- `ref_low` NUMERIC NULL · `ref_high` NUMERIC NULL — converted by the same factor as the value
- `ref_text` TEXT NULL — reference range **exactly as printed** (verbatim; never computed by the app)
- `flag` TEXT NULL — `'high' | 'low' | 'abnormal'` (CHECK)
- `uncertain` BOOLEAN NOT NULL DEFAULT false
- `normalized` BOOLEAN NOT NULL DEFAULT false — true if value/unit was unit-converted on import
- `value_num_original` NUMERIC NULL · `unit_original` TEXT NULL — printed value/unit before
  normalization (auditable/reversible)
- `created_at`, `updated_at` · Indexes on (`user_id`, `test_key`) and (`report_id`)

Standard rules on `medical_report`/`medical_result`: own `user_id` for direct RLS, four owner policies
using `(select auth.uid()) = user_id`, CHECK on enum columns, `moddatetime` trigger on `updated_at`,
explicit GRANT to `anon`/`authenticated`. **Hard delete** (deleting a report cascades its results).
Migration: `supabase/migrations/11_medical_schema.sql`. Profile columns added by
`supabase/migrations/13_medical_profile_settings.sql`.

### `medical_latest_result` (view)

- A `security_invoker` view: `DISTINCT ON (user_id, coalesce(test_key, 'name:'||lower(btrim(test_name))))`
  of `medical_result` ⨝ `medical_report`, ordered so the **latest `report_date`** wins (`created_at`
  breaks ties) — the most recent result per test, with its `report_date`/`report_type`. The dedupe key
  mirrors the client's `latestResultPerTest` (ad-hoc NULL-`test_key` rows dedupe by name).
- `security_invoker = true` (PG15+) → base-table RLS applies; `grant select` to the API roles. Powers
  the Dashboard's latest-values card (`listLatestResultPerTest`) without fetching all history (cf. F18,
  same pattern as `networth_monthly_type_total`). Created by the same migration; reflected in
  `database.ts` after `npm run gen:types`.

---

## Seed data

### Lab test reference seed

The **full source of truth** is `MEDICAL_LAB_TESTS` in `src/lib/medical.ts`; the migration
`supabase/migrations/12_medical_seed_lab_test.sql` mirrors it. A build-time test asserts they match.
Built from the owner's 2021–2026 reports across three providers (MediFast HK, Mobile Medical HK,
Global HealthCare Shanghai).

**Section order** (categories in display order):
`general, vitals, lipids, glucose, liver, renal, electrolytes, cbc, thyroid, bone, tumour_markers,
hepatitis, inflammation, urine, stool, imaging, eye, other`

**`default_tracked`** (Dashboard starter set, seeds `profile.medical_tracked_tests` on first run):
`bmi, blood_pressure_systolic, blood_pressure_diastolic, total_cholesterol, ldl_cholesterol,
hdl_cholesterol, triglycerides, fasting_glucose, hba1c, alt_sgpt, ast_sgot, creatinine, urea,
uric_acid, haemoglobin, wbc, platelet, tsh, bone_t_score, vitamin_d_25oh`

**Canonicalization decisions:**

- Blood pressure split into two numeric keys (`blood_pressure_systolic`, `blood_pressure_diastolic`)
- Thyroid: `t4_total` vs `free_t4`/`free_t3` are distinct analytes
- H. pylori serology and the C-13 breath test are separate keys
- Cardiac/pancreatic/iron markers and radiation-scan rows live in `other`
- ECG numeric intervals live in `imaging`; the impression is `ecg_finding`
- Eye refraction: `sphere_od, cylinder_od, addition_od, sphere_os, cylinder_os, addition_os` in `eye`

### Import templates

Real lab results stay **out of the repo**. Extraction by any vision-capable AI tool.

- `templates/medical-extraction-prompt.md` — model-agnostic extraction prompt (tracked)
- `templates/medical-import.schema.json` — JSON shape + CSV header + example (tracked)
- `templates/medical-import-template.json` — sanitized fictional example (tracked)
- Real results: `templates/medical-import-20*.json`, any PDFs — **real PII; gitignored**
