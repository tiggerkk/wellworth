# 01 — Screens (Functional Spec)

## Navigation

The app opens to a **Home hub** — a launcher of module cards (Wellness, Net Worth, Shows, Books,
Quotes, Medical, Travel; more later). Selecting a module enters it and the **bottom tab bar becomes that
module's tabs**, with a **Home** item to return to the hub. On launch the app reopens the **last-used
module**, so daily Wellness use skips the hub.

- **Wellness** tabs: **Home**, **Dashboard**, **Diary**, **Library**, **Settings**.
- **Net Worth** tabs: **Home**, **Dashboard**, **Monthly Entry**.
- **Shows** tabs: **Home**, **Dashboard**, **Library**, **New Show**, **Settings**. The Entry/Edit
  screen is reached from the **New Show** tab (new) or by tapping a Library/Dashboard row (edit);
  **Settings** opens Shows Settings. The Dashboard/Library pages carry no title bar (the active tab
  signals location).
- **Books** tabs: **Home**, **Dashboard**, **Library**, **New Book**, **Settings**. Same shape as
  Shows; the Entry/Edit screen is reached from the **New Book** tab (new) or by tapping a row (edit),
  and **Settings** opens Books Settings.
- **Quotes** tabs: **Home**, **Zen** (the Moment-of-Zen dashboard), **Library**, **New Quote**,
  **Settings**. The Add/Edit screen is reached from the **New Quote** tab (new) or by tapping a row
  (edit), and **Settings** opens Quotes Settings.
- **Medical** tabs: **Home**, **Dashboard**, **Reports**, **New Medical**, **Settings**. The Add/Edit
  Report screen is reached from the **New Medical** tab (new) or by tapping a report (edit), and
  **Settings** opens Medical Settings. The **biometric/PIN lock** gates entry to the whole module (see
  02-tech-spec → Medical).
- **Travel** tabs: **Home**, **Dashboard**, **Map**, **Trips**, **New Trip**, **Settings**. The Trip
  Builder is reached from the **New Trip** tab (new = header-only + Create) or by tapping a Trips/Map row
  (edit), and **Settings** opens Travel Settings.
- **Settings is global**, reached from a gear on the Home hub (profile, units, account — app-wide).
  Module-specific settings live in **Settings** bottom tab.

Routing is URL-namespaced per module (`/wellness/*`, `/networth/*`, `/shows/*`, `/books/*`,
`/quotes/*`, `/medical/*`, `/travel/*`); a future module drops in as a card + routes with no structural change. Modals (sheets)
slide up over a module's tabs: Calendar, Add Food, Food Detail, Add Activity, Activity Log, New Food,
New Activity, Month Picker (Net Worth), Title Search (Shows), Book Search (Books), Source Link (Quotes),
City Picker / Stop Editor / Reorder Days / Expense Editor (Travel — local overlays so the Builder draft survives).

Diary groups, in order: **Breakfast, Lunch, Dinner, Snacks, Supplements, Activities**.

## Button convention

- Action buttons in a persisted pane at the top right. On the New/Edit forms they render as **compact
  icons** (shared `EntryHeaderActions`): **Reset** = undo-arrow, **Create** = plus (new) / **Save** =
  floppy-disk (editing), and a **Delete** = trash icon that appears **only when editing** an existing
  record. Delete asks for an inline confirm, then removes the record and returns. Logging sheets that
  add to the Diary keep a single **plus** (Add) action in create mode. Enable/disable gating is
  unchanged (Reset needs a change; Save needs the record to be dirty / required fields filled).
- A vertically-centered **empty state** (shared `EmptyState`) shows "No X yet" + a **+ New X** action on
  the media Dashboards/Libraries (Shows/Books/Quotes) and the Medical Dashboard/Reports when there's no
  data.
- The **date-picker Calendar** header is tappable: it opens a year-stepper + month grid; picking a month
  returns to that month's day grid.
- Settings sub-screens: auto-save on change

## Global - Settings (from the Home hub gear)

App-wide; shared across all modules. Auto-save on change. A back chevron returns to the hub.

- **PROFILE**: Birthday, Sex, Height, Weight (all editable).
- **PREFERENCES**: **Units** (Metric / Imperial — editable; display-only, DB stays metric).
- **ACCOUNT**: Google account + **Sign out**. This card is driven by the **session, not the profile**,
  so it renders even when the profile fails to load (e.g. after a DB reset deletes the user) — the
  error message points here. Sign out clears the session **locally** (`scope: 'local'`) and, as a
  guaranteed fallback, removes the persisted `sb-*-auth-token` and reloads, so a stale token for a
  deleted user can always be cleared.

---

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

## Wellness - Daily Report (from the Diary `⋯`)

- Identical layout to the Dashboard, scoped to a single day instead of an averaged range.

## Wellness - Library (tab)

Two sub-tabs:

- **Foods**: searchable list of your custom foods and supplements; tap a row to edit, swipe to delete;
  `+ New Food` opens the form. Supplements show a "supplement" tag. An accent-coloured `Import CSV…`
  link (matching the other modules) opens the bulk
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

## Wellness - Settings (from the Settings tab in the Wellness bottom nav)

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

