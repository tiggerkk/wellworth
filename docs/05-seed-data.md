# 05 — Seed Data

## Profile (owner — seed on first login, then editable in Settings)

- birthday: `1974-09-06`, sex: `female`, height_cm: `171`, weight_kg: `56`
- protein_target_g: `90` (manual override; she intentionally eats above the standard target)
- activity_factor: `1.4`, units: `metric`
- highlighted_nutrients (8): `protein, fiber, vitamin_d, calcium, iron, magnesium, folate, potassium`
- visible_nutrients: all keys below marked **Visible = yes**

---

## Wellness - Activity library (seed these — at first login, alongside the profile)

| Name                   | Template | Default duration | Default effort | MET by effort (editable)                    | Description                               | Icon            |
| ---------------------- | -------- | ---------------- | -------------- | ------------------------------------------- | ----------------------------------------- | --------------- |
| Body Combat            | duration | 60               | vigorous       | {"light":3.0,"moderate":5.9,"vigorous":7.0} | High-intensity martial-arts cardio        | IconKarate      |
| 八段锦 (Baduanjin)     | duration | 10               | light          | {"light":3.0}                               | Gentle qigong                             | IconStretching  |
| Stretching             | duration | 10               | light          | {"light":2.3}                               | Shoulder/Neck stretches                   | IconStretching2 |
| Yoga                   | duration | 15               | light          | {"light":2.5,"moderate":3.5}                | General                                   | IconYoga        |
| Weights - General      | strength | 20               | moderate       | {"light":3.0,"moderate":3.5}                | 8–15 reps, standard rest                  | IconBarbell     |
| Weights - Powerlifting | strength | 20               | vigorous       | {"vigorous":6.0}                            | Heavy sets                                | IconBarbell     |
| Weights - Circuit      | strength | 20               | vigorous       | {"vigorous":8.0}                            | Fast-paced, minimal rest, high heart rate | IconBarbell     |
| Swimming               | duration | 30               | moderate       | {"light":3.0,"moderate":5.9,"vigorous":6.5} | Leisurely                                 | IconSwimming    |
| Walking                | duration | 30               | moderate       | {"moderate":3.3}                            | ~3 mph                                    | IconWalk        |
| Running - Jog          | duration | 30               | moderate       | {"moderate":5.9}                            | ~4 mph                                    | IconRun         |
| Running - Fast         | duration | 30               | vigorous       | {"vigorous":9.8}                            | ~6 mph                                    | IconRun         |

MET source: Compendium of Physical Activities. Intensity bands: light ≤3.0, moderate 3.1–5.9, vigorous ≥6.0 METs.
For strength activities, met_by_effort maps each effort level to its Compendium value. Sessions resolve the MET from the map using the session's chosen effort level.

Icon values are Tabler icon component name strings stored in activity.icon. Resolved via src/constants/activity-icons.ts, which imports only the icons used in the app by name (tree-shaking safe — do NOT use import \* as TablerIcons). The New Activity icon picker renders the keys of ACTIVITY_ICONS. Null/unknown falls back to DEFAULT_ACTIVITY_ICON (IconRun).

## Wellness - Nutrient reference (seed the `nutrient` table)

`Visible = yes` = `default_visible true` (Phase-1 list). `UL` = `has_upper_limit true` (red-bar capable).
DRI target/UL numeric values are looked up by age/sex in `src/lib/dri.ts`, not stored here.

### General

| key      | name     | unit | Visible | UL  |
| -------- | -------- | ---- | ------- | --- |
| energy   | Energy   | kcal | yes     | —   |
| water    | Water    | g    | yes     | —   |
| alcohol  | Alcohol  | g    | no      | —   |
| caffeine | Caffeine | mg   | no      | —   |

### Protein & Amino Acids (category: protein)

The individual amino-acid rows carry `parent_key = 'protein'` (nested under Protein for display).
`protein` itself has no parent.

