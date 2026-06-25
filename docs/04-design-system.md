# 04 — Design System (Look & Feel)

Dark, calm, Cronometer-like. These tokens are taken directly from the approved wireframes — match them exactly. (Screenshots, if added, live in `docs/wireframes/` but serve as samples only; docs/\*.md files are authoritative.)

## Color tokens

| Token             | Hex                      | Use                                                        |
| ----------------- | ------------------------ | ---------------------------------------------------------- |
| `bg`              | `#161b28`                | App / screen background                                    |
| `surface`         | `#232a3a`                | Cards, group headers, list groups                          |
| `surface-alt`     | `#1b2130`                | Nested/expanded rows, summary panels                       |
| `input`           | `#2a3142`                | Input boxes, segmented-control track, pills                |
| `border`          | `rgba(255,255,255,0.08)` | Card borders, dividers (use 0.06–0.07 for inner rows)      |
| `text-primary`    | `#e8eaf0`                | Primary text                                               |
| `text-secondary`  | `#9aa3b5`                | Labels, captions, inactive                                 |
| `text-muted`      | `#c2c7d4`                | Secondary values                                           |
| `text-tertiary`   | `#5b6172`                | Disabled / future dates                                    |
| `accent` (coral)  | `#e8623c`                | Brand, active tab, links, energy-negative, favorites heart |
| `positive` (teal) | `#5dcaa5`                | Add `+`, activity/supplement accents, "food logged" dot    |
| `info` (blue)     | `#5b8def`                | "Want" status chip (planned) on Shows/Books                |
| `danger`          | `#e2574c`                | Over-limit bars and % text, destructive text               |
| `delete`          | `#e24b4a`                | Swipe-to-delete background                                 |
| `track`           | `#3a4253`                | Progress-bar track, off-toggle                             |
| `fill`            | `#eef1f7`                | Progress-bar fill; primary-button background               |
| `dynasty`         | `#d8a657`                | Gold dynasty badge (Shows/Books Chinese titles)            |
| `cat-meal`        | `#e2574c`                | Diary category icon — Breakfast/Lunch/Dinner (red apple)   |
| `cat-snack`       | `#e2933c`                | Diary category icon — Snacks (orange cookie)               |
| `cat-supplement`  | `#a779e0`                | Diary category icon — Supplements (purple pill)            |
| `cat-activity`    | `#5b8def`                | Diary category icon — Activities (blue runner)             |

Primary button = `fill` background with `#161b28` text (a light pill on dark). The accent coral is
_not_ the primary-button color; it's for emphasis, active states, and energy.

## Radii & spacing

- Screen container: 28px. Cards/groups: 14px. Inner rows: 12px. Pills: 16–24px. Inputs: 8px.
- Section padding ~16px horizontal. Card-to-card gap ~14px. Row vertical padding ~13px.

## Typography

- System sans (`-apple-system`/SF Pro; Inter as a web fallback).
- Screen title 18 / 500. Modal title 17 / 500. Body 15. Secondary 12–13.
- Section labels: 11px, UPPERCASE, letter-spacing 0.08em, color `text-secondary`.

## Core components (build once in `src/components`)

- **BottomNav** — 4 items (Dashboard, Diary, Library, Settings); active item coral.
- **SectionCard** — `surface` rounded container wrapping rows with hairline dividers.
- **ListRow** — leading icon, two-line name/subtitle, trailing value or chevron.
- **NutrientBar** — name + "value / target" (muted) + %; thin track+fill; **red variant** when over UL.
- **Toggle** — pill switch; on = coral with knob right, off = `track` with grey knob left.
- **SegmentedTabs** — `input` track, active segment = `fill` pill with dark text (All/Favorites/Custom,
  Food/Supplement, Foods/Activities). Generic over N options — Shows reuses it for the **Type**
  (TV/Movie), **Status** (Want/Watching/Watched/Dropped), and **LGBT+** (None/Some/Significant) controls.
- **GroupHeader** — collapsible: expand chevron · category icon · title · kcal subtotal, with a green
  `+` on the right.
- **SwipeRow** — swipe-left reveals a `delete` Delete action.
- **SearchBar** — magnifier + input (+ barcode icon on Add Food).
- **FilterToggleButton** — the shared **icon-only** Filter toggle (`src/components/FilterToggleButton.tsx`):
  a bare `IconFilter` that tints **accent** while its panel is open, else `text-secondary`. Sits to the
  right of the `SearchBar` (Shows/Books/Quotes/Medical) or on its own row (Travel). Replaces the old
  per-module labelled "Filters (N)" buttons.
