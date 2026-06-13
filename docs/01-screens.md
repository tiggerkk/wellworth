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
- **Highlighted Nutrients**: a 4×2 grid of 8 chosen nutrients, each a name, % of target, and a thin
  progress bar. The 8 are chosen in Settings → Highlighted Nutrients.
- Groups (Breakfast … Activities): each header has a green `+` (add into that group), a kcal subtotal
  (activities show negative kcal in coral), and a chevron. **Collapsed by default.** Expanded shows
  the logged entries. **Swipe-left** on an entry reveals Delete.
- Top-right `⋯` menu: View Daily Report · Copy to Today (only if a day was copied) · Copy Current Day · Copy Previous Day.

## Calendar (modal, from the Diary date)

- Month grid with `‹ ›` to change month; today circled in coral.
- Per-day cue dots: one color if food was logged, another if activity was logged, both if both.
- Legend explaining the dots; **Cancel** / **OK**.

## Add Food (modal, from a group's `+`)

- Search bar with a barcode-scan icon; a filter/sort control.
- Tabs: **All** (combined USDA + your custom), **Favorites** (hearted items), **Custom** (your items).
- Result rows: name, serving, source tag (USDA / Custom / Off for Open Food Facts); a heart marks
  favorites inline. Tapping a row opens **Food Detail**.
- Barcode scan looks the product up in Open Food Facts; you may save the result into Custom.

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
  **overridable per session**.
- Duration (minutes).
- Energy Burned: auto-computed, read-only = MET × body-weight(kg) × hours. Shows the basis.
- Group defaults to **Activities**.
- Bottom: **ADD TO DIARY**.

## Activity Log — strength type

- Duration (minutes) → drives the energy estimate; Energy Burned auto-computed (MET 5.5).
- **Exercises** list: each exercise expands to sets logged as reps × weight, with "Add set"; an
  "Add exercise" button builds the session. Sets persist to `strength_set` for progress tracking.
- Group defaults to **Activities**. Bottom: **ADD TO DIARY**.

## Dashboard (tab)

- Title `Daily average · {range} ▾`; the picker offers Last 7 Days (default), Last 2/3/4/8 Weeks,
  Last 3/6 Months, Last Year.
- **Energy Balance** card: Consumed, BMR, Activity, and a bold **Net = Consumed − BMR − Activity**.
- Nutrient sections in fixed order — General, Vitamins, Minerals, Carbohydrates, Lipids,
  Protein & Amino Acids — each visible nutrient a "name · value / target · %" bar.
  **Bars turn red when a value exceeds that nutrient's DRI upper limit.**
- Only nutrients toggled **Visible** (Settings → Visible Nutrients) appear.

## Daily Report (from the Diary `⋯`)

- Identical layout to the Dashboard, scoped to a single day instead of an averaged range.

## Library (tab)

Two sub-tabs:

- **Foods**: searchable list of your custom foods and supplements; tap a row to edit, swipe to delete;
  `+ New Food` opens the form. Supplements show a "supplement" tag.
- **Activities**: list of your activities; tap a row to edit template + default effort/MET, swipe to delete; `+ New Activity` opens the form.

### New Food (form)

- **Type** toggle: Food / Supplement.
- Food Name.
- **Serving Sizes**: name + gram weight; "Add serving size" for multiple measures.
- **Nutrition shown per**: 100 g / serving (the storage basis).
- **Nutrition Facts**: the _complete_ nutrient set, grouped by category, each an input + unit,
  collapsible per section. (Supplements: leave Energy/macros blank, fill the relevant micros.)
- **Save** top-right.

### New Activity (form)

- Activity Name; optional Description.
- **Logging Template**: Duration (minutes + effort) or Strength (sets/reps/weight + duration).
- **Default Effort**: Light (<3 MET) / Moderate (3–5.9) / Vigorous (≥6) — applies to both Duration and Strength templates; overridable per session when logging.
- **MET by effort**: for each effort level selected above, an editable MET value is shown and can be fine-tuned. Single-intensity activities need only one level filled in; the default effort must have a value. Drives the calorie estimate via MET × weight × hours.- **Save** top-right.

## Settings (tab)

- **PROFILE**: Birthday, Sex, Height, Weight (all editable).
- **TARGETS** (auto-set from profile via DRI): **Protein Target** is the only manual override field.
- **VISIBILITY**:
  - **Highlighted Nutrients** → choose the 8 shown on the Diary.
  - **Visible Nutrients** → per-nutrient toggle for what appears on the Dashboard & Daily Report.
- **ACCOUNT**: **Units** (Metric / Imperial — editable; display-only, DB stays metric), Google account,
  Sign out.

### Visible Nutrients sub-screen

- All nutrients grouped (General & Protein, Vitamins, Minerals, Carbohydrates, Lipids), each a Visible
  toggle. Defaults on for the Phase-1 list (see seed data), off for the rest.
- Protein also shows its editable Daily Target here. No other per-nutrient targets and no max-threshold fields are exposed. Items with sparse source data show a small "limited data" note.