| key           | name          | unit | Visible | UL  |
| ------------- | ------------- | ---- | ------- | --- |
| protein       | Protein       | g    | yes     | —   |
| histidine     | Histidine     | g    | no      | —   |
| isoleucine    | Isoleucine    | g    | no      | —   |
| leucine       | Leucine       | g    | no      | —   |
| lysine        | Lysine        | g    | no      | —   |
| methionine    | Methionine    | g    | no      | —   |
| phenylalanine | Phenylalanine | g    | no      | —   |
| threonine     | Threonine     | g    | no      | —   |
| tryptophan    | Tryptophan    | g    | no      | —   |
| valine        | Valine        | g    | no      | —   |
| alanine       | Alanine       | g    | no      | —   |
| arginine      | Arginine      | g    | no      | —   |
| aspartic_acid | Aspartic acid | g    | no      | —   |
| cystine       | Cystine       | g    | no      | —   |
| glutamic_acid | Glutamic acid | g    | no      | —   |
| glycine       | Glycine       | g    | no      | —   |
| proline       | Proline       | g    | no      | —   |
| serine        | Serine        | g    | no      | —   |
| tyrosine      | Tyrosine      | g    | no      | —   |

### Carbohydrates (parent shown where nested)

| key          | name          | unit | Visible | UL  | parent |
| ------------ | ------------- | ---- | ------- | --- | ------ |
| carbs        | Carbs (Total) | g    | yes     | —   | —      |
| fiber        | Fiber         | g    | yes     | —   | carbs  |
| starch       | Starch        | g    | no      | —   | carbs  |
| sugars       | Sugars        | g    | no      | —   | carbs  |
| added_sugars | Added Sugars  | g    | no      | UL  | carbs  |
| net_carbs    | Net Carbs     | g    | no      | —   | carbs  |
| fructose     | Fructose      | g    | no      | —   | sugars |
| galactose    | Galactose     | g    | no      | —   | sugars |
| glucose      | Glucose       | g    | no      | —   | sugars |
| lactose      | Lactose       | g    | no      | —   | sugars |
| maltose      | Maltose       | g    | no      | —   | sugars |
| sucrose      | Sucrose       | g    | no      | —   | sugars |

### Lipids

| key             | name                  | unit | Visible | UL  | parent          |
| --------------- | --------------------- | ---- | ------- | --- | --------------- |
| fat             | Fat                   | g    | yes     | —   | —               |
| monounsaturated | Fat (Monounsaturated) | g    | yes     | —   | fat             |
| polyunsaturated | Fat (Polyunsaturated) | g    | yes     | —   | fat             |
| omega3          | Omega-3               | g    | yes     | —   | polyunsaturated |
| omega6          | Omega-6               | g    | yes     | —   | polyunsaturated |
| saturated       | Fat (Saturated)       | g    | yes     | —   | fat             |
| trans           | Fat (Trans)           | g    | yes     | —   | fat             |
| cholesterol     | Cholesterol           | mg   | yes     | —   | —               |
| ala             | ALA (18:3)            | g    | no      | —   | omega3          |
| epa             | EPA (20:5)            | g    | no      | —   | omega3          |
| dha             | DHA (22:6)            | g    | no      | —   | omega3          |
| linoleic        | Linoleic (18:2)       | g    | no      | —   | omega6          |
| arachidonic     | Arachidonic (20:4)    | g    | no      | —   | omega6          |
| palmitic        | Palmitic (16:0)       | g    | no      | —   | saturated       |
| stearic         | Stearic (18:0)        | g    | no      | —   | saturated       |
| oleic           | Oleic (18:1)          | g    | no      | —   | monounsaturated |

### Vitamins

