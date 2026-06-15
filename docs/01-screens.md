# 01 — Screens (Functional Spec)

## Navigation

The app opens to a **Home hub** — a launcher of module cards (Wellness, Net Worth; more later).
Selecting a module enters it and the **bottom tab bar becomes that module's tabs**, with a **Home**
item to return to the hub. On launch the app reopens the **last-used module**, so daily Wellness use
skips the hub.

- **Wellness** tabs: **Diary**, **Dashboard**, **Library**, **Home**. A **gear** in each Wellness
  header opens Wellness Settings.
- **Net Worth** tabs: **Dashboard**, **Monthly Entry**, **Home** (Phase 2).
- **Settings is global**, reached from a gear on the Home hub (profile, units, account — app-wide).
  Wellness-specific settings (protein target, nutrient display) live in **Wellness Settings**.

Routing is URL-namespaced per module (`/wellness/*`, `/networth/*`); a future module drops in as a
card + routes with no structural change. Modals (sheets) slide up over a module's tabs: Calendar,
Add Food, Food Detail, Add Activity, Activity Log, New Food, New Activity.

Diary groups, in order: **Breakfast, Lunch, Dinner, Snacks, Supplements, Activities**.

## Button convention

| Screen type                                              | Top-right | Bottom              |
| -------------------------------------------------------- | --------- | ------------------- |
| Form screens (New Food, New Activity, edit Library item) | **Save**  | —                   |
| Logging screens (Food Detail, Activity Log)              | —         | **ADD TO DIARY**    |
| Settings sub-screens                                     | —         | auto-save on change |

---

## Diary (Wellness home tab)

- Header `‹ Today ›`: left/right arrows step one day; tapping the date opens the **Calendar** modal.
- **Highlighted Nutrients**: a grid of up to 8 chosen nutrients (a 4×2 grid when 8 are chosen), each a
  name, % of target, and a thin progress bar. Chosen in Settings → Highlighted Nutrients (max 8).
- Groups (Breakfast … Activities): each header reads, left-to-right, **expand chevron · category icon ·
  group name · kcal subtotal** (activities show negative kcal in coral), with the green **`+`** (add into
  that group) on the **right**. Category icons: a red apple for Breakfast/Lunch/Dinner, an orange cookie
  for Snacks, a purple pill for Supplements, a blue runner for Activities. **Collapsed by default.**
  Expanded shows the logged entries. **Tap an entry** to edit it (reopens Food Detail / Activity Log on
  the entry, with **RESET** + **SAVE**); **swipe-left** reveals Delete.
- Top-right `⋯` menu:
  - **View Daily Report** — opens the day's report.
  - **Multi-Select** — shows a checkbox before each logged entry (and expands all groups). Pick one or
    more, then reopen the `⋯` menu and choose **Copy** to copy them to an in-app clipboard (strength
    activities carry their `strength_set` rows); **Cancel** exits the mode.
  - **Paste** — shown only when the clipboard holds entries copied from a **different** day; **adds**
    them to the day in view (does not replace existing entries) and stays on that day.
  - **Delete All Diary Entries** — clears the day's entries after a confirm.

## Calendar (modal, from the Diary date)

- Month grid with `‹ ›` to change month; today circled in coral.
- Per-day cue dots: one color if food was logged, another if activity was logged, both if both.
- Legend explaining the dots; **Cancel** / **OK**.

## Add Food (modal, from a group's `+`)

- Search bar with a barcode-scan icon.
- Tabs: **Favorites** (hearted items, default), **Custom** (your items), **All** (combined USDA + your custom).
  Opening a food then backing out with **X** returns here with the active tab, search text, and results
  preserved; **ADD TO DIARY** instead closes both sheets and lands back on the **Diary** (you don't pass
  back through this picker).
- **Matching is broad** — case-, punctuation-, singular/plural-insensitive and partial-typing-tolerant
  (so "blueberr" and "blueberri" already match "blueberry"/"blueberries") — a "Blueberries" search
  returns "Blueberries, raw", "Muffins, blueberry", etc., not just the exact name. USDA text
  search queries the whole-food databases (Foundation / SR Legacy / Survey FNDDS) and Branded foods
  as two separate pools so the thousands of identical Branded exact-name products can't bury the
  varied whole-food results; Branded duplicates (same name + brand) are collapsed and capped.
- Result rows are two lines: **line 1** is the food name (wraps to multiple lines) with a heart on
  the right; **line 2** shows `<n> nutrients · <serving>` on the left and the source tag (USDA /
  Custom / OFF for Open Food Facts) on the right. Results are ordered by how well the name matches
  the query, then by nutrient count (descending) — and because exact and leading-prefix matches share
  a tier, the nutrient count decides between them (a bare "BLUEBERRIES" won't outrank a richer
  "Blueberries, raw"). Your saved foods
  (Favorites / Custom) have an interactive heart to toggle favorite; raw USDA results show a
  non-interactive heart and are favorited from **Food Detail** (they aren't cached until favorited or
  logged). Tapping a row opens **Food Detail**.
