# 04 — Wellness Module

## Screens

### Dashboard (tab)

- Title `Daily average · {range} ▾`; the picker offers Last 7 Days (default), Last 2/3/4/8 Weeks, Last 3/6 Months, Last Year. The "daily average" divides totals by the number of **days that have at least one entry** in the range (not by calendar days). An empty range shows the shared centered **empty state** (Diary icon · "No entries yet" · "+ Diary").
  - The window list + default live in `src/constants/wellness-ranges.ts` (`WELLNESS_RANGES` + `WELLNESS_RANGE_DEFAULT`). These are **pure UI constants** — not persisted to any table — so editing them (add/remove/relabel windows, change counts, change the default) takes effect on reload with **no DB change and no other code change**. The default lives beside the list so the screen never hardcodes a key; just keep it pointing at one of the list's keys.
- **Energy Balance** card: Consumed, BMR, Activity, and a bold **Net = Consumed − BMR − Activity**.
- Nutrient sections in fixed order — General, Vitamins, Minerals, Carbohydrates, Lipids, Protein & Amino Acids — each visible nutrient a "name · value / target · %" bar. **Bars turn red when a value exceeds that nutrient's upper limit — but only for limits that apply to total dietary intake** (and sodium's CDRR). Limits that apply only to supplemental/synthetic forms (e.g. magnesium, niacin, folic acid, vitamin E, preformed vitamin A) never turn a food bar red. See "Upper limits / red bars" under Wellness Calculations below.
- Only nutrients toggled **Visible** (Settings → Visible Nutrients) appear.

### Diary (Wellness home tab)

