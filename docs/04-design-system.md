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
- **ShowTypeBadge** — small chip with a TV (`IconDeviceTv`) or movie (`IconMovie`) icon, on every
  Shows row/poster. (Books have no type badge — all books are one kind.)
- **StatusChip** — a **presentational** status pill taking a `label` + palette `className`, so Shows
  and Books share one chip. Both use the same per-status palette tokens: neutral (`input`) / coral
  (`accent`, active) / teal (`positive`) / grey (`track`) — Shows = Want/Watching/Watched/Dropped,
  Books = Want to Read/Reading/Read/Dropped.
- **Thumb** — the shared presentational 2:3 rounded image-or-placeholder (`src/components/Thumb.tsx`,
  `url` + `className`; a neutral `bg-input` tile when `url` is null). **PosterThumb** (Shows) wraps it,
  resolving the TMDB `posterUrl` (`w92` list / `w185` detail); **CoverThumb** (Books) wraps it with the
  full `cover_url` (Google Books / Open Library — no CDN base). Used by search sheets, Dashboard rows,
  and Library rows in both modules.
- **TitleSearchSheet** / **BookSearchSheet** — metadata title search, a **local** full-screen overlay
  inside Entry (not the routing `Sheet`, which would remount Entry and lose the draft): search bar +
  cover/poster-thumb result rows; selecting a row populates the live form. Shows scopes by Type (TMDB);
  Books searches Google Books (Open Library fallback).
- **SelectMenu** — a compact dropdown (button + label + chevron → scrim + absolute menu of
  `{value,label}` options); generic over string options. Used by the Shows + Books Library filters/sort.
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
