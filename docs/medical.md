# Medical — staging doc

> **Build status** (see `CONTINUITY.md` + BUILD-LOG "Medical Build Sequence"): **M1** (schema, RLS,
> seed, scaffold), **M2** (manual report CRUD + Report detail), and **M3** (structured JSON/CSV import,
> tolerant repair, unit normalization, review-confirm, Settings importer toggle) are **SHIPPED**.
> Remaining: **M4** dashboard trends + tracked-test selection; **M5** drag-to-reorder settings; **M6**
> biometric lock; **M7** narrative + eye refraction. This staging doc stays the behaviour source for the
> unbuilt milestones; when the module is feature-complete it merges into the permanent `/docs` and is
> deleted (like `06-books.md`/`07-quotes.md`).

Staging spec for the **Medical** module: store medical test results over the years and trend them, plus
narrative reports (MRI, eye, imaging). Sections are labelled with the file they merge into; transient file
(delete after merging). Conventions follow the other modules: Home-hub card + `/medical/*` route, singular
tables with `user_id` + 4 RLS policies + `CHECK` enums + `moddatetime` + `GRANT`s, hard delete,
RESET/SAVE/CREATE buttons, and the app-wide structured-import convention.

**Validated design decisions:** intake is a **structured JSON/CSV import** produced **outside the app** by
any vision-capable AI tool (model-agnostic prompt + schema in `templates/`), **not** in-app OCR — testing
on the 2025/2026 reports showed a vision LLM extracts decimals accurately where Tesseract fails (e.g.
LDL 2.9, HDL 2.1, Creatinine 77.9), while plain OCR mangles them. Original documents are **not stored**;
each report holds **Google Drive URL(s)**. A **review-before-save** step is mandatory (its real job is
catching _omitted_ sections, the one observed failure mode). **Biometric lock** guards the module.

---

## (merge into 00-PRD later)

**Overview** — add **(6) Medical** to the module list.

**Goals** — add:

- Medical: keep a private, multi-year record of test results (blood panels, vitals, bone density, etc.)
  and narrative reports (MRI, eye, imaging); a **dashboard of trends** for the tests you choose to track,
  with values flagged against each report's own reference range; intake via **manual entry** or a
  **structured import** (JSON/CSV the owner generates from a report PDF using any AI tool); originals kept
  as **Google Drive links**, not files. Protected by a **biometric lock**.

**Navigation model** — extend routes to include `/medical/*`.

**Medical** (new feature section):

- **Dashboard** (`/medical`): trend charts for tracked tests, latest values flagged high/low by category,
  and a reports timeline.
- **Reports** (`/medical/reports`): chronological list; tap to view a report's results + narrative + links.
- **Add / Edit Report**: manual entry, or **Import** a JSON/CSV → review & confirm → save (+ paste Drive URL[s]).
- **Settings**: pick **tracked tests** (like Visible Nutrients), **drag-to-reorder** sections and tests,
  toggle the biometric lock.

**Out of scope / non-goals → Medical** (new sub-block):

- **In-app OCR / Tesseract** — rejected (mangles decimals; dangerous for medical numbers). Extraction is
  done outside the app by a vision AI tool; the app imports the structured result.
- **Storing original files** — not stored; Google Drive URL(s) per report instead. (No Supabase Storage.)
- **Diagnosis / medical advice** — the app records and trends data only; it is not a medical device.
  Reference ranges are stored exactly as printed on each report (labs differ); the app never computes a
  range or interprets results.
- **Auto stock of normal ranges / eGFR computation** — values come only from the report (or manual entry).

---

## (merge into 01-screens later)

**Navigation** — add **Medical** tabs: **Home**, **Dashboard**, **Reports**, **New Medical**, **Settings**. The **biometric lock** gates entry to the whole module
(see tech-spec).

### Medical - Dashboard (`/medical`)

- **Trend charts** (line) for each **tracked** test across all reports, x-axis = report date (first-of-… not
  relevant here; use the actual report date), newest on the right. Tap a chart → full Measurement Trend.
