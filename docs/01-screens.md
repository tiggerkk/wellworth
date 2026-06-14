# 01 — Screens (Functional Spec)

## Navigation

Bottom tab bar with four tabs: **Diary**, **Dashboard**, **Library**, **Settings**.
Modals (sheets) slide up over these: Calendar, Add Food, Food Detail, Add Activity, Activity Log,
New Food, New Activity.

Diary groups, in order: **Breakfast, Lunch, Dinner, Snacks, Supplements, Activities**.

## Button convention

| Screen type                                              | Top-right | Bottom              |
| -------------------------------------------------------- | --------- | ------------------- |
| Form screens (New Food, New Activity, edit Library item) | **Save**  | —                   |
| Logging screens (Food Detail, Activity Log)              | —         | **ADD TO DIARY**    |
| Settings sub-screens                                     | —         | auto-save on change |

---

## Diary (home tab)

- Header `‹ Today ›`: left/right arrows step one day; tapping the date opens the **Calendar** modal.
- **Highlighted Nutrients**: a grid of up to 8 chosen nutrients (a 4×2 grid when 8 are chosen), each a
  name, % of target, and a thin progress bar. Chosen in Settings → Highlighted Nutrients (max 8).
- Groups (Breakfast … Activities): each header has a green `+` (add into that group), a kcal subtotal
  (activities show negative kcal in coral), and a chevron. **Collapsed by default.** Expanded shows
  the logged entries. **Swipe-left** on an entry reveals Delete.
