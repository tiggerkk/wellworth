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
  Food/Supplement, Foods/Activities).
- **GroupHeader** — green `+`, title, kcal subtotal, chevron; collapsible.
- **SwipeRow** — swipe-left reveals a `delete` Delete action.
- **SearchBar** — magnifier + input + filter icon (+ barcode icon on Add Food).
- **PrimaryButton** — light `fill` pill, used as the bottom "ADD TO DIARY".
- **FieldRow** — label + value/input + chevron, for forms and Settings.
- **EffortPicker** — Light / Moderate / Vigorous radio list with MET ranges.

## Icons

Tabler Icons (or lucide-react), outline style. Mapping used in the wireframes:
food = apple, supplement = pill, activity = run/karate/barbell, energy = flame/flask,
nav = chart-bar / notebook / apple / settings, delete = trash, favorite = heart, scan = barcode.

## Button placement

Form screens: **Save** top-right, no bottom button. Logging screens: **ADD TO DIARY** at the bottom,
no top-right Save. (See `01-screens.md` table.)