- **FilterPanel** — the collapsible filter-panel "pane" (`src/components/FilterPanel.tsx`): a
  `rounded-card border bg-surface p-3 text-xs` surface that wraps a module's dropdowns/date rows + the
  Sort/Clear-Filters footer. Used by every Library/Reports/Trips filter.
- **SortControl** — the shared "Sort" cluster (`src/components/SortControl.tsx`): a label + sort-field
  `SelectMenu` + an asc/desc icon toggle. Lives in the `FilterPanel` footer next to **Clear Filters**.
  Each module passes its own `options` array, so editing a module's Sort menu is a one-line code change.
- **DateRangeRow** — a single-line filter date range — `label · From · To` — opening the shared
  `Calendar`, with a small ✕ to clear a bound (`src/components/DateRangeRow.tsx`). Used by the
  Shows/Books Library "Started" / "Finished" filters.
- **PrimaryButton** / **SecondaryButton** — light `fill` pill / outline pill. A `size` prop toggles
  `default` (full, e.g. sign-in) vs `sm` (compact, used by the top-right ADD / SAVE / CREATE / RESET
  header actions).
- **FieldRow** — label + value/input + chevron, for forms and Settings.
- **EffortPicker** — Light / Moderate / Vigorous radio list with MET ranges.
- **Sheet** — slide-up overlay for route-based modal screens (scrim, `bottom`/`full` variants,
  Esc/scrim/back close); the app shell renders sheets over the active tab via React Router's
  background-location pattern.
- **Splash** — full-screen loading state while the auth session resolves.
- **Calendar** — month-grid date picker (a local overlay, not a route). Presentational: per-day cue
  dots + legend are drawn only when a caller passes an optional `loadCues(monthStart, monthEnd)`
  loader (Wellness Diary draws food/activity dots; Shows date pickers pass none). **Tapping the
  month-year header** switches to a **year-stepper + month grid** (the `MonthPicker` pattern, inlined);
  picking a month returns to that month's day grid (the bottom Cancel/OK still commit the day).
- **EntryHeaderActions** — the shared top-right action cluster for every New/Edit form
  (`src/components/EntryHeaderActions.tsx`): compact `sm` **icon** buttons in order **Delete · Reset ·
  Submit**. **Reset** = `IconArrowBackUp` (undo), **Submit** = `IconPlus` (new) / `IconDeviceFloppy`
  (editing). **Delete** (`IconTrash`, `danger`) shows **only when editing** and flips to a two-step
  inline confirm before firing. Disable gating is unchanged (Reset needs a change; Submit needs dirty /
  required fields). Replaces the old text RESET / CREATE / SAVE buttons across all modules.
- **EmptyState** — vertically-centered "No X yet" line over a **+ New X** action pill
  (`src/components/EmptyState.tsx`). Used by the media Dashboards/Libraries (Shows/Books/Quotes) and the
  Medical Dashboard/Reports; the host gives its content region `flex-1` so it centers.
- **StarRating** — 0–5 **half-star** rating; display (no `onChange`) or input (two half-width
  hit-zones per star; tap the current value to clear). Reused on Shows + Books Entry + Library rows.
- **ShowTypeBadge** — small chip with a TV (`IconDeviceTv`), movie (`IconMovie`), or documentary
  (`IconVideo`) icon, on every Shows row/poster. The Entry **Type** control is a three-segment
  `SegmentedTabs` (TV Show / Movie / Documentary). (Books have no type badge — all books are one kind.)
- **Favourite heart** — an `IconHeart`/`IconHeartFilled` toggle (filled `accent` when on, `text-tertiary`
  when off) in the Shows/Books/Quotes Entry header sets `is_favorite`; a small filled ♥ marks favourite
  rows on Library/Dashboard lists, and a "Favourites" Dashboard shelf + "Favourites only" Library filter
  surface them (the shared pattern across all three media modules).
- **Refresh from TMDB** — a small `⟳` (`IconRefresh`) action beside Search TMDB on the Shows Entry form,
  greyed/disabled until a `tmdb_id` exists; spins while fetching and reports "Updated" / "Already up to date".
