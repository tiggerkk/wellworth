# 01 — Design System (Look & Feel)

Dark, calm. These tokens are taken directly from the approved wireframes — match them exactly. (Screenshots, if added, live in `docs/wireframes/` but serve as samples only; docs/\*.md files are authoritative.)

## Color tokens

| Token              | Hex                      | Use                                                                                                                                                                                                       |
| ------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg`               | `#161b28`                | App / screen background                                                                                                                                                                                   |
| `surface`          | `#232a3a`                | Cards, group headers, list groups                                                                                                                                                                         |
| `surface-alt`      | `#1b2130`                | Nested/expanded rows, summary panels                                                                                                                                                                      |
| `input`            | `#2a3142`                | Input boxes, segmented-control track, pills                                                                                                                                                               |
| `border`           | `rgba(255,255,255,0.08)` | Card borders, dividers (use 0.06–0.07 for inner rows)                                                                                                                                                     |
| `text-primary`     | `#e8eaf0`                | Primary text                                                                                                                                                                                              |
| `text-secondary`   | `#9aa3b5`                | Labels, captions, inactive                                                                                                                                                                                |
| `text-muted`       | `#c2c7d4`                | Secondary values                                                                                                                                                                                          |
| `text-tertiary`    | `#7a8294`                | Hints / disabled / future dates (lightened from `#5b6172` for readability — still below `secondary`)                                                                                                      |
| `accent` (blue)    | `#3874f6`                | Brand, active tab, links, energy-negative                                                                                                                                                                 |
| `favorite` (rose)  | `#e06aa0`                | Filled favorite heart (decoupled from `accent`)                                                                                                                                                           |
| `positive` (teal)  | `#5dcaa5`                | Add `+`, activity/supplement accents, "food logged" dot                                                                                                                                                   |
| `info` (blue)      | `#5b8def`                | (legacy; no longer used for status chips)                                                                                                                                                                 |
| `plan` (purple)    | `#a779e0`                | "Want" status chip (planned) on Shows/Books/Travel                                                                                                                                                        |
| `warning` (orange) | `#e8623c`                | In-progress status chip (Watching·Reading·Planning); import notes                                                                                                                                         |
| `danger`           | `#e2574c`                | Over-limit bars and % text, destructive text                                                                                                                                                              |
| `delete`           | `#e24b4a`                | Swipe-to-delete background                                                                                                                                                                                |
| `track`            | `#3a4253`                | Progress-bar track, off-toggle                                                                                                                                                                            |
| `fill`             | `#eef1f7`                | Progress-bar fill; primary-button background                                                                                                                                                              |
| `dynasty`          | `#d8a657`                | Gold dynasty badge (Shows/Books Chinese titles)                                                                                                                                                           |
| `cat-meal`         | `#e2574c`                | Diary category icon — Breakfast/Lunch/Dinner (red apple)                                                                                                                                                  |
| `cat-snack`        | `#e2933c`                | Diary category icon — Snacks (orange cookie)                                                                                                                                                              |
| `cat-supplement`   | `#a779e0`                | Diary category icon — Supplements (purple pill)                                                                                                                                                           |
| `cat-activity`     | `#5b8def`                | Diary category icon — Activities (blue runner)                                                                                                                                                            |
| `med-*` (18)       | per category             | Medical lab-result section accents (`--color-med-general` … `--color-med-other`); one distinct hue per category, consumed via `MEDICAL_CATEGORY_COLOR` for `MedicalSection`'s left stripe + tinted header |

Primary button = `fill` background with `#161b28` text (a light pill on dark). The accent blue is
_not_ the primary-button color; it's for emphasis, active states, and energy.

## Radii & spacing

- Screen container: 28px. Cards/groups: 14px. Inner rows: 12px. Pills: 16–24px. Inputs: 8px.
- Section padding ~16px horizontal. Card-to-card gap ~14px. Row vertical padding ~13px.

## Typography

- System sans (`-apple-system`/SF Pro; Inter as a web fallback).
- **One font-size scale — the `@theme` `--text-*` tokens in `src/index.css`.** Sizes are in `rem`, so
  they ride the **`--font-scale`** lever on `<html>` (`font-size: calc(16px * var(--font-scale))`). The
  Settings **Font Size** preset just sets `--font-scale` (1 / 1.15 / 1.30) and the whole UI grows —
  text (rem) and icons (a `.tabler-icon` transform) together (Dynamic Type; see `02_tech_spec.md` F23).