| key       | name                  | unit | Visible | UL  |
| --------- | --------------------- | ---- | ------- | --- |
| vitamin_a | Vitamin A             | µg   | yes     | UL  |
| vitamin_c | Vitamin C             | mg   | yes     | UL  |
| vitamin_d | Vitamin D             | µg   | yes     | UL  |
| vitamin_e | Vitamin E             | mg   | yes     | UL  |
| vitamin_k | Vitamin K             | µg   | yes     | —   |
| b1        | B1 (Thiamine)         | mg   | yes     | —   |
| b2        | B2 (Riboflavin)       | mg   | yes     | —   |
| b3        | B3 (Niacin)           | mg   | yes     | UL  |
| b5        | B5 (Pantothenic Acid) | mg   | yes     | —   |
| b6        | B6 (Pyridoxine)       | mg   | yes     | UL  |
| b12       | B12 (Cobalamin)       | µg   | yes     | —   |
| folate    | Folate                | µg   | yes     | UL  |
| b7        | B7 (Biotin)           | µg   | no      | —   |
| choline   | Choline               | mg   | no      | UL  |

### Minerals

| key        | name       | unit | Visible | UL  |
| ---------- | ---------- | ---- | ------- | --- |
| calcium    | Calcium    | mg   | yes     | UL  |
| copper     | Copper     | mg   | yes     | UL  |
| iodine     | Iodine     | µg   | yes     | UL  |
| iron       | Iron       | mg   | yes     | UL  |
| magnesium  | Magnesium  | mg   | yes     | UL  |
| manganese  | Manganese  | mg   | yes     | UL  |
| phosphorus | Phosphorus | mg   | yes     | UL  |
| potassium  | Potassium  | mg   | yes     | —   |
| selenium   | Selenium   | µg   | yes     | UL  |
| sodium     | Sodium     | mg   | yes     | UL  |
| zinc       | Zinc       | mg   | yes     | UL  |
| chromium   | Chromium   | µg   | no      | —   |
| fluoride   | Fluoride   | mg   | no      | UL  |
| molybdenum | Molybdenum | µg   | no      | UL  |
| chloride   | Chloride   | mg   | no      | UL  |

Notes: many non-visible micronutrients (amino acids, individual fatty acids, biotin, chromium) are sparsely populated in USDA data — flag a small "limited data" note when toggled visible. `net_carbs` is derived (carbs − fiber) and need not be stored on foods. `sort_order` within each category follows the row order in the tables above (10, 20, 30, … in steps of 10).

---

## DRI target/UL values — adult female 51–70

These are the actual numbers in `src/lib/dri.ts` (`FEMALE_51_70`), transcribed from the
**NASEM/IOM Dietary Reference Intakes** as published by the NIH Office of Dietary Supplements
(consolidated summary tables, NCBI Bookshelf **NBK545442**, incl. the 2011 Ca/Vitamin D and 2019
Na/K updates). **Target** = RDA where one exists, else AI. **Phase 1 populates only this one band**;
`getDriForProfile` throws for any other sex/age band.

> **The owner (born 1974-09-06) is in this band through age 70.** At 71 she enters the 71+ band and
> the lookup will throw until a `female:71+` entry is added to `DRI_TABLES`. See "How to add a band"
> below.

### Upper-limit scope (`ulScope`) — which bars turn red

A red bar means a value exceeds an **intake-based** limit. `ulScope` distinguishes:

- `total` — UL applies to total intake; **fires red** when exceeded.
- `cdrr` — sodium's Chronic-Disease-Risk-Reduction ceiling (2300 mg); treated like a UL, **fires red**.
- `guidance` — an energy-% guideline ceiling (added sugars); **fires red**.
- `supplemental` — UL applies only to the supplemental/synthetic form, which a normal diet routinely
  exceeds; **never fires red** on food intake (stored only for reference).

### Targets + ULs