- Shelves, each a card shown only when it has items, scoped by a **type filter** (All / TV / Movies /
  Docs).
  Every row carries a baseline of **type badge + status chip** (so status reads the same here as in
  the Library); on top of that each shelf adds the one detail that matters there:
  - **Favourites** — every `is_favorite` title (any status), each row showing its status chip + the
    **star rating** when set. (A favourite also still appears in its status shelf below.)
  - **Up Next** — an in-progress episodic title (TV or documentary) with episodes remaining; each row
    shows the poster, title, type badge, a **"Watching"** chip, and **"S{watched_seasons} ·
    {watched_episodes}/{total_episodes}"** progress + a **Mark Watched** action (status → watched,
    finish → today, watched counts → totals).
  - **Watching** — the remaining `status=watching` titles (movies + TV without episode totals); each row
    shows the **"Watching"** chip + the most useful cue — season·episode progress for an episodic title
    with a known total, otherwise **"Started {start date}"** (so a watching movie isn't a dead end) —
    plus a **Mark Watched** action. (Up Next is de-duplicated out of Watching so a show isn't listed
    twice.) Every watching title — whether started from the Want shelf or set to Watching manually —
    gets the chip.
  - **Want to Watch** — a short shelf of `status=want`, each showing the blue **"Want"** chip + first
    genre + a compact **length hint** (`~2h 10m` for a movie, `3 seasons` / `12 eps` for episodic) and
    a **Start Watching** action (status → watching, start → today).
  - **Recently Watched** — the last 5 by finish date (rows show the **"Watched"** chip + stars +
    the finish date as **month + day**, e.g. "Jun 22" — no weekday or "Finished" prefix). Imported
    rows with no `end_date` don't appear here (they live in the Library).
- Every Dashboard row shows its **status chip** (like the Library), and a favourite row anywhere shows a
  small filled **♥** before the title. The status chips use a shared palette — **Want** = blue,
  **Watching** = coral, **Watched** = teal, **Dropped** = grey — with the short label "Want" (the shelf
  titles still spell out "Want to Watch").
- A small stat line: "**N watched this year**".

## Shows - Library

- **Search bar** over a list of every tracked title — matches **Title, Director, and Cast** (when
  TMDB returned them). An **icon-only Filter button** sits to the right of the search bar and tints
  **accent** while its panel is open (the shared `FilterToggleButton`; mirrors Travel).
- The Filter panel (shared `FilterPanel` pane) is **label-free** — the first option of each dropdown
  names the field: **Type** segmented control (All/TV/Movies/Docs), **Any Status**, **Any Genre** (the
  genres present in your own rows), **Any Rating** (minimum: Any / 1★+ … / 5★), **Any LGBT+**
  (None/Some/Significant), **Any Dynasty** (+ the 12 dynasties), a **Favorites Only** toggle, and
  single-line **Started** + **Finished** date ranges (label · From · To; each bound via the Calendar
  modal, clearable).
- The panel footer carries the **Sort** control (shared `SortControl`) next to **Clear Filters**. Sort
  over { Date, Dynasty, Rating, Status, Genre, Title, Year, Type } with an **asc/desc** toggle (nulls
  sort last; Dynasty orders chronologically newest→oldest, non-Chinese titles last); default is
  **Date** descending.
- Each row is a **uniform catalog row** (same fields for every status): a **poster thumbnail**, the
  title (+ year) with a small filled **♥** when favourited and a **gold Dynasty badge** to the right
  of the title for Chinese titles, then **type badge · status chip · star rating** (when set) and a
  second line of **first genre · date** (the date as **month + day**, e.g. "Jun 22"; no prefix or
  weekday). Tap a row → **Entry/Edit**; **swipe-left → Delete** (hard, with a confirm).
- _Filter/sort state is per-visit (not persisted); a wide-screen sortable table is parked — see
  `PARKED.md`._

## Shows - Entry / Edit (form)

- Reached from the **New Show** bottom-nav tab (new, `/shows/entry`) or by tapping a row (edit, `/shows/:id`). A new
  show can be **prefilled** from `?title=&poster=&overview=&type=` (copy-paste / a future
  iOS Shortcut; only the param support is built).
- A **favourite heart** in the header (filled when on) toggles `is_favorite` — surfaces a "Favourites"
  Dashboard shelf and a "Favourites only" Library filter (mirrors Quotes).
- **Type** three-segment control (TV Show / Movie / Documentary) — Movie hides the season/episode
  fields; Documentary shows them (optional, often N/A). (A documentary sub-series is folded into the
  **Title** by the owner, e.g. `国宝档案 — 从东晋到北魏`.)
- **Title** (required for CREATE; as wide as possible) shares a line with a **TMDB** search button
  (search icon) and the **⟳ Refresh** action. **Original Title**, **Year** follow.
- **Poster URL**: paste a direct image URL ("Copy Image Address" from Douban / a streaming page) into
  `poster_path`; rendered everywhere with `referrerpolicy="no-referrer"`. **Shown automatically when TMDB
  supplied no poster** (the field is empty or holds a manually pasted URL); the **Shows Settings →
  Visible Fields → Poster URL** toggle (off by default) forces it always visible, even when TMDB
  provided a poster.
- **Status** (Want / Watching / Watched / Dropped) is a **dropdown** sharing a line with **Rating** (a
  0–5 half-star picker): choosing Watching / Watched / Dropped defaults the **Start date** to today (the
  title has been started); choosing Watched or Dropped also defaults the **Finish/Drop date** to today;
  choosing **Watched** on an episodic title (TV / documentary) snaps the watched counts to the totals.
  **Want leaves Start Date blank** (not started yet).
- **LGBT+ representation**: a None / Some / Significant **dropdown**.
- **Start Date** and **Finish / Drop Date** share a line; each opens the **Calendar** modal and is
  clearable. **Last Update Date** sits below Comments. Last Update defaults to today on a new entry;
  Start Date stays blank until the status leaves Want.
- **Total Seasons / Episodes** and **Watched Seasons / Episodes** (episodic types — TV + documentary):
  two labels over four side-by-side number inputs. **Poster URL** sits just above **Comments** (textarea).
- **Search TMDB** (Chinese-aware: a CJK query is sent with `language=zh-CN`; documentary uses the /tv
  endpoint) opens the **Title Search** modal; selecting a result fetches details and populates the
  **metadata** — a poster thumbnail + Genres, Director/Creator, top Cast, Overview, Runtime (read-only
  display), plus Title/Original Title/Year (editable) and, for episodic types, the season & episode
  totals. Nothing is saved until CREATE/SAVE. Title/Year stay editable so manual entry and corrections work.
- **⟳ Refresh from TMDB** (beside Search; enabled only when a `tmdb_id` exists): re-fetches TMDB metadata
  and updates **only the TMDB-sourced fields** (title, original_title, overview, genres, director, cast,
  season/episode totals, runtime, original_language, and the TMDB poster). It **never** touches owner
  fields (status, rating, lgbtq_rep, dates, comments, watched counts, is_favorite) or a **manually
  pasted** poster. Reports "Updated" / "Already up to date".
- Top-right **favourite heart** + the icon actions (Delete when editing · Reset · Create/Save), enabled
  only once something changes; Create needs a Title.
- Which optional fields appear is controlled by **Shows Settings → Visible Fields** (Type, Title, Status,
  the favourite heart and the Refresh action are always shown; **Poster URL** auto-shows when TMDB has no
  poster and its Visible-Fields toggle — **off by default** — forces it always visible); hiding a field
  is display-only and never drops saved data.

## Shows - Title Search (modal)

- Mirrors the **Add Food** search-sheet pattern but is a **local overlay inside Entry** (not a route
  sheet — a route sheet would remount the Entry form and lose in-progress edits): a search bar over
  poster-thumbnail result rows (poster · title · year · type badge), scoped to the current Type toggle
  (documentary searches /tv) and **Chinese-aware** (a CJK query returns Chinese titles). Tapping a result
  selects it (triggers the TMDB details fetch + field population) and closes the modal; **X**/Esc/scrim
  cancels. Shows a configuration hint if `VITE_TMDB_API_KEY` is unset.

## Shows - Settings

Shows-specific sub-settings (mirrors the Wellness Settings split; app-wide profile/units/account stay
in the global Settings at the Home level).

- **Entry Form → Visible Fields** opens a sub-screen of toggles over the optional Entry/Edit fields
  (Original Title, Year, Rating, LGBT+, Dynasty, the three dates, Season & Episode counts, Comments,
  TMDB metadata display, and **Poster URL**). Most are stored on `profile.show_visible_fields` (**NULL = all
  visible**, default-on) and auto-save per toggle; **Poster URL** is the exception — it's backed by
  `profile.show_poster_url_visible` (**default off**, kept separate because the visible-fields list is
  default-on) and means "**force always visible**": the field still auto-shows whenever TMDB supplied no
  poster regardless of the toggle. Type, Title, Status, and the favourite heart are always shown and not
  listed.
- **Import → Enable CSV Import** toggle (`profile.show_importer_enabled`); when on, an **Import CSV…**
  launcher appears that opens the importer sheet.

## Shows - Import CSV (sheet, from Shows Settings)

An in-app bulk importer (the owner's choice over a script — same as Net Worth). One CSV covers English +
Chinese across all three types. Columns:
`title,type,status,rating,lgbtq_rep,dynasty,watched_seasons,watched_episodes,is_favorite` (`type` ∈
`tv|movie|documentary`; `dynasty` kept only for Chinese titles; `is_favorite` optional trailing
boolean — see `templates/shows-import-guide.md`).
`watched_episodes` accepts the literal **`all`** on a `watching`/`dropped` episodic row (with a
`watched_seasons`), meaning "all episodes of the last-watched season" — resolved to that season's
TMDB episode count at import (left blank if TMDB has no count); used anywhere else, the row is skipped.

- **Choose CSV** → rows are parsed/validated (bad rows listed as skipped) and each is **matched
  against TMDB** (Chinese-aware top hit + details) with a progress count.
- A **preview list** shows each row's poster + matched title/year + type/status + (episodic)
  season·episode totals; rows TMDB couldn't find are flagged **No match** and rows whose top hit differs
  from the CSV title are flagged **review**. **Change** on any row opens the **Title Search** modal to
  pick the correct title (or leave it as-is to import with no metadata — common for niche documentaries,
  topped up later via a pasted Poster URL or Refresh).
- **Import** writes all rows **idempotently** (dedup on lower(title) — re-running the same file updates
  in place, never duplicates). Imported rows have **NULL dates**, so they appear in the Library but not
  the Dashboard's "Recently Watched".

## Books - Dashboard

- Shelves, each a card shown only when it has items. There is no type filter (books are one kind). Every row shows its **status chip** (Want / Reading /
  Read / Dropped) — the same chip as the Library, so the status reads consistently rather than
  being only implied by the shelf title:
  - **Favourites** — every `is_favorite` book (any status), each row showing its status chip. (A
    favourite also still appears in its status shelf below.)
  - **Currently Reading** — all `status=reading`; each row shows the cover, title (+ year), the status
    chip, and author(s), plus a **Mark Read** action (status → read, finish → today).
  - **Recently Read** — the last 5 by finish date (rows show the status chip + star rating + the
    finish date as **month + day**, e.g. "Jun 22" — no weekday). Imported rows with no `end_date`
    don't appear here (they live in the Library).
  - **Want to Read** — a short shelf of `status=want`, each with the blue **"Want"** chip + author(s)
    and a **Start Reading** action (status → reading, start → today).
- A favourite row anywhere shows a small filled **♥** before the title. The status chips share the
  Shows palette — **Want** = blue, **Reading** = coral, **Read** = teal, **Dropped** = grey — with the
  short label "Want" (the shelf title still spells out "Want to Read").
- A small stat line: "**N read this year**".

## Books - Library

- **Search bar** over a list of every tracked book — matches **Title and Author(s)** (Author is
  searched here, not filtered — too many values). An **icon-only Filter button** to the right tints
  **accent** while its panel is open. (New Book opens the blank Entry from the bottom nav.)
- The Filter panel is **label-free**: **Any Status**, **Any Genre** (the genres present in your own
  rows), **Any Rating** (minimum: Any / 1★+ … / 5★), **Any LGBT+** (None/Some/Significant), and **Any
  Dynasty** (+ the 12 dynasties) sharing a row with the **Favorites Only** toggle, plus single-line
  **Started** + **Finished** date ranges (each bound via the Calendar modal, clearable).
- The panel footer carries the **Sort** control next to **Clear Filters**. Sort over { Date, Dynasty,
  Rating, Status, Genre, Author, Title, Year } with an **asc/desc** toggle (nulls sort last; Dynasty
  chronological newest→oldest, non-Chinese last); default is **Date** descending.
- Each row: a **cover thumbnail** (2:3, neutral placeholder when there's no cover), title (+ year) with
  a small filled **♥** when favourited and a **gold Dynasty badge** to the right of the title for
  Chinese titles, the author(s), a **status chip** (Want / Reading / Read / Dropped — Want is blue),
  the **star rating** when rated, the first genre, and the date as **month + day** (e.g. "Jun 22"; no
  weekday). Tap a row → **Entry/Edit**; **swipe-left → Delete** (hard, with a confirm).
- _Filter/sort state is per-visit (not persisted); a wide-screen sortable table is parked — see
  `PARKED.md`._

## Books - Entry / Edit (form)

- Reached from the **New Book** bottom-nav tab (new, `/books/entry`) or by tapping a row (edit, `/books/:id`).
- A **favourite heart** in the header (filled when on) toggles `is_favorite` — surfaces a "Favourites"
  Dashboard shelf and a "Favourites only" Library filter (mirrors Quotes / Shows).
- **Title** (required for CREATE; as wide as possible) shares a line with a **Google Books** search
  button (search icon) opening the **Title Search** modal (pre-filled with the current Title); selecting
  a result fetches details and populates the **metadata** — a cover thumbnail + Genres, Page count,
  Language, Description (read-only display) — plus Title / Author(s) / Year (editable). Nothing is saved
  until Create/Save; Title/Author/Year stay editable so manual entry and match corrections still work.
- **Author(s)** (comma-separated), **Year**.
- **Status** (Want / Reading / Read / Dropped) is a **dropdown** sharing a line with **Rating** (a 0–5
  half-star picker): choosing **Reading** defaults the **Start Date** to today; choosing **Read** or
  **Dropped** defaults the **Finish / Drop date** to today.
- **LGBT+ Representation** (a None / Some / Significant **dropdown**) and **Dynasty** share one compact
  row. **Dynasty** is a dropdown of the 12 dynasties (近代 … 先秦), defaulting to 近代, and is **editable
  only when the Title contains CJK**; for a non-Chinese title it's disabled and stored as NULL.
- **Start Date** and **Finish / Drop Date** share a line; each opens the **Calendar** modal and is
  clearable (Start defaults to today on a new entry). **Comments** (textarea), then **Last Update Date**
  below it (defaults to today on a new entry).
- Top-right **favourite heart** + the icon actions (Delete when editing · Reset · Create/Save), enabled
  only once something changes; Create needs a Title.
- Which optional fields appear is controlled by **Books Settings → Visible Fields** (Title, Status, the
  Search button and the favourite heart are always shown); hiding a field is display-only and never drops
  saved data.

## Books - Title Search (modal)

- Mirrors the Shows **Title Search** pattern but is a **local overlay inside Entry** (not a route
  sheet — a route sheet would remount the Entry form and lose in-progress edits): a search bar over
  cover-thumbnail result rows (cover · title · author(s) · year). Tapping a result selects it
  (triggers the details fetch + field population) and closes the modal; **X**/Esc/scrim cancels.
- Results come from **Google Books**, falling back to **Open Library** when Google returns nothing.
  The `VITE_GOOGLE_BOOKS_API_KEY` is **optional** (search works keyless at a lower quota), so a failure
  is a network/quota issue, not a missing key.

## Books - Settings

Books-specific sub-settings (mirrors the Wellness/Shows Settings split; app-wide profile/units/account
stay in the global Settings at the Home level). Reached from the **Settings** tab in the Books bottom
nav.

- **Entry Form → Visible Fields** opens a sub-screen of toggles over the optional Entry/Edit fields
  (Author(s), Year, Rating, LGBT+, Dynasty, the three dates, Comments, Book metadata display). Stored
  on `profile.book_visible_fields` (**NULL = all visible**); auto-saves per toggle. Title, Status and
  the Search button are always shown and not listed.
- **Import → Enable CSV Import** toggle (`profile.book_importer_enabled`); when on, an **Import CSV…**
  launcher appears that opens the importer sheet.

## Books - Import CSV (sheet, from Books Settings)

An in-app bulk importer (the owner's choice over a script — same as Net Worth / Shows). Columns:
`title,author,rating,lgbtq_rep,dynasty,end_date,is_favorite` (`dynasty` kept only for Chinese titles;
`is_favorite` optional trailing boolean — see `templates/books-import-guide.md`).

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

## Quotes - Moment of Zen (`/quotes`)

- **First load**: one random quote where `is_favorite = true`; falls back to the whole pool if no
  favourites.
- **Refresh**: a floating **Shuffle** button at the **bottom-right** of the quote area (works
  everywhere) and **pull-to-refresh** (touch) rotate to a new random quote from the **entire pool**
  (no immediate repeat). (New Quote and Settings live in the bottom nav, not a page header.)
- **Card**: the quote text (large, centred; renders Chinese + multi-line correctly) — **tapping the
  quote text opens the Edit Quote page**; a metadata cluster — **Author · Source type · Title**, where
  **tapping the Title navigates to the linked Show/Book detail** (only when a link exists); the single
  **Category** badge and any **Tags**; a **heart** to toggle favourite instantly.

## Quotes - Library (`/quotes/library`)

- **Search** (placeholder "Search quote, author, title, tag"): real-time match across quote text,
  author, title, and tags. An **icon-only Filter button** to the right tints **accent** while its
  panel is open.
- **Filters** (shared `FilterPanel`, label-free): **Any Category**, **Any Source**, **Any Language**,
  a **Favorites Only** toggle, and multi-select **Tags** (OR — any selected tag). When opened from a
  Show/Book detail ("Quotes from this title", via a `?show=`/`?book=` param), the list is constrained
  to that record's quotes with a clearable banner.
- The panel footer carries the **Sort** control next to **Clear Filters**. Sort over { Date, Category,
  Source Type } with an **asc/desc** toggle (Date = date added; Category/Source Type sort on the stored
  key); default is **Date** descending.
- **List**: rows — a quote snippet, the category badge, and author. Tap → Add/Edit; **swipe-left** →
  Delete (hard, with confirm).

## Quotes - Add / Edit (form, `/quotes/entry`, `/quotes/:id`)

- **Quote Text** (6-row textarea; required). Prefilled from `?text=` when launched via copy-paste / an
  Apple Books Shortcut; a **Paste from clipboard** button fills it from the clipboard.
- **Author** + **Source Type** (TV Show / Movie / Book / Podcast / Article / Video / Song) share a line
  (Author as wide as possible, the Source Type dropdown clamped to fit its longest value).
- **Title** sits below Author with a **link control** to its right — a **Show or Book** button (icon)
  opening a modal that searches local **Show** and **Book** records (pre-filled with the current Title);
  selecting one binds `show_id`/`book_id` and auto-fills **Source Type** + **Title** (for a Book, also
  **Author**; a Show leaves Author for the speaker/character). When linked the button shows **Linked**
  (tap to unlink, keeping the filled values). Title is entered manually for podcasts/songs/articles/videos.
- **Category** (required, a clamped dropdown) + **Language** share a line; **Language** is an English /
  Chinese **toggle** that fills the rest of the line (auto-detected from the text — CJK → Chinese — and
  editable). **Tags** (optional): inline tag input with autocomplete against existing tags. **Favourite**
  heart in the header.
- Top-right icon actions (Delete when editing · Reset · Create/Save). **Validation**: requires Quote Text
  - exactly one Category. A duplicate (same normalised text) is rejected inline.
- Which fields are visible is controlled in **Quotes Settings** (Quote Text + Category always shown).

## Quotes - Settings (from the Settings tab in the Quotes bottom nav)

- **Visible Fields**: choose which Add/Edit fields appear (Quote Text + Category always shown).
- **Values** — manage the dropdown lists used on the Add/Edit form (each opens a sheet):
  - **Source Types** and **Categories**: **add / rename / delete / reorder** (drag handle) the values;
    order = display order in the dropdowns + Library filters. Changes auto-save. Seed defaults — Source
    Types: Book, Podcast, TV Show, Movie, Interview, Article, Song, Video; Categories: Wit, Observation,
    Philosophy, Heart, Connection, Growth.
  - **Delete migration**: deleting a value still used by quotes prompts a **reassignment** — pick a
    replacement and the affected quotes are moved to it before the value is removed. A value can't be
    deleted if it's the last one in its list. **TV / Movie / Book** source types are **protected from
    deletion** (they auto-link a quote to the Shows/Books library) — they can still be renamed/reordered.
- **Enable CSV Import**: surfaces the **Import CSV…** launcher.

## Quotes - Import CSV (sheet, from Quotes Settings)

An in-app bulk importer (the owner's choice over a script — same as Net Worth / Shows / Books). Columns:
`Quote,Author,Source,Title,Category,Tags,is_favorite` (`is_favorite` optional trailing boolean — see `templates/quotes-import-guide.md`). **No external API** —
unlike Shows/Books, links resolve against the user's own Show/Book rows.

- **Choose CSV** → rows are parsed/validated; **Category** and **Source** are matched against the owner's
  **configured** lists by **key or label** (case-insensitive; blank/unknown → flagged + skipped), **Tags**
  is split from its quoted cell, **Language** is auto-detected, and a **Title** matching an existing Show
  (a `linkKind: show` source) or Book (`linkKind: book`) **links** the quote.
- A **preview** shows counts of **new / duplicate-skipped / flagged** rows + a sample of the new rows
  (snippet + category + a "linked" marker) and the flagged rows with reasons.
- **Import** writes only the new, valid rows **idempotently** (dedup on `lower(trim(text))` via the DB
  `UNIQUE` + `ON CONFLICT DO NOTHING`) — re-running the same file imports nothing.

## Medical - Dashboard (`/medical`)

The module index (no screen-title header). Explicit loading / empty / error states; empty (no reports
yet) shows the centered **"No medical reports yet" / + New Medical Report** empty state. When there is
data, three sections:

- **Trends** — a two-column grid of **sparkline cards**, one per **tracked** test that has numeric data
  (ordered by the canonical section + sort order). Each card shows the test name, its **latest value**
  (+ unit, coloured by the latest flag), and a small **inline-SVG** sparkline (no chart library, so the
  full set renders cheaply). Tapping a card opens a **bottom-sheet** with the full trend chart (lazy
  recharts) for that test: flag-coloured points, an optional shaded **reference band** from the latest
  printed range, and a **time-window selector** (1Y / 2Y / 3Y / 5Y / All). Escape / tap-outside closes.
- **Latest values by category** — for **every** test recorded, its **most recent** value across all
  reports (not just the newest report — a heterogeneous history means the latest report may omit most
  tests), grouped under uppercase category headers in the user's display order. Each row: `test name`
  with `value (+ unit)` and the printed reference range, the value **coloured by flag**.
- **Recent reports** — up to five newest reports (date · type · provider · body part) linking to Report
  detail, with a **View all reports** row when there are more.

Tracked tests are chosen in Medical Settings → Tracked Tests (seeded from `default_tracked`).

## Medical - Reports (`/medical/reports`)

Searchable/filterable/sortable list (no screen-title header), newest report-date first by default. A
**Search bar** (placeholder "Search body part, narrative") with an **icon-only Filter button** to its
right (tints **accent** while open) sits above the list once at least one report exists. The shared
**`FilterPanel`** is label-free — **Any Type**, **Any Provider** (the providers present in your own
reports), **Any Body Part** — and its footer carries the **Sort** control next to **Clear Filters**.
Sort over { Date, Type, Provider, Body Part } with an **asc/desc** toggle (newest-first within ties);
default is **Date** descending. Each row: the **full date** (with year — reports span years), the
**type** label, and `provider · body part` as a secondary line. Tap → **Report detail**; swipe-left →
confirm → **delete** (hard; the FK cascades the report's results). New reports come from the **New
Medical** bottom-nav tab. Explicit loading / empty / error states (empty → the centered **"No medical
reports yet" / + New Medical Report** state; an active search/filter with no matches → "No matches.").

## Medical - Report detail (`/medical/:id`)

Read-only view. The header shows **Date - Type** (e.g. `May 4, 2026 - Health Screening`, with `· body
part` appended when relevant) on line 1 and the **Provider** as secondary text on line 2, with an
**Edit** (pencil icon) action → the form.
Below: **Open original** link(s) for each Google Drive URL (`target="_blank" rel="noreferrer"`); a
**Narrative** block when present; then **results grouped under uppercase category headers** in the
seeded section + sort order (filtered to the tests this report contains). Each result row shows
`test name · reference range` on the left and `value (+ unit)` on the right, the **value coloured by
flag** (high/abnormal red, low a distinct accent) using the report's own range; a small "normalized
from …" note appears when the value was unit-converted on import, and an "uncertain" marker when set.

## Medical - Add / Edit Report (`/medical/entry`, `/medical/:id/edit`)

Reached from the **New Medical** tab (new) or the Report detail **Edit** button. On the New form an
**Import JSON…** accent link (not a button) sits in the **header**, between the "New Report" title and
the action icons (when the importer is enabled in Settings). Top-right icon actions (Delete when editing
· Reset · Create/Save); close (✕) / Escape returns without saving.

- **Parent fields:** **Report Date** (Calendar; defaults today) + **Type** (dropdown) share one line;
  **Provider** sits below on its own line; then **Body Part** (shown for
  mri/ultrasound/mammogram/other), **Narrative**, and
  **Document Links** (repeatable Google-Drive URL rows). The optional fields are hidden when trimmed off
  in Medical Settings → Visible Fields (M3); date/type/results are always shown.
- **Results:** an **Add result** button opens a searchable **test picker** (the seeded reference grouped
  by category) or **Add custom test** (an ad-hoc row with an editable name + category). Each result row
  edits the value (number and/or text, by the test's kind), unit, reference range (as printed), a flag
  (none/high/low/abnormal), and an uncertain toggle; rows can be removed. Manual values are stored
  as-entered (no unit normalization — that's the importer's job).
- **Eye reports** (type = eye) surface a dedicated **Eye Refraction** grid above the results: a row per
  eye (OD / OS) × **Sphere / Cylinder / Addition** (dioptres). Each cell edits the `value_num` of the
  matching `eye`-category `medical_result` row (created on first input, removed when cleared), so the six
  values store + trend like any measurement — they just get a grid instead of the generic picker, and
  are hidden from the "Other Results" list to avoid double entry. IOP / other eye findings go through the
  generic results list as usual.

## Medical - Import (`/medical/import`, sheet)

Reached from **Medical Settings → Import JSON / CSV…** or the **Import** button on the New-Report form
(both gated by the importer toggle). Choose a `.json` (preferred) or `.csv` file generated outside the
app by an AI tool (see `templates/medical-extraction-prompt.md`). The parse applies **tolerant JSON
repair** (auto-fixes a stray quote after a number, e.g. `8.6"`); an unparseable file shows a **specific
error** (line/column). Each result is **matched to a reference test** (fuzzy, CJK-aware, with a
provider-alias map) and **unit-normalized** to the test's canonical unit (flagged, original kept). The
**review** then shows **counts per category** (to catch a skipped section), every parsed row in the same
editor as manual entry (edit/add/remove; uncertain + normalized noted), and the report header — where
you **paste the Drive link(s)**. **Save** writes idempotently: a report with the same date + type is
**replaced**, so re-importing the same file never duplicates.

## Medical - Settings (`/medical/settings`)

- **Dashboard → Tracked Tests**: choose which tests trend on the Dashboard (the sparkline grid). A
  sheet grouping the reference tests by category with a toggle each; persisted to
  `medical_tracked_tests` (seeded from `default_tracked` on first run, so it's pre-populated).
- **Display → Display Order**: **drag-to-reorder** the category **sections** and the **tests within a
  section** (drag handles). A **Sections** list reorders the categories; a **Tests in section** list
  (gated by a category picker) reorders that section's tests. Saved as personal overrides
  (`medical_section_order` / a flat `medical_test_order`) and applied to the Dashboard + Report detail;
  an unset/partial override falls back to the seeded order.
- **Report Form → Visible Fields**: choose which optional Add/Edit-Report fields appear (date, type,
  results always shown). NULL = all visible.
- **Enable Structured Import** (**on by default**): surfaces the **Import JSON / CSV…** launcher (and
  the Import button on the New-Report form).
- **Security → Lock**: set up / change / turn off the module **PIN**, register an optional **Face ID /
  Touch ID** unlock (hidden where the device has no platform authenticator), and choose the **auto-lock**
  timeout (Immediately / 1 / 5 / 15 min / Only on app restart). See the Lock screen below.

## Medical - Lock screen

Shown over the whole Medical module whenever it's locked — on app **cold start** and after the chosen
auto-lock idle timeout (always re-locks on restart). A **mandatory PIN** entry is always available; if a
biometric unlock was registered it is **auto-attempted** on appearance (and re-tryable via a button),
silently falling back to the PIN on any failure. A small **"Forgot PIN? Sign out"** escape avoids a hard
lockout. The lock is a convenience gate on this device — the data is already private to the account
(RLS); it is not a server-verified boundary.

## Travel - Dashboard (`/travel`)

- **Six count tiles** over `status = visited` trips, laid out **3 columns × 2 rows, filled
  column-first**: **中国省份** (China provinces, with an `N / 34` suffix) · **中国城市** (China cities) |
  **Countries** · **Cities** | **Trips This Year** · **Days Travelled** — distinct counts (China-scoped
  ones use a China-country match; the province count is intersected with `CHINA_PROVINCES`, so it never
  exceeds 34; Days Travelled is the inclusive span of dated visited trips). Monetary spend is per-trip
  (Expenses tab), not rolled up here. (The standalone province-progress bar was removed — it duplicated
  the 中国省份 tile.)
- **Shelves**: **Recently Visited** (reverse-chron, with a "See all trips" link), **Planning**,
  **Want to Visit** — each a card row (cover thumbnail · name · date range · primary region · status
  chip), tapping into the Trip Builder. Empty overall → a **New Trip** CTA.

## Travel - Map (`/travel/map`)

- A **Leaflet** map (OSM tiles), lazy-loaded into its own chunk. A **markercluster dot per visited
  city** (coral = visited, neutral = planned), placed from the city's `remembered_city` coords; a city
  without a cached pin shows no dot (a hint points to the picker's "Look up online").
- A **Region fill** toggle (default on): China filled by province (DataV GeoJSON, matched via
  `snapProvince`) + non-China countries filled whole (Natural Earth, matched via `resolveCountryName`),
  over visited trips, in the teal "Visited" colour.
- Tapping a dot opens the trip(s) touching that city (single → Trip Builder; multiple → a short list).

## Travel - Trips (`/travel/trips`)

- A **full-width Search bar** (placeholder "Search trip name, city, companion" — matches trip name,
  itinerary city, and companions) with an **icon-only Filter button** on its own row below (tints
  **accent** while open). The Filter panel (shared `FilterPanel` pane, label-free) holds **Any
  Country**, **Any Province**, **Any Status**, **Any Rating** (minimum: Any / 1★+ … / 5★, mirroring
  Shows), **Any Year**, and a footer with the **Sort** control next to **Clear Filters**. Sort over
  { Date, Country, Province, City, Status, Trip Name } with an **asc/desc** toggle (country/province/
  city use the trip's alphabetically-first itinerary value; undated trips last); default is **Date**
  descending (a reverse-chronological list). Row: cover thumbnail · name · status chip · date range ·
  primary region. Tap → Trip Builder; **swipe-left → Delete** (hard, cascades days/stops/expenses).

## Travel - Trip Builder (`/travel/entry` new, `/travel/trip/:id` edit)

The header's top-left is a **✕ Close** (returns to where you came from — falling back to the Trips list
on a direct load/refresh — matching the other modules; Escape does the same).

- **New** (`/travel/entry`): header-only — **Trip Name** + **Base Currency** on one line, **Status**
  below — with **Reset** + **Create** icon actions. **Create** persists the trip and opens it for editing
  (days/stops need a saved trip).
- **Edit** header card: **Trip Name** + **Base Currency** on one line; **Status** (Want to Visit /
  Planning / Visited, dropdown, filling the line) + **Rating** (0–5 half-stars, its label aligned over
  the stars — the same Status/Rating layout as the Shows form) on the next; **Cover Image URL** (rendered
  `no-referrer`, previewed); **Companions** paired with a **Track Reimburse** toggle (label over the
  toggle); **Notes**. Top-right icon actions: **Delete** (removes the trip, cascading days/stops/expenses)
  · **Reset** (reverts the header fields to the saved values, disabled when unchanged) · **Save** (persists
  the header and returns to where you came from; days/stops/expenses auto-save on each change, so they're
  already persisted).
- Two sub-tabs (segmented): **Itinerary** and **Expenses**.
- **Itinerary**: **Add Day** + (when >1) **Reorder Days** (a drag-reorder sheet). Each **Day** card shows
  `Day N`, a tappable **Calendar date chip** (the date or "Add date" — writes `trip_day.day_date` and
  re-caches the trip's start/end), **duplicate**, and **delete**. Within a day, **Stops** are a
  drag-reorder list (tap a stop to edit; a "Done" chip on done stops; skipped stops are struck through),
  plus **Add Stop**.
- **Stop editor** (local overlay): **Type** (Travel / Visit / Eat / Shop / Stay / Other), **City** (opens
  the City picker), Description, type-specific fields (Travel → Mode/From/To; Visit → Local Transit),
  Time, **Cost + currency** (defaults to the trip's base currency, overridable; **informational only,
  never summed**), Details, **Completion** (Unmarked / Done / Skipped), and a **Move to day** picker.
- **Expenses**: **Add Expense**; a **Totals** card (per-currency cost/net, then the **HKD total**); a
  **Conversion to HKD** card (per non-HKD currency: an editable rate + a **Fetch missing rates** button —
  Frankfurter at the trip's first day; missing currencies are flagged and excluded until priced); a
  **By Category (HKD)** donut; and the expense rows (date · description · category · cost; net when
  tracked; swipe-delete, tap-to-edit).
- **Expense editor** (local overlay): Date (Calendar), Description, **Category** (configured list), Cost
  - currency, and — when Track Reimbursement is on — a **Reimbursed** field accepting a number or a
    formula on `amount` (presets ½ / ⅖ / Full), with the computed reimbursed + net shown live.

## Travel - City Picker (modal, from a Stop's City)

- Type a city → **remembered cities** matching fill instantly (tap to pick). An optional **Look up
  online** runs Nominatim (assist-only) and lists suggestions that fill Country / Province / coords.
  Manual entry always available: Country, and Province (a **CHINA_PROVINCES** select when the country is
  China, else free text). Confirming caches the city (`remembered_city`) and returns it to the stop.

## Travel - Settings (`/travel/settings`)

- **Expenses → Expense Categories**: add / rename / delete / **drag-reorder** the category list (stored
  on `profile.travel_expense_categories`). Deleting a category still used by expenses prompts a
  **reassignment** first; the last category can't be deleted.
  The two importers are accent-coloured upload links (no chevron), mirroring the other modules.
- **Import → Import JSON Trips** (listed first): a JSON array of trips → one combined review (per-trip
  day/stop counts + a pooled **new-cities** list with optional per-city geocode) → import as drafts.
- **Import → Import CSV Expenses** (listed second): a wide sheet (Trip, Date, category columns…, Cost,
  Re-imbursed) → detected-columns + **unknown-header mapping** + per-trip preview + **replace-per-trip** →
  import. Columns + rules: `templates/travel-expenses-import-guide.md`.
  Shape: `templates/travel-itinerary.schema.json`; prompt: `templates/travel-itinerary-prompt.md`.
- **FX overrides** are per-trip and live in the trip's Expenses tab (not here).