- The barcode-scan button opens the camera scanner (lazy-loaded); a decoded EAN/UPC is looked up in
  Open Food Facts and opens **Food Detail**. Logging or favoriting saves the product into the `food`
  table (`source='off'`).

## Food Detail (logging screen)

- Top: `X` close · food name · **heart** (favorite toggle; coral = favorited).
- Editable fields: **Amount**, **Serving Size** (dropdown), **Group** (pre-filled to the group tapped).
- **Complete Nutrient Summary**: every nutrient as "name · value / target · %", same bar style as the
  Dashboard, recomputing live as Amount/Serving change.
- Bottom: **ADD TO DIARY** when logging a new item. When opened to **edit a logged entry** (tapped from
  the Diary), the footer is **RESET** + **SAVE** instead, both enabled only once a value changes; the
  Amount and the serving are prefilled from the entry.

## Add Activity (modal, from the Activities `+`)

- Opens your **Activity Library** directly (your activities + an Add button) — no big category drill-down.
- Tapping an activity opens **Activity Log**, in one of two templates.

## Activity Log — duration type

- Effort Level picker (Light / Moderate / Vigorous): defaults to the activity's saved effort, but is
  **overridable per session**. Levels the activity has no MET for are disabled.
- Duration (minutes): prefilled from the activity's default duration.
- Energy Burned: auto-computed, read-only = MET × body-weight(kg) × hours. Shows the basis.
- Group defaults to **Activities**.
- Bottom: **RESET** + **ADD TO DIARY** (logging). RESET enables only when something differs from the
  defaults. Editing a logged entry instead shows **RESET** + **SAVE**, both enabled only once changed.

## Activity Log — strength type

- Same **Effort Level** picker as duration (defaults to the activity's, overridable per session).
- Duration (minutes, prefilled from the default) → drives the energy estimate. Energy Burned =
  MET × body-weight(kg) × hours, MET resolved from `met_by_effort` at the chosen effort. No hardcoded MET.
- **Exercises** list: each exercise expands to sets logged as reps × weight, with "Add set"; an
  "Add exercise" button builds the session. Sets persist to `strength_set` for progress tracking.
  Reps/weight are editable drafts that can be **emptied** while typing; **Add set duplicates the
  previous set's reps + weight** (a new set is usually the same load). Validation (inline error +
  ADD TO DIARY / SAVE disabled): for any **named** exercise every set needs **reps > 0** and
  **weight (kg) ≥ 0** (0 = bodyweight); an **unnamed** exercise is fine left blank (dropped on save)
  but is flagged if any reps/weight field has been filled in — so typed sets aren't silently lost.
- Group defaults to **Activities**. Bottom: **RESET** + **ADD TO DIARY** (logging) or **RESET** + **SAVE**
  (editing a logged entry); editing prefills duration, effort, and the exercise/set list from the entry.

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
- Bottom: **RESET** + **ADD FOOD** (new) / **SAVE FOOD** (editing). RESET (and, when editing, SAVE) are
  enabled only when something changed; ADD requires a name.

### New Activity (form)

- Activity Name; optional Description.
- **Logging Template**: Duration (minutes + effort) or Strength (sets/reps/weight + duration).
- **Default Duration** (minutes): prefills the Duration field when logging this activity (default 30).
- **Default Effort**: Light (≤3 MET) / Moderate (3.1–5.9) / Vigorous (≥6) — applies to both Duration and Strength templates; overridable per session when logging.
- **MET by effort**: for each effort level, an editable MET value; fill **at least one** level (the
  default effort must have a value; single-intensity activities need only one). Drives the calorie
  estimate via MET × weight × hours. In the Activity Log, effort levels with no MET are disabled.
- **Icon**: an icon picker (the keys of `ACTIVITY_ICONS`); optional, defaults to `IconRun`.
- Bottom: **RESET** + **ADD ACTIVITY** (new) / **SAVE ACTIVITY** (editing). RESET (and, when editing,
  SAVE) are enabled only when something changed; ADD requires a name and a MET for the default effort.

## Settings (global — from the Home hub gear)

App-wide; shared across all modules. Auto-save on change. A back chevron returns to the hub.

- **PROFILE**: Birthday, Sex, Height, Weight (all editable).
- **ACCOUNT**: **Units** (Metric / Imperial — editable; display-only, DB stays metric), Google account,
  Sign out.

## Wellness Settings (from the gear in the Wellness header)

Wellness-module sub-settings. Auto-save on change. A back chevron returns to the previous Wellness screen.

- **TARGETS** (auto-set from profile via DRI): **Protein Target** is the only manual override field.
- **DISPLAY**:
  - **Highlighted Nutrients** → choose up to 8 shown on the Diary (the picker caps the selection at 8).
  - **Visible Nutrients** → per-nutrient toggle for what appears on the Dashboard & Daily Report.

### Visible Nutrients sub-screen

- All nutrients grouped (General & Protein, Vitamins, Minerals, Carbohydrates, Lipids), each a Visible
  toggle. Defaults on for the Phase-1 list (see seed data), off for the rest.
- Protein also shows its editable Daily Target here. No other per-nutrient targets and no max-threshold fields are exposed. Items with sparse source data show a small "limited data" note.