| key        | target | type | UL   | ulScope      | notes                                                                                                                                                              |
| ---------- | ------ | ---- | ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| water      | 2700   | AI   | —    | —            | g, total water                                                                                                                                                     |
| protein    | 46     | RDA  | —    | —            | overridden by `profile.protein_target_g` (owner = 90)                                                                                                              |
| carbs      | 130    | RDA  | —    | —            |                                                                                                                                                                    |
| fiber      | 21     | AI   | —    | —            |                                                                                                                                                                    |
| omega3     | 1.1    | AI   | —    | —            | ALA                                                                                                                                                                |
| omega6     | 11     | AI   | —    | —            | linoleic acid                                                                                                                                                      |
| vitamin_a  | 700    | RDA  | 3000 | supplemental | µg RAE; UL is preformed **retinol** only, not carotenoids                                                                                                          |
| vitamin_c  | 75     | RDA  | 2000 | total        |                                                                                                                                                                    |
| vitamin_d  | 15     | RDA  | 100  | total        | µg (600 IU target / 4000 IU UL)                                                                                                                                    |
| vitamin_e  | 15     | RDA  | 1000 | supplemental | UL = supplemental α-tocopherol only                                                                                                                                |
| vitamin_k  | 90     | AI   | —    | —            |                                                                                                                                                                    |
| b1         | 1.1    | RDA  | —    | —            | thiamin                                                                                                                                                            |
| b2         | 1.1    | RDA  | —    | —            | riboflavin                                                                                                                                                         |
| b3         | 14     | RDA  | 35   | supplemental | mg NE target; UL is supplemental niacin (mg), not NE                                                                                                               |
| b5         | 5      | AI   | —    | —            |                                                                                                                                                                    |
| b6         | 1.5    | RDA  | 100  | total        |                                                                                                                                                                    |
| b12        | 2.4    | RDA  | —    | —            |                                                                                                                                                                    |
| folate     | 400    | RDA  | 1000 | supplemental | µg DFE target; UL is synthetic folic acid only                                                                                                                     |
| b7         | 30     | AI   | —    | —            | biotin                                                                                                                                                             |
| choline    | 425    | AI   | 3500 | total        |                                                                                                                                                                    |
| calcium    | 1200   | RDA  | 2000 | total        |                                                                                                                                                                    |
| copper     | 0.9    | RDA  | 10   | total        | **mg** (app stores copper in mg, not µg)                                                                                                                           |
| iodine     | 150    | RDA  | 1100 | total        | µg                                                                                                                                                                 |
| iron       | 8      | RDA  | 45   | total        | postmenopausal RDA (8, not 18)                                                                                                                                     |
| magnesium  | 320    | RDA  | 350  | supplemental | UL = supplemental Mg only; dietary Mg routinely exceeds it                                                                                                         |
| manganese  | 1.8    | AI   | 11   | total        |                                                                                                                                                                    |
| phosphorus | 700    | RDA  | 4000 | total        |                                                                                                                                                                    |
| potassium  | 2600   | AI   | —    | —            | 2019 value (not the old 4700)                                                                                                                                      |
| selenium   | 55     | RDA  | 400  | total        | µg                                                                                                                                                                 |
| sodium     | 1500   | AI   | 2300 | cdrr         | no classical UL; 2300 is the CDRR ceiling                                                                                                                          |
| zinc       | 8      | RDA  | 40   | total        |                                                                                                                                                                    |
| chromium   | 20     | AI   | —    | —            | µg                                                                                                                                                                 |
| fluoride   | 3      | AI   | 10   | total        | mg                                                                                                                                                                 |
| molybdenum | 45     | RDA  | 2000 | total        | µg                                                                                                                                                                 |
| chloride   | 2300   | AI   | 3600 | total        | mg. **Edition caveat:** some summary tables print the AI as 2.0 g; the established adult value is 2.3 g (2300 mg) — verify against the source if precision matters |

Energy is shown against the **computed** target (BMR × activity factor), not a DRI constant. Nutrients
not in this table (amino acids, individual fatty acids, starch/sugars, alcohol, caffeine, cholesterol,
monounsaturated/polyunsaturated) have **no target** — they display as a value with no % bar.

### Energy-derived soft targets