- **Never hardcode `text-[Npx]`, `text-xs/sm/lg`, etc. — pick a role token.** Each role = one blessed
  (size · color · weight) recipe:

  | role token     | px @1× | recipe (size + color [+ weight])                                                  | used for                                   |
  | -------------- | ------ | --------------------------------------------------------------------------------- | ------------------------------------------ |
  | `text-title`   | 18     | `text-title font-medium text-text-primary`                                        | screen / sheet titles                      |
  | `text-heading` | 17     | `text-heading font-medium text-text-primary`                                      | entry & modal headers                      |
  | `text-field`   | 16     | baked into `.field-control` (iOS auto-zoom floor, F21)                            | form inputs                                |
  | `text-body`    | 15     | `text-body text-text-primary` (row titles); `… text-text-secondary` (muted)       | body, row titles, button text              |
  | `text-label`   | 13     | `text-label text-text-primary` / chip body                                        | compact labels, chips                      |
  | `text-caption` | 12     | `text-caption text-text-secondary` (label/caption); `… text-text-tertiary` (hint) | captions, field labels, hints, ResultCount |
  | `text-section` | 11     | `text-section font-medium uppercase tracking-[0.08em] text-text-secondary`        | section labels, status chips               |

- Large display numerals (hero stats) may use Tailwind's `text-xl`/`2xl`/`3xl` — these are rem-based
  and scale with the lever too; they're outside the 7-role chrome scale.
