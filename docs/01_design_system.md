# 01 — Design System (Look & Feel)

Dark, calm. These tokens are taken directly from the approved wireframes — match them exactly.

## Color tokens

### Common palette (single source of truth)

Every "named color" reused across modules — chart fallbacks, swatch pickers, category accents — traces back to one of these 11 anchors. The `PALETTE_*` constants in `src/constants/palette.ts` are the single source of truth; `--palette-*` in `src/index.css` mirrors them for pure-CSS contexts (Tailwind's `@theme`, `color-mix` tints). Change an anchor in `palette.ts` and every TS consumer (fixed category→color maps, owner-configurable swatch lists) updates together; nothing downstream should hardcode a hex, reach into another module's token, or reintroduce a per-module CSS-var alias for a color that already has a `PALETTE_*` constant.

| Anchor      | Hex                        |
| ----------- | -------------------------- |
| `red`       | `#dd5f5f`                  |
| `gold`      | `#ddbe5f`                  |
| `emerald`   | `#5fdd7f`                  |
| `cyan`      | `#5fdddd`                  |
| `blue`      | `#3874f6`                  |
| `purple`    | `#9e5fdd`                  |
| `magenta`   | `#dd5fbe`                  |
| `brown`     | `#b5825f`                  |
| `off-white` | `#eef1f7` (= `fill`)       |
| `grey`      | `#c2c7d4` (= `text-muted`) |
| `dark-grey` | `#3a4253` (= `track`)      |

### Core UI tokens

| Token                   | Hex                             | Use                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bg`                    | `#161b28`                       | _(near-black navy)_ App / screen background                                                                                                                                                                                                                        |
| `surface`               | `#232a3a`                       | _(dark slate)_ Cards, group headers, list groups                                                                                                                                                                                                                   |
| `surface-alt`           | `#1b2130`                       | _(darker slate)_ Nested/expanded rows, summary panels                                                                                                                                                                                                              |
| `input`                 | `#2a3142`                       | _(slate-blue)_ Input boxes, segmented-control track, chips                                                                                                                                                                                                         |
| `border`                | `rgba(255,255,255,0.08)`        | _(white, low opacity)_ Card borders, dividers (use 0.06–0.07 for inner rows)                                                                                                                                                                                       |
| `text-primary`          | `#e8eaf0`                       | _(near-white)_ Primary text                                                                                                                                                                                                                                        |
| `text-secondary`        | `#9aa3b5`                       | _(grey)_ Labels, captions, inactive                                                                                                                                                                                                                                |
| `text-muted`            | `#c2c7d4`                       | _(light grey)_ Secondary values                                                                                                                                                                                                                                    |
| `text-tertiary`         | `#7a8294`                       | _(darker grey)_ Hints / disabled / future dates (lightened from `#5b6172` for readability — still below `secondary`)                                                                                                                                               |
| `accent`                | `#5f7fdd` (palette `blue`)      | Brand, active tab, links, energy-negative                                                                                                                                                                                                                          |
| `favorite`              | `#dd5fbe` (palette `magenta`)   | Filled favorite heart (decoupled from `accent`)                                                                                                                                                                                                                    |
| `positive`              | `#5fdd7f` (palette `emerald`)   | Add `+`, activity/supplement accents, "food logged" dot                                                                                                                                                                                                            |
| `info`                  | `#5f7fdd` (palette `blue`)      | Medical **low**-flag value colour (`MEDICAL_FLAG_CLASS.low`); not used for status chips — same anchor as `accent`                                                                                                                                                  |
| `plan`                  | `#9e5fdd` (palette `purple`)    | "Want" status chip (planned) on Shows/Books/Travel                                                                                                                                                                                                                 |
| `warning`               | `#ddbe5f` (palette `gold`)      | In-progress status chip (Watching·Reading·Planning); import notes — same anchor as `dynasty`                                                                                                                                                                       |
| `danger`                | `#dd5f5f` (palette `red`)       | Over-limit bars and % text, destructive text                                                                                                                                                                                                                       |
| `delete`                | `#dd5f5f` (palette `red`)       | Swipe-to-delete background — same anchor as `danger`                                                                                                                                                                                                               |
| `track`                 | `#3a4253` (palette `dark-grey`) | Progress-bar track, off-toggle                                                                                                                                                                                                                                     |
| `fill`                  | `#eef1f7` (palette `off-white`) | Progress-bar fill; primary-button background                                                                                                                                                                                                                       |
| `dynasty`               | `#ddbe5f` (palette `gold`)      | Gold dynasty badge (Shows/Books Chinese titles)                                                                                                                                                                                                                    |
| `meal`                  | `#dd5f5f` (palette `red`)       | Diary category icon — Breakfast/Lunch/Dinner (red apple), via `WELLNESS_CATEGORY_COLOR.meal`                                                                                                                                                                       |
| `snack`                 | `#ddbe5f` (palette `gold`)      | Diary category icon — Snacks (gold cookie), via `WELLNESS_CATEGORY_COLOR.snack`                                                                                                                                                                                    |
| `supplement`            | `#9e5fdd` (palette `purple`)    | Diary category icon — Supplements (purple pill), via `WELLNESS_CATEGORY_COLOR.supplement`                                                                                                                                                                          |
| `activity`              | `#5f7fdd` (palette `blue`)      | Diary category icon — Activities (blue runner), via `WELLNESS_CATEGORY_COLOR.activity`                                                                                                                                                                             |
| Medical categories (18) | per category                    | Medical lab-result section accents; one distinct hue per category (mostly palette anchors; `electrolytes`/`other` keep their own distinct shade), consumed via `MEDICAL_CATEGORY_COLOR` (`src/constants/medical.ts`) for test results' left stripe + tinted header |

Fixed per-key accents like the two rows above (a category that isn't owner-configurable) are a plain `Record<Key, string>` of `PALETTE_*` constants — see `WELLNESS_CATEGORY_COLOR`, `MEDICAL_CATEGORY_COLOR`, `LITERATURE_SECTION_COLOR`, `STOP_TYPE_COLORS`, `JOURNAL_MOOD_DEFAULT_COLORS`. Owner-configurable lists (Report Types, Insurance Providers, Travel Expense Categories, Quotes Categories) instead offer a swatch cycling list built from the same 10 `PALETTE_SWATCHES` `{name,value}` pairs (`src/constants/palette.ts`) — each module orders its list differently via `reorderSwatches(order)` so new items pick up its own intentional starting color and sequence, without duplicating the underlying color data.

Primary button = `fill` background with `#161b28` text (a light chip on dark). The accent blue is
_not_ the primary-button color; it's for emphasis, active states, and energy.

## Radii & spacing

- Screen container: 28px. Cards/groups: 14px. Inner rows: 12px. Pills: 16–24px. Inputs: 8px.
- Section padding ~16px horizontal. Card-to-card gap ~14px. Row vertical padding ~13px.

## Typography

- System sans (`-apple-system`/SF Pro; Inter as a web fallback).
- **One font-size scale — the `@theme` `--text-*` tokens in `src/index.css`.** Sizes are in `rem`, so they ride the **`--font-scale`** lever on `<html>` (`font-size: calc(16px * var(--font-scale))`). The Settings **Font Size** preset just sets `--font-scale` (1 / 1.15 / 1.30) and the whole UI grows — text (rem) and icons (a `.tabler-icon` transform) together (Dynamic Type; see `02_tech_spec.md` F23).
- **Never hardcode `text-[Npx]`, `text-xs/sm/lg`, etc. — pick a role token.** Each role = one blessed (size · color · weight) recipe:

  | role token     | px @1× | recipe (size + color [+ weight])                                                  | used for                                   |
  | -------------- | ------ | --------------------------------------------------------------------------------- | ------------------------------------------ |
  | `text-title`   | 18     | `text-title font-medium text-text-primary`                                        | screen / sheet titles                      |
  | `text-heading` | 17     | `text-heading font-medium text-text-primary`                                      | entry & modal headers                      |
  | `text-field`   | 16     | baked into `.field-control` (iOS auto-zoom floor, F21)                            | form inputs                                |
  | `text-body`    | 15     | `text-body text-text-primary` (row titles); `… text-text-secondary` (muted)       | body, row titles, button text              |
  | `text-label`   | 13     | `text-label text-text-primary` / chip body                                        | compact labels, chips                      |
  | `text-caption` | 12     | `text-caption text-text-secondary` (label/caption); `… text-text-tertiary` (hint) | captions, field labels, hints, ResultCount |
  | `text-section` | 11     | `text-section font-medium uppercase tracking-[0.08em] text-text-secondary`        | section labels, status chips               |
  | `text-compact` | 10     | `text-compact`                                                                    | sub-section chips, tightest labels         |

- Large display numerals (hero stats) may use Tailwind's `text-xl`/`2xl`/`3xl` — these are rem-based and scale with the lever too; they're outside the 7-role chrome scale.
- Color stays a **separate** `text-text-*` utility (don't fold color into the size token). Text colors: `text-primary` body, `text-secondary` muted/labels, `text-tertiary` hints/disabled (lightened to `#7a8294` for readability), `text-muted` trailing values. **Placeholders** are `text-text-secondary` app-wide (baked into `.field-control`; `SearchBar`/`TagInput`/`PinInput` set it directly) — never `text-tertiary` (too dim).

## Date formatting (one source of truth — `src/lib/date.ts`)

Always format dates through these helpers — never inline a `new Intl.DateTimeFormat` or hand-built string in a screen, so the formats can't drift apart:

- **`formatFullDate`** → `Jun 25, 2026` (**MMM DD, YYYY**) — **the canonical date format used everywhere** a date value is shown: entry/edit screens (incl. Wellness Diary header + Daily Report), all module filters (`DateRangeRow`), profile birthday, Medical reports, Net Worth Fund "priced as of".
- **`formatMonthDay`** → `Jun 13` (MMM DD, **no year**) — **the only exception**: deliberately year-less to stay short in Shows / Books / Quotes **Dashboard + Library** rows (and the Shows Dashboard "Started" line); also the short end of a Travel trip date range.
- **`formatDayLabel`** → `Today` / `Yesterday` / `Tomorrow`, else `formatFullDate` (`MMM DD, YYYY`) — **Wellness Diary nav/header + its copy toast only** (the one place relative day labels make sense).
- **`formatMonthLabel`** → `June 2026`; **`formatMonthShort`** → `Jun ’26` (chart ticks).
- **`formatWeekdayShort`** → `MON` (3-letter uppercase) and **`formatDayOfMonth`** → `13` (zero-padded) — together form the Journal Library row's leading date badge (weekday over bold day-of-month); not used elsewhere.

Every other date value reads as `MMM DD, YYYY` (`formatFullDate`), or `MMM DD` (`formatMonthDay`) in the Shows/Books exception above — no weekday is ever shown.

## Core components (build once in `src/components`)

### Cross-Module

- **`.field-control`** (CSS class in `src/index.css`) — **single source of truth for a single-line form/filter field's chrome + height** (`rounded-input bg-input px-3 py-2 text-field` via `@apply`). Font is **`text-field` (16px)** (not 15px) so a focused field never triggers iOS Safari's auto-zoom — see F21 in `02_tech_spec.md`; any new focusable text input must stay ≥16px. Use it for **every** `<input>`/`<button>`/`<select>`/`<textarea>` field app-wide (compose with `w-full`/`flex-1`/`w-NN` for width, `text-right`/`text-left` for alignment, `block`, `resize-none`, `placeholder:*`); per-screen `inputClass`/`inputCls` constants are just `'field-control …'`. **Number inputs hide their up/down spin buttons globally** (a single `input[type='number']` rule in `index.css`) — no per-field class is needed; `.no-spinner` is kept only as a now-redundant alias. The field components match the same height: **`SelectMenu`** defaults to `size="field"` (pass `size="compact"` only to opt a tight spot back down), **`DateRangeRow`** and **`SearchBar`** already render at it, and **`SegmentedTabs`** takes `size="field"`. So a row mixing an input, a dropdown, a segmented control and a date button all line up. **Never re-spell the px/py/text/bg of a field in a screen** — change the height in one place here. The ubiquitous full-width composition `'field-control w-full'` is exported once as **`FIELD_CLASS`** (`src/constants/forms.ts`); form screens import it (usually `as inputClass`) rather than re-declaring the string per file.
- **Field labels** are uniformly **`text-caption text-text-secondary`** (12px) — the small caption above an input (`mb-1 …`) or the wrapping `<label>`. Distinct from **section labels** (`text-section`, 11px UPPERCASE `tracking-[0.08em]`) and muted captions (`text-text-tertiary`). Don't use `text-section`/`text-body` for a field label.
- **BottomNav** — leading **Home** item + module tabs; active item tints `accent`. The **Home** item shows the **`BrandMark`** logo (not a Tabler icon) in a soft accent-tinted (`bg-accent/20`) rounded-pill chip so the hub anchor reads apart from the flat module tabs; the mark uses `currentColor`, so it tints with the active/inactive state like the other tabs.
- **BrandMark** - WellWorth brand mark used on the Login screen; PWA / onboarding header uses the generated PNG instead.
- **Calendar** — month-grid date picker (a local overlay, not a route). Presentational: per-day cue dots + legend are drawn only when a caller passes an optional `loadCues(monthStart, monthEnd)` loader; an optional `legend` prop overrides the default Food/Activity legend text, or pass `legend={false}` to draw cue dots with no legend at all (Journal's calendar has only one kind of dot — "has an entry" — so no legend is needed). Header: an **X (top-left)** cancels, and a **centered `‹ month ›` cluster** (arrows pulled in tight against the label) frees up the top-left corner. **Tapping the month label** switches to a **month grid**; **tapping the year there** opens a **paged year grid** (12 years; the ◀/▶ arrows jump a whole page) so distant years like a birthday are a few taps, not dozens. Picking a year returns to the month grid, a month returns to that month's day grid. **Tapping a day commits immediately and closes** (calls `onSelect`, which every caller treats as "date chosen" + closes) — so there are **no Cancel/OK buttons**; **X / scrim / Esc** all cancel (`onClose`). Day styling: **today = white ring, no fill**; the **previously-selected date (the `day` prop) = accent-filled** (both can apply at once). A single **Today** button is **centered at the bottom** and just navigates the view to the current month's day grid (it no longer pre-selects/confirms).
- **Collapsible** — generic collapsible **color-accented** card: a left chevron + optional per-section **colored left stripe** (`borderLeft: 4px`) and **tinted header** (`color-mix … 14%`). The header label is `text-body font-medium` (not the 11px section caption) so CJK titles read clearly. Supports both uncontrolled (`defaultOpen`) and controlled (`open`/`onOpenChange`) — use controlled when the open/closed state must survive a remount (e.g. JournalMoodsSheet's per-mood rows, see `02_tech_spec.md` → Data flow gotchas F13). When `titleGrow={false}` (Wellness Diary group headers, Travel's day rows), the toggle button shrinks and truncates its title instead of staying fixed to its content width, so a long title can't push `actions` (the trailing icon cluster) past the row's right edge. Used by Wellness New Food (Nutrients), Net Worth Monthly Entry (Asset Types), Literature Poem & Poet Detail, Travel Trip Days, Medical Dashboard / Report Test Results, and Quotes Journal Moods settings.
- **ColorPicker** — compact swatch colour picker: round swatch button that opens a small popover grid of `{name,value}` colour options (sourced from `PALETTE_SWATCHES`, reordered per module via `reorderSwatches`, see `01_design_system.md` → Common palette) with a scrim + `useEscapeKey` to dismiss. The popover is **portaled to `document.body`** and positioned `fixed` from the trigger's rect (flipping above when there's no room below) — it must escape the `ConfigListEditor` row it lives in: `ReorderList`'s container is `overflow-hidden` (would clip it) and each reorder row carries a `transform` (a per-row **stacking context** that paints later rows over an in-flow popover). See the Layout-gotcha below. Presentational + controlled (parent owns `value`, persists in `onChange`).
- **ConfigListEditor** — add / rename (inline) / delete / drag-reorder editor for a configurable list, generic over `{key,label}` entries. Wraps `ReorderList` (rename + delete in the trailing slot) and auto-saves each change; deleting a value still used by records opens a `SelectMenu` reassignment picker, refuses the last value, and honours delete-protected keys. The `rowExtra` slot adds a per-row control (e.g. an insurance provider's default currency, or the Travel expense category's **`ColorPicker`**). Used by Quotes source-type/category lists and the Travel expense categories.
- **ConfirmDeleteAction** — icon-row delete control: an `IconAction`-styled `IconTrash` that, on click, flips **inline** to `Delete?` + a ✓ (`danger`) / ✗ (`secondary`) confirm — the compact, in-cluster counterpart to `EntryHeaderActions`' two-step delete. `disabled` blocks entering the confirm. Sibling icons (Copy/Paste/Add) stay visible during confirm; the "Delete?" text disambiguates. Used by the Diary day header, Net Worth monthly row, and Edit Trip day header. This is the single delete model for **icon rows**; swipe lists delete on the revealed `SwipeRow` Delete instead (no browser dialog).
- **ConfirmDialog** - confirms discard of unsaved changes.
- **DateRangeRow** — single-line filter date range — `label · From · To` — opening the `Calendar`, with a small ✕ to clear a bound.
- **DisplaySettingsCard** — **DISPLAY** section: Font Size + Visible Modules + Units in one `SectionCard`. Fully controlled (parent owns values + persistence); changing Font Size applies the preset instantly via `applyFontSize`. Rendered by both **Global Settings** and the first-run **Onboarding** wizard above `ProfileMetricsFields`, so the two screens stay identical.
- **DynastyChip** — dynasty badge (e.g. 先秦, 唐代), renders via `LabelChip`.
- **EmptyState** — vertically-centered **module icon** over a "No X yet" line over a **+ New X** action chip. Internally `flex-1 justify-center`. Takes an optional `Icon` (a Tabler `Icon`, shown muted at size 40). Used by every module's Dashboards/Libraries and the Travel Dashboard, Trips, and Map. **The host root must be a full-height flex column** (`min-h-full flex flex-col`, or `h-full` for Zen) so the `flex-1` fills the real content area.
- **EntryHeaderActions** — top-right action cluster for every New/Edit form: compact `sm` **icon** buttons in order **Delete · Reset · Submit**. **Reset** = `IconArrowBackUp` (undo), **Submit** = `IconPlus` (new) / `IconDeviceFloppy` (editing). **Delete** (`IconTrash`, `danger`) shows **only when editing** and flips to a two-step inline confirm before firing. Reset needs a change to enable; Submit needs dirty / required fields.
- **EntryLoader** — outer wrapper for every New/Edit entry screen: a full-height `flex h-full min-h-0 flex-col` column that shows `Loading…`, an error/not-found line (`errorText`), or — once the async `data` resolves — the inner form via a **render prop** `(data) => …` (so `data` is narrowed non-null). Generic over the draft type; the caller still keys the form by id so a stale `useAsync` result never mounts under the wrong item.
- **Favorite heart** — `IconHeart`/`IconHeartFilled` toggle (filled `accent` when on, `text-tertiary` when off); a small filled ♥ marks favorite rows on Library lists, and a "Favorites only" Library filter surfaces them.
- **FieldRow** — label + value/input + chevron, for forms and Settings (compact `py-2` rows; hairline `border-b` divider, suppressed on the section's last row). An optional `hint` adds a small muted note inline after the label. It `flex-wrap`s — the value drops to its own line when it can't share the row (a long value or a larger Dynamic Type preset, F23). **Divider gotcha:** a `FieldRow` wrapped in a `<button>` (the Settings nav rows) has its own `last:border-b-0` scope to that button, so it never draws a divider — put `border-b border-border last:border-b-0` on the **wrapper button** instead.
- **SelectableChip** — filter/tag chip: a `rounded-pill px-3 py-1 text-body` chip, **`bg-input text-text-primary`** inactive (deliberately whiter + larger than a caption for readability). A `tone` prop (**`accent`** default / `neutral`) sets the `selected` fill: `accent` is `bg-accent text-bg` (Quotes Library tag facet, Literature poem filters (朝代/主題/…), the Poets list, a poem's tag list); `neutral` is a checkmark + `bg-text-primary text-bg` — for a context where "selected" must stay visually distinct from a caller-configurable palette color, e.g. Journal Entry's sub-tag suggestions sitting beside recolorable mood `LabelChip`s. With `onClick` it's a toggle/nav `<button>` (`aria-pressed` only when `selected` is set); without one it's a display-only `<span>`.
- **IconAction** — header action icon-button: a bare Tabler icon at `size 18`, `p-1` hit area, tinted `secondary` (Copy) or `positive` (Add, and Paste while armed), muted `text-tertiary` when `disabled`.
- **ImportPreviewList** — CSV-importer result list: a bordered card of rows, each `{ media, title, year, subtitle?, meta?, status, reviewLabel }` plus the standard **No-match / review / manual** flag and **Change / Manual** actions (solid chips, white text, matching Medical's **Mark Reviewed**: **Change** = `bg-danger` red, **Manual** = `bg-accent` blue, dimmed when disabled); callers pass the module-specific thumbnail + chips (`media` + `year` are optional — the Food importer omits them). Used by the Books, Shows, and Food importers. Carries **`shrink-0`** so the `overflow-hidden` card isn't squished + clipped by the sheet's flex-col body — see tech-spec's **flex scroll pane** gotcha; its absence was why long imports wouldn't scroll.
- **ImportSheetFooter** - footer for all Import\*Sheet screens.
- **KpiTile** — dashboard stat card: bold headline `value` (+ optional `suffix`) over a caption `label`. Used by the Travel and Journal Dashboards' KPI grids.
- **LabelChip** — **presentational** status chip taking a `label` + palette `className` + accent color `color`. A `size` prop (**`section`** default, 11px / `body`, 15px) picks the text size — `body` matches `SelectableChip`'s size for a chip that's a primary tappable choice rather than a compact badge (e.g. Journal Entry's mood picker). A non-status label chip different from `StatusChip` so labels read apart from statuses at a glance.
- **ListFab** — floating round **+** create action for every listing screen: pinned to the bottom-right via `sticky bottom-4` inside the scrollable list (so it floats just above the bottom nav without needing to know its height), `bg-positive`, at the same `z-10` stacking tier as page content/`BottomNav` — a routed sheet/overlay (`z-30`) naturally covers it once open. Rendered by the host screen only once its filtered list has **at least one row** (an empty list already shows its own **+ New X** chip via `EmptyState`, so a persistent FAB there would duplicate it). Wellness renders one per tab body, so the action and label switch with the active Foods/Activities tab automatically.
- **ListLoader** - fragment-based render-prop for dashboard & listing screens.
- **ListRow** — listing-screen row: its own rounded/bordered card (so screens can lay rows out with a gap between them) containing a leading slot, a flexible text body, an optional right-edge favorite heart, and an optional accent color for a left strip on the row.
- **ListSearchFilterPanel** - Search bar + icon-only filter toggle (bare `IconFilter` that tints **accent** while its panel is open, else `text-secondary`; sits flush at the right edge of the row); sort-field `SelectMenu` + an ascending/descending icon toggle + Favorite-Only toggle (if it exists in the module) + icon-only clear filters button; collapsible filter panel pane with module-specific filter criteria
  ; used by every module's listing; results count.
- **NotesEditorModal** — full-screen notes editor, used by the Shows, Books, and Medical Entry screens for free-text notes.
- **OverlayBottom** - bottom part of overlays
- **OverlayTop** - top part of overlays
- **PinInput** - masked numeric PIN field (digits only, max 8). Shared by the lock screen and the lock settings; Enter submits; `inputMode="numeric"` raises the digit keypad on mobile.
- **PrimaryButton** / **SecondaryButton** — light `fill` chip / outline chip. A `size` prop toggles `default` (full, e.g. sign-in) vs `sm` (compact header actions). PrimaryButton's `tone` prop is `fill` (neutral, default) or `positive` (teal) — Create / Add / Save actions use `positive` so the `+` / floppy / Save matches the teal `+` elsewhere.
- **RemoveRowButton** - small muted trash-icon button for removing one row from an in-progress list; only used by Wellness manage servings for now.
- **ReorderGrid** — 2-column (2-up) sibling of `ReorderList`, for reordering items shown in a `grid-cols-2` layout. Same in-house Pointer-Events drag, but the dragged cell **floats under the finger** and the destination slot is **outlined** (target = nearest cell center, from rects cached at drag start) rather than a 1-D row-shift. A cell's grid position (linear order = reading order) **is** its hub position — no number badge (it crowded the longer labels on narrow phones); each cell has an optional `renderTrailing(id)` control. Used only by the **Visible Modules** sheet, whose grid follows the 2-column Home hub.
- **ReorderList** — pointer-drag reorderable list: a grip handle per row (`IconGripVertical`); drag it to move the row (Pointer Events, no dnd dependency), rows shift to open a gap, commit on release. Uniform row height (rows truncate to one line). `touch-action:none` is on the handle only, so a row body still scrolls. An optional `renderTrailing(id)` slot adds per-row controls; an optional `containerClassName` overrides the default card chrome so the list can nest inside an existing card (the Diary groups pass `border-t border-border divide-y divide-border`). Used by the Medical Display-Order sheet, the configurable-list editors, and the Diary groups (drag to reorder logged items).
- **ResultCount** — small muted "N results" line shown above the list on every search/filter screen so the current match count is always visible. Rendered only when the filtered list is non-empty (the "No matches" empty line already conveys zero); pluralizes 1 → result.
- **ScreenHeaderTitle** - header for all screen families (screens, routed sheets, overlays).
- **SearchBar** — magnifier + input (+ barcode icon on Diary Food Picker). Takes an optional `className` so it can fill a flex row beside a Filter icon (the list screens pass `min-w-0 flex-1`), and an optional `icon` to swap the leading glyph (online-search sheets pass `IconWorldSearch`; default is `IconSearch`).
- **SectionCard** — `surface` rounded container wrapping rows with hairline dividers.
- **SegmentedTabs** — `input` track, active segment = `fill` chip with dark text. Generic over N options — used for multi-way controls (Type selectors, Status/LGBT+ filters, Food/Supplement toggle). The Library Type control sits in the **sticky header above the `SearchBar`** (always visible, not inside the filter panel). A `size` prop (`compact` default / `field`) sizes it to the **`.field-control`** height so it aligns with form inputs on an entry screen.
- **SelectMenu** — a compact dropdown (button + label + chevron → scrim + menu of `{value,label}` options); generic over string options. Used by Library filters/sort and the Entry forms' Status / LGBT+ / Language / Type controls. **Esc** collapses an open menu (via `useEscapeKey`). The menu is **portaled to `document.body`** and positioned `fixed` from the trigger's rect (like `ColorPicker`), so it can't be clipped, mis-stacked, or made semi-transparent by an ancestor's `overflow` / `transform` / `opacity` — the reason it renders correctly inside a `ReorderList` `rowExtra` (insurance currency) and the dimmed (`opacity-55`) add-expense row. It **flips upward** when there isn't room below, and its **max-height is the space actually available** on the chosen side (minus an 8px margin), capped at the list's own height — so a long list fills the screen's spare vertical room instead of being clipped to a fixed few rows. A `size` prop (**`field` default** / `compact`) keeps the trigger at the **`.field-control`** height across forms + filters; pass `size="compact"` to opt a tight spot back down.
- **SettingsLayout** — shell for a global/module **Settings** screen: a `flex flex-col gap-5 px-4 py-4` column + sticky header with the uniform top-left **`IconX`** dismiss (`navigate(-1)`, also Esc-closable via `useEscapeKey`) and a `text-title`. Takes `{ title, closeLabel?, children }` (`closeLabel` overrides the button's accessible name — the Literature module passes 關閉); the caller supplies its own loading/error/section body. Used by global Settings + every module Settings, so they share one dismiss affordance per the Button convention below.
- **SettingsLoader** - outer wrapper for every Settings screen.
- **Sheet** — slide-up overlay for route-based modal screens (scrim, `bottom`/`full` variants, Esc/scrim/back close); the app shell renders sheets over the active tab via React Router's background-location pattern.
- **SheetLoader** - outer wrapper for Sheets.
- **Splash** — full-screen loading state while the auth session resolves.
- **StarRating** — 0–5 **half-star** rating; display (no `onChange`) or input (two half-width hit-zones per star; tap the current value to clear). Used on the Shows and Books Entry/Dashboard/Library screens and Travel's Edit Trip.
- **StatusChip** — **presentational** status chip taking a `label` + status `tone`. Chips appear on every Library row **and** every Dashboard row.
- **SwipeRow** — swipe-left reveals a `delete` Delete action; tapping it deletes **immediately** (the swipe + tap is the confirmation — no browser dialog). Its wrapper sets `touch-action: pan-y pinch-zoom` so the rows stay pinch-zoomable (a bare `pan-y` would disable zoom over the whole list — see F21 in `02_tech_spec.md`).
- **TagInput** — free-form tag editor: committed tags as removable `rounded-pill` chips (`text-body`, matching `SelectableChip`'s size) + a text input that commits on **Enter/comma**, removes the last on Backspace, and offers an autocomplete dropdown over passed suggestions (case-insensitive dedupe).
- **Thumb** — presentational 2:3 rounded image-or-placeholder (`url` + `className`; a neutral `bg-input` tile when `url` is null). Its `<img>` sets `referrerpolicy="no-referrer"` so hotlink-protected CDNs still serve. Used by search sheets, Dashboard rows, and Library rows.
- **Toaster** — single app-wide transient toast. Mounted once in `AppShell`; `showToast(msg)` shows a bottom-centered chip (`bg-surface` border) for ~2s. Used for in-app cues like "Copied Breakfast · 3 items".
- **Toggle** — chip switch; on = `accent` with knob right, off = `track` with grey knob left.
- **VisibleFieldsSheet** — "Visible Fields" sheet used by every module's Settings: a `full` `Sheet` + header + intro + auto-saving toggle list. Each module passes its `*_ENTRY_FIELDS` list (in New/Edit form order), the `profile` `text[]` column (NULL = all visible), the intro string, and optional **`extras`** — boolean-column toggles interleaved in form-order position (e.g. a Poster URL toggle with `afterKey: 'episodes'`). The `*FieldsSheet.tsx` screens are thin wrappers over it. Field lists/labels live in `src/lib/{module}.ts`.

### Global

- **Onboarding** - forced first-run wizard. Shown by `AppShell`'s OnboardingGate to a brand-new member whose profile has no `onboarded_at`.
- **ProfileMetricsFields** - PROFILE section — Birthday / Sex / Height / Weight inputs — shared by global Settings and the first-run Onboarding wizard.

### Wellness

- **BarcodeScanner** — ZXing camera scanner (lazy-loaded).
- **EffortPicker** — Light / Moderate / Vigorous radio list with MET ranges.
- **EnergyBalanceCard** — Consumed / BMR / Activity / bold Net.
- **FoodRowHeader** - standardized 2-line row display for Diary Food Picker listing and Wellness Library food listing.
- **FoodSearchOverlay** — title/food search, a **local** full-screen overlay: search bar + result rows; selecting a row hands the result back. `FoodSearchOverlay` (USDA, `searchFoods` + `foodMatchScore`, rows show `{N} nutrients · {serving}`) backs the food importer's **Change** action.
- **NutrientBar** — name + "value / target" (muted) + %; thin track+fill; **red variant** when over UL. `compact` prop drops the "value / target unit" text (name + % only) for narrow columns — used by the Diary highlighted-nutrients 2-col grid so the % is never crowded out by the full name.
- **NutrientReport** — body of Dashboard + Daily Report (energy card + visible-nutrient sections).

### Net Worth

- **NetWorthFundDetail** — fund detail display body, used in Dashboard & Monthly Entry.
- **ImportScheduleOverlay** - overlay to import a single insurance policy schedule.
- **InsuranceCompareCharts** — Recharts-based comparison chart set for insurance policies.
- **InsuranceCompareOverlay** — local overlay that hosts the insurance comparison view.
- **InsurancePolicyDetail** — insurance policy detail display body, used in Monthly Entry.
- **InsurancePolicyHeader** - standardized 2-line insurance policy header — reused everywhere a policy's identity is shown.
- **InsuranceTrendChart** — Recharts trend line for a single insurance value over time, using `formatHkd`/`formatHkdCompact`.
- **MonthPicker** — month/year picker (year stepper over a month grid, OK/Cancel) for the Net Worth month selector (a local overlay, not a route).
- **NetWorthTrendChart** — Recharts trend line for overall net worth over time, using `formatMonthShort`.

### Quotes

- **QuoteSourceLinkOverlay** — title/source search, a **local** full-screen overlay: search bar + result rows; selecting a row hands the result back.

### Literature

- **PoemCard** — poem index/list card: dynasty chip, favorite toggle, tap to open.
- **PoemReader** — the Poem reading view, built on `SegmentedTabs` and the `useSpeech` hook for text-to-speech language selection.

### Shows

- **Refresh from TMDB** — a small `⟳` (`IconRefresh`) action beside Search TMDB on the Shows Entry form, greyed/disabled until a `tmdb_id` exists; spins while fetching and reports "Updated" / "Already up to date".
- **PosterThumb** — wraps `Thumb`, resolving `posterUrl` (`w92` list / `w185` detail) — which passes a full pasted image URL through as-is and only prefixes the CDN base for a TMDB path.
- **ShowRowHeader** - standardized 3-line row display for Shows.
- **ShowTypeBadge** — small chip with a TV (`IconDeviceTv`), movie (`IconMovie`), or documentary (`IconVideo`) icon, on every Shows row/poster.
- **TitleSearchOverlay** — title search, a **local** full-screen overlay: search bar + result rows; selecting a row hands the result back.

### Books

- **BookRowHeader** - standardized 3-line row display for Books.
- **BookSearchOverlay** — title/book search, a **local** full-screen overlay: search bar + result rows; selecting a row hands the result back.
- **CoverThumb** — wraps `Thumb` with the full `cover_url` (no CDN base).

### Travel

- **CitySearchOverlay** — trip-stop city search overlay, used by `StopEditorSheet`.
- **DayExpensesOverlay** - to log the day's expenses as they're incurred.
- **ExpenseRowsEditor** — inline, spreadsheet-style expense editor: rows of **Description · Category · Currency · Cost** with a trailing add row (no modal) and a tap-to-expand panel (Date · up/down reorder within the date group · Reimbursed when tracked · Delete). Rows are **always stacked 2-line** (Description + expand chevron on line 1; Category · Currency · Cost on line 2) at every Dynamic Type preset (F23) — the four fields on one line over-truncated + overflowed, so the single-line variant was dropped and the component no longer takes a `font_size` prop. **Layout gotcha:** each field input in a fixed-width `shrink-0` wrapper is `w-full` (a bare `<input>` keeps its intrinsic ~20-char width and spills past the wrapper — the Cost field was the overflow culprit). Ordering/grouping is driven by the parent (the component is `sort_order`-free; reorder is positional). The **add row** is visually distinct from saved rows — a **dashed** card border, with its default category/currency/cost (+ date chip) line **dimmed (`opacity-55`) until the user starts typing** — so it reads as an entry affordance, not a blank persisted expense. Used by the Travel per-day expense modal (`DayExpensesSheet`) and the trip-level `TripExpensesPanel` ledger (the latter with `groupByDate`).
- **StopEditorOverlay** — trip-stop add/edit overlay.
- **StopTypeIcon** — small icon mapped from a stop's `StopType`, coloured via `STOP_TYPE_COLORS`.
- **TravelExpenseChart** — Travel expense donut/pie chart, Recharts `PieChart`, using `formatHkd`.
- **TravelMapCanvas** — Leaflet map canvas with marker clustering, used by the Travel Map screen.
- **TravelRowHeader** - standardized 2-line row display for Travel.

### Medical

- **EyeRefractionFields** — refraction test's grid of OD/OS fields, driven by `EYE_REFRACTION_COLUMNS`/`EYE_REFRACTION_ROWS`.
- **MedicalLockProvider** — context provider that gates Medical routes behind the lock screen, keyed off `moduleForPath`.
- **MedicalLockScreen / PinInput** — medical lock gate: a full-shell overlay (lock glyph, masked numeric `PinInput`, Unlock, an auto-tried Face ID / Touch ID button when a credential is registered, and a "Sign out" escape). `PinInput` is a masked numeric field (digits only, Enter submits) reused by the lock settings. Lock colours reuse `danger` for errors; the screen sits at `z-50`, above sheets.
- **MedicalResultCard** — per-test-result entry card on the Medical Report entry screen, using `labTestByKey`/`medicalReviewReason`.
- **MedicalRowHeader** - standardized 2-line row display for Medical Reports.
- **MedicalTestPickerSheet** — "add a test" picker sheet, built on `SearchBar`, grouped by `MEDICAL_CATEGORY_LABELS`.
- **MedicalValueRow** — medical result row: name + the (long, wrapping) printed reference range in a `min-w-0 flex-1` left column, value (+ unit, flag-coloured) in a `shrink-0` right column, `items-start` — so a long ref wraps under the name rather than squeezing it or pushing the value off the edge. Callers pass row chrome via `className` and optional `leftExtra`/`rightExtra` slots. Used by the Medical Dashboard latest-values list and the View Report `ResultRow`.
- **Sparkline** — tiny dependency-free **inline-SVG** trend line (`src/components/Sparkline.tsx`): min–max normalized values, an end dot tintable by a flag colour. Used by Medical Dashboard's tracked-test grid so many render cheaply without a chart library. The full trend chart (`MedicalTrendChart`, recharts) is **lazy-loaded** only when a sparkline is expanded.

## Button convention

- Action buttons live in the **top-right of the screen/sheet header** at the compact `sm` size, rendered as **icons** via the **`EntryHeaderActions`** (see above): form screens show **Delete** (trash, editing only) · **Reset** (undo) · **Create** (plus, new) / **Save** (floppy, editing); logging sheets that add to the Diary keep a single **plus** (Add) in create mode.
- Every listing screen's own create action is a floating round **+** (`ListFab`, above) pinned bottom-right over the scrollable list — not a header action, and not a row-level button.
- No bottom action bar.
- The header title sits left of the actions and **clamps to 2 lines with an ellipsis** when long.
- **Settings sub-screens auto-save on change.**

## Icons

**Icon sizing & Dynamic Type:** keep passing a px `size={N}` per the wireframe scale (13/16/18/22/40…). Icons **scale with the font-size preset automatically** — a global `.tabler-icon { transform: scale(…) }` keyed off the `<html>` `data-font-scale` attribute (tech-spec F23) enlarges every Tabler glyph at the Large/Larger presets. It's a `transform` (not width/height), so the icon's layout box is unchanged — no extra wrap pressure; you don't need to do anything per-icon.

**Wellness activity icons** are the one exception to "Tabler everywhere": the activity library (`src/constants/activity-icons.tsx`) uses a custom hand-drawn stroke-based SVG set instead, since Tabler doesn't cover every activity and some available Tabler icons don't read clearly at small sizes. Each icon still exposes the same `{ size, className, stroke }` props as a Tabler icon and applies the `tabler-icon` class itself, so it rides the same Dynamic Type transform above with no special handling at the call site.

## Layout gotchas

General React/CSS implementation pitfalls (flex scroll panes, third-party-widget z-index, portaled
popovers) live in `02_tech_spec.md` → **UI implementation gotchas**, since they're mechanics rather than
visual tokens.

## Screen Architecture

WellWorth's screens fall into four families, each with a distinct history/routing model, close behavior, and state-survival contract. Within a family, screens further split into screen types that share a construction pattern (a common shell built from the shared components below). Every family and type below lists its member files, its behavioral characteristics, and the components it's built from — including named exceptions where a member doesn't use a component the rest of its type does.

### A. Routed screens

Screens registered directly as router children under `AppShell` (see `router.tsx`). They render into `<Outlet/>`, have their own URL, survive a reload/deep-link (module data refetches from scratch), and are pushed onto browser history — so the device/browser Back button and in-app Close/Cancel buttons both normally call `navigate(-1)`. None of them reserve the top safe-area inset themselves; `AppShell`'s outer column already applies `pt-[env(safe-area-inset-top)]` once for every routed screen, and `BottomNav` (present for any screen inside a module) reserves its own space at the bottom.

#### A1. Listing screens

Searchable/filterable/sortable lists of a module's records, reached from a bottom-nav tab or a dashboard drill-in.

**Files:** `BooksLibrary.tsx`, `ShowsLibrary.tsx`, `QuotesLibrary.tsx`, `JournalLibrary.tsx`, `WellnessLibrary.tsx`, `InsurancePolicies.tsx`, `MedicalReports.tsx`, `TravelTrips.tsx`, `LiteraturePoems.tsx`

**Characteristics:**

- No stacked header — they live directly under a bottom-nav tab (or, for Insurance/Literature, are reached by drilling in), so none of them use `ScreenHeaderTitle`.
- Criteria (search text, filters, sort) persist in `sessionStorage` via `useSessionState`, keyed per-listing, so criteria survive a navigate-away-and-back within the same tab session but reset on a hard reload.
- Data loads through `useAsync`, refetching on a module-specific "version" bump (`useBooksVersion`, `useShowsVersion`, etc.) after any create/edit/delete elsewhere bumps that version.
- Most apply an optimistic-delete `override` layer (drop the row locally before the server confirms) so a swipe-delete feels instant; `WellnessLibrary`, `TravelTrips`, and `LiteraturePoems` skip this (Wellness/Travel refetch via `bumpDiary`/`bumpTravel` instead; Literature has no delete at all).
- Tapping a row navigates to that record's Entry screen (`navigate(routes.<module>.edit(id))`) — except `MedicalReports`, whose row tap opens the read-only `MedicalReportDetail` View screen instead, and `WellnessLibrary`, which opens the corresponding Entry as a sheet via `useSheetNavigate`.
- `WellnessLibrary` is also the only listing screen with an internal tab switch (Foods/Activities), synced to a `?tab=` URL param rather than `sessionStorage` alone, so returning from a sheet restores the correct tab.
- `QuotesLibrary` additionally reads a `?show=`/`?book=` URL constraint ("Quotes from this title") layered onto the criteria at view time.

**Components used:**

- All use `ListSearchFilterPanel` (search box + collapsible filter drawer + sort control, `sticky`) with its paired `ResultCount`, `ListRow` for each record, `ListFab` for the "+ New" action, and `EmptyState` for the zero-state.
- Most use `Calendar` for date-range filter pickers (Books, Shows, Journal, Insurance) — Quotes, Medical, Travel, and Literature have no date-range filter and so don't use it.
- Type-specific leading visuals: `CoverThumb` (Books), `PosterThumb` (Shows), `Thumb` (Travel). Quotes, Journal, Medical, and Insurance render inline color/label chips instead of a thumbnail.
- Row headers: `BookRowHeader`, `ShowRowHeader`, `FoodRowHeader`/`ActivityRowHeader` (Wellness), `MedicalRowHeader`, `TravelRowHeader`, `InsurancePolicyHeader`. Quotes and Journal render their row content directly rather than through a dedicated `*RowHeader` component (their row content is a quote/entry excerpt, not a titled record).
- `SegmentedTabs` for an in-panel type/tab switch: Shows (TV/Movie/Doc), Insurance (status), Wellness (Foods/Activities).

**Exceptions:**

- `LiteraturePoems` has no `ListFab` — the poem corpus is a static read-only asset with no "New" action — and paginates with a "load more" button instead of rendering the full result set, since a search can return thousands of poems.
- `LiteraturePoems` has no delete/optimistic-override handling (nothing to delete); its only per-row mutation is a favorite toggle.
- `LiteraturePoets` does not fit this type at all despite living at a poets-tab route — see the exception noted under "Other listing-adjacent screens" below.

#### A2. Entry screens (New / Edit / View)

Single-record create/edit forms, reached from a listing row, a dashboard row, or a listing's `+ New` action.

**Files:** `BooksEntry.tsx`, `ShowsEntry.tsx`, `QuotesEntry.tsx`, `JournalEntry.tsx`, `InsuranceEntry.tsx`, `TravelEntry.tsx`, `MedicalEntry.tsx`, `WellnessFoodEntry.tsx`, `WellnessActivityEntry.tsx` (New/Edit); `NetWorthEntry.tsx` (a distinct exception, see below); `MedicalReportDetail.tsx`, `LiteraturePoemDetail.tsx`, `LiteraturePoetDetail.tsx` (View-only sub-type)

**Characteristics — New/Edit sub-type:**

- The route is shared between New and Edit (an optional `:id` param); `useEntryDraft` derives the form's initial state synchronously from `id`, which is what prevents a New-mode render from ever flashing a previous Edit's stale data.
- Close/Save navigation is a **fixed destination**, not a history pop: `useEntryClose` computes where Cancel/Save should land (the module's Listing, or — for a Dashboard-linked row via the `fromDashboard` nav state — back to the Dashboard) rather than relying on `navigate(-1)`, because a `{ replace: true }` earlier in the flow can otherwise land Cancel on the wrong screen.
- `dirty` state is tracked locally (`useDirty`) and lifted to the always-mounted header, so the header's Close button can gate on it via `ConfirmDialog` before discarding changes.
- The caller's dirty in-progress state does **not** survive if the same routed screen is remounted for a different `id` (Edit(A) → Edit(B) both hit this route) — this is exactly the bug `useEntryDraft` exists to prevent.

**Components used (New/Edit):**

- `EntryLoader` (outer loading/error/not-found chrome), `ScreenHeaderTitle` (header + close), `EntryHeaderActions` (Reset/Delete/Save cluster in the header), `ConfirmDialog` (discard/delete confirmation).
- Local (non-routed) overlays for cross-module or external-API lookups without losing the draft: `BookSearchOverlay`, `TitleSearchOverlay`, `QuoteSourceLinkOverlay`, `NotesEditorOverlay`, `Calendar`.

**Exceptions:**

- `NetWorthEntry` does not fit the New/Edit sub-type at all: it's a **month-snapshot editor** (navigating month-to-month via `useSessionState`-persisted month, freezing a snapshot of every asset type for that month), not a single-record CRUD form. It doesn't use `useEntryDraft`, `useEntryClose`, or `useDirty` — it loads/saves a whole month's `AssetEntryInput[]` at once and deletes via `deleteSnapshot`, not a per-record delete. It does still use `EntryLoader` and `ScreenHeaderTitle` for its shell, and `OverlayTop` for an inline overlay.
- `WellnessFoodEntry` and `WellnessActivityEntry` are plain top-level routes (not background-location sheet routes — they're absent from `AppShell`'s `TAB_FOR_PATH` map), but each wraps its body in the `Sheet` component (`variant="full"`) purely for the slide-up visual chrome and its `onClose` override wiring into `useEntryClose`'s `requestClose`. They otherwise follow the standard New/Edit construction.
- `InsuranceEntry` and `TravelEntry` use `ConfirmDeleteAction` in addition to `ConfirmDialog` (a two-step "tap again to confirm" delete affordance) where Books/Shows/Quotes/Journal/Medical/Wellness use a single `ConfirmDialog` prompt instead.

**Characteristics — View sub-type (`MedicalReportDetail`, `LiteraturePoemDetail`, `LiteraturePoetDetail`):**

- Read-only: no draft state, no dirty-tracking, no `ConfirmDialog`. A plain `useAsync` fetch keyed by the route's `id`.
- Closes via `useEscapeKey(() => navigate(-1))` — a history pop, not a fixed destination, since a read-only drill-in has no unsaved-state risk to protect against.
- Edit is a separate forward navigation (a pencil-icon button in the header) to the corresponding Entry screen, not inline.

**Components used (View):**

- `MedicalReportDetail` uses `EntryLoader` + `ScreenHeaderTitle`; `LiteraturePoemDetail` and `LiteraturePoetDetail` do not use `EntryLoader` — they render their own inline `Loading…`/error text, since their body only ever needs the single loaded record with no separate "not found" case.
- `Collapsible` for grouped/sectioned read-only content in all three (result categories in Medical, prose sections in Literature).

#### A3. Dashboards

Module-index screens reached from the module's bottom-nav tab, splitting into constructive sub-patterns.

**Files (shelf dashboards):** `BooksDashboard.tsx`, `ShowsDashboard.tsx`, `TravelDashboard.tsx`
**Files (analytics dashboards):** `WellnessDashboard.tsx`, `JournalDashboard.tsx`
**Files (hybrid):** `MedicalDashboard.tsx`, `NetWorthDashboard.tsx`
**Files (day-log dashboard):** `WellnessDiary.tsx`

**Characteristics — shelf dashboards:**

- Curated shelves ("Currently Reading/Watching", "Recently…", "Want to…") of the same underlying list data used by the module's Listing screen.
- Tapping a row navigates to that record's Entry screen with `fromDashboard` nav state, so the Entry screen's Cancel/Save return to the Dashboard rather than the Listing.

**Components used (shelf dashboards):** `ListLoader` (outer load/empty chrome), `SectionCard` per shelf, `DashboardRow` per record, and the same `*RowHeader`/thumbnail components as that module's Listing screen. `ShowsDashboard` additionally uses `SegmentedTabs` (TV/Movie/Doc) and `TravelDashboard` uses `KpiTile` for its stat row.

**Characteristics — analytics dashboards:**

- No shelves of individual records — a stat/chart view over a selectable date range, with a custom sticky header (a `<button>` + dropdown menu for the range, not `ScreenHeaderTitle`).
- Loading/error/empty states are handled inline (or delegated to a child like `NutrientReport`) rather than via `ListLoader`/`EntryLoader`.

**Components used (analytics dashboards):** `KpiTile` for headline numbers, plus a lazy-loaded chart component (`JournalCircumplexChart` for Journal; `NutrientReport` for Wellness, which also owns its own loading/empty rendering).

**Hybrid exceptions:**

- `MedicalDashboard` mixes both: a sparkline trend grid + latest-values list (shelf-like `DashboardRow`/`Collapsible` grouping) with no date-range picker of its own. Its one use of `ScreenHeaderTitle` is not for the dashboard root — it's the header of the expanded-trend-chart `OverlayBottom` that opens when a sparkline is tapped.
- `NetWorthDashboard` uses `ListLoader` + `SectionCard` (shelf-dashboard shell) but has no `DashboardRow`/`KpiTile` — its body is chart-driven (lazy `NetWorthTrendChart`/`InsuranceTrendChart`) with a range/liquid-only toggle header, closer to the analytics sub-pattern in content even though it borrows the shelf sub-pattern's loader shell.

**Characteristics — day-log dashboard (`WellnessDiary`):**

- Wellness's actual tab-root (`/wellness`) is this day-log, not `WellnessDashboard` — the analytics dashboard is a separate drill-in (`/wellness/dashboard`) reached from here, so within the Wellness module this screen fills the role the shelf/analytics dashboards fill for their own modules.
- The viewed day lives in the URL (`?day=`), not component state, so it survives unmounting while a picker/detail sheet (family B) is opened over it via `useSheetNavigate` — closing the sheet's `navigate(-1)` returns to the same day.
- Entries are grouped into fixed sections (Breakfast/Lunch/Dinner/Snacks/Activity, etc.) that the user can collapse/expand, drag-reorder within, and copy/paste as a whole day or a single group via an in-memory (not `sessionStorage`) clipboard. Each group's expand/collapse state is controlled and persisted in `sessionStorage` for the session (`useSessionState`), same convention as Net Worth Monthly Entry's Asset Type headers — it's whatever the user last left it as, with no content-based auto-expand, surviving both day navigation and unmounts when a picker/detail sheet opens over this screen.
- Row taps open the corresponding Detail sheet (B2) rather than navigating to an Entry screen directly.

**Components used (day-log dashboard):** `EntryLoader` for the day's load/error state, `Collapsible` per group (with a per-group action cluster: `ConfirmDeleteAction`, copy/paste `IconAction`s, an add-`IconAction`), `ReorderList` for the entries within an open group, `Calendar` for jumping to an arbitrary day, and `WellnessDailyReportOverlay` for the "view full nutrient report" action — none of the shelf-dashboard (`ListLoader`/`SectionCard`/`DashboardRow`) or analytics-dashboard (`KpiTile`/chart) components apply, since its content is an editable list of the day's log entries, not a curated shelf or a stat view.

#### A4. Home, QuotesZen, and TravelMap

Standalone root screens that don't fit any other type.

**Files:** `Home.tsx` (the app's own root — the index-redirect's usual destination, a launcher of module cards), `QuotesZen.tsx` (the Quotes module's root route, replacing what would otherwise be a dashboard or listing), `TravelMap.tsx` (a canvas map view reached from the Travel bottom-nav)

**Characteristics:** Each is a bespoke, single-purpose full-bleed view (a 2-column grid of module launcher cards for Home; a random/browsable quote card for QuotesZen; an interactive map canvas for TravelMap) rather than a list, form, or stat grid, so none shares meaningful construction with the other screen types. Documented here as their own type rather than force-fit into Listing/Dashboard. `Home` seeds its first render from a locally cached profile (`useProfile`) so the module grid's saved order/visibility paints immediately rather than flashing the canonical order or an empty grid; hiding a module only removes its card, the module's routes stay reachable by direct URL.

**Components used:** `TravelMap` uses `TravelMapCanvas` as its core rendering component; `QuotesZen` composes ordinary card/button primitives with no shared list/entry/dashboard shell; `Home` uses `BrandMark` for its wordmark and otherwise composes plain `Link` cards with no shared list/entry/dashboard shell either.

#### A5. Settings screens

Module and global settings, reached from a module's bottom-nav tab (module settings) or the Home hub (global settings).

**Files:** `Settings.tsx` (global), `WellnessSettings.tsx`, `NetWorthSettings.tsx`, `QuotesSettings.tsx`, `LiteratureSettings.tsx`, `ShowsSettings.tsx`, `BooksSettings.tsx`, `MedicalSettings.tsx`, `TravelSettings.tsx`

**Characteristics:**

- Every module Settings screen loads the profile via `useProfileEditor` and auto-saves each change immediately (no explicit Save button) — there is no dirty-tracking or discard-confirm at this level.
- Closes via `navigate(-1)` (a history pop), consistent with drilling into Settings from its tab.
- Sub-items (visible fields, categories, tracked tests, etc.) are reached via `useSheetNavigate`, opening a Settings **sheet** (family B) over the current Settings screen.

**Components used:** Every module Settings screen composes `SettingsLoader` (itself `SettingsLayout` + `EntryLoader`), `SectionCard` per group, and `FieldRow`/`Toggle` for individual settings.

**Exception:** `Settings.tsx` (global) does not use `SettingsLoader` — it composes `SettingsLayout` + `EntryLoader` directly, because its `AccountCard` (session-driven sign-out) must stay usable even when the profile itself fails to load, whereas `SettingsLoader` would block the whole body behind the profile fetch.

---

### B. Routed sheets

Full-screen "sheet" routes, still registered in the router (so they get their own URL, survive reload, and participate in browser history), but visually presented via the `Sheet` component (`variant="full"`, a full-bleed panel with a slide-up entrance animation) rather than a plain page. Reached either as a **background-location sheet** (opened via `useSheetNavigate`, which passes `{ state: { background: location } }` so `AppShell` keeps the calling tab painted behind the sheet and only the sheet unmounts on close) or as a plain nested route for a drill-in that doesn't need a background tab preserved (e.g. `networth/fund/:id`).

Because a background-location sheet remounts on close/reopen, **any in-progress state in the screen underneath is preserved (it never unmounts)**, but a sheet's own in-progress state does not survive being closed and reopened. This is the key distinction from Overlays (family C): anything that must survive across the _caller's_ remount risk (an Entry form's live draft, e.g.) uses an Overlay instead of a routed Sheet.

#### B1. Import\*Sheets

Bulk CSV import flows, reached from a module's Settings screen.

**Files:** `ImportBooksSheet.tsx`, `ImportShowsSheet.tsx`, `ImportFoodsSheet.tsx`, `ImportQuotesSheet.tsx`, `ImportJournalSheet.tsx`, `ImportMedicalSheet.tsx`, `ImportNetWorthSheet.tsx`, `ImportFundSheet.tsx`, `ImportInsuranceBulkSheet.tsx`, `ImportTravelSheet.tsx`, `ImportTravelExpensesSheet.tsx`

**Characteristics:** Parse a CSV, show a preview of what will be created (and what's a duplicate/error), then commit on confirm. Gated behind a per-module "importer enabled" toggle in that module's Settings.

**Components used:** All use `Sheet` (`variant="full"`), `ImportSheetHeader`, and `ImportSheetFooter` (the commit/cancel action row).

**Exception:** Only `ImportBooksSheet`, `ImportShowsSheet`, and `ImportFoodsSheet` use `ImportPreviewList` — these three match imported rows against an external API (Google Books/Open Library, TMDB, USDA/OFF) and need a per-row match-review UI. The rest (Quotes, Journal, Medical, NetWorth, Fund, Insurance, Travel, Travel Expenses) import directly from CSV columns with no external matching step, so they render a simpler custom inline preview list instead of the shared component.

#### B2. Detail sheets

Read-only drill-in sheets for a single record, reached from a dashboard row, a listing row, or (for Fund/Policy) a Net Worth Monthly Entry row.

**Files:** `NetWorthFundDetailSheet.tsx`, `InsurancePolicyDetailSheet.tsx`, `WellnessDiaryFoodDetailSheet.tsx`, `WellnessDiaryActivityDetailSheet.tsx`

**Characteristics:** Load one record by route `id` via `useAsync`; no dirty-tracking, no delete (the Wellness pair are logging forms more than pure "detail" views — see below). `icon="back"` on the header (drilling in), except the two Wellness sheets, which are reached as a picker's forward step and so use `icon="close"`.

**Components used:** `SheetLoader` (the shared `Sheet` + `ScreenHeaderTitle` + `EntryLoader` shell) for `NetWorthFundDetailSheet`. `InsurancePolicyDetailSheet`, `WellnessDiaryFoodDetailSheet`, and `WellnessDiaryActivityDetailSheet` compose `Sheet` + `ScreenHeaderTitle` + `EntryLoader` **directly** instead of `SheetLoader`, because each has a header action that depends on the loaded data (an Edit-policy pencil, a food/activity log-entry Save) and needs the "reserved placeholder + absolutely-floated real action" technique so the header doesn't shift width once data arrives — `SheetLoader`'s `actions` prop is documented as being for actions that do _not_ depend on loaded data.

- `WellnessDiaryFoodDetailSheet`/`WellnessDiaryActivityDetailSheet` additionally use `EntryHeaderActions`, `ConfirmDialog`, and `useDirty`/`useEntryClose` — they're really logging forms (add this food/activity to today's diary) wearing a "detail sheet" route shape, not pure read-only views like the other two.

#### B3. Picker sheets

Search/browse-then-select flows for the Wellness Diary's "add food"/"add activity" actions.

**Files:** `WellnessDiaryFoodPickerSheet.tsx`, `WellnessDiaryActivityPickerSheet.tsx`

**Characteristics:** Both open via `useSheetNavigate`; selecting a row navigates forward to the corresponding Detail sheet (B2) rather than closing immediately.

**Components used:** `WellnessDiaryActivityPickerSheet` is a short, flat list of the user's own activities (few enough to need no search or tabs), so it fits the generic `SheetLoader` shell directly. `WellnessDiaryFoodPickerSheet` is bespoke — it has favorites/custom/all tabs (`SegmentedTabs`), a `SearchBar` querying both local foods and an external food API, and a lazy-loaded `BarcodeScanner` — so it composes `Sheet` + `ScreenHeaderTitle` directly rather than `SheetLoader`, and caches its last search/tab state in a module-level variable (outside React state) so reopening after the sheet unmounts doesn't flash empty results.

#### B4. Settings sheets

Sub-editors opened from a module's Settings screen (or the global Settings/Home hub) via `useSheetNavigate`. This type splits into three constructive sub-patterns.

**B4a. ConfigListEditor-based** — add/rename/delete/reorder a list of owner-defined values.

**Files:** `QuoteCategoriesSheet.tsx`, `QuoteSourceTypesSheet.tsx`, `TravelCategoriesSheet.tsx`, `MedicalReportTypesSheet.tsx`, `InsuranceProvidersSheet.tsx`

**Components used:** `SheetLoader` + `ConfigListEditor` (add/rename/remove/reorder + reassign-on-delete for in-use values). Most also pass a `rowExtra` render prop supplying a `ColorPicker` per row (Travel Categories, Medical Report Types, Insurance Providers) — `QuoteSourceTypesSheet` is the exception, with no color coding, so it has no `rowExtra`/`ColorPicker`.

**Exception:** `JournalMoodsSheet.tsx` conceptually belongs to this group (it's Quotes Settings → Journal Values → Moods) but is **not** built on `ConfigListEditor` — the 7 moods are a fixed, structural set (no add/delete/reorder is possible, only rename/recolor/edit sub-tags), so it's hand-built from `SheetLoader` + `Collapsible` rows + `ColorPicker` + `TagInput` instead.

**B4b. Toggle/visibility sheets** — show/hide a fixed set of fields or values, no reordering.

**Files:** `BooksFieldsSheet.tsx`, `ShowsFieldsSheet.tsx`, `TravelFieldsSheet.tsx`, `MedicalFieldsSheet.tsx`, `QuotesFieldsSheet.tsx`, `LiteraturePoemFieldsSheet.tsx`, `LiteratureWriterFieldsSheet.tsx` (thin wrappers); `WellnessVisibleNutrientsSheet.tsx`, `WellnessHighlightedNutrientsSheet.tsx`, `MedicalTrackedTestsSheet.tsx` (bespoke, grouped); `NetWorthLiquidAssetTypesSheet.tsx` (bespoke, flat)

**Components used:** The seven `*FieldsSheet.tsx` files are thin wrappers passing field lists/column names into the single shared `VisibleFieldsSheet` component (itself `SheetLoader` + a `Toggle` per field). `WellnessVisibleNutrientsSheet`, `WellnessHighlightedNutrientsSheet`, and `MedicalTrackedTestsSheet` don't use `VisibleFieldsSheet` — they group their toggles under category headers (nutrient category, medical test category) rather than a flat field list, so each is hand-built from `SheetLoader` + `Toggle`, with `WellnessVisibleNutrientsSheet` additionally inlining a numeric protein-target input beside one row. `NetWorthLiquidAssetTypesSheet` is also hand-built from `SheetLoader` + `Toggle` rather than `VisibleFieldsSheet` (it's classifying a fixed asset-type list as liquid/non-liquid, not toggling form-field visibility), but its list is flat like the `*FieldsSheet` wrappers rather than grouped like the other three bespoke sheets.

**B4c. Reorder(+toggle) sheets** — drag-to-reorder, sometimes paired with a visibility toggle per row.

**Files:** `NetWorthVisibleAssetTypesSheet.tsx`, `VisibleModulesSheet.tsx` (reorder + toggle); `MedicalOrderSheet.tsx` (reorder only)

**Components used:** `SheetLoader` + `ReorderList` (linear) or `ReorderGrid` (2-up, `VisibleModulesSheet` only, matching the Home hub's 2-column layout) with a `Toggle` in each row's trailing slot. `MedicalOrderSheet` uses two `ReorderList`s (sections, then tests within the selected section) with no toggle at all — display order, not visibility.

**B4d. Other/bespoke:** `MedicalLockSheet.tsx` (PIN setup/change, biometric registration, auto-lock timeout) doesn't fit any of the above — it's built from `SheetLoader` + `SectionCard`/`FieldRow`/`SelectMenu`/`PinInput`/`PrimaryButton`, a form-like body rather than a config-list. It's the settings surface for the security gate that `MedicalLockScreen`/`MedicalLockProvider` (family D) enforce elsewhere.

---

### C. Overlays

Local, non-routed, in-tree overlays — plain React state (`useState`) inside the calling screen, not a route. This is the key distinction from routed Sheets (family B): opening an Overlay never unmounts the caller, so **any in-progress draft in the calling screen (an Entry form mid-edit, a Builder's local state) survives untouched** underneath it — which is exactly why these exist instead of a routed Sheet wherever a caller has unsaved state to protect. An Overlay has no URL, doesn't survive a reload, and isn't on the back-button history stack (Esc/scrim-click/an explicit close button all call a caller-supplied `onClose`, not `navigate(-1)`).

All overlays render via one of two shells: `OverlayTop` (a fixed full-screen panel, reserving the top safe-area inset itself) or `OverlayBottom` (the equivalent bottom-anchored/expanding panel, used for `MedicalDashboard`'s expanded trend chart). Both provide the scrim, dialog semantics, and Esc-to-close; the caller supplies its own header/body.

#### C1. Search/picker overlays

Search-then-select flows opened from a live Entry-form draft.

**Files:** `BookSearchOverlay.tsx`, `FoodSearchOverlay.tsx`, `CitySearchOverlay.tsx`, `TitleSearchOverlay.tsx`, `MedicalTestPickerOverlay.tsx`, `QuoteSourceLinkOverlay.tsx`

**Characteristics:** Each searches either an external API (Google Books/Open Library for `BookSearchOverlay`, USDA/OFF for `FoodSearchOverlay`, a geocoding API for `CitySearchOverlay`) or the user's own existing records (`QuoteSourceLinkOverlay` searches the user's Shows/Books; `TitleSearchOverlay` and `MedicalTestPickerOverlay` search within-app catalogues), debounced, and hand the selected result back to the caller via an `onSelect` callback — the overlay itself never persists anything.

**Components used:** `OverlayTop` + `ScreenHeaderTitle` (with a `SearchBar` passed as `children` in place of a title) + results rendered as plain buttons (`CoverThumb`/`Thumb`/`LabelChip` as appropriate per search domain).

#### C2. Buffered editor overlays

Full-screen editors for one field or sub-record of a live Entry-form draft, with their own dirty-tracking and discard-confirm.

**Files:** `NotesEditorOverlay.tsx`, `StopEditorOverlay.tsx`

**Characteristics:** Edit a **local buffer**, separate from the parent form's field — only `onSave` (from the overlay's own Save action) writes the buffer back into the parent draft; the parent form's own Save is what actually persists to the database. This is why each needs its own dirty/discard handling independent of the parent form's `useDirty`.

**Components used:** `OverlayTop` + `ScreenHeaderTitle` + `EntryHeaderActions` (Delete/Reset/Save cluster, reused from the Entry-screen pattern) + `ConfirmDialog`, driven by `useDiscardConfirm` (the confirm-dialog half of `useEntryClose`, factored out for callers with a `dirty` flag and an `onClose` but no navigation of their own).

#### C3. Immediate-write overlays

Full-screen editors whose changes propagate immediately via callbacks — no local buffer, no discard-confirm.

**Files:** `DayExpensesOverlay.tsx`

**Characteristics:** Each add/update/delete/reorder action calls straight back to the caller (`onAdd`/`onUpdate`/`onDelete`/`onReorder`), which is expected to persist immediately (or hold it in the parent draft, itself covered by the parent's own dirty-tracking) — there's no separate "Save" step at the overlay level, so no `ConfirmDialog`/`EntryHeaderActions` is needed here.

**Components used:** `OverlayTop` + `ScreenHeaderTitle` + a dedicated body editor (`ExpenseRowsEditor`).

#### C4. Read-only viewer overlays

Full-screen, non-editing views opened over the current screen for supplementary detail.

**Files:** `InsuranceCompareOverlay.tsx`, `WellnessDailyReportOverlay.tsx`

**Characteristics:** Pure display — pick/compare UI (`InsuranceCompareOverlay`'s two schedule-version pickers) or a fetch-and-render report (`WellnessDailyReportOverlay`), with no save action of any kind.

**Components used:** `OverlayTop` + `ScreenHeaderTitle` (no `actions`) + a lazy-loaded chart (`InsuranceCompareCharts`) or report component (`NutrientReport`).

**Exception:** Neither uses `EntryLoader` — `InsuranceCompareOverlay` is handed already-loaded `schedules` as a prop (no fetch of its own), and `WellnessDailyReportOverlay` delegates its own loading/error rendering to `NutrientReport`, matching `WellnessDashboard`'s analytics-dashboard pattern of the same delegation.

#### C5. `ImportScheduleOverlay` (hybrid exception)

**Files:** `ImportScheduleOverlay.tsx`

**Characteristics:** A single-policy schedule CSV import opened from `InsuranceEntry`'s local `importOpen` state rather than a route — routing here would remount the Insurance Entry form and lose whatever the owner had already typed (Policy Number, Provider, Start Date) before picking a file, the same reasoning that puts every other Import flow behind a routed Sheet (B1) except this one.

**Components used:** `OverlayTop` + `ScreenHeaderTitle`, but — uniquely among Overlays — reuses `ImportSheetFooter` from the routed Import-sheet family for its commit/cancel action row, since its commit step (parse → preview → apply) is identical in shape to a routed import even though the container is an Overlay.

---

### D. Others

Screens that sit outside the routed-screen/sheet/overlay taxonomy entirely — pre-auth, index-redirect, or app-level gates rendered by `AppShell` above the normal route tree.

**Files:** `Login.tsx`, `RootRedirect.tsx`, `Onboarding.tsx` (component, not a route), `MedicalLockScreen.tsx` + `MedicalLockProvider.tsx` (components, not routes)

**Characteristics:**

- `Login.tsx` is registered at `/login`, entirely outside `RequireAuth`/`AppShell` — no `BottomNav`, no shared header, its own full-page layout (`min-h-svh`) rather than the `AppShell` column's `env(safe-area-inset-top)` padding.
- `RootRedirect.tsx` is the router's `index: true` route inside `AppShell` — it renders no UI at all, just a `<Navigate>` to the user's last-used module (or the Home hub on first run).
- `Onboarding` is not a route — it's a forced first-run gate rendered by `AppShell`'s `OnboardingGate` whenever the profile has no `onboarded_at`, covering the shell at `z-20` (below the `z-30` route-sheet layer, so a sheet opened while onboarding — e.g. Visible Modules, or the birthday `Calendar` — still paints above it; above the ordinary `z-10` content/nav). The only way out is completing the form or the global sign-out; it has no nav chrome of its own.
- `MedicalLockScreen` is likewise not a route — `AppShell`'s `MedicalLockGate` renders it whenever the Medical module is locked (per `MedicalLockProvider`'s `locked`/`inMedical` state), covering the shell at `z-50` (above Onboarding, above sheets — the topmost layer besides the `Toaster`). It auto-attempts a registered platform biometric credential on mount, falling back to a mandatory PIN; "Sign out" is the forgotten-PIN escape hatch.

**Components used:** `Login` uses `PrimaryButton`, `BrandMark`, `Splash`. `Onboarding` uses `BrandMark`, `DisplaySettingsCard`, `ProfileMetricsFields`, `PrimaryButton` — the same profile-metrics fields as the global `Settings` screen's body, since Onboarding is collecting the same data on first run. `MedicalLockScreen` uses `PinInput`, `PrimaryButton`. `RootRedirect` uses no components.

**Note:** `MedicalLockSheet.tsx` (the Settings sheet for _configuring_ the PIN/biometric/timeout, family B4d) is a different screen from `MedicalLockScreen.tsx` (the gate that _enforces_ the lock, family D) — the naming is easy to conflate but the two have no construction in common.
