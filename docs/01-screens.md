# 01 — Screens (Functional Spec)

## Navigation

The app opens to a **Home hub** — a launcher of module cards (Wellness, Net Worth, Shows, Books; more
later). Selecting a module enters it and the **bottom tab bar becomes that module's tabs**, with a
**Home** item to return to the hub. On launch the app reopens the **last-used module**, so daily
Wellness use skips the hub.

- **Wellness** tabs: **Home**, **Diary**, **Dashboard**, **Library**. A **gear** in each Wellness
  header opens Wellness Settings.
- **Net Worth** tabs: **Home**, **Dashboard**, **Monthly Entry**.
- **Shows** tabs: **Home**, **Dashboard**, **Library**. The Entry/Edit screen is a form reached from
  a `+` (new) or by tapping a Library/Dashboard row (edit).
- **Books** tabs: **Home**, **Dashboard**, **Library**. Same shape as Shows; the Entry/Edit screen is
  a form reached from a `+` (new) or by tapping a row (edit). A **gear** in the Books headers opens
  Books Settings.
- **Settings is global**, reached from a gear on the Home hub (profile, units, account — app-wide).
  Wellness-specific settings (protein target, nutrient display) live in **Wellness Settings**.

Routing is URL-namespaced per module (`/wellness/*`, `/networth/*`, `/shows/*`, `/books/*`); a future
module drops in as a card + routes with no structural change. Modals (sheets) slide up over a module's tabs:
Calendar, Add Food, Food Detail, Add Activity, Activity Log, New Food, New Activity, Month Picker
(Net Worth), Title Search (Shows), Book Search (Books).

Diary groups, in order: **Breakfast, Lunch, Dinner, Snacks, Supplements, Activities**.

## Button convention

- Action buttons in a persisted pane at the top right: **ADD**, **RESET**, **SAVE**, **CREATE**
- Settings sub-screens: auto-save on change

## Global - Settings (from the Home hub gear)

App-wide; shared across all modules. Auto-save on change. A back chevron returns to the hub.

- **PROFILE**: Birthday, Sex, Height, Weight (all editable).
- **ACCOUNT**: **Units** (Metric / Imperial — editable; display-only, DB stays metric), Google account,
  Sign out.

---

## Wellness - Diary (Wellness home tab)

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

## Wellness - Calendar (modal, from the Diary date)

- Month grid with `‹ ›` to change month; today circled in coral.
- Per-day cue dots: one color if food was logged, another if activity was logged, both if both.
- Legend explaining the dots; **Cancel** / **OK**.

## Wellness - Add Food (modal, from a group's `+`)

- Search bar with a barcode-scan icon.
- Tabs: **Favorites** (hearted items, default), **Custom** (your items), **All** (combined USDA + your custom).
  Opening a food then backing out with **X** returns here with the active tab, search text, and results preserved; **ADD** instead closes both sheets and lands back on the **Diary** (you don't pass
  back through this picker).
- **Matching is broad** — case-, punctuation-, singular/plural-insensitive and partial-typing-tolerant
  (so "blueberr" and "blueberri" already match "blueberry"/"blueberries") — a "Blueberries" search
  returns "Blueberries, raw", "Muffins, blueberry", etc., not just the exact name. USDA text
  search queries the whole-food databases (Foundation / SR Legacy / Survey FNDDS) and Branded foods
  as two separate pools so the thousands of identical Branded exact-name products can't bury the
  varied whole-food results; Branded duplicates (same name + brand) are collapsed and capped.
