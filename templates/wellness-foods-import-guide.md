# Bulk-import template — foods & supplements

- Fill in **`wellness-foods-template.csv`** (one row per item) and import it from **Wellness → Settings →
  Import → Import CSV Food** (turn on **Enable Bulk Food Import** first).
- Each row is **matched against USDA** by `name` (the same search the Diary "Diary Food Picker → All" tab uses):
  - A confident match imports as a **USDA** food with USDA's full nutrients — **you don't fill any
    nutrient columns** for these. A weaker match is flagged **review**; no match is flagged **No match**.
  - In the preview, **Change** lets you pick the right USDA food; **Manual** keeps the row as a **custom**
    food (`source = 'custom'`) built from whatever nutrient columns you filled in.
- **Know it isn't in USDA? Set `is_custom = true`.** The importer then **skips USDA entirely** for that
  row — no lookup, no review — and saves it straight as a custom food from your CSV nutrients/servings.
  Use it for home-cooked / local dishes and supplements you've already confirmed USDA doesn't have.
- So for the rest you **don't pre-tag** custom vs USDA: leave nutrient cells blank for foods USDA can
  find, and fill them only for genuinely custom items.
- **Servings work for USDA foods too.** Fill `serving*` to add your own measures (e.g. `1 cup`) on top
  of USDA's own serving; leave them blank to just use USDA's serving + the automatic `100 g`. Use
  `default_serving` to pick which measure is preselected when logging.
- **Re-import overwrites.** Re-importing a food you've already imported updates it **in place** and
  **replaces** its servings + default from the CSV (the file is the source of truth) — so any servings
  you added to that food **inside the app** are overwritten. Identity is the USDA food (for matched
  rows) or the exact `name` (for custom rows); a different name imports as a new food.
- **Every** imported row is saved as a **favorite** (USDA foods only persist when favorited), so the
  `is_favorite` column is ignored.

- You only fill the columns you have data for. **Blank cells are ignored.** The only required column is `name`.

> Tip: open the CSV in Excel / Google Sheets, delete any nutrient columns you'll never use, fill
> the rest, then export back to CSV (UTF-8). Keep the header row exactly as the column keys below.

---

## How a row maps to the database

| CSV columns                                                  | Goes to                      | Notes                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `type`, `is_custom`, `is_favorite`, `nutrient_basis` | `food` row                   | `name` is matched against USDA unless `is_custom=true`; matched rows save as `source='usda'`, the rest as `custom`. Every row is saved as a favorite (`is_favorite` ignored). `nutrient_basis` applies to **custom rows only** (USDA supplies its own). `user_id` is set at import. |
| `serving1_*` … `serving3_*`, `default_serving`               | `serving` rows + the default | Optional. A `100 g` measure is always available automatically, so you don't need to add it. For a USDA food, your servings are added **on top of** USDA's own serving. `default_serving` is the preselected measure.                                                                |
| every nutrient column (`energy`, `protein`, …)               | `food.nutrients` (JSONB map) | Stored as `{ key: amount }`, **relative to the basis** (see below). Ignored for USDA-matched rows (USDA supplies the nutrients).                                                                                                                                                    |

`net_carbs` is **not** a column — it's derived automatically as `carbs − fiber` at display time.

---

## Core columns

| Column           | Required? | Allowed values / format                                                  | Default           |
| ---------------- | --------- | ------------------------------------------------------------------------ | ----------------- |
| `name`           | **Yes**   | Any text, e.g. `Homemade Granola`                                        | —                 |
| `type`           | No        | `food` or `supplement`                                                   | `food`            |
| `is_custom`      | No        | `true`/`1`/`yes` ⇒ true (skips USDA, imports as custom)                  | `false`           |
| `is_favorite`    | No        | ignored — every row imports as a favorite                                | (always favorite) |
| `nutrient_basis` | No        | `per_100g` or `per_serving` — **custom rows only; leave blank for USDA** | `per_100g`        |

### Servings (`serving1_name`/`serving1_grams`, …`serving3_*`) + `default_serving`

- Optional named measures.
- `*_name` is free text (`1/2 cup`, `1 capsule`, `1 scoop`); `*_grams` is the weight of that measure in grams (numeric).
- Add as many of the three pairs as you need; leave the rest blank.
- For supplements, use the pill/scoop as the serving and put its actual weight (a small number like `0.3`) in grams.
- **For a USDA-matched food**, these are **extra** measures added on top of USDA's own household
  serving (e.g. "6 slices") — so add a `serving1_name=1 cup` only if your measure isn't USDA's. Leave
  them all blank to just get USDA's serving + the automatic `100 g`.
- **`default_serving`** — the measure preselected when you log this food. Must **exactly match one of
  your `servingN_name` values** (case-insensitive); anything else is ignored with a warning. Leave it
  **blank** to default to the USDA serving (matched foods) or the first serving you listed.

### `nutrient_basis` — what the nutrient numbers mean

- **USDA-matched rows ignore it** — USDA supplies its nutrients per 100 g, so **leave it blank** for any
  food you expect USDA to find. It only matters for custom rows (`is_custom=true`, Manual, or no match).
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

1. **Banana raw** — a USDA-matched `food` (no `is_custom`, blank `nutrient_basis`, no nutrient
   columns); adds a `1 medium` (118 g) serving on top of USDA's, and sets `default_serving = 1 medium`.
2. **Homemade Granola** — `is_custom=true`, so it imports as a custom `food` (`per_100g`) straight from
   the CSV with two named servings (default `1 cup`) — no USDA lookup.
3. **Vitamin D3 1000 IU** — `is_custom=true` `supplement`, `per_serving`, one capsule, `vitamin_d = 25` (µg).
4. **Magnesium Glycinate** — `is_custom=true` `supplement`, `per_serving`, two-capsule dose, `magnesium = 200` (mg).

Delete these rows before importing your own data (or keep them — they're valid).

---

## Importing the file

Import it in-app: **Wellness → Settings → Import → Import CSV Food** (enable **Bulk Food Import** first).
The sheet parses the file in the browser, matches each row against USDA (except `is_custom` rows),
shows a preview where you can **Change**/**Manual** any flagged row, then writes the `food` rows (with
the nutrient columns collapsed into the JSONB `nutrients` map), their `serving` rows, and the default
serving — all through the normal data layer, so it runs as you and respects RLS. Re-importing the same
file updates in place (see "Re-import overwrites" above).