- Top-right `⋯` menu: View Daily Report · Copy to Today (only if a day was copied) · Copy Current Day · Copy Previous Day. (Copy clones the day's food/activity entries with their stored snapshots; it does not duplicate individual `strength_set` rows.)

## Calendar (modal, from the Diary date)

- Month grid with `‹ ›` to change month; today circled in coral.
- Per-day cue dots: one color if food was logged, another if activity was logged, both if both.
- Legend explaining the dots; **Cancel** / **OK**.

## Add Food (modal, from a group's `+`)

- Search bar with a barcode-scan icon; a filter/sort control.
- Tabs: **Favorites** (hearted items, default), **Custom** (your items), **All** (combined USDA + your custom).
  Selecting a food and returning (X / ADD TO DIARY) preserves the active tab, search text, and results.
- Result rows: name, serving, source tag (USDA / Custom / Off for Open Food Facts). Your saved
  foods (Favorites / Custom) show an inline heart to toggle favorite; raw USDA search results are
  favorited from **Food Detail** (the heart there), since they aren't cached until favorited or
  logged. Tapping a row opens **Food Detail**.
- The barcode-scan button opens the camera scanner (lazy-loaded); a decoded EAN/UPC is looked up in
  Open Food Facts and opens **Food Detail**. Logging or favoriting saves the product into the `food`
  table (`source='off'`).

## Food Detail (logging screen)

- Top: `X` close · food name · **heart** (favorite toggle; coral = favorited).
- Editable fields: **Amount**, **Serving Size** (dropdown), **Group** (pre-filled to the group tapped).
- **Complete Nutrient Summary**: every nutrient as "name · value / target · %", same bar style as the
  Dashboard, recomputing live as Amount/Serving change.
- Bottom: **ADD TO DIARY**.

## Add Activity (modal, from the Activities `+`)

- Opens your **Activity Library** directly (your activities + an Add button) — no big category drill-down.
- Tapping an activity opens **Activity Log**, in one of two templates.

## Activity Log — duration type

- Effort Level picker (Light / Moderate / Vigorous): defaults to the activity's saved effort, but is
  **overridable per session** — any level is selectable; if the chosen level has no MET defined, the
  activity's default-effort MET is used.
- Duration (minutes): prefilled from the activity's default duration.
- Energy Burned: auto-computed, read-only = MET × body-weight(kg) × hours. Shows the basis.
- Group defaults to **Activities**.
- Bottom: **RESET** (effort/duration/exercises back to defaults) + **ADD TO DIARY**.

## Activity Log — strength type

- Same **Effort Level** picker as duration (defaults to the activity's, overridable per session).
- Duration (minutes, prefilled from the default) → drives the energy estimate. Energy Burned =
  MET × body-weight(kg) × hours, MET resolved from `met_by_effort` at the chosen effort (with the
  default-effort MET as fallback). No hardcoded MET.
- **Exercises** list: each exercise expands to sets logged as reps × weight, with "Add set"; an
  "Add exercise" button builds the session. Sets persist to `strength_set` for progress tracking.
- Group defaults to **Activities**. Bottom: **RESET** + **ADD TO DIARY**.

## Dashboard (tab)

- Title `Daily average · {range} ▾`; the picker offers Last 7 Days (default), Last 2/3/4/8 Weeks,
  Last 3/6 Months, Last Year. The "daily average" divides totals by the number of **days that have at
  least one entry** in the range (not by calendar days) — a typical logged day. An empty range shows
  "Nothing logged."
- **Energy Balance** card: Consumed, BMR, Activity, and a bold **Net = Consumed − BMR − Activity**.
- Nutrient sections in fixed order — General, Vitamins, Minerals, Carbohydrates, Lipids,
  Protein & Amino Acids — each visible nutrient a "name · value / target · %" bar.
  **Bars turn red when a value exceeds that nutrient's upper limit — but only for limits that apply
  to total dietary intake** (and sodium's CDRR). Limits that apply only to supplemental/synthetic
  forms (e.g. magnesium, niacin, folic acid, vitamin E, preformed vitamin A) never turn a food bar
  red. See `02-tech-spec.md` → "Upper limits / red bars".
- Only nutrients toggled **Visible** (Settings → Visible Nutrients) appear.

## Daily Report (from the Diary `⋯`)

- Identical layout to the Dashboard, scoped to a single day instead of an averaged range.

## Library (tab)

Two sub-tabs:

- **Foods**: searchable list of your custom foods and supplements; tap a row to edit, swipe to delete;
  `+ New Food` opens the form. Supplements show a "supplement" tag. `Import CSV` opens the bulk
  importer (parses a CSV in-browser and inserts custom foods/supplements + servings via the data
  layer; format in `templates/custom-foods-template.csv`, documented in
  `templates/custom-foods-import-guide.md`).
- **Activities**: list of your activities; tap a row to edit template + default effort/MET, swipe to delete; `+ New Activity` opens the form.

### New Food (form)

- **Type** toggle: Food / Supplement.
- Food Name.
- **Serving Sizes**: name + gram weight; "Add serving size" for multiple measures.
- **Nutrition shown per**: 100 g / serving (the storage basis).
- **Nutrition Facts**: the _complete_ nutrient set, grouped by category, each an input + unit,
  collapsible per section. (Supplements: leave Energy/macros blank, fill the relevant micros.)
- Bottom: full-width **ADD FOOD** (new) / **SAVE FOOD** (editing) button (enabled once there's a name).

### New Activity (form)

- Activity Name; optional Description.
- **Logging Template**: Duration (minutes + effort) or Strength (sets/reps/weight + duration).
- **Default Duration** (minutes): prefills the Duration field when logging this activity (default 30).
- **Default Effort**: Light (≤3 MET) / Moderate (3.1–5.9) / Vigorous (≥6) — applies to both Duration and Strength templates; overridable per session when logging.
- **MET by effort**: for each effort level, an editable MET value; fill **at least one** level (the
  default effort must have a value; single-intensity activities need only one). Drives the calorie
  estimate via MET × weight × hours. In the Activity Log, effort levels with no MET are disabled.
- **Icon**: an icon picker (the keys of `ACTIVITY_ICONS`); optional, defaults to `IconRun`.
- Bottom: full-width **ADD ACTIVITY** (new) / **SAVE ACTIVITY** (editing) button (enabled once there's
  a name and a MET value for the default effort).

## Settings (tab)

- **PROFILE**: Birthday, Sex, Height, Weight (all editable).
- **TARGETS** (auto-set from profile via DRI): **Protein Target** is the only manual override field.
- **DISPLAY**:
  - **Highlighted Nutrients** → choose up to 8 shown on the Diary (the picker caps the selection at 8).
  - **Visible Nutrients** → per-nutrient toggle for what appears on the Dashboard & Daily Report.
- **ACCOUNT**: **Units** (Metric / Imperial — editable; display-only, DB stays metric), Google account,
  Sign out.

### Visible Nutrients sub-screen

- All nutrients grouped (General & Protein, Vitamins, Minerals, Carbohydrates, Lipids), each a Visible
  toggle. Defaults on for the Phase-1 list (see seed data), off for the rest.
- Protein also shows its editable Daily Target here. No other per-nutrient targets and no max-threshold fields are exposed. Items with sparse source data show a small "limited data" note.