- Result rows are two lines: **line 1** is the food name (wraps to multiple lines) with a heart on the right; **line 2** shows `<n> nutrients · <serving>` on the left and the source tag (USDA / Custom / OFF for Open Food Facts) on the right. Results are ordered by how well the name matches the query, then by nutrient count (descending) — and because exact and leading-prefix matches share a tier, the nutrient count decides between them (a bare "BLUEBERRIES" won't outrank a richer "Blueberries, raw"). Your saved foods (Favorites / Custom) have an interactive heart to toggle favorite; raw USDA results show a non-interactive heart and are favorited from **Food Detail** (they aren't cached until favorited or logged). Tapping a row opens **Food Detail**.
- The barcode-scan button opens the camera scanner (lazy-loaded); a decoded EAN/UPC is looked up in Open Food Facts and opens **Food Detail**. Logging or favoriting saves the product into the `food` table (`source='off'`).

## Wellness - Food Detail (logging screen)

- Top: `X` close · food name · **heart** (favorite toggle; coral = favorited).
- Editable fields: **Amount**, **Serving Size** (dropdown), **Group** (pre-filled to the group tapped).
- **Complete Nutrient Summary**: every nutrient as "name · value / target · %", same bar style as the Dashboard, recomputing live as Amount/Serving change.
- **ADD** when logging a new item. When opened to **edit a logged entry** (tapped from the Diary), the buttons are **RESET** + **SAVE** instead, both enabled only once a value changes; the Amount and the serving are prefilled from the entry.

## Wellness - Add Activity (modal, from the Activities `+`)

- Opens your **Activity Library** directly (your activities + an Add button) — no big category drill-down.
- Tapping an activity opens **Activity Log**, in one of two templates.

## Wellness - Activity Log — duration type

- Effort Level picker (Light / Moderate / Vigorous): defaults to the activity's saved effort, but is
  **overridable per session**. Levels the activity has no MET for are disabled.
- Duration (minutes): prefilled from the activity's default duration.
- Energy Burned: auto-computed, read-only = MET × body-weight(kg) × hours. Shows the basis.
- Group defaults to **Activities**.
- **RESET** + **ADD** (logging). RESET enables only when something differs from the
  defaults. Editing a logged entry instead shows **RESET** + **SAVE**, both enabled only once changed.

## Wellness - Activity Log — strength type

