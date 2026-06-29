# Bulk-import template — foods & supplements

- Fill in **`wellness-foods-template.csv`** (one row per item) and import it from **Wellness → Settings →
  Import → Import CSV Food** (turn on **Enable Bulk Food Import** first).
- Each row is **matched against USDA** by `name` (the same search the Diary "Add Food → All" tab uses):
  - A confident match imports as a **USDA** food with USDA's full nutrients — **you don't fill any
    nutrient columns** for these. A weaker match is flagged **review**; no match is flagged **No match**.
  - In the preview, **Change** lets you pick the right USDA food; **Manual** keeps the row as a **custom**
    food (`source = 'custom'`) built from whatever nutrient columns you filled in.
- So you **don't pre-tag** custom vs USDA: leave nutrient cells blank for foods USDA can find, and fill
  them only for genuinely custom items (e.g. home-cooked / local dishes USDA doesn't have).
- **Every** imported row is saved as a **favorite** (USDA foods only persist when favorited), so the
  `is_favorite` column is ignored.

- You only fill the columns you have data for. **Blank cells are ignored.** The only required column is `name`.

> Tip: open the CSV in Excel / Google Sheets, delete any nutrient columns you'll never use, fill
> the rest, then export back to CSV (UTF-8). Keep the header row exactly as the column keys below.

---

## How a row maps to the database

| CSV columns                                     | Goes to                      | Notes                                                                                                                                                                             |
| ----------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `type`, `nutrient_basis`, `is_favorite` | `food` row                   | `name` is matched against USDA; matched rows save as `source='usda'`, the rest as `custom`. Every row is saved as a favorite (`is_favorite` ignored). `user_id` is set at import. |
| `serving1_*` … `serving3_*`                     | `serving` rows               | Optional. A `100 g` measure is always available automatically, so you don't need to add it.                                                                                       |
| every nutrient column (`energy`, `protein`, …)  | `food.nutrients` (JSONB map) | Stored as `{ key: amount }`, **relative to the basis** (see below).                                                                                                               |

`net_carbs` is **not** a column — it's derived automatically as `carbs − fiber` at display time.

---

## Core columns

| Column           | Required? | Allowed values / format                   | Default           |
| ---------------- | --------- | ----------------------------------------- | ----------------- |
| `name`           | **Yes**   | Any text, e.g. `Homemade Granola`         | —                 |
| `type`           | No        | `food` or `supplement`                    | `food`            |
| `nutrient_basis` | No        | `per_100g` or `per_serving`               | `per_100g`        |
| `is_favorite`    | No        | ignored — every row imports as a favorite | (always favorite) |

### Servings (`serving1_name`/`serving1_grams`, …`serving3_*`)

- Optional named measures.
- `*_name` is free text (`1/2 cup`, `1 capsule`, `1 scoop`); `*_grams` is the weight of that measure in grams (numeric).
- Add as many of the three pairs as you need; leave the rest blank.
- For supplements, use the pill/scoop as the serving and put its actual weight (a small number like `0.3`) in grams.

### `nutrient_basis` — what the nutrient numbers mean

- **`per_100g`** (typical for whole foods): enter every nutrient **per 100 grams**. When you log it,
  the app scales by the serving you pick. Enter the most accurate `serving*` weights so logging "1
  cup" is correct.
- **`per_serving`** (typical for supplements): enter every nutrient **per one serving** (per capsule,
  per scoop). The grams of the first serving are used as the basis, so logging "amount = 2" gives
  exactly twice the listed values. Always provide `serving1_name`/`serving1_grams` when you use this.

---

## Nutrient columns & units

Enter the **number only**, in the unit shown here (the same units the app displays). `energy` is the
food's calories — enter it directly; it isn't computed from the macros.

**General:** `energy` (kcal) · `water` (g) · `alcohol` (g) · `caffeine` (mg)

**Macros:** `protein` (g) · `carbs` (g) · `fat` (g)

**Carbohydrate detail:** `fiber` (g) · `starch` (g) · `sugars` (g) · `added_sugars` (g) ·
`fructose` (g) · `galactose` (g) · `glucose` (g) · `lactose` (g) · `maltose` (g) · `sucrose` (g)

**Fat detail:** `saturated` (g) · `monounsaturated` (g) · `polyunsaturated` (g) · `trans` (g) ·
`cholesterol` (mg) · `omega3` (g) · `omega6` (g) · `ala` (g) · `epa` (g) · `dha` (g) ·
`linoleic` (g) · `arachidonic` (g) · `palmitic` (g) · `stearic` (g) · `oleic` (g)

**Vitamins:** `vitamin_a` (µg) · `vitamin_c` (mg) · `vitamin_d` (µg) · `vitamin_e` (mg) ·
`vitamin_k` (µg) · `b1` (mg) · `b2` (mg) · `b3` (mg) · `b5` (mg) · `b6` (mg) · `b12` (µg) ·
`folate` (µg) · `b7` (µg) · `choline` (mg)

**Minerals:** `calcium` (mg) · `copper` (mg) · `iodine` (µg) · `iron` (mg) · `magnesium` (mg) ·
`manganese` (mg) · `phosphorus` (mg) · `potassium` (mg) · `selenium` (µg) · `sodium` (mg) ·
`zinc` (mg) · `chromium` (µg) · `fluoride` (mg) · `molybdenum` (µg) · `chloride` (mg)

**Amino acids** (all in g): `histidine` · `isoleucine` · `leucine` · `lysine` · `methionine` ·
`phenylalanine` · `threonine` · `tryptophan` · `valine` · `alanine` · `arginine` · `aspartic_acid` ·
`cystine` · `glutamic_acid` · `glycine` · `proline` · `serine` · `tyrosine`

### Unit conversions you may need

- **Vitamin A:** enter **µg RAE** (not IU).
- **Vitamin D:** enter **µg** — 1 µg = 40 IU (so 1000 IU = 25 µg, 2000 IU = 50 µg).
- **Vitamin E:** enter **mg** — 1 mg α-tocopherol ≈ 1.49 IU (natural).
- **Folate:** enter **µg** (DFE where possible).
- Sodium label values are often in mg already; if a label lists grams of salt, sodium (mg) ≈ salt(g) × 400.

---

## Examples (already in the template)

1. **Homemade Granola** — a `food`, `per_100g`, with two named servings and macro + a few micro values.
2. **Vitamin D3 1000 IU** — a `supplement`, `per_serving`, one capsule, `vitamin_d = 25` (µg), favorited.
3. **Magnesium Glycinate** — a `supplement`, `per_serving`, two-capsule dose, `magnesium = 200` (mg).

Delete these rows before importing your own data (or keep them — they're valid).

---

## Importing the file

There is no import button in the app yet — this template defines the format. To actually load the
CSV you'll need an importer that reads each row, writes the `food` row (with the nutrient columns
collapsed into the JSONB `nutrients` map) and its `serving` rows. Two options, depending on what you
prefer; ask and I'll build it:

- **In-app upload** (recommended): a "Import CSV" button in Library that parses the file in the
  browser and inserts through the normal data layer — runs as you, respects RLS, reusable any time.
- **One-off local script**: a Node script (`scripts/import-foods.ts`) run from your machine. Simple
  for a single big load, but needs Supabase credentials in your local `.env`.