Three nutrients get targets computed from the day's energy target (kcal), not from a DRI
(`ENERGY_DERIVED` in `dri.ts`):

| key          | target = % of energy | kcal/g | red bar?         | basis                                      |
| ------------ | -------------------- | ------ | ---------------- | ------------------------------------------ |
| fat          | 35%                  | 9      | no               | AMDR 20–35% (we use the top as the target) |
| saturated    | 10%                  | 9      | no               | DGA "< 10% of energy"                      |
| added_sugars | 10%                  | 4      | yes (`guidance`) | DGA "< 10% of energy"                      |

### How to add a DRI band (future multi-user)

Add another `Record<string, StaticDri>` (e.g. `MALE_31_50`) with that band's RDA/AI + UL + ulScope
values from the same NASEM/IOM tables, register it in `DRI_TABLES` keyed `'male:31-50'`, and extend
`bandFor(sex, age)` in `dri.ts` to map ages to the new key. No schema or UI change is required.

---

## Net Worth - Asset types (fixed enum in this order)

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

All values are entered manually. The `details` fields are preserved for reference but do **not** drive the value or the net-worth math. The `details` JSONB is open-ended — the import accepts whatever `detailN_key`/`detailN_value` pairs appear in the CSV, so new keys can be added later without a schema change.

## Net Worth - Seed & import (in-app CSV importer)

Your real balances stay **out of the repo**. An **in-app importer** (in the Net Worth module, signed in as you) reads a local CSV and creates/replaces a month's snapshot + `asset_entry` rows. It is reusable for **any** month — not just the first — so you can bulk-replace a month's holdings instead of typing them in. After the initial import, copy-forward takes over month to month. The importer is **idempotent per month** (re-running for a month replaces that month's entries, never duplicating them).

- File: `templates/networth-seed-template.csv` — a **sanitized example** is committed; your **filled** copy must stay gitignored (see `.gitignore`; keep it as e.g. `templates/networth-seed.local.csv`). Confirm each `value_native`.
- **Number parsing:** some CSV numbers are quoted with thousands-separator commas (e.g. `"1,234,567.89"`) while others are plain (e.g. `999.99`). The importer **must strip commas (and surrounding quotes) before converting to numeric**, for both `value_native` and all detail values.
- **Gitignore the filled CSV** (it contains private financial data).
- Column spec:
  `asset_type,name,currency,value_native,detail1_key,detail1_value,detail2_key,detail2_value`
  - `detail*` columns are optional, type-specific, and stored as-is in `details` (e.g. `maturity_date`, `ticker`, `shares`, `units`, `cost`, `premium`, `policy_year`). Extra detail pairs are allowed.
  - The importer asks you for the snapshot month (e.g. `2026-06`) and normalizes it to the **first day** of that month.
  - Full column rules + examples: `templates/networth-import-guide.md`. (Implemented in
    `src/lib/networth-import.ts` + `src/screens/ImportNetWorthSheet.tsx`.)

---

## Medical - lab-test reference (seed the `medical_lab_test` table)

The reference list is the SQL mirror of `src/lib/medical.ts` `MEDICAL_LAB_TESTS` (the front-end source
of truth); `src/lib/medical.test.ts` cross-checks the two so they can't drift. It was built from the
owner's **2021–2026** reports across three providers (MediFast HK, Mobile Medical HK, Global HealthCare
Shanghai). The seed migration is `supabase/migrations/11_medical_seed_lab_test.sql`
(idempotent `ON CONFLICT (key) DO UPDATE`).

- **Section order** (categories): `general, vitals, lipids, glucose, liver, renal, electrolytes, cbc,
thyroid, bone, tumour_markers, hepatitis, inflammation, urine, stool, imaging, eye, other`.
  `sort_order` orders tests within a category (10, 20, 30, … per the provider order).