- Color stays a **separate** `text-text-*` utility (don't fold color into the size token). Text colors:
  `text-primary` body, `text-secondary` muted/labels, `text-tertiary` hints/disabled (lightened to
  `#7a8294` for readability), `text-muted` trailing values. **Placeholders** are `text-text-secondary`
  app-wide (baked into `.field-control`; `SearchBar`/`TagInput`/`PinInput` set it directly) — never
  `text-tertiary` (too dim).

## Date formatting (one source of truth — `src/lib/date.ts`)

Always format dates through these shared helpers — never inline a `new Intl.DateTimeFormat` or
hand-built string in a screen, so the formats can't drift apart:

- **`formatFullDate`** → `Jun 25, 2026` (**MMM DD, YYYY**) — **the canonical date format used
  everywhere** a date value is shown: entry/edit screens (incl. Wellness Diary header + Daily Report),
  all module filters (`DateRangeRow`), profile birthday, Medical reports, Net Worth Fund "priced as of".
- **`formatMonthDay`** → `Jun 13` (MMM DD, **no year**) — **the only exception**: deliberately
  year-less to stay short in Shows / Books / Quotes **Dashboard + Library** rows (and the Shows
  Dashboard "Started" line); also the short end of a Travel trip date range.
- **`formatDayLabel`** → `Today` / `Yesterday` / `Tomorrow`, else `formatFullDate` (`MMM DD, YYYY`) —
  **Wellness Diary nav/header + its copy toast only** (the one place relative day labels make sense).
- **`formatMonthLabel`** → `June 2026`; **`formatMonthShort`** → `Jun ’26` (chart ticks).

Every other date value reads as `MMM DD, YYYY` (`formatFullDate`), or `MMM DD` (`formatMonthDay`) in
the Shows/Books exception above — no weekday is ever shown.

## Core components (build once in `src/components`)

- **BottomNav** — leading **Home** item + module tabs; active item tints `accent`. The **Home**
  icon sits in a soft accent-tinted (`bg-accent/20`) rounded-pill chip so the hub anchor reads
  apart from the flat module tabs.
- **SectionCard** — `surface` rounded container wrapping rows with hairline dividers.
- **ListRow** — leading icon, two-line name/subtitle, trailing value or chevron.
- **NutrientBar** — name + "value / target" (muted) + %; thin track+fill; **red variant** when over UL.
  `compact` prop drops the "value / target unit" text (name + % only) for narrow columns — used by the Diary highlighted-nutrients 2-col grid so the % is never crowded out by the full name.
- **Toggle** — pill switch; on = `accent` with knob right, off = `track` with grey knob left.
- **SegmentedTabs** — `input` track, active segment = `fill` pill with dark text. Generic over N
  options — used for multi-way controls (Type selectors, Status/LGBT+ filters, Food/Supplement toggle).
  The Library Type control sits in the **sticky header above the `SearchBar`** (always visible, not
  inside the filter panel). A `size` prop (`compact` default / `field`) sizes it to the
  **`.field-control`** height so it aligns with form inputs on an entry screen.
- **`.field-control`** (CSS class in `src/index.css`) — the **single source of truth for a single-line
  form/filter field's chrome + height** (`rounded-input bg-input px-3 py-2 text-field` via `@apply`).
  Font is **`text-field` (16px)** (not 15px) so a focused field never triggers iOS Safari's auto-zoom
  — see F21 in `02_tech_spec.md`; any new focusable text input must stay ≥16px.
  Use it for **every** `<input>`/`<button>`/`<select>`/`<textarea>` field app-wide (compose with
  `w-full`/`flex-1`/`w-NN` for width, `text-right`/`text-left` for alignment, `block`,
  `resize-none`, `placeholder:*`); per-screen `inputClass`/`inputCls` constants are just
  `'field-control …'`. **Number inputs hide their up/down spin buttons globally** (a single
  `input[type='number']` rule in `index.css`) — no per-field class is needed; `.no-spinner` is kept
  only as a now-redundant alias. The shared field components match the same height: **`SelectMenu`** defaults to
  `size="field"` (pass `size="compact"` only to opt a tight spot back down), **`DateRangeRow`** and
  **`SearchBar`** already render at it, and **`SegmentedTabs`** takes `size="field"`. So a row mixing an
  input, a dropdown, a segmented control and a date button all line up. **Never re-spell the
  px/py/text/bg of a field in a screen** — change the height in one place here. The ubiquitous
  full-width composition `'field-control w-full'` is exported once as **`FIELD_CLASS`**
  (`src/constants/forms.ts`); form screens import it (usually `as inputClass`) rather than
  re-declaring the string per file.
- **Field labels** are uniformly **`text-caption text-text-secondary`** (12px) — the small caption above
  an input (`mb-1 …`) or the wrapping `<label>`. Distinct from **section labels** (`text-section`, 11px
  UPPERCASE `tracking-[0.08em]`) and muted captions (`text-text-tertiary`). Don't use
  `text-section`/`text-body` for a field label.
- **GroupHeader** — collapsible diary-group header: expand chevron · category icon · title · kcal
  subtotal (kcal next to the title) · ⟨spacer⟩ · **Delete · Copy · Paste · Add** action icons. Delete
  is a **`ConfirmDeleteAction`** (inline `Delete? ✓ ✗`); Delete/Copy disable on an empty group; Paste
  tints **positive** (teal) only while the in-app clipboard holds items; Add is the green `+`. The
  icons mirror the Edit Trip day-header cluster.
- **IconAction** — the shared header action icon-button (`src/components/IconAction.tsx`): a bare
  Tabler icon at `size 18`, `p-1` hit area, tinted `secondary` (Copy) or `positive` (Add, and
  Paste while armed), muted `text-tertiary` when `disabled`. Used by both the Diary day header and
  `GroupHeader`.
- **ConfirmDeleteAction** — the icon-row delete control (`src/components/ConfirmDeleteAction.tsx`): an
  `IconAction`-styled `IconTrash` that, on click, flips **inline** to `Delete?` + a ✓ (`danger`) /
  ✗ (`secondary`) confirm — the compact, in-cluster counterpart to `EntryHeaderActions`' two-step
  delete. `disabled` blocks entering the confirm. Sibling icons (Copy/Paste/Add) stay visible during
  confirm; the "Delete?" text disambiguates. Used by the Diary day header, `GroupHeader`, the Net
  Worth monthly row, and the Edit Trip day header. This is the single delete model for **icon rows**;
  swipe lists delete on the revealed `SwipeRow` Delete instead (no browser dialog).
- **Toaster** — a single app-wide transient toast (`src/components/Toaster.tsx` + `src/lib/toast.ts`).
  Mounted once in `AppShell`; `showToast(msg)` shows a bottom-centered pill (`bg-surface` border) for
  ~2s. Used for in-app cues like "Copied Breakfast · 3 items".
- **SwipeRow** — swipe-left reveals a `delete` Delete action; tapping it deletes **immediately**
  (the swipe + tap is the confirmation — no browser dialog). Used by every list/library/reports/trips
  row and `ReorderList`'s `onDelete`. Its wrapper sets `touch-action: pan-y pinch-zoom` so the rows
  stay pinch-zoomable (a bare `pan-y` would disable zoom over the whole list — see F21 in `02_tech_spec.md`).
- **SearchBar** — magnifier + input (+ barcode icon on Add Food). Takes an optional `className` so it
  can fill a flex row beside a Filter icon (the list screens pass `min-w-0 flex-1`), and an optional
  `icon` to swap the leading glyph (online-search sheets pass `IconWorldSearch`; default is `IconSearch`).
- **FilterToggleButton** — the shared **icon-only** Filter toggle (`src/components/FilterToggleButton.tsx`):
  a bare `IconFilter` that tints **accent** while its panel is open, else `text-secondary`. Sits flush at
  the right edge of the row, after a `min-w-0 flex-1` `SearchBar` (every list module).
- **FilterPanel** — the collapsible filter-panel "pane" (`src/components/FilterPanel.tsx`): a
  `rounded-card border bg-surface p-3 text-caption` surface that wraps a module's dropdowns/date rows + the
  Sort/Clear-Filters footer. Used by every Library/Reports/Trips filter. Each list screen's criteria
  object (search + filters + sort) is held in **`useSessionState`** (`src/hooks/useSessionState.ts`) so
  it persists for the browser-tab session and survives the navigate-into-an-item-and-back remount; the
  transient panel-open and active-calendar state stay plain `useState`.
- **ResultCount** — a small muted "N results" line (`src/components/ResultCount.tsx`) shown above the
  list on every search/filter screen (Wellness Food/Activity Library, Shows/Books/Quotes Libraries,
  Medical Reports, Travel Trips) so the current match count is always visible. Rendered only when the
  filtered list is non-empty (the "No matches" empty line already conveys zero); pluralizes 1 → result.
- **SortControl** — the shared "Sort" cluster (`src/components/SortControl.tsx`): a label + sort-field
  `SelectMenu` + an asc/desc icon toggle. Lives in the `FilterPanel` footer next to **Clear Filters**.
  Each module passes its own `options` array.
- **DateRangeRow** — a single-line filter date range — `label · From · To` — opening the shared
  `Calendar`, with a small ✕ to clear a bound (`src/components/DateRangeRow.tsx`).
- **PrimaryButton** / **SecondaryButton** — light `fill` pill / outline pill. A `size` prop toggles
  `default` (full, e.g. sign-in) vs `sm` (compact header actions). PrimaryButton's `tone` prop is
  `fill` (neutral, default) or `positive` (teal) — Create / Add / Save actions use `positive` so the
  `+` / floppy / Save matches the teal `+` elsewhere.
- **FieldRow** — label + value/input + chevron, for forms and Settings (compact `py-2` rows; hairline
  `border-b` divider, suppressed on the section's last row). An optional `hint` adds a small muted note
  inline after the label. It `flex-wrap`s — the value drops to its own line when it can't share the row
  (a long value or a larger Dynamic Type preset, F23). **Divider gotcha:** a `FieldRow` wrapped in a
  `<button>` (the Settings nav rows) has its own `last:border-b-0` scope to that button, so it never
  draws a divider — put `border-b border-border last:border-b-0` on the **wrapper button** instead.
- **DisplaySettingsCard** — the shared **DISPLAY** section (`src/components/DisplaySettingsCard.tsx`):
  Font Size + Visible Modules + Units in one `SectionCard`. Fully controlled (parent owns values +
  persistence); changing Font Size applies the preset instantly via `applyFontSize`. Rendered by both
  **Global Settings** and the first-run **Onboarding** wizard above `ProfileMetricsFields`, so the two
  screens stay identical. Pairs with **ProfileMetricsFields** (`src/components/ProfileMetricsFields.tsx`)
  — the shared **PROFILE** section (Birthday / Sex / Height / Weight; metric↔imperial conversion in one
  place; Units is _not_ here, it lives in `DisplaySettingsCard`).
- **VisibleFieldsSheet** — the shared "Visible Fields" sheet used by every module's Settings
  (`src/components/VisibleFieldsSheet.tsx`): a `full` `Sheet` + header + intro + auto-saving toggle list.
  Each module passes its `*_ENTRY_FIELDS` list (in New/Edit form order), the `profile` `text[]` column
  (NULL = all visible), the intro string, and optional **`extras`** — boolean-column toggles interleaved
  in form-order position (e.g. a Poster URL toggle with `afterKey: 'episodes'`). The `*FieldsSheet.tsx`
  screens are thin wrappers over it. Field lists/labels live in `src/lib/{module}.ts`.
- **EffortPicker** — Light / Moderate / Vigorous radio list with MET ranges.
- **Sheet** — slide-up overlay for route-based modal screens (scrim, `bottom`/`full` variants,
  Esc/scrim/back close); the app shell renders sheets over the active tab via React Router's
  background-location pattern.
- **Splash** — full-screen loading state while the auth session resolves.
- **EntryLoader** — the shared outer wrapper for every New/Edit entry screen
  (`src/components/EntryLoader.tsx`): a full-height `flex h-full min-h-0 flex-col` column that shows
  `Loading…`, an error/not-found line (`errorText`), or — once the async `data` resolves — the inner
  form via a **render prop** `(data) => …` (so `data` is narrowed non-null). Generic over the draft
  type; the caller still keys the form by id so a stale `useAsync` result never mounts under the wrong
  item. Used by the Shows/Books/Quotes/Medical/Insurance entry screens.
- **SettingsLayout** — the shared shell for a global/module **Settings** screen
  (`src/components/SettingsLayout.tsx`): a `flex flex-col gap-5 px-4 py-4` column + sticky header with
  the uniform top-left **`IconX`** dismiss (`navigate(-1)`, also Esc-closable via `useEscapeKey`) and a
  `text-title`. Takes `{ title, closeLabel?, children }` (`closeLabel` overrides the button's
  accessible name — the Literature module passes 關閉); the caller supplies its own loading/error/section
  body. Used by global Settings + every module Settings (Wellness/Net Worth/Shows/Books/Quotes/Medical/
  Travel/Literature), so they share one dismiss affordance per the Button convention below.
- **Calendar** — month-grid date picker (a local overlay, not a route). Presentational: per-day cue
  dots + legend are drawn only when a caller passes an optional `loadCues(monthStart, monthEnd)` loader.
  Header: an **X (top-left)** cancels, and a **centered `‹ month ›` cluster** (arrows pulled in tight
  against the label) frees up the top-left corner. **Tapping the month label** switches to a **month
  grid**; **tapping the year there** opens a **paged year grid** (12 years; the ◀/▶ arrows jump a whole
  page) so distant years like a birthday are a few taps, not dozens. Picking a year returns to the month
  grid, a month returns to that month's day grid. **Tapping a day commits immediately and closes**
  (calls `onSelect`, which every caller treats as "date chosen" + closes) — so there are **no Cancel/OK
  buttons**; **X / scrim / Esc** all cancel (`onClose`). Day styling: **today = white ring,
  no fill**; the **previously-selected date (the `day` prop) = accent-filled** (both can apply at once).
  A single **Today** button is **centered at the bottom** and just navigates the view to the current
  month's day grid (it no longer pre-selects/confirms).
- **EntryHeaderActions** — the shared top-right action cluster for every New/Edit form
  (`src/components/EntryHeaderActions.tsx`): compact `sm` **icon** buttons in order **Delete · Reset ·
  Submit**. **Reset** = `IconArrowBackUp` (undo), **Submit** = `IconPlus` (new) /
  `IconDeviceFloppy` (editing). **Delete** (`IconTrash`, `danger`) shows **only when editing** and flips
  to a two-step inline confirm before firing. Reset needs a change to enable; Submit needs dirty /
  required fields.
- **FilterPill** — the shared filter/tag chip (`src/components/FilterPill.tsx`): a `rounded-pill px-3 py-1
text-body` pill, **`bg-input text-text-primary`** inactive (deliberately whiter + larger than a caption
  for readability), **accent-filled** (`bg-accent text-bg`) when `selected`. With `onClick` it's a
  toggle/nav `<button>` (`aria-pressed` only when `selected` is set); without one it's a display-only
  `<span>`. Used by the Quotes Library tag facet, the Literature poem filters (朝代/主題/…), the Poets
  list (nav), and a poem's tag list (display).
- **CollapsibleColorSection** — the generic collapsible **color-accented** card
  (`src/components/CollapsibleColorSection.tsx`): a left chevron + per-section **colored left stripe**
  (`borderLeft: 4px`) and **tinted header** (`color-mix … 14%`), the same pattern as the Net Worth
  Monthly Entry asset sections / `MedicalSection`, but module-agnostic (takes a `color` + `title`). The
  header label is `text-body font-medium` (not the 11px section caption) so CJK titles read clearly. Used
  by the Literature Poem/Poet detail sections (colours from `LITERATURE_SECTION_COLOR`).
- **EmptyState** — vertically-centered **module icon** over a "No X yet" line over a **+ New X** action
  pill (`src/components/EmptyState.tsx`). Internally `flex-1 justify-center`. Takes an optional `Icon`
  (a Tabler `Icon`, shown muted at size 40). Used by every module's Dashboards/Libraries and the
  Travel Dashboard, Trips, and Map. **The host root must be a full-height flex column** (`min-h-full
flex flex-col`, or `h-full` for Zen) so the `flex-1` fills the real content area.
- **StarRating** — 0–5 **half-star** rating; display (no `onChange`) or input (two half-width hit-zones
  per star; tap the current value to clear).
- **ShowTypeBadge** — small chip with a TV (`IconDeviceTv`), movie (`IconMovie`), or documentary
  (`IconVideo`) icon, on every Shows row/poster.
- **Favourite heart** — an `IconHeart`/`IconHeartFilled` toggle (filled `accent` when on,
  `text-tertiary` when off) in the Shows/Books/Quotes Entry header sets `is_favorite`; a small filled ♥
  marks favourite rows on Library/Dashboard lists, and a "Favourites" Dashboard shelf + "Favourites
  only" Library filter surface them.
- **Refresh from TMDB** — a small `⟳` (`IconRefresh`) action beside Search TMDB on the Shows Entry
  form, greyed/disabled until a `tmdb_id` exists; spins while fetching and reports "Updated" / "Already
  up to date".
- **StatusChip** — a **presentational** status pill taking a `label` + palette `className`. Palette
  tokens: **Want** = purple (`plan`, planned) on Shows/Books/Travel /
  **Watching·Reading·Planning** = orange (`warning`,
  in-progress) / **Watched·Read·Visited** = teal (`positive`) / **Dropped** = grey (`track`). "Want" label is deliberately
  short so the chip stays compact; shelf titles still spell it out. Chips appear on every Library row
  **and** every Dashboard row. The Quotes module reuses the same chip for its **Category badge** (single
  neutral palette).
- **Thumb** — the shared presentational 2:3 rounded image-or-placeholder (`src/components/Thumb.tsx`,
  `url` + `className`; a neutral `bg-input` tile when `url` is null). Its `<img>` sets
  `referrerpolicy="no-referrer"` so hotlink-protected CDNs still serve. **PosterThumb** (Shows) wraps
  it, resolving `posterUrl` (`w92` list / `w185` detail) — which passes a full pasted image URL
  through as-is and only prefixes the CDN base for a TMDB path; **CoverThumb** (Books) wraps it with
  the full `cover_url` (no CDN base). Used by search sheets, Dashboard rows, and Library rows.
- **TitleSearchSheet** / **BookSearchSheet** / **FoodSearchSheet** / **QuoteSourceLinkSheet** —
  title/food/source search, a **local** full-screen overlay (not the routing `Sheet`, which would
  remount the host and lose its draft/preview): search bar + result rows; selecting a row hands the
  result back. `FoodSearchSheet` (USDA, `searchFoods` + `foodMatchScore`, rows show
  `{N} nutrients · {serving}`) backs the food importer's **Change** action.
- **TagInput** — a free-form tag editor (`src/components/TagInput.tsx`): committed tags as removable
  `rounded-pill` chips + a text input that commits on **Enter/comma**, removes the last on Backspace,
  and offers an autocomplete dropdown over passed suggestions (case-insensitive dedupe).
- **SelectMenu** — a compact dropdown (button + label + chevron → scrim + absolute menu of
  `{value,label}` options); generic over string options. Used by Library filters/sort and the Entry
  forms' Status / LGBT+ / Language / Type controls. **Esc** collapses an open menu (via
  `useEscapeKey`). The menu **flips upward** when there isn't room below, and its **max-height is the
  space actually available** on the chosen side (minus an 8px margin), capped at the list's own height
  — so a long list (Dynasty, Quotes Category/Source, …) fills the screen's spare vertical room instead
  of being clipped to a fixed few rows. A `size` prop
  (**`field` default** / `compact`) keeps the trigger at the **`.field-control`** height across forms +
  filters; pass `size="compact"` to opt a tight spot back down.
- **useEscapeKey(handler, enabled?)** (`src/hooks/useEscapeKey.ts`) — shared **Escape-to-dismiss**.
  One document listener drives a LIFO stack so the **innermost** overlay handles Esc: route `Sheet`s
  and local search sheets close themselves, the `Calendar` closes, an open `SelectMenu` collapses, and
  the Add/Edit screens `navigate(-1)` only when no overlay is layered above them.
- **MonthPicker** — month/year picker (year stepper over a month grid, OK/Cancel) for the Net Worth
  month selector (a local overlay, not a route).
- **EnergyBalanceCard** — Consumed / BMR / Activity / bold Net.
- **NutrientReport** — shared body of Dashboard + Daily Report (energy card + visible-nutrient sections).
- **CollapsibleSection** — collapsible card for the New Food nutrient-entry groups.
- **MedicalSection** — collapsible, color-accented lab-result section (`src/components/MedicalSection.tsx`):
  a left chevron (mirrors `GroupHeader`) + per-category colored **left stripe** and **tinted header**
  (`MEDICAL_CATEGORY_COLOR` → `--color-med-*`, tint via `color-mix`); default **expanded**. `variant="card"`
  wraps the body in a `surface` card (Report detail, Dashboard latest-values); `variant="bare"` is the
  header bar only (Edit Report, whose children are already `MedicalResultCard`s).
- **BarcodeScanner** — ZXing camera scanner (lazy-loaded).
- **MedicalLockScreen / PinInput** — the Medical lock gate (`src/components/MedicalLockScreen.tsx`): a
  full-shell overlay (lock glyph, masked numeric `PinInput`, Unlock, an auto-tried Face ID / Touch ID
  button when a credential is registered, and a "Sign out" escape). `PinInput` is a shared masked
  numeric field (digits only, Enter submits) reused by the lock settings. Lock colours reuse `danger`
  for errors; the screen sits at `z-50`, above sheets.
- **MedicalValueRow** — the shared Medical result row (`src/components/MedicalValueRow.tsx`): name + the
  (long, wrapping) printed reference range in a `min-w-0 flex-1` left column, value (+ unit,
  flag-coloured) in a `shrink-0` right column, `items-start` — so a long ref wraps under the name rather
  than squeezing it or pushing the value off the edge. Callers pass row chrome via `className` and
  optional `leftExtra`/`rightExtra` slots. Used by the Medical Dashboard latest-values list and the
  View Report `ResultRow`.
- **ReorderList** — a pointer-drag reorderable list (`src/components/ReorderList.tsx`): a grip handle
  per row (`IconGripVertical`); drag it to move the row (Pointer Events, no dnd dependency), rows shift
  to open a gap, commit on release. Uniform row height (rows truncate to one line). `touch-action:none`
  is on the handle only, so a row body still scrolls. An optional `renderTrailing(id)` slot adds per-row
  controls; an optional `containerClassName` overrides the default card chrome so the list can nest
  inside an existing card (the Diary groups pass `border-t border-border divide-y divide-border`). Used
  by the Medical Display-Order sheet, the configurable-list editors, and the Diary groups (drag to
  reorder logged items).
- **ReorderGrid** — the 2-column (2-up) sibling of `ReorderList` (`src/components/ReorderGrid.tsx`),
  for reordering items shown in a `grid-cols-2` layout. Same in-house Pointer-Events drag, but the
  dragged cell **floats under the finger** and the destination slot is **outlined** (target = nearest
  cell center, from rects cached at drag start) rather than a 1-D row-shift. A cell's grid position
  (linear order = reading order) **is** its hub position — no number badge (it crowded the longer
  labels on narrow phones); each cell has an optional `renderTrailing(id)` control. Used only by the
  **Visible Modules** sheet, whose grid mirrors the 2-column Home hub.
- **ConfigListEditor** — the shared add / rename (inline) / delete / drag-reorder editor for a
  configurable list, generic over `{key,label}` entries (`src/components/ConfigListEditor.tsx`).
  Wraps `ReorderList` (rename + delete in the trailing slot) and auto-saves each change; deleting a
  value still used by records opens a `SelectMenu` reassignment picker, refuses the last value, and
  honours delete-protected keys. Used by Quotes source-type/category lists and the Travel expense
  categories.
- **ExpenseRowsEditor** — the shared inline, spreadsheet-style expense editor
  (`src/components/ExpenseRowsEditor.tsx`): rows of **Description · Category · Currency · Cost** with a
  trailing add row (no modal) and a tap-to-expand panel (Date · up/down reorder within the date group ·
  Reimbursed when tracked · Delete). Rows are **always stacked 2-line** (Description + expand chevron
  on line 1; Category · Currency · Cost on line 2) at every Dynamic Type preset (F23) — the four fields
  on one line over-truncated + overflowed, so the single-line variant was dropped and the component no
  longer takes a `font_size` prop. **Layout gotcha:** each field input in a fixed-width `shrink-0`
  wrapper is `w-full` (a bare `<input>` keeps its intrinsic ~20-char width and spills past the wrapper —
  the Cost field was the overflow culprit). Ordering/grouping is driven by the parent (the component is
  `sort_order`-free; reorder is positional). The **add row** is visually distinct from saved rows — a
  **dashed** card border, with its default category/currency/cost (+ date chip) line **dimmed
  (`opacity-55`) until the user starts typing** — so it reads as an entry affordance, not a blank
  persisted expense. Used by the Travel per-day expense modal (`DayExpensesSheet`) and the trip-level
  `TripExpensesPanel` ledger (the latter with `groupByDate`).
- **ImportPreviewList** — the shared CSV-importer result list (`src/components/ImportPreviewList.tsx`):
  a bordered card of rows, each `{ media, title, year, subtitle?, meta?, status, reviewLabel }` plus the
  standard **No-match / review / manual** flag and **Change / Manual** actions (solid pills, white
  text, matching Medical's **Mark Reviewed**: **Change** = `bg-danger` red, **Manual** = `bg-accent`
  blue, dimmed when disabled); callers pass the
  module-specific thumbnail + chips (`media` + `year` are optional — the Food importer omits them).
  Used by the Books, Shows, and Food importers (`ImportBooksSheet`, `ImportShowsSheet`,
  `ImportFoodsSheet`). Carries **`shrink-0`** so the `overflow-hidden` card isn't squished + clipped by
  the sheet's flex-col body — the **Layout gotchas → flex scroll** rule below; its absence was why long
  (e.g. 432-row) imports wouldn't scroll.
- **Sparkline** — a tiny dependency-free **inline-SVG** trend line (`src/components/Sparkline.tsx`):
  min–max normalized values, an end dot tintable by a flag colour. Used by the Medical Dashboard's
  tracked-test grid so many render cheaply without a chart library. The full trend chart
  (`MedicalTrendChart`, recharts) is **lazy-loaded** only when a sparkline is expanded.

## List-screen states

- On every search/filter list screen (Wellness Libraries, Shows/Books/Quotes Libraries, Medical
  Reports, Net Worth Insurance Policies, Travel Trips), the **`SearchBar` + Filter row stays rendered**
  — during `loading` (so `Loading…` sits **below** it) **and on the empty result** (so the centered
  `EmptyState` sits **below** the bar, never alone at the top). This is uniform: the Libraries/Trips
  render it unconditionally; Insurance Policies + Medical Reports gate only on `!error` (so it's still
  present when empty — they were updated to match the Libraries). Only a hard load **error** drops it.

## Layout gotchas

- **Flex scroll panes (F6c/F9):** a flex-col scroll pane needs `min-h-0` on ITSELF **and** `shrink-0`
  on EVERY direct child. A flex item's default `min-height:auto` makes the pane grow to fit content
  (then `overflow-hidden` clips it / the whole `<main>` scrolls); once height-constrained, default
  `flex-shrink:1` squishes children. Don't reach for a fixed pixel height; make a simple scroll pane a
  plain block `flex-1 overflow-y-auto`.
- **Overlays over third-party widgets (F14, general form):** a DOM overlay layered over a map or other
  third-party widget needs an explicit `z-index` above that widget's own controls (e.g. Leaflet's
  `.leaflet-top/.leaflet-bottom` sit at `z-index:1000`, so use `z-[1100]`), or the widget's controls
  swallow taps.

