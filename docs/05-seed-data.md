# 05 — Seed Data

## Profile (owner — seed on first login, then editable in Settings)

- birthday: `1974-09-06`, sex: `female`, height_cm: `171`, weight_kg: `56`
- protein_target_g: `90` (manual override; she intentionally eats above the standard target)
- activity_factor: `1.4`, units: `metric`
- highlighted_nutrients (8): `protein, fiber, vitamin_d, calcium, iron, magnesium, folate, potassium`
- visible_nutrients: all keys below marked **Visible = yes**

## Activity library (seed these six)

| Name               | Template | Default effort | MET (editable)               | Description                               | Icon             |
| ------------------ | -------- | -------------- | ---------------------------- | ----------------------------------------- | ---------------- |
| Body Combat        | duration | vigorous       | 7.0                          | High-intensity martial-arts cardio        | IconKarate       |
| 八段锦 (Baduanjin) | duration | light          | 3.0                          | Gentle qigong                             | IconStretching   |
| Stretching         | duration | light          | 2.3                          | Shoulder/Neck stretches                   | IconStretching-2 |
| Yoga               | duration | light          | 2.5                          | General                                   | IconYoga         |
| Weight Training    | strength | moderate       | {"light":3.5,"moderate":3.5} | 8–15 reps, standard rest                  | IconBarbell      |
| Powerlifting       | strength | vigorous       | {"vigorous":6.0}             | Heavy sets                                | IconBarbell      |
| Circuit Training   | strength | vigorous       | {"vigorous":8.0}             | Fast-paced, minimal rest, high heart rate | IconBarbell      |
| Swimming           | duration | moderate       | 5.9                          | Leisurely                                 | IconSwimming     |
| Walking            | duration | moderate       | 3.5                          | ~3 mph                                    | IconWalk         |

MET source: Compendium of Physical Activities. Intensity bands: light <3.0, moderate 3.0–5.9, vigorous ≥6.0 METs.
For strength activities, met_by_effort maps each effort level to its Compendium value. Sessions resolve the MET from the map using the session's chosen effort level.

Icon values are Tabler icon component name strings stored in activity.icon. Resolved via src/constants/activityIcons.ts, which imports only the icons used in the app by name (tree-shaking safe — do NOT use import \* as TablerIcons). The New Activity icon picker renders the keys of ACTIVITY_ICONS. Null falls back to DEFAULT_ACTIVITY_ICON (IconRun).

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

Notes: many non-visible micronutrients (amino acids, individual fatty acids, biotin, chromium) are sparsely populated in USDA data — flag a small "limited data" note when toggled visible. `net_carbs` is derived (carbs − fiber) and need not be stored on foods.