- **`default_unit` is the canonical unit** the importer normalizes incoming values to (e.g. Haemoglobin
  `g/dL`, uric acid `mmol/L`, creatinine `umol/L`, enzymes `U/L`, blood counts `K/uL`) — chosen from the
  consistent HK convention where one exists. See `02-tech-spec.md` → "Unit normalization".
- **`default_tracked`** is the Dashboard starter set (seeds `profile.medical_tracked_tests` on first
  run): `bmi, blood_pressure_systolic, blood_pressure_diastolic, total_cholesterol, ldl_cholesterol,
hdl_cholesterol, triglycerides, fasting_glucose, hba1c, alt_sgpt, ast_sgot, creatinine, urea,
uric_acid, haemoglobin, wbc, platelet, tsh, bone_t_score, vitamin_d_25oh`.
- **`value_kind`** marks each test `numeric` | `qualitative` | `either`. Eye refraction
  (`sphere_od … addition_os`) is seeded so eye reports trend like any measurement.

Canonicalization notes (decided during seeding): blood pressure is split into two numeric keys; thyroid
keeps `t4_total` vs `free_t4`/`free_t3` as distinct analytes; H. pylori serology and the C-13 breath
test are separate keys; cardiac/pancreatic/iron markers and the radiation-scan rows live in `other`;
ECG numeric intervals live in `imaging` with the impression as `ecg_finding`.

## Medical - structured import (no in-app OCR)

Real lab results stay **out of the repo**. Extraction is done outside the app by any vision-capable AI
tool, then imported. Templates (all gitignored except the sanitized ones):

- `templates/medical-extraction-prompt.md` — the model-agnostic prompt (tracked).
- `templates/medical-import.schema.json` — JSON shape + CSV header + example (tracked).
- `templates/medical-import-template.json` — sanitized, fictional example (tracked).
- `templates/medical-import-2021.json … -2026.json` and any report PDFs — **real PII; gitignored**
  (`medical-import-20*.json`, `templates/*.pdf`).

The importer (M3) accepts JSON (primary) + CSV (RFC-4180), auto-repairs the known AI glitch (a stray
quote after a number, e.g. `8.6"`), normalizes provider names to `test_key` via an alias map and values
to the canonical unit, and requires a **review-before-save** step (counts per category; catches omitted
sections).

## Travel - seed & assets

- **Expense categories** (owner-editable thereafter): **Restaurant, Take-out, Groceries, Shopping,
  Activity, Local Transit, Flight/Train, Hotel** — the `TRAVEL_EXPENSE_CATEGORIES` defaults in
  `src/constants/travel.ts` (display order = array order). Applied when `profile.travel_expense_categories`
  is NULL; **not a seeded table** (the Quotes pattern). The labels double as the wide-CSV importer's
  recognized category headers.
- **`CHINA_PROVINCES`** constant — the 34 province-level divisions (bare canonical names, incl. Hong Kong
  & Macau), the shared vocabulary for the city resolver, the shaded map, and the "N / 34" denominator.
- **Bundled GeoJSON** (static assets in `public/geo/`, served from our origin, **excluded from the PWA
  precache**, loaded on demand by the lazy map chunk): `china-provinces.geojson` (DataV.GeoAtlas, Chinese
  province names) + `world-countries.geojson` (Natural Earth 110m admin-0, public domain). A build-time
  test asserts the names line up with `CHINA_PROVINCES` / `COUNTRY_ALIASES`.
- **`remembered_city`** is populated on first use (manual confirm or geocode) — no up-front seed.

## Travel - import templates

Real trip/expense data stays **out of the repo**; only sanitized templates are tracked.

- `templates/travel-expenses-template.csv` + `travel-expenses-import-guide.md` — the wide expenses CSV
  (tracked). Real `travel-expenses*.csv` are **gitignored**.
- `templates/travel-itinerary.schema.json` + `travel-itinerary-prompt.md` — the itinerary JSON array
  shape + the model-agnostic extraction prompt (tracked). Produced outside the app from freeform
  itinerary text by any AI tool; imported as drafts.