## Icons

Tabler Icons (or lucide-react), outline style. Mapping used in the wireframes:
food = apple, supplement = pill, activity = run/karate/barbell, energy = flame/flask,
nav = chart-bar / notebook / apple / settings, delete = trash, favorite = heart, scan = barcode.
Form header actions: delete = `IconTrash`, reset = `IconArrowBackUp` (undo), create = `IconPlus`,
save = `IconDeviceFloppy`, search = `IconSearch`, source link = `IconLink`, TMDB refresh = `IconRefresh`.

**Icon sizing & Dynamic Type:** keep passing a px `size={N}` per the wireframe scale (13/16/18/22/40…).
Icons **scale with the font-size preset automatically** — a global `.tabler-icon { transform: scale(…) }`
keyed off the `<html>` `data-font-scale` attribute (tech-spec F23) enlarges every Tabler glyph at the
Large/Larger presets. It's a `transform` (not width/height), so the icon's layout box is unchanged —
no extra wrap pressure; you don't need to do anything per-icon.

**Diary group category icons** (in the group headers) use the `cat-*` color tokens above:
Breakfast/Lunch/Dinner = red apple (`cat-meal`), Snacks = orange cookie (`cat-snack`),
Supplements = purple pill (`cat-supplement`), Activities = blue runner (`cat-activity`). The
icon↔group mapping lives in `constants/groups.ts`.

## Button convention

- Action buttons live in the **top-right of the screen/sheet header** at the compact `sm` size,
  rendered as **icons** via the shared **`EntryHeaderActions`** (see above): form screens show
  **Delete** (trash, editing only) · **Reset** (undo) · **Create** (plus, new) / **Save** (floppy,
  editing); logging sheets that add to the Diary keep a single **plus** (Add) in create mode.
- No bottom action bar.
- The header title sits left of the actions and **clamps to 2 lines with an ellipsis** when long.
- **Settings sub-screens auto-save on change.**
- **Back / close is a top-left `IconX`** (`size 22`, `text-text-secondary`), never a `‹` chevron — the
  uniform dismiss affordance on entry forms, detail drill-ins, sheets, and module sub-settings (e.g. all
  Literature screens: Poem/Poet detail + Settings). It `navigate(-1)`s, and the screen also registers
  **`useEscapeKey(() => navigate(-1))`** so the laptop **Esc** key closes it too (route `Sheet`s already
  do this internally — the shared LIFO stack means an overlay layered above consumes Esc first). (A
  `‹ month ›` cluster is a distinct _navigation_ control, not a dismiss — see the Net Worth month nav /
  `Calendar`.)