- **Day header** — left-to-right: a **Daily Report** icon (top-left, `IconReportAnalytics`, opens the day's report); the centered `‹ date ›` nav (arrows step one day, tapping the date opens the **Calendar** modal); and a top-right cluster of **Delete · Copy · Paste** icons that act on the **whole day**. The Calendar injects per-day cue dots: one colour if food was logged, another if activity, both if both; a legend explains the dots.
- **Highlighted Nutrients**: a grid of up to 8 chosen nutrients (a 4×2 grid when 8 are chosen), each a name, % of target, and a thin progress bar (via `NutrientBar`'s **`compact`** variant — name + % only, so the % isn't crowded out by the full nutrient name in the narrow 2-col grid). Chosen in Settings → Highlighted Nutrients (max 8).
- **Diary groups, in order:** Breakfast, Lunch, Dinner, Snacks, Supplements, Activities. Each header reads, left-to-right: **expand chevron · category icon · group name · kcal subtotal** (kcal sits right next to the name; activities show negative kcal coral) · ⟨spacer⟩ · **Delete · Copy · Paste · Add** icons (`IconTrash` / `IconCopy` / `IconClipboard` / `IconPlus`). **Delete** is a `ConfirmDeleteAction` (inline `Delete? ✓ ✗`, no browser dialog) — as is the day-level Delete in the top-right header. Category icons use `cat-*` color tokens (see `docs/01_design_system.md` → Icons).
- **Default-expand on entry:** when a day's entries first load (on navigating to the Diary or picking another day), every group that **has items** auto-expands; empty groups stay collapsed. This runs **once per day** — later same-day refetches (after add/delete) never clobber a manual collapse. A **Paste** is the exception: it re-runs the auto-expand so the groups it just filled open. Expanded shows the logged entries; **tap an entry** to edit it (reopens Diary Food Detail / Diary Activity Detail with **RESET** + **SAVE**), **swipe-left** reveals Delete, and a **drag handle** reorders items within the group (the `ReorderList` component shared with Edit Trip; persisted via `diary_entry.sort_order`).

#### Copy / Paste (group- and day-level)

Copy granularity is a whole group or a whole day, via the header icons. The clipboard is an in-app, in-memory store (`src/lib/diary-clipboard.ts`) that survives sheets but not reloads; strength activities carry their `strength_set` rows.

- **Delete** (group or day) — clears that group's / the day's entries after a confirm. Disabled when there's nothing to delete.
- **Copy** (group or day) — replaces the clipboard with those entries (each remembers its **own** group). Fires a toast (e.g. "Copied Breakfast · 3 items"). Disabled when the source is empty.
- **Paste** — enabled whenever the clipboard holds any item (across a different group **and/or** day). A **group Paste** drops every clipboard item into the clicked group; a **day Paste** keeps each item's original group. Both are **additive** (never overwrite existing rows) and **one-shot** — the clipboard is cleared after a paste, so every Paste icon disables until the next Copy. Enabled Paste icons take an active tint (`text-positive`) while the clipboard holds items.

### Diary Food Picker (modal, from the Diary group's `+`)

- Search bar with a barcode-scan icon.
- Tabs: **Favorites** (hearted items, default), **Custom** (your items), **All** (combined USDA + your custom). Opening a food then backing out with **X** returns here with the active tab, search text, and results preserved; **ADD** instead closes both sheets and lands back on the Diary.
- **Matching is broad** — case-, punctuation-, singular/plural-insensitive and partial-typing-tolerant. USDA text search queries the whole-food databases (Foundation / SR Legacy / Survey FNDDS) and Branded foods as two separate pools; Branded duplicates (same name + brand) are collapsed and capped.
- Result rows are two lines: **line 1** is the food name (supplements with a pill icon) and a heart on the right; **line 2** shows the source tag (USDA / Custom / OFF) and `<n> nutrients · <serving>`. Results are ordered by name-match relevance then nutrient count. Your saved foods have an interactive heart to toggle favorite; raw USDA results do not have a heart and are favorited from **Diary Food Detail**.
- **Dedupe cached externals:** a USDA/OFF food the user already saved appears as a local row, so its live USDA twin (same `source:external_id`) is filtered out of the **All** results — no double listing, and the local row is the one that carries the custom servings/default.
- The barcode-scan button opens the camera scanner (lazy-loaded); a decoded EAN/UPC is looked up in Open Food Facts and opens **Food Detail**. Logging or favoriting saves the product into `food` (`source='off'`).

### Diary Food Detail (from Diary Food Picker)

- Top: `<` close · food name · **heart** (favorite toggle; rose `favorite` = favorited).
- Editable fields: **Amount**, **Serving Size** (dropdown), **Group** (pre-filled to the group tapped).
- **Complete Nutrient Summary**: every nutrient as "name · value / target · %", same bar style as the Dashboard, recomputing live as Amount/Serving change.
- **ADD** when logging a new item. When opened to **edit a logged entry**, the buttons are **RESET** + **SAVE** instead, both enabled only once a value changes; Amount and the serving are prefilled from the entry.
- **Resolve-to-cached-row on open (F22):** opening a USDA/OFF result first looks up the cached `food` row via `getFoodByExternal(source, externalId)` and, if found, loads **that** (its stored servings, default, favorite state, snapshot nutrients) instead of re-fetching the live API. Only a never-saved food falls back to `getUsdaFood`/`lookupBarcode`.

#### Manage Servings (Diary Food Detail)

A food's **servings** (reusable measures = name + grams) are distinct from **Amount** (the per-log quantity). The **Serving Size** dropdown picks which measure this log uses; **Manage Servings** (an accent-coloured toggle under the dropdown; reads **Hide Servings** when open) is where they're created/edited:

- Each row: a **default star** (`IconStarFilled` = the food's default measure), a name input, a grams input, and a delete (`IconTrash`); **+ Add Serving** appends a blank row. The default is marked `· default` in the dropdown and is preselected next time the food is opened
  (`food.default_serving_id`).
- **Persistence is deliberate, not incidental (F22):** the managed list is written to the DB **only when it's dirty** (a serving's name/grams or the default changed) — on **ADD**, the **heart**, or **SAVE**. Changing **Amount**, or just picking a different serving in the dropdown for one log, **never** writes back, so a one-off "ate more/less today" doesn't drift the stored default.
- Persisting replaces the food's `serving` rows (new ids each time) and re-points `default_serving_id` at the chosen row by position. Adding a custom serving to a never-saved USDA food creates its `food` row (the heart/ADD path), so the serving has somewhere to live.

### Diary Activity Picker (modal, from the Diary Activities `+`)

- Lists your available **Activities** and an Add button.
- Tapping an activity opens **Diary Activity Detail**, in one of two templates.

### Diary Activity Detail — duration type

- Effort Level picker (Light / Moderate / Vigorous): defaults to the activity's saved effort, but is **overridable per session**. Levels the activity has no MET for are disabled.
- Duration (minutes): prefilled from the activity's default duration.
- Energy Burned: auto-computed, read-only = MET × body-weight(kg) × hours. Shows the basis.
- Group defaults to **Activities**.
- **RESET** + **ADD** (logging). RESET enables only when something differs from the defaults. Editing a logged entry shows **RESET** + **SAVE**, both enabled only once changed.

### Diary Activity Detail — strength type

- Same **Effort Level** picker as duration.
- Duration (minutes, prefilled) → drives the energy estimate. Energy Burned = MET × body-weight(kg) × hours, MET resolved from `met_by_effort` at the chosen effort.
- **Exercises** list: each exercise expands to sets logged as reps × weight, with "Add set"; an "Add exercise" button builds the session. Sets persist to `strength_set` for progress tracking. Reps/weight are editable drafts that can be **emptied** while typing; **Add set duplicates the previous set's reps + weight**. Validation: for any **named** exercise every set needs **reps > 0** and **weight (kg) ≥ 0** (0 = bodyweight); an **unnamed** exercise is fine left blank (dropped on save) but is flagged if any reps/weight field has been filled in — so typed sets aren't silently lost.
- Group defaults to **Activities**. **RESET** + **ADD** (logging) or **RESET** + **SAVE** (editing); editing prefills duration, effort, and the exercise/set list from the entry.

### Daily Report (from the Diary day-header report icon)

Identical layout to the Dashboard, scoped to a single day instead of an averaged range.

### Library (Foods & Activities tab)

The bottom-nav tab is labelled **Foods & Activities**. The pinned top pane holds the sub-tab control + `SearchBar` only; the **`+ New Food`** / **`+ New Activity`** action sits at the **right edge of the "XX results" row** (below the pane), opposite the `ResultCount` — so it scrolls with the list rather than staying pinned. It's a `SecondaryButton` with an `IconPlus` + label — the shared **Add-button style** used app-wide.

Two sub-tabs:

- **Foods**: searchable list of **all** your foods — custom items **plus** the USDA/OFF rows cached from a favorite, log, or custom serving. Tapping a **custom** food opens **Edit Food** screen; tapping a **USDA/OFF** food opens Food Detail (to view/Manage its servings — they aren't editable as custom nutrient rows). **Swipe to delete** any of them (`deleteFoodSmart` — see below); `+ New Food` opens the **New Food** screen. Surfacing the cached USDA/OFF rows here gives them the **only** delete path they have (they're created silently by favoriting/logging/customizing and were previously undeletable). (The bulk CSV importer launcher lives in **Wellness Settings → Import**, not here — see Settings + Import CSV below.)
  - **`deleteFoodSmart`**: if any diary entry still references the food → **soft-delete** (preserve the entry's snapshot + FK, per the rule below); otherwise **hard-delete** so an unreferenced "phantom" leaves no tombstone (its `serving` rows cascade). Applies to custom and cached foods alike.
- **Activities**: list of your activities; tap to edit template + default effort/MET, swipe to delete; `+ New Activity` opens the **New Activity** screen.

### New / Edit Food

- **Type** toggle: Food / Supplement.
- Food Name.
- **Serving Sizes**: name + gram weight; "Add serving size" for multiple measures.
- **Nutrition shown per**: 100 g / serving (the storage basis).
- **Nutrition Facts**: the _complete_ nutrient set, grouped by category, each an input + unit, collapsible per section. (Supplements: leave Energy/macros blank, fill the relevant micros.)
- **RESET** + **CREATE** (new) / **SAVE** (editing). Enabled only when something changed; CREATE requires a name.

### New / Edit Activity

- Activity Name; optional Description.
- **Logging Template**: Duration (minutes + effort) or Strength (sets/reps/weight + duration).
- **Default Duration** (minutes): prefills the Duration field when logging this activity (default 30).
- **Default Effort**: Light (≤3 MET) / Moderate (3.1–5.9) / Vigorous (≥6) — applies to both templates; overridable per session when logging.
- **MET by effort**: for each effort level, an editable MET value; fill **at least one** level (the default effort must have a value; single-intensity activities need only one). Drives the calorie estimate via MET × weight × hours. In the Activity Log, effort levels with no MET are disabled.
- **Icon**: an icon picker (the keys of `ACTIVITY_ICONS`); optional, defaults to `IconRun`.
- Top-right: **RESET** + **CREATE** (new) / **SAVE** (editing). Enabled only when something changed; CREATE requires a name and a MET for the default effort.

### Settings (from the Settings tab in the Wellness bottom nav)

Wellness-module sub-settings. Auto-save on change.

- **TARGETS**: **Protein Target** is the only manual override field (auto-set from profile via DRI).
- **DISPLAY**:
  - **Highlighted Nutrients** → choose up to 8 shown on the Diary (the picker caps the selection at 8).
  - **Visible Nutrients** → per-nutrient toggle for what appears on the Dashboard & Daily Report.
- **IMPORT**: **Enable Bulk Food Import** toggle (`profile.food_importer_enabled`, **on by default**; column added to the `profile` table in `01_wellness_schema.sql`). When on: an **Import CSV Food** launcher opens the importer sheet, plus a **Clear Import Match Cache (N)** button (`clearFoodMatchCache` / `foodMatchCacheSize`)..

#### Import CSV (sheet, from Wellness Settings)

Reused CSV format: `templates/wellness-foods-template.csv` (guide: `templates/wellness-foods-import-guide.md`). Columns are all optional except `name` (`type` food|supplement, `is_custom`, `is_favorite`, `nutrient_basis` (custom rows only — blank/ignored for USDA), three `serving*` pairs, `default_serving`, and the nutrient columns). Uses `ImportPreviewList`:

- Each row is **matched against USDA** using the **same logic as Diary Diary Food Picker → All** (`searchFoods` + `foodMatchScore`); the best hit's score → status via `foodMatchStatus`: exact/leading-exact → **ok**, weaker → **review**, none → **No match**. Matched rows fetch full nutrients via `getUsdaFood`.
- **`is_custom=true` short-circuits matching** (`resolveRow`): the row skips USDA/OFF entirely (no request, no cache), resolves straight to a **custom** food (`status='manual'`), and needs no review — for foods the owner already knows USDA doesn't have.
- Preview rows show the USDA **name + "{N} nutrients · {serving}"** (like the live USDA list); \*\*No-match
  - review sort to the top** (danger/accent). **Change** opens the `FoodSearchOverlay` USDA overlay; **Manual\*\* keeps the row as a custom food. Concurrency `POOL` ≈ 6 (USDA ~1,000 req/hr).
- **Match cache** (`src/lib/food-match-cache.ts`, a `match-cache.ts` instance; key `normMatch(name)`, value = the resolved `ExternalFood`): re-importing the same file (after `supabase db reset --linked`) skips USDA entirely. **Change** overwrites, **Manual** removes; cleared via Settings → **Clear import match cache** (`OWNER_RUNBOOK.md` Part R).
- **Import** (`saveImportedFoods`): **every** row saved as a **favorite** (`is_favorite=true`, so USDA foods persist). Matched → `source='usda'` (per-100g, USDA nutrients); unmatched/Manual/`is_custom` → `source='custom'` from the CSV's nutrients/servings. **Idempotent** — USDA dedupe on (source, external_id), custom on `lower(name)`; re-running updates in place.
- **Servings + default (F22):** each food's `serving` rows = the USDA household serving (for matched rows, from `match.servingText/servingGrams`) **+** the CSV `serving*` measures; `default_serving_id` is set from the CSV `default_serving` (by name) → else the USDA serving → else the first serving. New rows resolve their default by position after the bulk serving insert, then set it in **one** bulk `food` upsert (full rows, so NOT NULL columns hold). **Re-import overwrites** an existing food's servings + default from the CSV (`applyImportServings`) — including USDA rows (previously their servings were untouched) — so in-app serving edits are replaced.

#### Visible Nutrients sub-screen

- All nutrients grouped (General & Protein, Vitamins, Minerals, Carbohydrates, Lipids), each a Visible toggle. Defaults on for the Phase-1 list (see Nutrient reference below), off for the rest.
- Protein also shows its editable Daily Target **inline beside the "Protein" label** (a `field-control` input, blank = DRI), not on a separate line. Items with sparse source data show a small "limited data" note.

---

## Wellness Calculations (implement as pure helpers in `src/lib`)

- **BMR (Mifflin–St Jeor):** `BMR = 10*kg + 6.25*cm − 5*age − 161` (female); use `+5` instead of `−161` for male.
- **Energy (calorie) target:** `BMR × activityFactor` (default 1.4, adjustable later). Do not hardcode.
- **Activity energy (duration):** `kcal = MET × kg × hours`. Logged as a negative diary entry.
- **Activity energy (strength):** same formula `kcal = MET × kg × hours`, where MET is resolved from `activity.met_by_effort[session_effort]`. No hardcoded MET for strength activities.
- **Net energy:** `Net = Consumed − BMR − Activity`. Activity rows are **stored** with a negative `diary_entry.energy_kcal` (see Data model), so a day's net is computed as a single signed sum of all entries' `energy_kcal` minus BMR — the formula above is the conceptual view of that signed sum.
- **Nutrient scaling:** for a logged entry, `value = nutrientPerBasis × (amount × servingGrams) / basisGrams`, where basis is 100 g (`basisGrams = 100`) or one serving (`basisGrams = the selected serving's grams`). Supplements typically use the per-serving basis; for a per-serving food the first/selected serving's grams define the basis.
- **Targets / DRI:** computed from profile via a lookup in `src/lib/dri.ts`. **Populated bands: adult female & male, 31–50 · 51–70 · 71+** (the lookup is keyed by sex/age band; ages under 31 / other sex values throw with an "add a band" message — `computeTargets` catches that and returns null, so the UI just shows no targets). **Protein target** is overridden by `profile.protein_target_g` when set, else the RDA. Nutrients with only an energy-percentage guideline get **energy-derived soft targets** computed from the day's energy target: `fat` (35% of kcal), `saturated` (10%), `added_sugars` (10%). `cholesterol`/`monounsaturated`/`polyunsaturated` have no target.
- **Upper limits / red bars:** each upper limit is **scope-tagged** (`total` | `cdrr` | `supplemental` | `guidance`). A bar turns red only when the value exceeds a limit whose scope is `total`, `cdrr` (sodium's chronic-disease-risk ceiling, 2300 mg), or `guidance` (e.g. added sugars > 10% kcal). Limits that apply only to supplemental/synthetic forms — magnesium (350), niacin (35), folic acid (1000), vitamin E (1000), preformed vitamin A (3000) — are stored for reference but **never** turn a food-intake bar red (a normal diet routinely exceeds them). Logic: `ulScope` in `src/lib/dri.ts` + `isOverUpperLimit` in `src/lib/nutrients.ts`.
- **Units:** stored metric; convert at display only via `src/lib/units.ts`. `1 oz = 28.3495 g`, `1 lb = 453.592 g`, `1 inch = 2.54 cm`, `1 fl oz = 29.5735 ml`. kcal/nutrient amounts are unit-independent. In Imperial mode, Settings shows height in inches and weight in lb (decimal); food nutrient amounts and the per-100 g basis are not re-expressed in imperial.

---

## External APIs (Wellness-only)

**USDA FoodData Central** (`api.nal.usda.gov/fdc/v1`): free `api.data.gov` key (`VITE_USDA_API_KEY`). Detail is `GET /food/{fdcId}`; amounts are per 100 g.

- **Serving size → grams (`usdaServingGrams`):** USDA reports `servingSize` in `servingSizeUnit`, usually `g` but sometimes a weight unit like `oz`/`lb` (e.g. "2 oz" pasta). Convert **weight** units to grams so the serving survives into Food Detail (previously only `g` was kept, so an `oz` serving was dropped and fell back to 100 g). Volume units (`ml`/`fl oz`) need a density we don't have, so they stay `null` — the user adds a custom serving instead. `householdServingFullText` (e.g. "6 slices", "2 oz") is the label; the gram value is the metric weight the nutrient math uses.

- **Search uses POST, not GET (F2):** `searchFoods` POSTs `/foods/search` with a JSON body — a GET whose `dataType` includes `"Survey (FNDDS)"` returns HTTP 400 (the space/parens) and yields stale `fdcId`s that then 404 on the detail endpoint.
- **Two POST searches, merged whole-foods-first (F6):** issue separate searches for the whole-food databases (`Foundation`/`SR Legacy`/`Survey (FNDDS)`) and `Branded`, then merge whole-foods-first — a single combined search ranks the thousands of identical Branded exact-name products above every varied whole-food entry. Branded duplicates (same name + brand) are collapsed and capped.
- **Stem-wildcard the last word (F6):** USDA matches **whole tokens**, so a partial word returns nothing — `searchFoods` wildcards the last word at a STEM (`food-search.ts#toUsdaWildcardQuery`, `blueberr*` not the raw word) so partial/plural input recalls the same set.
- **Result ranking — single-word vs multi-word (`foodMatchScore`):** for a **one-word** query, exact + leading-prefix matches share the top tier (4) so the nutrient-count tiebreak surfaces the fuller food (a bare "BLUEBERRIES" can't outrank "Blueberries, raw"). For a **multi-word** query — which usually names the whole food (Diary Food Picker typed name, or a CSV import row) — an **exact full name scores 5** and a **leading phrase 4**, both above the coarse "contains all tokens" tier (2). Without this, "Coffee, Latte" tied "Coffee, Iced Latte"/"…nonfat" (and "…with salt" tied "…without salt", since `with` prefix-matches `without`) at tier 2 and lost the nutrient/alphabetical tiebreak, burying the exact hit.
- **Plain-block results pane (F6):** the results scroll pane must be a plain block `flex-1 overflow-y-auto`, not a flex-col (which shrinks the results card — see tech-spec's **flex scroll pane** gotcha, F6c/F9).
- Map nutrients on the stable INFOODS **`nutrient.number`** (e.g. 208 energy kcal, 320 vitamin A µg RAE, 435 folate µg DFE, 328 vitamin D µg, 312 copper mg). When a USDA food is favorited or logged, cache a copy into `food` (`source`, `external_id`); plain search hits aren't persisted. Source of truth for nutrient mappings: `src/lib/food-api.ts`.

**Open Food Facts** (`world.openfoodfacts.org/api/v2/product/{barcode}.json`): free, global.

- **Every `*_100g` value is in grams** (including vitamins/minerals) → scale to our mg (×1000) / µg (×1e6).
- Sodium = `salt_100g / 2.5 × 1000` when `sodium_100g` is absent.
- All fields optional/sparse. Scanned products save into Custom.
- Source of truth for nutrient mappings (with per-field scale factor): `src/lib/off-api.ts`.

CJK-aware search (`searchZhVariants`) applies to USDA text search (see `docs/02_tech_spec.md` →
Shared external APIs).

---

## Data model

### `food` (custom items + cached USDA/Off items the user favorited or logged)

- `id` UUID PK · `user_id` UUID → auth.users
- `source` TEXT — 'usda' | 'off' | 'custom'
- `external_id` TEXT NULL — USDA fdcId or barcode
- `name` TEXT · `type` TEXT DEFAULT 'food' — 'food' | 'supplement'
- `nutrient_basis` TEXT DEFAULT 'per_100g' — 'per_100g' | 'per_serving'
- `nutrients` JSONB — `{ nutrient_key: amount }` relative to the basis; validated against the `nutrient` reference table at the data-access layer (`filterToKnownKeys`) so adding a tracked nutrient never needs a schema change
- `is_favorite` BOOLEAN DEFAULT false
- `default_serving_id` UUID NULL → serving (ON DELETE SET NULL) — the preselected measure when logging this food (set via Food Detail → Manage Servings). FK added **after** the `serving` table in the migration (circular dependency: `serving.food_id → food`). NULL ⇒ Food Detail defaults to the first serving. A per-log Amount/serving choice never writes this — only the Manage editor does.
- `deleted_at` TIMESTAMPTZ NULL — **soft delete**; NULL = active. Never hard-delete a food referenced by a diary entry (use `deleteFoodSmart`, which soft-deletes referenced foods and hard-deletes unreferenced "phantoms" — see Library). Library screens and Add sheets always filter `deleted_at IS NULL`.
- `created_at`, `updated_at`

### `serving` (a food's measures)

- `id` UUID PK · `food_id` UUID → food (ON DELETE CASCADE)
- `name` TEXT — e.g. '1 bowl', '1 cup', '1 capsule' · `grams` NUMERIC

### `activity` (the user's activity library)

- `id` UUID PK · `user_id` UUID → auth.users
- `name` TEXT · `description` TEXT NULL
- `template` TEXT — 'duration' | 'strength'
- `default_effort` TEXT — 'light' | 'moderate' | 'vigorous'
- `default_duration_min` NUMERIC NOT NULL DEFAULT 30
- `met_by_effort` JSONB — `{ "light": n, "moderate": n, "vigorous": n }`; at least one key required. Resolved MET for a session = `met_by_effort[session_effort]`. The default_effort must be a key in this map.
- `icon` TEXT NULL — Tabler icon component name (e.g. 'IconKarate'). Resolved at render time via `ACTIVITY_ICONS[icon]` in `src/constants/wellness.ts` (named imports only — do NOT use `import * as TablerIcons`). Null/unknown falls back to `IconRun`.
- `deleted_at` TIMESTAMPTZ NULL — **soft delete**. Never hard-delete an activity referenced by a diary entry.
- `created_at`, `updated_at`

### `diary_entry` (the log)

- `id` UUID PK · `user_id` UUID → auth.users
- `day` DATE — the logged day (no timestamp)
- `group_name` TEXT — 'breakfast'|'lunch'|'dinner'|'snacks'|'supplements'|'activities'
- `kind` TEXT — 'food' | 'activity'
- `food_id` UUID NULL → food (ON DELETE SET NULL)
- `activity_id` UUID NULL → activity (ON DELETE SET NULL)
- `serving_id` UUID NULL → serving (ON DELETE SET NULL)
- `amount` NUMERIC NULL · `duration_min` NUMERIC NULL · `effort` TEXT NULL — per-session override
- `energy_kcal` NUMERIC — negative for activities
- `label` TEXT — denormalized display name (snapshot; stable even after soft-delete of source)
- `nutrients` JSONB — snapshot of this entry's nutrient contribution (stable after soft-delete)
- `sort_order` NUMERIC NOT NULL DEFAULT 0 — manual order within a (`day`, `group_name`). Queries order by (`sort_order`, `created_at`). New rows get `Date.now()` (a large epoch value) so they append after any reordered rows; a drag (`reorderEntries`) renumbers a group's rows to small `0..n` indices, and `cloneEntriesToDay` stamps ascending values on pasted clones so they append in order.
- `created_at`, `updated_at`
- Index on (`user_id`, `day`).

**Snapshotting:** `diary_entry.nutrients`, `energy_kcal`, and `label` are computed and stored at log time. History stays stable even if a source food or activity is later soft-deleted; the FK columns (`food_id`, `activity_id`) are kept for the "log this again" feature and FK integrity, but the diary display never depends on them being non-null.

### `strength_set` (sets within a strength activity entry)

- `id` UUID PK · `entry_id` UUID → diary_entry (ON DELETE CASCADE)
- `exercise` TEXT — e.g. 'Chest Press' · `set_number` INT
- `reps` INT · `weight` NUMERIC · `weight_unit` TEXT

### `nutrient` (reference / seed — not user data; RLS on, read-only to clients)

- `key` TEXT PK — e.g. 'vitamin_d'
- `display_name` TEXT, `unit` TEXT
- `category` TEXT — 'general'|'protein'|'vitamins'|'minerals'|'carbohydrates'|'lipids'
- `parent_key` TEXT NULL — nesting (Fiber→carbs, Omega-3→polyunsaturated, amino acids→protein, etc.). A **DEFERRABLE INITIALLY DEFERRED** self-FK → `nutrient.key`, so the single multi-row seed insert validates at commit regardless of row order.
- `sort_order` INT · `default_visible` BOOLEAN · `has_upper_limit` BOOLEAN
- RLS enabled with a single SELECT policy for `authenticated` (no write policies; rows written only by migrations).

Migration: `supabase/migrations/01_wellness_schema.sql`.

---

## Seed data

### Activity library (seed at first login alongside the profile)

| Name                   | Template | Default duration | Default effort | MET by effort                               | Description                               | Icon            |
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

### Nutrient reference (seed the `nutrient` table — exactly 80 rows)

`Visible = yes` = `default_visible true`. `UL` = `has_upper_limit true`. `sort_order` follows row order in steps of 10. DRI target/UL numeric values are looked up by age/sex in `src/lib/dri.ts`, not stored here.

#### General

| key      | name     | unit | Visible | UL  |
| -------- | -------- | ---- | ------- | --- |
| energy   | Energy   | kcal | yes     | —   |
| water    | Water    | g    | yes     | —   |
| alcohol  | Alcohol  | g    | no      | —   |
| caffeine | Caffeine | mg   | no      | —   |

#### Protein & Amino Acids (category: protein; amino acids carry `parent_key = 'protein'`)

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

#### Carbohydrates

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

#### Lipids

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

#### Vitamins

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

#### Minerals

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

### DRI target/UL values (by sex/age band)

Transcribed from the **NASEM/IOM Dietary Reference Intakes** (NIH ODS consolidated tables, NCBI Bookshelf **NBK545442**, incl. the 2011 Ca/Vitamin D and 2019 Na/K updates). **Target** = RDA where one exists, else AI. Six bands populated — **adult female & male, each 31–50 · 51–70 · 71+**. `getDriForProfile` throws for ages under 31 or any other `sex` value (UI then shows no targets).

#### Upper-limit scope (`ulScope`)

- `total` — UL applies to total intake; **fires red** when exceeded.
- `cdrr` — sodium's Chronic-Disease-Risk-Reduction ceiling (2300 mg); **fires red**.
- `guidance` — energy-% guideline ceiling (added sugars); **fires red**.
- `supplemental` — UL applies only to supplemental/synthetic form; **never fires red** on food intake.

#### Adult female 51–70 (`FEMALE_51_70` — the reference band)

| key        | target | type | UL   | ulScope      | notes                                                                                          |
| ---------- | ------ | ---- | ---- | ------------ | ---------------------------------------------------------------------------------------------- |
| water      | 2700   | AI   | —    | —            | g, total water                                                                                 |
| protein    | 46     | RDA  | —    | —            | overridden by `profile.protein_target_g`                                                       |
| carbs      | 130    | RDA  | —    | —            |                                                                                                |
| fiber      | 21     | AI   | —    | —            |                                                                                                |
| omega3     | 1.1    | AI   | —    | —            | ALA                                                                                            |
| omega6     | 11     | AI   | —    | —            | linoleic acid                                                                                  |
| vitamin_a  | 700    | RDA  | 3000 | supplemental | µg RAE; UL is preformed retinol only, not carotenoids                                          |
| vitamin_c  | 75     | RDA  | 2000 | total        |                                                                                                |
| vitamin_d  | 15     | RDA  | 100  | total        | µg (600 IU target / 4000 IU UL)                                                                |
| vitamin_e  | 15     | RDA  | 1000 | supplemental | UL = supplemental α-tocopherol only                                                            |
| vitamin_k  | 90     | AI   | —    | —            |                                                                                                |
| b1         | 1.1    | RDA  | —    | —            | thiamin                                                                                        |
| b2         | 1.1    | RDA  | —    | —            | riboflavin                                                                                     |
| b3         | 14     | RDA  | 35   | supplemental | mg NE target; UL is supplemental niacin (mg), not NE                                           |
| b5         | 5      | AI   | —    | —            |                                                                                                |
| b6         | 1.5    | RDA  | 100  | total        |                                                                                                |
| b12        | 2.4    | RDA  | —    | —            |                                                                                                |
| folate     | 400    | RDA  | 1000 | supplemental | µg DFE target; UL is synthetic folic acid only                                                 |
| b7         | 30     | AI   | —    | —            | biotin                                                                                         |
| choline    | 425    | AI   | 3500 | total        |                                                                                                |
| calcium    | 1200   | RDA  | 2000 | total        |                                                                                                |
| copper     | 0.9    | RDA  | 10   | total        | **mg** (app stores copper in mg, not µg)                                                       |
| iodine     | 150    | RDA  | 1100 | total        | µg                                                                                             |
| iron       | 8      | RDA  | 45   | total        | postmenopausal RDA (8, not 18)                                                                 |
| magnesium  | 320    | RDA  | 350  | supplemental | UL = supplemental Mg only; dietary Mg routinely exceeds it                                     |
| manganese  | 1.8    | AI   | 11   | total        |                                                                                                |
| phosphorus | 700    | RDA  | 4000 | total        |                                                                                                |
| potassium  | 2600   | AI   | —    | —            | 2019 value (not the old 4700)                                                                  |
| selenium   | 55     | RDA  | 400  | total        | µg                                                                                             |
| sodium     | 1500   | AI   | 2300 | cdrr         | no classical UL; 2300 is the CDRR ceiling                                                      |
| zinc       | 8      | RDA  | 40   | total        |                                                                                                |
| chromium   | 20     | AI   | —    | —            | µg                                                                                             |
| fluoride   | 3      | AI   | 10   | total        | mg                                                                                             |
| molybdenum | 45     | RDA  | 2000 | total        | µg                                                                                             |
| chloride   | 2300   | AI   | 3600 | total        | mg. Some tables print 2.0 g; the established value is 2.3 g (2300 mg) — verify against source. |

Energy is shown against the **computed** target (BMR × activity factor), not a DRI constant. Nutrients not listed (amino acids, individual fatty acids, starch/sugars, alcohol, caffeine, cholesterol, monounsaturated/polyunsaturated) have **no target**.

#### Adult female 31–50 deltas (`FEMALE_31_50`) — spreads `FEMALE_51_70`, overrides only:

| key      | 31–50          | 51–70          | why                                       |
| -------- | -------------- | -------------- | ----------------------------------------- |
| iron     | 18             | 8              | premenopausal iron need                   |
| calcium  | 1000 / UL 2500 | 1200 / UL 2000 | RDA lower; the UL drops to 2000 mg at 51  |
| fiber    | 25             | 21             | AI (14 g/1000 kcal, higher median energy) |
| omega6   | 12             | 11             | linoleic-acid AI                          |
| b6       | 1.3            | 1.5            | RDA rises to 1.5 at 51                    |
| chromium | 25             | 20             | AI                                        |

#### Adult female 71+ deltas (`FEMALE_71_PLUS`) — spreads `FEMALE_51_70`:

| key        | 71+           | 51–70         | why                       |
| ---------- | ------------- | ------------- | ------------------------- |
| vitamin_d  | 20            | 15            | RDA rises to 800 IU at 71 |
| phosphorus | 700 / UL 3000 | 700 / UL 4000 | UL drops to 3000 mg at 71 |

#### Adult male 51–70 (`MALE_51_70`) — full band (ULs are not sex-specific); lists every value that differs from the female 51–70 reference:

| key       | male 51–70 | female 51–70 | type | notes                                    |
| --------- | ---------- | ------------ | ---- | ---------------------------------------- |
| water     | 3700       | 2700         | AI   | g, total water                           |
| protein   | 56         | 46           | RDA  | overridden by `profile.protein_target_g` |
| fiber     | 30         | 21           | AI   |                                          |
| omega3    | 1.6        | 1.1          | AI   | ALA                                      |
| omega6    | 14         | 11           | AI   | linoleic acid                            |
| vitamin_a | 900        | 700          | RDA  | µg RAE (UL 3000 supplemental, same)      |
| vitamin_c | 90         | 75           | RDA  | UL 2000 total (same)                     |
| vitamin_k | 120        | 90           | AI   |                                          |
| b1        | 1.2        | 1.1          | RDA  | thiamin                                  |
| b2        | 1.3        | 1.1          | RDA  | riboflavin                               |
| b3        | 16         | 14           | RDA  | mg NE (UL 35 supplemental, same)         |
| b6        | 1.7        | 1.5          | RDA  | UL 100 total (same)                      |
| choline   | 550        | 425          | AI   | UL 3500 total (same)                     |
| calcium   | 1000       | 1200         | RDA  | UL 2000 total (same)                     |
| magnesium | 420        | 320          | RDA  | UL 350 supplemental (same)               |
| manganese | 2.3        | 1.8          | AI   | UL 11 total (same)                       |
| potassium | 3400       | 2600         | AI   | 2019 value                               |
| zinc      | 11         | 8            | RDA  | UL 40 total (same)                       |
| chromium  | 30         | 20           | AI   | µg                                       |
| fluoride  | 4          | 3            | AI   | UL 10 total (same)                       |

All other keys (carbs, vitamin_d, vitamin_e, b5, b12, folate, b7, copper, iodine, iron 8,
phosphorus, selenium, sodium, molybdenum, chloride) match `FEMALE_51_70` exactly.

#### Adult male 31–50 deltas (`MALE_31_50`) — spreads `MALE_51_70`:

| key      | 31–50          | 51–70          | why                                             |
| -------- | -------------- | -------------- | ----------------------------------------------- |
| fiber    | 38             | 30             | AI                                              |
| omega6   | 17             | 14             | linoleic-acid AI                                |
| b6       | 1.3            | 1.7            | RDA rises to 1.7 at 51                          |
| calcium  | 1000 / UL 2500 | 1000 / UL 2000 | RDA stays 1000 till 71; only the UL drops at 51 |
| chromium | 35             | 30             | AI                                              |

#### Adult male 71+ deltas (`MALE_71_PLUS`) — spreads `MALE_51_70`:

| key        | 71+           | 51–70         | why                          |
| ---------- | ------------- | ------------- | ---------------------------- |
| vitamin_d  | 20            | 15            | RDA rises to 800 IU at 71    |
| calcium    | 1200          | 1000          | male calcium RDA rises at 71 |
| phosphorus | 700 / UL 3000 | 700 / UL 4000 | UL drops to 3000 mg at 71    |

#### Energy-derived soft targets

| key          | target = % of energy | kcal/g | red bar?         | basis                                      |
| ------------ | -------------------- | ------ | ---------------- | ------------------------------------------ |
| fat          | 35%                  | 9      | no               | AMDR 20–35% (we use the top as the target) |
| saturated    | 10%                  | 9      | no               | DGA "< 10% of energy"                      |
| added_sugars | 10%                  | 4      | yes (`guidance`) | DGA "< 10% of energy"                      |

#### How to add a DRI band

To add another band (e.g. `female:19-30`), add a `Record<string, StaticDri>` — spread the nearest band and override only the values that differ — register it in `DRI_TABLES`, and extend `bandFor(sex, age)` in `src/lib/dri.ts`. No schema or UI change needed.
