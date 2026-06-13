# 05 — Seed Data

## Profile (owner — seed on first login, then editable in Settings)

- birthday: `1974-09-06`, sex: `female`, height_cm: `171`, weight_kg: `56`
- protein_target_g: `90` (manual override; she intentionally eats above the standard target)
- activity_factor: `1.4`, units: `metric`
- highlighted_nutrients (8): `protein, fiber, vitamin_d, calcium, iron, magnesium, folate, potassium`
- visible_nutrients: all keys below marked **Visible = yes**

## Activity library (seed these nine — at first login, alongside the profile)

| Name               | Template | Default effort | MET (editable)               | Description                               | Icon            |
| ------------------ | -------- | -------------- | ---------------------------- | ----------------------------------------- | --------------- |
| Body Combat        | duration | vigorous       | 7.0                          | High-intensity martial-arts cardio        | IconKarate      |
| 八段锦 (Baduanjin) | duration | light          | 3.0                          | Gentle qigong                             | IconStretching  |
| Stretching         | duration | light          | 2.3                          | Shoulder/Neck stretches                   | IconStretching2 |
| Yoga               | duration | light          | 2.5                          | General                                   | IconYoga        |
| Weight Training    | strength | moderate       | {"light":3.5,"moderate":3.5} | 8–15 reps, standard rest                  | IconBarbell     |
| Powerlifting       | strength | vigorous       | {"vigorous":6.0}             | Heavy sets                                | IconBarbell     |
| Circuit Training   | strength | vigorous       | {"vigorous":8.0}             | Fast-paced, minimal rest, high heart rate | IconBarbell     |
| Swimming           | duration | moderate       | 5.9                          | Leisurely                                 | IconSwimming    |
| Walking            | duration | moderate       | 3.5                          | ~3 mph                                    | IconWalk        |

MET source: Compendium of Physical Activities. Intensity bands: light <3.0, moderate 3.0–5.9, vigorous ≥6.0 METs.
For strength activities, met_by_effort maps each effort level to its Compendium value. Sessions resolve the MET from the map using the session's chosen effort level.

Icon values are Tabler icon component name strings stored in activity.icon. Resolved via src/constants/activity-icons.ts, which imports only the icons used in the app by name (tree-shaking safe — do NOT use import \* as TablerIcons). The New Activity icon picker renders the keys of ACTIVITY_ICONS. Null/unknown falls back to DEFAULT_ACTIVITY_ICON (IconRun).

## Nutrient reference (seed the `nutrient` table)

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