- **Latest values** grouped by category (in the user's section order), each "name · value · unit", with the
  value coloured by **flag** (high/low/abnormal) using the report's own range.
- **Reports timeline** entry point (recent reports).

### Medical - Reports (`/medical/reports`)

- Chronological list: date · type · provider · body part (if any). Tap → Report detail. Swipe-left → Delete
  (hard, with confirm; cascades its results).

### Medical - Report detail

- Header: report date, type, body part, provider; **Open original** link(s) (Google Drive).
- **Narrative** block (MRI/imaging/eye findings) when present.
- **Results** rendered in the user's section + test order (see Settings), **showing only the tests this
  report contains**, each row: name · value (or text) · unit · the report's reference range · flag.
- Edit button → Add/Edit Report form.

### Medical - Add / Edit Report (form)

- From **New Medical** tab or Edit button on Report detail.
- Fields: **Report date**, **Type** (health_screening / mri / ultrasound / mammogram / eye / other),
  **Body part** (for mri/ultrasound/mammogram/other), **Provider**, **Document URL(s)**, **Narrative**
  (one or more Google Drive links), and the **results** list.
- **Two intake modes:**
  - **Manual**: add result rows by hand (test, value or text, unit, ref range, flag).
  - **Import**: pick a `.json` (preferred) or `.csv` file → the app parses it (see tech-spec) → a **review
    screen** lists every parsed result by **category with counts**, highlights `uncertain` rows, and lets
    you correct values and **add any test the extraction missed** before saving. Nothing is written until
    you confirm.
- **Eye reports**: the form surfaces the six structured refraction values — **Sphere / Cylinder / Addition
  for each eye (OD, OS)** — alongside the narrative.
- Top-right: **RESET** + **CREATE** (new) / **SAVE** (editing).

### Medical - Settings

- **Tracked tests**: choose which tests appear as trends on the Dashboard (same pattern as Visible/Highlighted
  Nutrients; seeded from `default_tracked`).
- **Display order**: **drag-to-reorder** the **sections** (categories) and the **tests within each section**;
  saved as personal overrides; falls back to the seeded order. _(Built as a module milestone, not parked.)_
- **Biometric lock**: toggle on/off; set/reset PIN fallback.

---

## (merge into 02-tech-spec later)

**Intake — structured import (no OCR in app):**

- Accept **JSON** (primary; shape = `templates/medical-import.schema.json`) and **CSV** (the schema's
  `x-csv-equivalent` header), parsed with an **RFC-4180-compliant parser** (app-wide convention; dates
  `YYYY-MM-DD` text).
- **Tolerant JSON repair**: before parsing, auto-fix the common AI-formatting glitches observed in testing
  — a stray quote after a number (`1.7"` → `1.7`) and a missing comma before the next key. If it still
  won't parse, show a **clear, specific error** (line/field) rather than failing silently. Never accept a
  partially-parsed file without surfacing the problem.
- **Preserve decimals exactly** from the file; never round or recompute. Map each result to a `medical_lab_test`
  by name where possible (fuzzy, case-insensitive); unmatched tests are kept with their printed `test_name`
  - `category`.
- **Review-before-save is mandatory** and its primary purpose is catching **omitted sections** (testing
  showed a vision model can skip e.g. bone density on a dense scan). Show parsed-result **counts per
  category** so a missing group is obvious; allow manual add/edit on the review screen.
- The PDF itself is used only transiently in the owner's external tool; the app stores only the structured
  values + the report's **Google Drive URL(s)**. No file upload/storage.

**Templates** (in `templates/`, referenced from the runbook): `medical-extraction-prompt.md` (model-agnostic
prompt with anti-omission checklist + valid-JSON self-check) and `medical-import.schema.json` (JSON shape +
CSV header + example).

**Display ordering:** render results/dashboard by the user's `medical_section_order` + `medical_test_order`
when set, else by each test's seeded `category` + `sort_order`. Report detail shows the canonical order
filtered to the tests present (so every report reads consistently regardless of provider layout).

**Biometric lock:** gate the module with the **WebAuthn platform authenticator** (Face ID/Touch ID on iOS
16+) as a re-auth step on entry, with a **hashed PIN fallback** (some PWA contexts lack a platform
authenticator). Honest limitation: a PWA has no true background-lock lifecycle, so the lock triggers on
module entry / app cold-start, not on every backgrounding. Store the WebAuthn credential id and the PIN
hash (never a plaintext PIN); the lock state is client-side gating over RLS-protected data.

**No new external API.** No Tesseract, no Supabase Storage.

---

## (merge into 03-data-model later)

### medical_lab_test (reference/seed; read-only to clients)

- `key` TEXT PK (e.g. `ldl_cholesterol`)
- `display_name` TEXT, `default_unit` TEXT NULL
- `category` TEXT — general|vitals|lipids|glucose|liver|renal|electrolytes|cbc|thyroid|bone|tumour_markers|hepatitis|inflammation|urine|stool|imaging|eye|other (CHECK)
- `sort_order` INT — within category; seeded from the 2025/2026 report order
- `default_tracked` BOOLEAN — appears on the Dashboard by default
- `value_kind` TEXT — 'numeric' | 'qualitative' | 'either'

### medical_report (one row per visit/document set)

- `id` UUID PK · `user_id` UUID → auth.users
- `report_date` DATE
- `report_type` TEXT — 'health_screening'|'mri'|'ultrasound'|'mammogram'|'eye'|'other' (CHECK)
- `body_part` TEXT NULL · `provider` TEXT NULL · `narrative` TEXT NULL
- `document_urls` TEXT[] DEFAULT '{}' — Google Drive link(s)
- `created_at`, `updated_at` · Index (`user_id`, `report_date`)

### medical_result (one row per test per report; numeric OR qualitative)

- `id` UUID PK · `user_id` UUID → auth.users
- `report_id` UUID → medical_report (ON DELETE CASCADE)
- `test_key` TEXT NULL → medical_lab_test.key (null for ad-hoc tests not in the reference)
- `test_name` TEXT — display name as printed/captured
- `category` TEXT (same enum as above, CHECK)
- `value_num` NUMERIC NULL · `value_text` TEXT NULL
- `unit` TEXT NULL · `ref_low` NUMERIC NULL · `ref_high` NUMERIC NULL · `ref_text` TEXT NULL
- `flag` TEXT NULL — 'high'|'low'|'abnormal' (CHECK)
- `uncertain` BOOLEAN DEFAULT false
- `created_at`, `updated_at` · Indexes (`user_id`, `test_key`) and (`report_id`)

Eye refraction is stored as `medical_result` rows with `test_key`s `sphere_od, cylinder_od, addition_od,
sphere_os, cylinder_os, addition_os`, category `eye` (so they trend like any measurement).

### profile — additions

- `medical_tracked_tests` TEXT[] — test keys shown on the Dashboard (seeded from `default_tracked`)
- `medical_section_order` TEXT[] — category order override (null/empty = seeded order)
- `medical_test_order` TEXT[] — flat ordered list of test keys override
- `medical_lock_enabled` BOOLEAN DEFAULT false
- `medical_lock_pin_hash` TEXT NULL · `medical_lock_webauthn_id` TEXT NULL

Standard rules: `user_id` (ON DELETE CASCADE), four RLS policies using `(select auth.uid()) = user_id`,
`CHECK` on enums, `moddatetime`, migration `GRANT`s. **Hard delete** (deleting a report cascades its
results). Migration `supabase/migrations/<ts>_medical_schema.sql`.

**Relationships** — add: `profile 1—* medical_report`; `medical_report 1—* medical_result`.

---

## (merge into 04-design-system later)

- **Trend chart**: line chart (Recharts), one per tracked test; reference band optional; flagged points
  coloured. Reuse the time-window selector pattern.
- **Flag colours** (reuse tokens): high = danger/red, low = a distinct accent (e.g. amber), abnormal = red;
  in-range = neutral.
- **Category section headers** on Report detail / Dashboard (uppercase label, like the nutrient sections).
- **Reorder UI**: drag handles on the Settings list (sections, and tests within a section).
- **Lock screen**: a simple Face ID / PIN gate shown on module entry; reuse card styling.
- `uncertain` rows on the review screen get a subtle warning chip.

---

## (merge into 05-seed-data later)

Seed `medical_lab_test` from the owner's 2024–2026 reports. **Section order** (categories):
`general, vitals, lipids, glucose, liver, renal, electrolytes, cbc, thyroid, bone, tumour_markers,
hepatitis, inflammation, urine, stool, imaging, eye, other`.

Representative tests with category + within-section order following the 2025/2026 provider; `default_tracked`
marked ✓ (the Dashboard starter set). Claude Code should expand the full list from the reports + the import
schema categories.

- **general**: bmi ✓, weight, height, body_fat
- **vitals**: blood_pressure ✓, pulse, pulse_oximetry
- **lipids**: total_cholesterol ✓, ldl_cholesterol ✓, hdl_cholesterol ✓, triglycerides ✓, vldl_cholesterol, lipoprotein_a
- **glucose**: fasting_glucose ✓ (note gap: hba1c not in reports — selectable if ever added)
- **liver**: alt ✓, ast ✓, alp, ggt, total_protein, albumin, globulin, ag_ratio, bilirubin_total, bilirubin_direct, bilirubin_indirect
- **renal**: creatinine ✓, urea ✓, uric_acid ✓
- **electrolytes**: sodium, potassium, chloride, bicarbonate, calcium, phosphate, magnesium
- **cbc**: haemoglobin ✓, wbc ✓, platelet ✓, rbc, (differential rows…)
- **thyroid**: tsh ✓ (gap: only t4 measured—keep tsh selectable), t4, t3
- **bone**: bone_t_score ✓, speed_of_sound
- **tumour_markers**: cea, afp, ca_125
- **hepatitis**: hbsag, anti_hav_igg
- **inflammation**: esr, crp, rheumatoid_factor
- **urine / stool**: routine qualitative panels (value_kind qualitative)
- **eye**: sphere_od, cylinder_od, addition_od, sphere_os, cylinder_os, addition_os, iop (optional)

---

## Module milestones (build order)

1. Schema + RLS + seed `medical_lab_test`.
2. Manual report CRUD + Report detail (results render in seeded order).
3. **Structured import** (JSON/CSV) + tolerant JSON repair + **review-confirm** + Drive URL(s).
4. Dashboard trends + **tracked-test** selection.
5. **Drag-to-reorder Settings** (sections + tests within section). ← built, not parked
6. **Biometric lock** (WebAuthn + PIN fallback).
7. Narrative reports (MRI/imaging) + **eye** structured refraction fields.

---

## (ask Claude Code to merge into OWNER-RUNBOOK.md later) — Logging a medical report

1. After you receive a report PDF, save the file to **Google Drive** and copy its share link(s).
2. Open any vision-capable AI tool (Claude, Gemini, etc.), upload the PDF, and paste the prompt from
   `templates/medical-extraction-prompt.md`. Save the output as `YYYY-MM-DD_<type>.json`.
3. **Spot-check the JSON** against the PDF — especially decimals (LDL/HDL/glucose/creatinine) and that no
   section was skipped (bone density, BMI, vitals, imaging findings). Fix any `uncertain` rows.
4. In WellWorth → **Medical → Add Report → Import**, choose the file. Review the parsed rows (counts by
   category), correct/add anything, paste the **Drive link(s)**, set type/date/provider, and **Save**.
5. Manual entry is always available for a single value or a screening the PDF doesn't cover.
6. First time: enable the **biometric lock** in Medical → Settings and set a PIN fallback.