- Same **Effort Level** picker as duration (defaults to the activity's, overridable per session).
- Duration (minutes, prefilled from the default) → drives the energy estimate. Energy Burned =
  MET × body-weight(kg) × hours, MET resolved from `met_by_effort` at the chosen effort. No hardcoded MET.
- **Exercises** list: each exercise expands to sets logged as reps × weight, with "Add set"; an "Add exercise" button builds the session. Sets persist to `strength_set` for progress tracking. Reps/weight are editable drafts that can be **emptied** while typing; **Add set duplicates the previous set's reps + weight** (a new set is usually the same load). Validation (inline error + **ADD** / **SAVE** disabled): for any **named** exercise every set needs **reps > 0** and **weight (kg) ≥ 0** (0 = bodyweight); an **unnamed** exercise is fine left blank (dropped on save) but is flagged if any reps/weight field has been filled in — so typed sets aren't silently lost.
- Group defaults to **Activities**. **RESET** + **ADD** (logging) or **RESET** + **SAVE**
  (editing a logged entry); editing prefills duration, effort, and the exercise/set list from the entry.

## Wellness - Dashboard (tab)

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

## Wellness - Daily Report (from the Diary `⋯`)

- Identical layout to the Dashboard, scoped to a single day instead of an averaged range.

## Wellness - Library (tab)

Two sub-tabs:

- **Foods**: searchable list of your custom foods and supplements; tap a row to edit, swipe to delete;
  `+ New Food` opens the form. Supplements show a "supplement" tag. `Import CSV` opens the bulk
  importer (parses a CSV in-browser and inserts custom foods/supplements + servings via the data
  layer; format in `templates/custom-foods-template.csv`, documented in
  `templates/custom-foods-import-guide.md`).
- **Activities**: list of your activities; tap a row to edit template + default effort/MET, swipe to delete; `+ New Activity` opens the form.

## Wellness - New Food (form)

- **Type** toggle: Food / Supplement.
- Food Name.
- **Serving Sizes**: name + gram weight; "Add serving size" for multiple measures.
- **Nutrition shown per**: 100 g / serving (the storage basis).
- **Nutrition Facts**: the _complete_ nutrient set, grouped by category, each an input + unit,
  collapsible per section. (Supplements: leave Energy/macros blank, fill the relevant micros.)
- **RESET** + **CREATE** (new) / **SAVE** (editing). **RESET** (and, when editing, **SAVE**) are
  enabled only when something changed; CREATE requires a name.

## Wellness - New Activity (form)

- Activity Name; optional Description.
- **Logging Template**: Duration (minutes + effort) or Strength (sets/reps/weight + duration).
- **Default Duration** (minutes): prefills the Duration field when logging this activity (default 30).
- **Default Effort**: Light (≤3 MET) / Moderate (3.1–5.9) / Vigorous (≥6) — applies to both Duration and Strength templates; overridable per session when logging.
- **MET by effort**: for each effort level, an editable MET value; fill **at least one** level (the default effort must have a value; single-intensity activities need only one). Drives the calorie estimate via MET × weight × hours. In the Activity Log, effort levels with no MET are disabled.
- **Icon**: an icon picker (the keys of `ACTIVITY_ICONS`); optional, defaults to `IconRun`.
- Top-right: **RESET** + **CREATE** (new) / **SAVE** (editing). RESET (and, when editing **SAVE**) are enabled only when something changed; CREATE requires a name and a MET for the default effort.

## Wellness - Settings (from the gear in the Wellness header)

Wellness-module sub-settings. Auto-save on change. A back chevron returns to the previous Wellness screen.

- **TARGETS** (auto-set from profile via DRI): **Protein Target** is the only manual override field.
- **DISPLAY**:
  - **Highlighted Nutrients** → choose up to 8 shown on the Diary (the picker caps the selection at 8).
  - **Visible Nutrients** → per-nutrient toggle for what appears on the Dashboard & Daily Report.

### Visible Nutrients sub-screen

- All nutrients grouped (General & Protein, Vitamins, Minerals, Carbohydrates, Lipids), each a Visible
  toggle. Defaults on for the Phase-1 list (see seed data), off for the rest.
- Protein also shows its editable Daily Target here. No other per-nutrient targets and no max-threshold fields are exposed. Items with sparse source data show a small "limited data" note.

---

## Net Worth - Dashboard

- Large **current total net worth** in HKD (latest snapshot).
- **Total net-worth trend graph** with a time-window selector (reuse the Wellness range-picker pattern; suggested windows: 6M, 12M, 2Y, 3Y, 5Y, All).
- A view toggle on the trend graph: **Total** ⇄ **By asset type** (one line per asset type, each the monthly sum of that type's `value_base`).
- A **per-asset-type summary** for the latest month: type, total HKD, % of net worth.

## Net Worth - Monthly Entry

- Month selector (defaults to the current month; can pick a past month for retrospective entry). The `‹ month ›` arrows step one month; **tapping the month label opens a month/year picker** (year stepper over a month grid, with OK/Cancel — the same modal pattern as the Wellness Calendar).
- On a new month, **pre-fill every entry from the most recent prior snapshot** (copy-forward), then re-fetch that month's FX rates and recompute `value_base`. The user edits `value_native` (and adds/removes entries) from there.
- The **header is pinned** — month selector, the live **NET WORTH** total, and **RESET**/**SAVE** stay visible while the **asset-type list scrolls** beneath them.
- Entries **grouped by asset type**; each row editable: name, currency, `value_native`, and the type-specific `details`. **Add entry** (pick type) / edit / **delete** (delete just omits it from this
  month onward — each month is self-contained).
- **Exchange rates** panel is compact: title shows the base (`EXCHANGE RATES (HKD 1.0000)`), with **CNY and USD rates on one line**, each auto-fetched (with ↻ refetch) and overridable. Note: \_Native → HKD as of 1st of the month from Frankfurter.
- **Running total in HKD** updates live as you edit.
- **RESET** and **SAVE** buttons.

## Shows - Dashboard

- Shelves, each a card shown only when it has items, scoped by a **type filter** (All / TV / Movies)
  and a `+` that opens a blank Entry:
  - **Up Next** — in-progress TV with episodes remaining; each row shows the poster, title, type
    badge, and **"S{watched_seasons} · {watched_episodes}/{total_episodes}"** progress + a **Mark
    Watched** action (status → watched, finish → today, watched counts → totals).
  - **Watching** — the remaining `status=watching` titles (movies + TV without episode totals); also
    offers **Mark Watched**. (Up Next is de-duplicated out of Watching so a show isn't listed twice.)
  - **Want to Watch** — a short shelf of `status=want`, each with a **Start Watching** action (status
    → watching, start → today).
  - **Recently Watched** — the last 5 by finish date (rows show stars + finish date). Imported rows
    with no `end_date` don't appear here (they live in the Library).
- A small stat line: "**N watched this year**".

## Shows - Library

- **Search bar** over a list of every tracked title — matches **Title, Director, and Cast** (when
  TMDB returned them); a **`+ New Show`** opens the blank Entry.
- A **Filters** toggle opens a panel: **Type** (All/TV/Movies), **Status**, **Genre** (the genres
  present in your own rows), **Rating** (minimum: Any / 1★+ … / 5★), **LGBT+** (Any/None/Some/
  Significant), and **Started-between** + **Finished-between** date ranges (each bound via the
  Calendar modal, clearable). A count on the Filters button shows how many are active; **Clear
  filters** resets them.
- A **Sort** menu over { Date, Title, Type, Year, Status, Rating, Genre } with an **asc/desc** toggle
  (nulls sort last); default is **Date** descending.
- Each row: a **poster thumbnail**, title (+ year), a **TV/Movie type badge**, a **status chip**, the
  **star rating**, the first genre, and the finish/updated date. Tap a row → **Entry/Edit**;
  **swipe-left → Delete** (hard, with a confirm).
- A **gear** in the Shows Dashboard/Library headers opens **Shows Settings**.
- _Filter/sort state is per-visit (not persisted); a wide-screen sortable table is parked — see
  `PARKED.md`._

## Shows - Entry / Edit (form)

- Reached from the Library `+` (new, `/shows/entry`) or by tapping a row (edit, `/shows/:id`).
- **Type** toggle (TV Show / Movie) — Movie hides the season/episode fields.
- **Title** (required for CREATE), **Original Title**, **Year**.
- **Status** (Want / Watching / Watched / Dropped): choosing Watched or Dropped defaults the
  **Finish/Drop date** to today; choosing **Watched** on a TV show snaps the watched counts to the
  totals.
- **Rating**: a 0–5 **half-star** picker. **LGBT+ representation**: a None / Some / Significant
  segmented control.
- **Start Date**, **Finish / Drop Date**, **Last Update** — each opens the **Calendar** modal;
  clearable. Start + Last Update default to today on a new entry.
- **Watched/Total Seasons & Episodes** (TV only); **Comments** (textarea).
- **Search TMDB** (scoped to the current Type) opens the **Title Search** modal; selecting a result
  fetches details and populates the **metadata** — a poster thumbnail + Genres, Director/Creator, top
  Cast, Overview, Runtime (read-only display), plus Title/Original Title/Year (editable) and, for TV,
  the season & episode totals. Nothing is saved until CREATE/SAVE. Title/Year stay editable so manual
  entry and match corrections still work.
- Top-right **RESET** + **CREATE/SAVE**, enabled only once something changes; CREATE needs a Title.
- Which optional fields appear is controlled by **Shows Settings → Visible Fields** (Type, Title and
  Status are always shown); hiding a field is display-only and never drops saved data.

## Shows - Title Search (modal)

- Mirrors the **Add Food** search-sheet pattern but is a **local overlay inside Entry** (not a route
  sheet — a route sheet would remount the Entry form and lose in-progress edits): a search bar over
  poster-thumbnail result rows (poster · title · year · TV/Movie badge), scoped to the current Type
  toggle. Tapping a result selects it (triggers the TMDB details fetch + field population) and closes
  the modal; **X**/Esc/scrim cancels. Shows a configuration hint if `VITE_TMDB_API_KEY` is unset.

## Shows - Settings (from the gear in the Shows headers)

Shows-specific sub-settings (mirrors the Wellness Settings split; app-wide profile/units/account stay
in the global Settings at the Home level).

- **Entry Form → Visible Fields** opens a sub-screen of toggles over the optional Entry/Edit fields
  (Original Title, Year, Rating, LGBT+, the three dates, Season & Episode counts, Comments, TMDB
  metadata display). Stored on `profile.show_visible_fields` (**NULL = all visible**); auto-saves per
  toggle. Type, Title and Status are always shown and not listed.
- **Import → Enable CSV import** toggle (`profile.show_importer_enabled`); when on, an **Import CSV…**
  launcher appears that opens the importer sheet.

## Shows - Import CSV (sheet, from Shows Settings)

An in-app bulk importer (the owner's choice over a script — same as Net Worth). Columns:
`title,type,status,rating,lgbtq_rep,watched_seasons,watched_episodes` (see
`templates/shows-import-guide.md`).

- **Choose CSV** → rows are parsed/validated (bad rows listed as skipped) and each is **matched
  against TMDB** (top hit + details) with a progress count.
- A **preview list** shows each row's poster + matched title/year + type/status + (TV) season·episode
  totals; rows TMDB couldn't find are flagged **No match** and rows whose top hit differs from the CSV
  title are flagged **review**. **Change** on any row opens the **Title Search** modal to pick the
  correct title (or leave it as-is to import with no metadata).
- **Import** writes all rows **idempotently** (dedup on `type` + lower title — re-running the same
  file updates in place, never duplicates). Imported rows have **NULL dates**, so they appear in the
  Library but not the Dashboard's "Recently Watched".

## Books - Dashboard

- Shelves, each a card shown only when it has items, with a `+` (top-right) that opens a blank Entry.
  There is no type filter (books are one kind):
  - **Currently Reading** — all `status=reading`; each row shows the cover, title (+ year), and
    author(s), plus a **Mark Read** action (status → read, finish → today).
  - **Recently Read** — the last 5 by finish date (rows show the star rating + finish date). Imported
    rows with no `end_date` don't appear here (they live in the Library).
  - **Want to Read** — a short shelf of `status=want`, each with a **Start Reading** action (status →
    reading, start → today).
- A small stat line: "**N read this year**".

## Books - Library

- **Search bar** over a list of every tracked book — matches **Title and Author(s)**; a
  **`+ New Book`** opens the blank Entry.
- A **Filters** toggle opens a panel: **Status**, **Genre** (the genres present in your own rows),
  **Rating** (minimum: Any / 1★+ … / 5★), **LGBT+** (Any/None/Some/Significant), **Author** (the
  authors present in your own rows), and **Started-between** + **Finished-between** date ranges (each
  bound via the Calendar modal, clearable). A count on the Filters button shows how many are active;
  **Clear filters** resets them.
- A **Sort** menu over { Date, Title, Author, Year, Status, Rating, Genre } with an **asc/desc** toggle
  (nulls sort last); default is **Date** descending.
- Each row: a **cover thumbnail** (2:3, neutral placeholder when there's no cover), title (+ year),
  the author(s), a **status chip** (Want to Read / Reading / Read / Dropped), the **star rating** when
  rated, the first genre, and the finish/updated date. Tap a row → **Entry/Edit**; **swipe-left →
  Delete** (hard, with a confirm).
- A **gear** in the Books Dashboard/Library headers opens **Books Settings**.
- _Filter/sort state is per-visit (not persisted); a wide-screen sortable table is parked — see
  `PARKED.md`._

## Books - Entry / Edit (form)

- Reached from the Library `+` (new, `/books/entry`) or by tapping a row (edit, `/books/:id`).
- **Search Google Books** (a button) opens the **Title Search** modal; selecting a result fetches
  details and populates the **metadata** — a cover thumbnail + Genres, Page count, Language,
  Description (read-only display) — plus Title / Author(s) / Year (editable). Nothing is saved until
  CREATE/SAVE; Title/Author/Year stay editable so manual entry and match corrections still work.
- **Title** (required for CREATE), **Author(s)** (comma-separated), **Year**.
- **Status** (Want to Read / Reading / Read / Dropped): choosing **Reading** defaults the **Start
  Date** to today; choosing **Read** or **Dropped** defaults the **Finish / Drop date** to today.
- **Rating**: a 0–5 **half-star** picker. **LGBT+ representation**: a None / Some / Significant
  segmented control.
- **Start Date**, **Finish / Drop Date**, **Last Update** — each opens the **Calendar** modal;
  clearable. Start + Last Update default to today on a new entry.
- **Comments** (textarea).
- Top-right **RESET** + **CREATE/SAVE**, enabled only once something changes; CREATE needs a Title.
- Which optional fields appear is controlled by **Books Settings → Visible Fields** (Title, Status and
  the Search button are always shown); hiding a field is display-only and never drops saved data.

## Books - Title Search (modal)

- Mirrors the Shows **Title Search** pattern but is a **local overlay inside Entry** (not a route
  sheet — a route sheet would remount the Entry form and lose in-progress edits): a search bar over
  cover-thumbnail result rows (cover · title · author(s) · year). Tapping a result selects it
  (triggers the details fetch + field population) and closes the modal; **X**/Esc/scrim cancels.
- Results come from **Google Books**, falling back to **Open Library** when Google returns nothing.
  The `VITE_GOOGLE_BOOKS_API_KEY` is **optional** (search works keyless at a lower quota), so a failure
  is a network/quota issue, not a missing key.

## Books - Settings (from the gear in the Books headers)

Books-specific sub-settings (mirrors the Wellness/Shows Settings split; app-wide profile/units/account
stay in the global Settings at the Home level). Reached from a **gear** in the Books Dashboard/Library
headers.

- **Entry Form → Visible Fields** opens a sub-screen of toggles over the optional Entry/Edit fields
  (Author(s), Year, Rating, LGBT+, the three dates, Comments, Book metadata display). Stored on
  `profile.book_visible_fields` (**NULL = all visible**); auto-saves per toggle. Title, Status and the
  Search button are always shown and not listed.
- **Import → Enable CSV import** toggle (`profile.book_importer_enabled`); when on, an **Import CSV…**
  launcher appears that opens the importer sheet.

## Books - Import CSV (sheet, from Books Settings)

An in-app bulk importer (the owner's choice over a script — same as Net Worth / Shows). Columns:
`title,author,rating,lgbtq_rep,end_date` (see `templates/books-import-guide.md`).

- **Choose CSV** → rows are parsed/validated (bad rows listed as skipped) and each is **matched against
  Google Books** (searching `title author` for the top hit, Open Library fallback) with a progress count.
- A **preview list** shows each row's cover + matched title/year + author(s) + the **Read** status chip +
  the parsed rating/finish date; rows nothing was found for are flagged **No match** and rows whose top
  hit differs from the CSV title are flagged **review**. **Change** on any row opens the **Book Search**
  modal to pick the correct book (or leave it as-is to import with the CSV values + no metadata).
- **Import** writes all rows **idempotently** (dedup on lower(title) + lower(author) — re-running the
  same file updates in place, never duplicates). Every imported row is **Read**; `start_date` /
  `last_update_date` are **NULL** and `end_date` comes from the file, so imported books appear in the
  Library and (when dated) the Dashboard's "Recently Read".
