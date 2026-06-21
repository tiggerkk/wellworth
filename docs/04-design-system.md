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
  loader (Wellness Diary draws food/activity dots; Shows date pickers pass none).
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
  filters/sort. **Esc** collapses an open menu (via `useEscapeKey`).
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

## Icons

Tabler Icons (or lucide-react), outline style. Mapping used in the wireframes:
food = apple, supplement = pill, activity = run/karate/barbell, energy = flame/flask,
nav = chart-bar / notebook / apple / settings, delete = trash, favorite = heart, scan = barcode.

**Diary group category icons** (in the group headers) use the `cat-*` color tokens above:
Breakfast/Lunch/Dinner = red apple (`cat-meal`), Snacks = orange cookie (`cat-snack`),
Supplements = purple pill (`cat-supplement`), Activities = blue runner (`cat-activity`). The
icon↔group mapping lives in `constants/groups.ts`.

## Button placement

Action buttons live in the **top-right of the screen/sheet header** (consistent with Net Worth), at
the compact `sm` size: logging screens show **ADD** (or **RESET** + **SAVE** when editing a logged
entry); form screens show **RESET** + **CREATE** (new) / **RESET** + **SAVE** (editing). No bottom
action bar. The header title (food / activity name) sits left of the actions and **clamps to 2 lines
with an ellipsis** when long. (See `01-screens.md` → Button convention.)