- **StatusChip** — a **presentational** status pill taking a `label` + palette `className`, so Shows,
  Books, and Quotes share one chip. Shows/Books use the per-status palette tokens: **Want** = blue
  (`info`, planned) / **Watching·Reading** = coral (`accent`, active) / **Watched·Read** = teal
  (`positive`) / **Dropped** = grey (`track`). The "Want" label is deliberately short ("Want", not "Want
  to Watch"/"Want to Read") so the chip stays compact; the shelf titles still spell it out. Chips appear
  on every Library row **and** every Dashboard row (Shows = Favourites/Up Next/Watching/Want shelves,
  Books = all shelves). **Quotes** reuses the same chip for its **Category badge**
  (a single neutral palette; a fixed colour per category is an optional, deferred nicety) and the
  importer/linker type pills.
- **Thumb** — the shared presentational 2:3 rounded image-or-placeholder (`src/components/Thumb.tsx`,
  `url` + `className`; a neutral `bg-input` tile when `url` is null). Its `<img>` sets
  `referrerpolicy="no-referrer"` so hotlink-protected CDNs (a pasted Douban/streaming poster) still serve.
  **PosterThumb** (Shows) wraps it, resolving `posterUrl` (`w92` list / `w185` detail) — which now passes
  a full pasted image URL through as-is and only prefixes the CDN base for a TMDB path; **CoverThumb**
  (Books) wraps it with the full `cover_url` (Google Books / Open Library — no CDN base). Used by search
  sheets, Dashboard rows, and Library rows in both modules.
- **TitleSearchSheet** / **BookSearchSheet** / **QuoteSourceLinkSheet** — title/source search, a
  **local** full-screen overlay inside Entry (not the routing `Sheet`, which would remount Entry and
  lose the draft): search bar + thumb result rows; selecting a row populates the live form. Shows scopes
  by Type (TMDB); Books searches Google Books (Open Library fallback); **Quotes** searches the user's own
  local Show + Book rows (no external API) and binds the FK + denormalised Title/Source Type/Author.
- **TagInput** — a free-form tag editor (`src/components/TagInput.tsx`): committed tags as removable
  `rounded-pill` chips + a text input that commits on **Enter/comma**, removes the last on Backspace, and
  offers an autocomplete dropdown over passed suggestions (case-insensitive dedupe). Used by the Quotes
  Entry form.
- **Quote card** (Zen): large centred quote text with comfortable line-height (`whitespace-pre-line` +
  `break-words` so multi-line and **CJK** render correctly); a metadata cluster (Author · source type ·
  title-as-link); the Category `StatusChip` + Tag chips; a favourite heart. Refreshed by a Shuffle
  button + a hand-rolled pull-to-refresh gesture.
- **SelectMenu** — a compact dropdown (button + label + chevron → scrim + absolute menu of
  `{value,label}` options); generic over string options. Used by the Shows, Books, and Quotes Library
  filters/sort **and the Entry forms' Status / LGBT+ / Language / Type controls** (replacing the former
  segmented controls there). **Esc** collapses an open menu (via `useEscapeKey`). The menu **flips
  upward** (measuring the trigger's viewport rect on open) when there isn't room below — so a dropdown
  near a short form's scroll-clip edge (e.g. New Trip) still shows all its options.
- **useEscapeKey(handler, enabled?)** (`src/hooks/useEscapeKey.ts`) — shared **Escape-to-dismiss**.
  One document listener drives a LIFO stack so the **innermost** overlay handles Esc: route `Sheet`s
  and the local search sheets close themselves, the `Calendar` closes, an open `SelectMenu` collapses,
  and the Add/Edit screens (`ShowsEntry`/`BooksEntry`/`QuotesEntry`) `navigate(-1)` — but only when no
  overlay is layered above them (the layered overlay consumes the key first).
- **MonthPicker** — month/year picker (year stepper over a month grid, OK/Cancel) for the Net Worth month selector (a local overlay, not a route).
- **EnergyBalanceCard** — Consumed / BMR / Activity / bold Net.
- **NutrientReport** — shared body of Dashboard + Daily Report (energy card + visible-nutrient sections).
- **CollapsibleSection** — collapsible card for the New Food nutrient-entry groups.
- **BarcodeScanner** — ZXing camera scanner (lazy-loaded).
- **MedicalLockScreen / PinInput** — the Medical lock gate (`src/components/MedicalLockScreen.tsx`): a
  full-shell overlay (lock glyph, masked numeric `PinInput`, Unlock, an auto-tried Face ID / Touch ID
  button when a credential is registered, and a "Sign out" escape). `PinInput` is a shared masked
  numeric field (digits only, Enter submits) reused by the lock settings. Lock colours reuse `danger`
  for errors; the screen sits at `z-50`, above sheets.
- **ReorderList** — a pointer-drag reorderable list (`src/components/ReorderList.tsx`): a grip handle
  per row (`IconGripVertical`); drag it to move the row (Pointer Events, no dnd dependency — consistent
  with `SwipeRow`), rows shift to open a gap, commit on release. Uniform row height (rows truncate to one
  line) so the target slot is `round(dragΔ / rowHeight)`. `touch-action:none` is on the handle only, so
  a row body still scrolls. An optional `renderTrailing(id)` slot adds per-row controls (rendered outside
  the truncated body). Used by the Medical Display-Order sheet (sections + tests-in-section) and the
  Quotes **`QuoteListEditor`**.
- **QuoteListEditor** — the shared add / rename (inline) / delete / drag-reorder editor for a
  configurable Quotes list (`src/components/QuoteListEditor.tsx`), generic over `{key,label}` entries.
  Wraps `ReorderList` (rename + delete in the trailing slot) and auto-saves each change; deleting a
  value still used by quotes opens a `SelectMenu` reassignment picker (bulk-moves quotes, then removes),
  refuses the last value, and honours delete-protected keys. Used by the Source Types / Categories sheets.
- **Sparkline** — a tiny dependency-free **inline-SVG** trend line (`src/components/Sparkline.tsx`):
  min–max normalized values, an end dot tintable by a flag colour. Used by the Medical Dashboard's
  tracked-test grid so many render cheaply without a chart library. The **full** trend chart
  (`MedicalTrendChart`, recharts) is **lazy-loaded** only when a sparkline is expanded — the same
  own-chunk pattern as `NetWorthTrendChart`; flag colours map to the semantic tokens (high/abnormal =
  `danger`, low = `info`, in-range = `accent`).

## Icons

Tabler Icons (or lucide-react), outline style. Mapping used in the wireframes:
food = apple, supplement = pill, activity = run/karate/barbell, energy = flame/flask,
nav = chart-bar / notebook / apple / settings, delete = trash, favorite = heart, scan = barcode.
Form header actions: delete = `IconTrash`, reset = `IconArrowBackUp` (undo), create = `IconPlus`,
save = `IconDeviceFloppy`, search = `IconSearch`, source link = `IconLink`, TMDB refresh = `IconRefresh`.

**Diary group category icons** (in the group headers) use the `cat-*` color tokens above:
Breakfast/Lunch/Dinner = red apple (`cat-meal`), Snacks = orange cookie (`cat-snack`),
Supplements = purple pill (`cat-supplement`), Activities = blue runner (`cat-activity`). The
icon↔group mapping lives in `constants/groups.ts`.

## Travel

- **Stop-type icons** (Tabler): Travel = plane/train, Visit = map-pin, Eat = tools-kitchen, Shop =
  shopping-bag, Stay = bed, Other = dots.
- **Completion:** Done = a teal "Done" chip; Skipped = a muted, struck-through stop row.
- **Trip cover:** a rounded image rendered `referrerpolicy="no-referrer"` (thumbnail in lists, larger in
  the header); a neutral placeholder when null (the shared `Thumb`).
- **Dashboard:** six count tiles in a **3-column × 2-row** grid filled **column-first** (China →
  World → Trips; the first two tiles labelled **中国省份 / 中国城市**). No separate province-progress
  bar. **Status chips** Want = neutral (`track`), Planning = amber (`warning`), Visited = teal
  (`positive`) — the `TRIP_STATUS_CHIP` palette, via the shared presentational `StatusChip`.
- **Map:** Leaflet over OSM tiles; **coral** dots (`accent` = visited) / **neutral** dots
  (`text-secondary` = planned), clustered; the visited-region fill is the teal `positive` at low opacity.
- **Expense breakdown:** a small **Recharts donut** over the categories (HKD-equivalent), lazy-loaded.
- **Reorder / category editors:** drag handles via the shared `ReorderList`; the category editor is the
  shared `ConfigListEditor` (same as Quotes).

## Button placement

Action buttons live in the **top-right of the screen/sheet header** (consistent with Net Worth), at
the compact `sm` size, rendered as **icons** via the shared **`EntryHeaderActions`**: form screens show
**Delete** (trash, editing only) · **Reset** (undo) · **Create** (plus, new) / **Save** (floppy,
editing); logging screens that add to the Diary keep a single **plus** (Add) in create mode. No bottom
action bar. The header title (food / activity name) sits left of the actions and **clamps to 2 lines
with an ellipsis** when long. (See `01-screens.md` → Button convention.)
