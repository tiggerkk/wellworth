# BUILD-HISTORY — WellWorth

Chronological engineering history: the per-milestone build sequence and the dated enhancement passes, with the rationale behind key decisions.

- **Read this only when explicitly asked** to do a major refactor or regression analysis on an older module. It is **not** part of the per-session context.
- **Not a behavior spec.** The source of truth for behavior/data is `00_PRD.md`, `01_design_system.md`, `02_tech_spec.md`, `03_global.md`, and the module specs `04_wellness.md … 10_travel.md`.
- **Durable constraints + "don't repeat" lessons live in those spec docs now** — this file keeps only one-line pointers (see [Failures & gotchas](#failures--gotchas-to-not-repeat)).

## Old doc-name legend

Older entries cite a previous doc-naming scheme that has since been renumbered:

- `01-screens.md` → module specs `04_wellness.md … 10_travel.md` + `03_global.md` (screen behavior).
- `03-data-model.md` → each module spec's "Data model" section + `02_tech_spec.md` "Database conventions".
- `04-design-system.md` → `01_design_system.md`.
- `05-seed-data.md` → each module spec's "Seed data" section + `04_wellness.md`.

## Module status

All modules are feature-complete:

- **Wellness** — M1–M9 + post-launch polish.
- **Net Worth** — M1–M6.
- **Shows** (TV, movies, documentaries) — M1–M7 + M8 (Chinese documentaries) + later cross-module passes (favourites; `master_series` removed/folded into the title; conditional Poster URL; Watching-badge/Start-Date fixes).
- **Books** (read / to read) — M1–M7 (a Shows re-skin) + favourites.
- **Quotes** (English or Chinese) — M1–M7 + owner-configurable source types/categories.
- **Medical** (lab results + narrative reports) — M1–M7.
- **Travel** (Days → Stops itineraries, map, per-trip expenses) — M1–M7 + simplification & UX passes.
- **Literature** (classical Chinese poems & prose) — static-asset corpus + read-aloud, integrated 2026-06-29.

Each module's former staging spec (`docs/06-books.md`, `07-quotes.md`, `medical.md`, `travel.md`, `CONTINUITY.md`) was merged into the permanent docs and deleted. Per-module build sequences and the dated enhancement passes follow below.

---

## Snapshot

- **Tests:** 631 Vitest tests (pure helpers only).
- **Deploy:** Deployed — GitHub `main` → Vercel auto-deploy; installed + tested on iPhone (PWA).
- **Stack / scripts / env / gates / conventions:** see `02_tech_spec.md` (the canonical, current reference) — not duplicated here.

---

## Wellness Build Sequence (per milestone)

### M1 — Scaffold + tooling (`d61e352`)

Goal: runnable dark Vite/React/TS PWA skeleton with the four quality gates enforced by a pre-commit hook.

- **Scaffolded** from `create-vite` 9.0.7 `react-ts` (Vite 8 / React 19 / TS 6 / ESLint 10 flat config).
- **Established** Tailwind v4 CSS-first tokens in `src/index.css` (the design system), the strict `tsconfig`, Vitest (node env), husky + lint-staged, CI, `.gitattributes` (LF — matters on Windows), and the first real helper `src/lib/units.ts`.
- **Rationale:** tokens-as-utilities keeps the design system in one file; husky+CI double-gate so a bypassed hook is still caught.

### M2 — Supabase schema + RLS + seed + types (`959e6a3`, `965c9fb`)

Goal: full Postgres schema on the cloud project (remote-only, no Docker), nutrient reference seeded, `database.ts` generated.

- **Migrations:** `01_wellness_schema.sql` (7 tables, CHECK constraints, FKs, indexes, RLS + policies, `moddatetime` triggers — all as `03-data-model.md` now specifies); `02_wellness_seed_nutrient.sql` (80 nutrient rows, idempotent `ON CONFLICT (key) DO UPDATE`).
- **Rationale:** reference data ships _in a migration_ (not `seed.sql`, which only runs on local resets) so it reaches prod and is re-runnable; the `nutrient.parent_key` self-FK is DEFERRABLE so one multi-row insert validates at commit.

### M3 — Google auth + first-run seed + app shell (`f31be26`, `6c3503d`)

Goal: Google sign-in, session-gated 4-tab shell, first-login owner data.

- **Built:** `src/lib/supabase.ts` (PKCE client), `AuthProvider`/`RequireAuth` (splash, no login flash), React Router v7 `createBrowserRouter`, `BottomNav`/`AppShell`/`Splash`/`PrimaryButton`, `Login` + stub tab screens, `useEnsureProfile` (idempotent first-login seed), `vercel.json` SPA rewrite.
- **Migration** `20260613120200_grant_api_roles.sql` was added here — see **Failure F1**. (Later merged into `01_wellness_schema.sql` during the migration consolidation; the standalone file is gone.)
- **Rationale:** client-side seeding (not a DB trigger) keeps the owner-seed logic in readable TS and needs no `auth`-schema grants; PKCE is the right SPA flow.

### M4 — Data-access layer + calc helpers (`12477a7`)

Goal: the computational + data foundation; no UI; 29 tests.

- **Built:** `src/lib/{energy,met,nutrients,dri,targets}.ts` and `src/data/*` repos for all 7 tables.
- **Rationale & key decisions** (all now in `02_tech_spec.md`): DRI is a sex/age-band lookup populated only for the owner's band (female 51–70) and throws otherwise; upper limits are **scope-tagged** so supplement-only ULs never fire a red bar on dietary intake; fat/saturated/added-sugars get energy-derived soft targets; protein honors the profile override.

### M5 — Diary + Add Food/Activity logging (`094a401`, `27e4b89`)

Goal: the core daily loop; built most of the shared component library.

- **Built:** components (`Sheet`, `NutrientBar`, `GroupHeader`, `SwipeRow` [hand-rolled Pointer Events], `SegmentedTabs`, `SearchBar`, `EffortPicker`, `Calendar`, `BarcodeScanner`, …); screens (`Diary`, `AddFoodSheet`, `FoodDetailSheet`, `AddActivitySheet`, `ActivityLogSheet`); hooks (`useAsync`, `useBarcodeScanner`, `useProfile`, `useNutrientReference`, `useSheetNavigate`); lib (`date`, `food-api`, `off-api`, `targets`, `diary-refresh`); constants.
- **`ensureOwnerActivities`** (first-login activity seeding) added to `useEnsureProfile`.
- **USDA search fix** in `27e4b89` — see **Failure F2**.

Key architecture (rationale):

- **Route-based modal sheets via React Router "background-location"**: sheet routes are children of
  `AppShell`; opening one navigates with `state.background = currentLocation`; `AppShell` keeps a
  `TAB_FOR_PATH` map and renders the background tab under the sheet. **New sheets must be added as
  `AppShell` children and opened via `useSheetNavigate`; new tabs must be added to `TAB_FOR_PATH`.**
- **`src/lib/diary-refresh.ts` (`bumpDiary`/`useDiaryVersion`) is the app-wide "user-data-changed"
  tick** (a `useSyncExternalStore` pub/sub). Despite the name it's used by Diary, Library, and
  `useProfile`, not just the diary — mutations call `bumpDiary()` and subscribers refetch.
- **`useAsync(fn)` requires a `useCallback`-stable `fn`** or it refetches every render — see
  **Failure F4**.
- Logging writes a per-entry snapshot (`nutrients`/`energy_kcal`/`label`) so history is stable across
  later edits/soft-deletes.
- Dates are civil `YYYY-MM-DD` via `src/lib/date.ts` — never `new Date('YYYY-MM-DD')` (UTC
  off-by-one); use `fromIsoDate` (local midnight) / `toIsoDate`.

### M6 — Dashboard / Daily Report (`91c40f4`)

Goal: energy-balance + nutrient report, as a daily average (range) or single day. Mostly reuse.

- **Built:** `src/lib/report.ts` (+tests), `EnergyBalanceCard`, shared `NutrientReport`, `Dashboard` (range dropdown), `DailyReportSheet` (`/report/:day`), `constants/{nutrient-sections,ranges}.ts`.
- **Rationale:** averages divide by **days-with-entries** (a typical logged day), per `01-screens.md`; one `NutrientReport` serves both screens (single day → 1 logged day).

### M7 — Library (`986448f`)

Goal: create/edit/delete custom foods/supplements and activities.

- **Built:** `Library.tsx` (Foods/Activities tabs, search, swipe-delete, edit, +New), `NewFoodSheet` (full collapsible nutrient entry; blank inputs omitted), `NewActivitySheet` (template, MET-by-effort, icon picker), `CollapsibleSection`, `serving.replaceServings`.
- **Rationale:** forms are outer-loader + inner-form (lazy `useState` init) so edits preload without a set-state-in-effect; edit re-inserts servings (`replaceServings`) — simplest correct sync at this scale.

### M8 — Settings (`ea43586`)

Goal: profile/targets/visibility/units/account.

- **Built:** `Settings.tsx`, `HighlightedNutrientsSheet` (cap 8), `VisibleNutrientsSheet` (grouped toggles + protein target + "limited data" notes), `useProfileEditor`. `useProfile` now refetches on the `diary-refresh` tick so edits propagate to Diary/Dashboard.
- **Rationale:** auto-save on change (per the spec's button convention); units are display-only via `src/lib/units.ts`.

### M9 — PWA polish (`c9a2c2c`)

Goal: real icons, smaller bundle, verified PWA, then deploy.

- **Built:** branded coral-ring icons (`public/`, incl. a padded maskable) + manifest update; **barcode scanner code-split** — `AddFoodSheet` lazy-loads `BarcodeScanner`, moving `@zxing` into its own ~470 kB chunk (initial JS ~1 MB → ~567 kB).
- **`registerType: 'autoUpdate'`** (silent SW update).
- **Subsequently deployed** to Vercel + installed on iPhone (see post-launch work below).

### Post-launch polish (session, June 2026)

A batch of usability + data fixes after the first deploy. Behavior is in the specs; the notable
engineering decisions:

- **Schema:** added `activity.default_duration_min` (prefills the Activity Log duration). Then
  **consolidated migrations** — folded the API-role grants (old F1 migration) _and_ the new column
  into `01_wellness_schema.sql`, so the tree is just `wellness_schema` + `wellness_seed_nutrient`. The live
  DB was reconciled with `supabase db reset --linked` (documented in `OWNER_RUNBOOK.md` Part M). Editing
  already-applied migrations is only OK because this is a solo pre-/early-prod DB that can be reset.
- **URL-as-state pattern:** the viewed Diary **day**, the Add Food **tab/search**, and the Library
  **tab** now live in `useSearchParams` (written with `{replace:true}`), not component state — so they
  survive the background-location remount when a sheet opens over a tab, and `navigate(-1)` restores
  them. Reach for this whenever a tab's transient UI must persist across an overlay sheet.
- **Layout / iOS:** app shell switched `min-h-svh` → `h-dvh` + `pt-[env(safe-area-inset-top)]` (the
  `black-translucent` status bar was overlapping the header, and `100svh` fell short of the screen);
  per-tab sticky top panes; full sheets reserve the top inset. `dev` script is now `vite --host` for
  LAN/iPhone testing.
- **Logging inputs:** Amount/Duration are **string drafts** with select-on-focus (kills the
  "type onto the leading 0" bug from coercing empty→0); shared `src/lib/quantity.ts#draftAmount`.
  Effort picker shows all levels but **disables** ones with no MET; New Activity requires ≥1 MET (and
  the default effort must have one); effort bands relabeled (Light ≤3 / Moderate 3.1–5.9 / Vigorous ≥6).
- **Diary group headers + ⋯ menu overhaul:** group headers reordered to **chevron · category icon ·
  name · kcal** with the green `+` moved to the **right** (`GroupHeader` now takes `Icon`/`iconClass`
  from `constants/groups.ts` — apple/cookie/pill/runner in per-category colors). The ⋯ menu's per-day
  copy actions were replaced by **Multi-Select → Copy / Paste / Delete All**: Multi-Select shows a
  checkbox per entry (and expands all groups); Copy stashes the chosen entries — with their
  `strength_set` children — in an in-memory clipboard (`lib/diary-clipboard.ts`, a `useSyncExternalStore`
  store so it survives the Diary remounting behind a sheet); Paste appears only for a **different** day
  and **adds** the clipboard entries to the viewed day (`cloneEntriesToDay`, which also clones strength
  sets — retired the PARKED item); Delete All clears the day via `deleteEntriesByDay` after a confirm.
  Removed `copyEntriesToDay`.
- **Return to Diary after logging:** ADD TO DIARY from Food Detail / Activity Log now lands back on
  the Diary, not the picker the user came through. `useReturnAfterLog` pops two sheets in create mode
  (detail-over-picker-over-Diary) and one in edit mode (detail opened straight from a Diary row, via
  `entry=`), keyed off the `editing` flag; a deep-linked sheet (no painted `background` state) falls
  back to a single pop so we never unwind past the app. The **X** close still pops one level, so it
  returns to the picker with its tab/search intact.
- **Strength sets (Activity Log):** reps/weight are now **string drafts** too (were raw `number` with
  `Number(e.target.value) || 0`, which snapped an emptied field back to `0` and couldn't be cleared);
  they parse to numbers only at save. **Validation** (inline error + ADD TO DIARY/SAVE disabled):
  a _named_ exercise needs reps > 0 and weight (kg) ≥ 0 in every set (0 = bodyweight); an _unnamed_
  exercise is fine blank (dropped on save) but is flagged once any reps/weight field is filled, so
  typed sets aren't silently lost. Default set is empty (`'' / ''`) so a fresh, untouched exercise
  doesn't trip the name check. **Add set** duplicates the previous set's reps + weight.
- **Edit logged entries:** Diary rows are tappable → reuse **Food Detail / Activity Log** in edit mode
  via an `entry=<id>` query param; footer becomes **RESET + SAVE**. New `SecondaryButton`; RESET/SAVE
  are **dirty-gated** (compare current vs. captured initial) across the edit + create forms.
- **Bulk import:** foods/supplements CSV import — `src/lib/csv.ts` (small RFC-4180 parser),
  `src/lib/food-import.ts` (validate + map to records), `data/food.importCustomFoods`, and
  `ImportFoodsSheet` (Library → **Import CSV**). Template + guide in `templates/`.
- **Add Food search overhaul:** (1) **broader matching** — two layers. USDA matches whole tokens, so
  `searchFoods` wildcards the last word at a stem (`food-search.ts#toUsdaWildcardQuery`:
  "blueberry"/"blueberries"/"blueberrie"/"blueberr" → `blueberr*`) so partial/plural input all returns
  the same candidates; then a pure, punctuation/plural-insensitive prefix scorer
  (`food-search.ts#foodMatchScore`: leading-word-equals > leading-prefix > later-word > substring)
  re-filters/ranks them. "Blueberries" → "Blueberries, raw" and "Muffins, blueberry".
  (2) **Branded flood fix** — `searchFoods` now runs two USDA POST searches (whole-food databases vs
  Branded) and merges whole-foods-first, collapsing/​capping Branded duplicates; a single combined
  search drowned the page in 8000+ identical "BLUEBERRIES" Branded items (see **F6**). (3) **Two-line
  result rows** — name (wraps) + heart on line 1; `n nutrients · serving` + source on line 2; local +
  USDA merged into one list sorted by match score then nutrient count. (4) **Scroll fix** — see **F6**.
- **Seed:** activities carry per-effort METs + default durations; added Running (Jog/Fast).
- **Misc:** Settings "Visibility" → "Display"; Toggle knob overflow fixed (flex layout, not
  absolute+translate); FoodDetail favorite-heart toggle fixed (a nullable override, not `a || b`).

---

## Net Worth Build Sequence (per milestone)

### M1 — Secure seed data + Net Worth schema

Goal: get private financial data out of the repo and lay the two-table foundation, without touching
the running Wellness app.

- **Security fix (the urgent part):** `templates/networth-seed-template.csv` had been committed with
  **real** balances and pushed to GitHub (commits `d08ef38`, `0e363e2`). Fixed by purging the file
  from all history with `git filter-repo --invert-paths` and **force-pushing**, then committing a
  **sanitized** example template. The real data now lives only in a **gitignored**
  `templates/networth-seed.local.csv`; `.gitignore` ignores `*-filled.csv` / `*.local.csv` /
  `networth-*.csv` with a `!templates/networth-seed-template.csv` negation so the sanitized template
  stays tracked. See **Failure F7**.
- **Schema:** `03_networth_schema.sql` — `networth_snapshot` (one row per user+month,
  `month` CHECK-normalized to the 1st, `UNIQUE(user_id, month)`) and `asset_entry` (own `user_id` for
  direct RLS like `diary_entry`; `snapshot_id` ON DELETE CASCADE; `value_native`/`fx_rate_to_base`/
  `value_base` stored so a month's HKD figures freeze against later FX revisions). RLS + 4 owner
  policies + explicit per-table grants, matching `wellness_schema`.
- **Currency = `CNY`, not `RMB`.** The renminbi is stored as ISO `CNY` end-to-end, which is exactly
  what Frankfurter (ECB) quotes — so FX needs no code translation. Docs (`00-PRD`, `PARKED`) updated accordingly.
- **Import is in-app, not a script.** Per the owner's choice, the one-time CSV seed becomes a reusable
  **in-app importer** (anon key + RLS, signed in as the owner) that creates/replaces a month's entries
  — idempotent per month. Built in a later Net Worth milestone.
- **Navigation grows into a Home hub** (owner's decision): instead of a two-way Wellness⇄Net Worth
  switch, a top-level Home hub of module cards, Wellness moved under `/wellness/*`, Settings lifted to
  the global level, last-used-module reopen. Built in the next milestone (M2). `00_PRD.md` carries the
  navigation model.

### M2 — Home hub + module routing refactor

Goal: turn the single-app shell into a multi-module app behind a Home hub, with Wellness fully
working under `/wellness/*` and Net Worth reachable as a placeholder module. No DB/data-layer changes.

- **Drop-in module architecture.** `src/constants/routes.ts` is the single source of truth for all
  path strings; `src/constants/modules.ts` holds the `MODULES` registry (`ModuleDef` + `moduleForPath`)
  that both the Home hub cards and the per-module `BottomNav` are derived from. Adding a module later =
  one `ModuleDef` + its routes in `router.tsx` — no structural change. New screens: `Home` (hub),
  `WellnessSettings`, `NetWorthDashboard`/`NetWorthEntry` (placeholders), `RootRedirect`.
- **Routing.** All routes stay flat children of the single `<AppShell/>` (full path strings, no nested
  layout route) so the background-location sheet pattern + single `<Outlet/>` are unchanged — lowest
  risk. Wellness tabs **and all its sheets** moved under `/wellness/*`; `TAB_FOR_PATH` re-keyed.
  `/` → `RootRedirect` → last-used module (`src/lib/last-module.ts`, localStorage) else `/home`.
- **Module-aware shell.** `BottomNav` takes a `module` prop (a Home item + the module's tabs);
  `AppShell` renders it only when `moduleForPath(pathname)` is non-null (hub + global Settings have no
  bottom nav) and records the last-used module in an effect.
- **Settings split.** Global `Settings` (Profile, Units, Account) reached from the hub gear; new
  `WellnessSettings` (protein Target + nutrient Display sheets) reached from a **gear added to the
  Wellness screen headers** (Diary/Dashboard/Library). The highlighted/visible sheets moved to
  `/wellness/settings/*`.
- **Internal links.** Every `openSheet(...)`/`to=` absolute literal swapped to `routes.*`
  (Diary, AddFoodSheet, AddActivitySheet, Library). The Back/X pop-logic (`useReturnAfterLog`,
  `Sheet`) is path-agnostic (`navigate(-1/-2)` off `state.background`) — unchanged.
- Built on branch `phase2-m2-home-hub` (auto-deploy safety); gates + production build green. The 76
  tests are pure helpers, so routing was verified by manual click-through.

### M3 — Net Worth Monthly Entry

Goal: make Net Worth real — data layer + pure calc helpers + the Monthly Entry screen (replacing the
M2 placeholder). **Manual FX** in M3 (auto-fetch is M4); no schema change.

- **Calc/constants** `src/lib/networth.ts`: `ASSET_TYPES` (+labels), `DETAIL_FIELDS`, `CURRENCIES`,
  `valueBase`/`totalBase`/`groupByType`/`formatHkd` — pure (+6 tests → **82** total).
- **Data layer** `src/data/networth-snapshot.ts` + `asset-entry.ts`. The SAVE path is
  `saveSnapshotEntries(userId, month, rows)` — get-or-create the month's snapshot, delete its
  `asset_entry` rows, insert the new set (mirrors `data/serving.replaceServings`). **Idempotent per
  month**; the M6 importer reuses it. Delete+insert is non-atomic (solo-app trade-off).
- **Screen** `src/screens/NetWorthEntry.tsx`: outer-loader + inner-form mirroring `NewFoodSheet`'s
  dirty-snapshot pattern, but it **stays mounted** after SAVE — so it keeps a local `baseline` and
  **re-seats it on save** (instead of `navigate(-1)`). Month nav (prev/next + `formatMonthLabel`);
  copy-forward via `getLatestSnapshotBefore`; entries grouped by all 7 asset types with a per-group
  add + inline edit/trash; manual per-currency FX (HKD locked at 1); live HKD total. SAVE calls
  `bumpNetWorth()` (new `src/lib/networth-refresh.ts`) for the M5 dashboard.
- **`useAsync` gotcha:** it keeps the _previous_ `data` while a refetch is in flight, so the form is
  gated on `!loading` (and keyed by `month`) — else a month switch briefly mounts the new month with
  the old month's rows.

### M4 — Frankfurter FX auto-fetch

Goal: replace M3's manual-only rate entry with an auto-fetch, keeping a manual override.

- **`src/lib/fx.ts`** (+ `fx.test.ts`, +3 tests → **85**): `fxUrl` / `parseFrankfurterRate` (pure,
  tested); `fetchRateToHkd` (module cache keyed `month|currency`, `AbortController` ~8s timeout);
  `fetchRatesToHkd` (`Promise.allSettled` → null on a failed leg, non-fatal). **Keyless, ECB,
  CORS-enabled** (browser-callable like OFF). **CNY is native** — no RMB→CNY map. HKD never fetched
  (= 1). Network fetch isn't unit-tested (only the pure URL/parse helpers are, matching off-api).
- **`NetWorthEntry`**: `loadFn` auto-fetches **only for a new month** (no existing snapshot) and
  overrides the copied/blank CNY/USD rates — existing months keep their **frozen stored** rates. The
  FX bar gains a per-currency **refresh ↻** (force-bypasses the cache) + "Fetching…/Couldn't fetch"
  status; a manual edit overrides and clears the error. `save()` is unchanged (already freezes the
  rate + `value_base` per row).

### M5 — Net Worth Dashboard

Goal: the real dashboard — current total, total-trend line graph (recharts) with a window selector +
Total⇄By-type toggle, and a latest-month per-type summary. Reads the frozen `value_base`; no mutation.

- **Data**: `asset-entry.listSnapshotsWithEntries(userId)` — one **embedded select**
  (`networth_snapshot` → `asset_entry(value_base, asset_type)`). Net-worth data is small, so fetch all
  and slice the window **client-side** (no refetch per window).
- **Calc** (`networth.ts`, +4 tests → **89**): `typeTotals`, `typeBreakdown` (% of net worth),
  `ASSET_TYPE_COLORS` (CSS-var per type), `formatHkdCompact` (axis). `date.formatMonthShort`
  (`Jun ’26`); `constants/networth-ranges.ts` (6M/12M/2Y/3Y/5Y/All, default All).
- **recharts is lazy-loaded.** All recharts imports live in `components/NetWorthTrendChart.tsx`, which
  the dashboard pulls in via `lazy()`/`Suspense` (mirrors the BarcodeScanner split) — it builds as its
  **own ~344 kB chunk** (gzip ~101 kB), kept out of the initial bundle. Chart colors are the `@theme`
  CSS vars so it matches the dark theme.
- **Screen**: refetches after an entry SAVE via `useNetWorthVersion`; explicit loading/error/empty
  states; the By-Type chart only draws types **present** in the window.

### M6 — In-app CSV importer

Goal: bulk-load/replace a month's holdings from a CSV — **feature-complete**. Reuses the
Wellness import machinery + `saveSnapshotEntries`.

- **`src/lib/networth-import.ts`** (+`.test.ts`, +5 tests → **94**): `parseNetWorthCsv` (mirrors
  `food-import.ts`) + `stripNumber` (strips thousands-separator commas **and** quotes — `"8,466,568.80"`
  → `8466568.80` — for `value_native` and all detail values). Scans any number of
  `detailN_key`/`detailN_value` pairs into `details`; validates asset_type/currency/name/value, case-
  normalized, bad rows reported + skipped.
- **`src/screens/ImportNetWorthSheet.tsx`** (mirrors `ImportFoodsSheet`): `<input type="month">` +
  file picker → preview (rows, errors, fetched FX rates, HKD total); fetches the month's FX
  (`fetchRatesToHkd`) and **blocks import** if a used non-HKD rate is missing; shows "Replaces N
  existing entries"; Import → `saveSnapshotEntries` (create-or-replace, idempotent) → `bumpNetWorth`.
  Opened from a new **Import CSV** button on Monthly Entry via `/networth/import` (background-location
  over `/networth/entry`).
- **Entry staleness fix:** `NetWorthEntry`'s `loadFn` now also depends on `useNetWorthVersion()`, so
  the entry refetches after an import (and its own SAVE) — keeps entry + dashboard consistent (a brief
  post-SAVE reload is the trade-off).
- Guide: `templates/networth-import-guide.md`.

---

### UI refinements (session, June 2026)

Cross-module consistency pass after the Net Worth build:

- **Bottom nav:** Home is now the **leading** (leftmost) tab in every module's `BottomNav`, not
  trailing.
- **Action-button convention unified to the top-right header.** All Wellness logging/form sheets
  (`FoodDetailSheet`, `ActivityLogSheet`, `NewFoodSheet`, `NewActivitySheet`) moved their action
  buttons out of a bottom bar into the **sheet header's right edge** — matching Net Worth's
  `EntryForm`. Labels shortened: `ADD TO DIARY` → **ADD**, `ADD FOOD`/`ADD ACTIVITY` → **CREATE**;
  edit-mode keeps **RESET** + **SAVE**. `ActivityLogSheet`'s strength validation error moved to a
  fixed strip just under the header (it used to sit above the now-removed footer). Convention is
  documented in `01-screens.md` (Button convention) + `04-design-system.md` (Button placement).
- **Compact header buttons + 2-line titles.** `PrimaryButton`/`SecondaryButton` gained a `size` prop
  (`default` = full pill for sign-in/full-width; `sm` = `px-3 py-1.5` for the header action bars);
  every top-right action (Net Worth + the four Wellness sheets) uses `size="sm"`. The food/activity
  name in `FoodDetailSheet`/`ActivityLogSheet` headers switched from single-line `truncate` to
  **`line-clamp-2`** so long names wrap to two lines with an ellipsis instead of being cut at one.
- **Diary header** `‹ date ›` is now **centered**: the day stepper is `justify-center` and the
  settings/⋯ controls are `absolute right-3`, so the date sits mid-header regardless of the controls'
  width.
- **Net Worth month selector:** tapping the month label opens a new **`MonthPicker`** overlay
  (year stepper + month grid, OK/Cancel — same modal pattern as the Wellness `Calendar`).

---

## Shows Build Sequence (per milestone)

- The **Shows module** (TV shows + movies) is specced in `docs/06_shows.md` (a staging doc whose sections merge into the permanent specs as each feature lands). It drops into the multi-module architecture with no structural change.
- Two **owner decisions deviate from `06_shows.md`** and are carried in the permanent docs as built:
  - (1) the back-catalogue importer is **in-app, not a CLI script** (same reversal as Net Worth — an in-app preview table lets the owner fix no-match/ambiguous TMDB rows inline);
  - (2) a **Shows Settings** screen (`/shows/settings`) adds Entry/Edit **field-visibility** + an **importer enable/disable** toggle, with both prefs synced on `profile`.

### M1 — Schema + module registration + scaffold screens

Goal: a runnable, navigable Shows module behind a hub card, before any data layer or external API.

- **Schema:** `05_shows_schema.sql` — one `show` table (own `user_id` for direct RLS like
  `asset_entry`; CHECKs on `type`/`status`/`lgbtq_rep` and `rating` 0–5 in 0.5 steps via
  `(rating*2)=floor(rating*2)`; `index (user_id, status)`; 4 owner policies; `moddatetime`; explicit
  grants). `cast` is a SQL reserved word → declared as `"cast"`; the M2 data layer will map it to a
  safe TS name. Imported rows leave `start_date`/`end_date`/`last_update_date` NULL by design.
  Owner reviews + `supabase db push`, then `npm run gen:types` regenerates `database.ts`.
- **Module registration (drop-in):** `shows` namespace in `constants/routes.ts`; a Shows `ModuleDef`
  in `constants/modules.ts` (tabs Dashboard + Library; `IconDeviceTv`); flat routes `/shows`,
  `/shows/library`, `/shows/entry`, `/shows/:id` in `router.tsx`; `/shows*` keys added to
  `AppShell.TAB_FOR_PATH`. `Home` + `moduleForPath` need no change.
- **Stub screens:** `ShowsDashboard` / `ShowsLibrary` / `ShowsEntry` — navigable empty states (the
  real shelves, list/filters/sort, and the Entry form arrive in M2–M5). Exported from `screens/index`.
- Verified by `npm run typecheck` + manual click-through; the data-model section of `06_shows.md` was
  merged into `03-data-model.md` and the PRD module list / nav / non-goals updated.

### M2 — Data layer + manual Entry/Edit + basic Library

Goal: a full **manual** CRUD loop (no TMDB yet) so the module is usable end-to-end.

- **Pure layer** `src/lib/shows.ts` (+`shows.test.ts`, +10 tests → **104**): the `type`/`status`/
  `lgbtq_rep` unions + label maps (the generated types surface the CHECK columns as plain `string`),
  the status-chip palette, `posterUrl`, and the tested transitions `startWatching`/`markWatched`/
  `progressLabel`/`isUpNext`. `src/lib/shows-refresh.ts` mirrors `networth-refresh`.
- **Data** `src/data/show.ts`: list/get/create/update + **hard** `deleteShow` (no soft-delete column;
  nothing references `show`). `cast` needed quoting only in SQL — in TS it's an ordinary
  `row.cast` property, no rename.
- **Components**: `StarRating` (0–5 half-star, display+input via two half-width hit-zones per star,
  tap-to-clear), `ShowTypeBadge` (TV/movie icon chip), `StatusChip` (palette pill). The Type/Status/
  LGBT+ controls **reuse `SegmentedTabs`** (already generic over N options) — no new toggle.
- **`Calendar` generalized.** It was wellness-coupled (imported `useAuth` + `listEntriesByRange` to
  draw food/activity cue dots). Made it **presentational** with an optional
  `loadCues(monthStart, monthEnd)` callback (legend shown only when provided); the diary fetch moved
  into its one caller, `Diary.tsx`. Shows date pickers pass no loader → a plain date picker. Keeps a
  single shared Calendar; verified the Diary calendar still shows its dots.
- **Screens**: `ShowsEntry` (full route `/shows/entry` + `/shows/:id`, not a sheet — outer loader +
  inner form keyed by id per F8, single `draft` object, `JSON.stringify` dirty gate, RESET +
  CREATE/SAVE; status→Watched/Dropped defaults the finish date and snaps TV watched counts to totals;
  dates via `Calendar`); `ShowsLibrary` (search + `SwipeRow` hard-delete with confirm, rows show
  badge/status/stars, tap → edit). TMDB metadata fields are deferred to M3 (manual Title/Year for now).

### M3 — TMDB integration

Goal: pull poster + metadata into the Entry form on demand (search → details on select); persisted
only on CREATE/SAVE.

- **Client** `src/lib/tmdb-api.ts` (+`tmdb-api.test.ts`, +11 tests → **115**): browser-direct
  (v3 `api_key` query param, `VITE_TMDB_API_KEY`), mirroring `food-api`. `searchTitles(type, query)`
  - `getTitleDetails(type, id)` (`append_to_response=credits,external_ids`). Pure mappers
    (`mapSearchResults`/`mapMovieDetails`/`mapTvDetails`/`pickDirectorFromCrew`/`pickCast`/`pickYear`)
    are unit-tested; the network calls aren't (matching food-api/off-api/fx). `content_rating` is not
    fetched (deferred — needs extra `release_dates`/`content_ratings` parsing the spec doesn't require).
- **Title Search is a LOCAL overlay, not a route sheet** (`src/components/TitleSearchSheet.tsx`). The
  routing `Sheet` closes via `navigate(-1)`, so opening it puts Entry behind the background-location
  and **remounts a fresh `ShowsEntry`** (from `AppShell.TAB_FOR_PATH`), discarding the in-progress
  draft. So Title Search renders as a local `fixed inset-0` overlay inside Entry (like
  `Calendar`/`MonthPicker`), returning the pick via an `onSelect` callback. No new route / `router` /
  `AppShell` change. **Don't make in-form pickers route sheets** — they must outlive a remount.
- **`ShowsEntry`**: `ShowDraft` extended to the full column set; a **Search TMDB** button opens the
  overlay scoped to `draft.type`; on select, `getTitleDetails` merges metadata (incl. Title/Year + TV
  totals) while keeping the user's Status/Rating/LGBT+/dates/comments; a read-only poster + metadata
  block renders when populated; `save()` now writes the metadata columns. Title/Year stay editable.
- **Config**: `VITE_TMDB_API_KEY` added to `vite-env.d.ts` + `.env.example`; OWNER-RUNBOOK gained a
  "Get a free TMDB key" part (Part C2) + env/Vercel/smoke-test/summary entries.

### M4 — Shows Dashboard

Goal: replace the `ShowsDashboard` stub with the real shelves + quick actions. Mostly assembly of
existing tested helpers; no schema/API change.

- **Selectors** (`src/lib/shows.ts`, +3 tests → **118**): `recentlyWatched(shows, limit)` (watched +
  non-null `end_date`, newest first) and `countWatchedThisYear(shows, year)`. The Up Next / Watching /
  Want filters are inline one-liners reusing `isUpNext`.
- **`PosterThumb`** (`src/components/PosterThumb.tsx`): the 2:3 poster/placeholder, extracted from
  `TitleSearchSheet` (refactored to use it) and reused by the dashboard rows (and M5 Library).
- **`ShowsDashboard`**: sticky header (title + `+` New + All/TV/Movies `SegmentedTabs` filter);
  `useAsync(listShows)` keyed on `useShowsVersion`; shelves as `SectionCard`s shown only when
  non-empty; a compact local `DashRow` (poster + two lines + optional trailing action). Quick actions
  reuse the pure transitions — **Mark Watched** = `updateShow(id, markWatched(show, todayLocal()))`,
  **Start Watching** = `updateShow(id, startWatching(todayLocal()))` — then `bumpShows()`; an
  `updatingId` disables the button in-flight.
- **Decision**: **Watching de-duplicates Up Next** (`watching && !isUpNext`) so an episode-tracked TV
  show isn't listed twice; **Mark Watched** is offered on Watching rows too (movies aren't a dead end).
  The "this year" count derives from `todayLocal().slice(0,4)` (no `new Date('…')` — date.ts rule).

### M5 — Library filters + sort + poster thumbnails

Goal: the full Library — poster rows + a filter panel + a Sort menu, search over Title/Director/Cast.

- **Pure view** (`src/lib/shows.ts`, +7 tests → **125**): `applyLibraryView(shows, criteria)` does all
  filtering (query over `searchableText` = title+original+director+cast; Type/Genre/Rating(min)/LGBT+/
  Status; start & finish date ranges) then sorts (`field × dir`, **nulls last** regardless of
  direction, stable title tiebreak; `date` key = `end_date ?? last_update_date ?? updated_at`). Plus
  `showGenres` (genre options from the user's own rows), `searchableText`, `SHOW_STATUS_ORDER`,
  `LibraryCriteria` + `DEFAULT_LIBRARY_CRITERIA`.
- **`SelectMenu`** (`src/components/SelectMenu.tsx`): extracted the dropdown pattern (previously inlined
  in `NetWorthDashboard`/`Dashboard`/`Diary`) — used for the Status/Genre/Rating/LGBT+/Sort dropdowns.
  (The three existing inlined menus were left as-is — out of M5 scope.)
- **`ShowsLibrary`** rewritten: sticky header (search + a **Filters** toggle with an active-count + a
  **Sort** `SelectMenu` + asc/desc button); a collapsible filter panel (Type `SegmentedTabs`, the four
  dropdowns, two date ranges via the `Calendar` overlay, Clear filters); poster rows (`PosterThumb`)
  with title/year · badge·status·stars · genre·date. Rows come straight from `applyLibraryView`.
- **Decision**: filter/sort state is **local** (resets on leaving the tab); URL-persistence and the
  wide-screen sortable table are **parked** (`PARKED.md`). Rating filter is a **minimum**.

### M6 — Shows Settings + Entry field-visibility

Goal: a Shows Settings screen (the Wellness Settings split, mirrored) for Entry field-visibility + an
importer-enable toggle, both synced on `profile`.

- **Migration** `06_shows_profile_settings.sql`: adds `profile.show_visible_fields text[]`
  (**nullable — NULL = all visible**, default-on, no seeding) + `show_importer_enabled boolean default
false`. Additive columns on an existing table → RLS/grants/`moddatetime` already cover them. Owner
  `db push` + `gen:types`.
- **Null-sentinel decision**: unlike `visible_nutrients` (defaults `'{}'` = none), Shows field
  visibility defaults **on** — hiding-by-default is wrong for an entry form, and a NULL sentinel means
  new fields added later are visible without a data migration. `isFieldVisible(prefs, key)` = `prefs
== null || prefs.includes(key)` (`src/lib/shows.ts`, +2 tests → **127**).
- **Screens** (mirror `WellnessSettings`/`VisibleNutrientsSheet`): `ShowsSettings` (full screen — a
  **Visible Fields** row + an **Enable CSV import** `Toggle` on `show_importer_enabled`) and
  `ShowsFieldsSheet` (route `Sheet` of per-field toggles over `SHOW_ENTRY_FIELDS`, auto-saving via
  `useProfileEditor`; initialised from `show_visible_fields ?? all keys`). A **gear** was added to the
  `ShowsDashboard`/`ShowsLibrary` headers → `/shows/settings`; `/shows/settings/visible` is the sheet.
- **Entry** reads the prefs via `useProfile` and wraps each hideable field in `isFieldVisible(...)`
  (Type/Title/Status/Search always shown). Hiding is display-only — `save()` still writes the draft's
  loaded values, so no data is lost and the dirty check is unaffected.
- **Importer toggle persists in M6**; its launcher + the Import sheet land in **M7**.

### M7 — In-app CSV importer (Shows feature-complete)

Goal: the bulk importer to seed the back-catalogue — per-row TMDB resolution + idempotent
commit. Launched from the M6 Settings toggle. No migration, no env.

- **`.gitignore` first** (F7): added `shows-import*.csv` + `!templates/shows-import-template.csv`
  before creating any CSV; only the sanitized `templates/shows-import-template.csv` + guide are tracked.
- **Pure layer** `src/lib/shows-import.ts` (+`.test.ts`, +10 tests → **137**): `parseShowsCsv` (shares
  `src/lib/csv.ts`), `dedupKey(title, type)`, `buildImportRow(input, match)` — combines a CSV row with
  its TMDB match; **dates left NULL**; watched counts per status/type (watched ⇒ TMDB totals,
  watching/dropped TV ⇒ CSV values, want/movie ⇒ null).
- **Idempotent commit** `data/show.saveImportedShows(userId, payloads)`: fetch existing `(id,title,
type)` once → `dedupKey → id` map → update-or-insert (collapsing in-file dupes). Re-running the same
  file updates in place. **Dedup keys on the _resolved_ (stored) title**, so a CSV title that resolves
  to a different TMDB title still re-matches on re-run (both runs resolve identically).
- **`ImportShowsSheet`** (route `Sheet`, mirrors `ImportNetWorthSheet`): pick file → resolve every row
  against TMDB with a **concurrency pool (5)** + progress → preview (poster, matched title/year,
  no-match / review flags) → per-row **Change** reuses `TitleSearchSheet` to re-pick → **Import** →
  `saveImportedShows` + `bumpShows` → done ("N — C new, U updated"). Launcher added to `ShowsSettings`
  (shown when `show_importer_enabled`); route `/shows/import` opens over `/shows/settings`.
- **Shows is now feature-complete (M1–M7).**

### M8 — Chinese documentaries enhancement (`06-shows-enhancement.md`, then deleted)

Goal: track Chinese-language content — esp. Chinese documentaries / CCTV series TMDB often lacks or only carries under Chinese titles.

- Four owner decisions taken before building (see `06-shows-enhancement.md`'s ambiguities):
  - **(1)** edit the original `05_shows_schema.sql` + recreate the table (the DB held no live data) rather than ship an additive migration;
  - **(2)** **remove** the dormant `content_rating` column outright (it was fetched/displayed nowhere);
  - **(3)** Library handles `master_series` with a **filter only** (no grouped headers);
  - **(4)** documentary uses the **`/tv`** endpoint by default.

- **Schema** (recreated `show`): `type` CHECK gains `documentary`; **add** `master_series text` + index
  `(user_id, master_series)`; **drop** `content_rating`. `poster_path` now documents a dual meaning (TMDB
  path **or** a full pasted URL). `database.ts` regenerated (master_series in, content_rating out).
- **Pure logic** (`src/lib/shows.ts`, +tests → **242** total): `SHOW_TYPES` += documentary;
  `usesEpisodes(type)` (TV + documentary share the episode UI + watched-count logic — `markWatched`,
  Entry, importer all switch off it); `posterUrl` returns an absolute pasted URL as-is (`isAbsoluteUrl`)
  and only CDN-prefixes a TMDB path; `buildRefreshPatch(show, meta)` — the per-show Refresh merge:
  patches only the TMDB-sourced fields, **preserves owner fields + a manual (absolute-URL) poster**, and
  reports `changed` for "no changes"; `masterSeriesOptions` + a `masterSeries` `LibraryCriteria` filter.
  **Refresh deliberately excludes `year`/`imdb_id`** (per the spec's explicit field list).
- **TMDB Chinese-aware** (`src/lib/tmdb-api.ts`): `containsCjk`/`tmdbLanguage` send `language=zh-CN` for
  CJK queries/titles; `endpointFor` maps documentary→/tv; `getTitleDetails` takes an optional `language`;
  `refreshFromTmdb(show)` re-pulls a `tmdb_id` title (Chinese-aware) → `ShowMetadata` for the pure merge.
- **Posters:** `referrerpolicy="no-referrer"` added once on the shared `Thumb` (covers PosterThumb +
  CoverThumb) plus the Entry detail `<img>`, so hotlink-protected CDNs (a pasted Douban poster) serve.
- **UI:** `ShowTypeBadge` third glyph `IconVideo`; Entry gains a documentary-only **Master Series** field,
  an always-editable **Poster URL** field, a **⟳ Refresh** button (enabled once `tmdb_id` is set), and
  `?title=&poster=&overview=&master_series=&type=` **prefill** (mirrors `QuotesEntry`); Library + Dashboard
  - importer render a master-series eyebrow; Library type filter gains **Docs** + a **master-series filter**.
- **Importer:** column `master_series` added, `documentary` accepted, **`dedupKey(title, masterSeries)`**
  (type-agnostic; `saveImportedShows` + the existing-row fetch updated to match); a no-match documentary
  imports metadata-less. Template + guide updated (incl. two Chinese documentary example rows).
- The transient `docs/06-shows-enhancement.md` staging doc was deleted (all sections merged into the
  spec docs / templates / runbook). **Shows feature-complete (M1–M7 + M8).**

## Books Build Sequence (per milestone)

- The **Books module** (books read / to read) is specced in `docs/06-books.md` (a staging doc whose sections merge into the permanent specs as each feature lands).
- Per that doc it is **"the Shows module re-skinned for books"**, so it drops into the multi-module architecture with no structural change and its build mirrors the Shows M1–M7 sequence.
- **Four owner decisions deviate from `06-books.md`** and are carried in the permanent docs as built:
  - (1) the back-catalogue importer is **in-app, not a CLI script** (same reversal as Net Worth / Shows — an in-app preview lets the owner fix no-match/ambiguous Google Books rows inline);
  - (2) a **Books Settings** screen (`/books/settings`) adds Entry field-visibility + an importer enable/disable toggle, synced on `profile` (mirrors Shows Settings);
  - (3) the **Open Library fallback is built**, not parked, so titles Google Books lacks (and ISBN/cover lookup) still resolve;
  - (4) the importer **reuses the in-house RFC-4180 parser `src/lib/csv.ts`, not Papa Parse** — verified against the real `templates/quotes-seed-local.csv` that `csv.ts` already handles quoted fields with embedded commas, `""` escapes, embedded newlines, and the Excel BOM, and the Books CSV (`title,author,rating,lgbtq_rep,end_date`) has no multi-line cells at all.

### M1 — Schema + module registration + scaffold screens

Goal: a runnable, navigable Books module behind a hub card, before any data layer or external API.

- **Schema:** `07_books_schema.sql` — one `book` table (own `user_id` for direct RLS like
  `show`; CHECKs on `status`/`lgbtq_rep` and `rating` 0–5 in 0.5 steps via
  `(rating*2)=floor(rating*2)`; `index (user_id, status)`; 4 owner policies; `moddatetime`; explicit
  grants). Unlike Shows' `poster_path`, `cover_url` stores a **full image URL** (Google Books / Open
  Library return absolute URLs, no CDN base to prepend). **Hard delete** (leaf table; no `deleted_at`)
  — the future Quotes `quote.book_id` link is `ON DELETE SET NULL` on `quote`, so it imposes no FK on
  `book`. Imported rows leave `start_date`/`last_update_date` NULL by design. Owner reviews +
  `supabase db push`, then `npm run gen:types` regenerates `database.ts` (the M2 data layer needs the
  `book` row type).
- **Module registration (drop-in):** `books` namespace in `constants/routes.ts`; a Books `ModuleDef`
  in `constants/modules.ts` (tabs Dashboard + Library; `IconBook`); flat routes `/books`,
  `/books/library`, `/books/entry`, `/books/:id` in `router.tsx`; `/books*` keys added to
  `AppShell.TAB_FOR_PATH`. `Home` + `moduleForPath` need no change.
- **Stub screens:** `BooksDashboard` / `BooksLibrary` / `BooksEntry` — navigable empty states (the real
  shelves, list/filters/sort, and the Entry form arrive in M2–M5). The Dashboard's settings gear is
  intentionally deferred to M6 (its route lands then), so M1 has no dead links. Exported from
  `screens/index`.
- Verified by `npm run typecheck` + manual click-through; the data-model section of `06-books.md` was
  merged into `03-data-model.md` and the PRD module list / nav / non-goals updated. No new pure helpers
  in M1, so the test count is unchanged (**137**).

### M2 — Data layer + pure logic + manual Entry/Edit + basic Library

Goal: a full **manual** CRUD loop (no Google Books yet) so the module is usable end-to-end.

- **Pure layer** `src/lib/books.ts` (+`books.test.ts`, +8 tests → **145**): the `status`/`lgbtq_rep`
  unions + label maps, the `BOOK_STATUS_CHIP` palette, `bookSearchText`, and the tested transitions
  `startReading`/`markRead`. Simpler than `shows.ts` — no type/episode/watched-count logic.
  `src/lib/books-refresh.ts` mirrors `shows-refresh`.
- **Data** `src/data/book.ts`: list/get/create/update + **hard** `deleteBook`. (`saveImportedBooks`
  lands in M7.)
- **Shared-UI refactors (DRY).** Two Shows-coupled components were generalized rather than duplicated:
  the 2:3 poster/cover tile was extracted into a presentational **`Thumb`** (`url` + `className`);
  `PosterThumb` now delegates to it (keeping its `path`/`size` TMDB API, so Shows call sites are
  unchanged) and a new **`CoverThumb`** wraps it for Books' full `cover_url`. **`StatusChip`** was made
  presentational (`label` + palette `className`); the three Shows call sites
  (`ShowsDashboard`/`ShowsLibrary`/`ImportShowsSheet`) now pass `SHOW_STATUS_LABELS`/`SHOW_STATUS_CHIP`,
  and Books passes its own — one chip, no duplicated visual.
- **Screens**: `BooksEntry` (full route `/books/entry` + `/books/:id`, not a sheet — outer loader +
  inner form keyed by id per F8, single `draft` object, `JSON.stringify` dirty gate, RESET +
  CREATE/SAVE; status→Reading defaults the start date, status→Read/Dropped defaults the finish date;
  dates via `Calendar`). The Google Books metadata fields are **carried through** as nulls (M3 wires the
  search that populates them). **Author(s) entered as one comma-separated string** in the form, split to
  `text[]` on save and rejoined on load — simplest manual input; the M3 search will set the array
  directly. `BooksLibrary` (search over `bookSearchText` + `SwipeRow` hard-delete with confirm, rows
  show cover/status/stars, tap → edit). `BooksDashboard` stays the M1 stub until M4.
- Verified by `npm run check` (all gates) + manual click-through (create → list → edit → delete; Shows
  chips/posters regression-checked after the refactor).

### M3 — Google Books + Open Library metadata

Goal: pull cover + metadata into the Entry form on demand (search → details on select); persisted only
on CREATE/SAVE.

- **Client** `src/lib/books-api.ts` (+`books-api.test.ts`, +18 tests → **163**): browser-direct, two
  APIs. `searchBooks` queries **Google Books** (`GET /volumes?q=`) and **falls back to Open Library**
  (`GET /search.json`) on an empty result set **or** an error; `getBookDetails(result)` fetches the
  Google volume or the Open Library work (the work JSON lacks authors/year/cover/isbn, so those are
  carried from the search hit and merged). Pure mappers are unit-tested (`pickPublishYear` across
  `YYYY`/`YYYY-MM`/`YYYY-MM-DD` + numeric, `httpsCover`, `pickIsbn` [ISBN_13 > ISBN_10], `capGenres`,
  `olCoverUrl`, the Google + OL search/detail mappers incl. OL's string-or-`{value}` description); the
  network calls aren't (matching `tmdb-api`/`food-api`/`fx`).
- **Optional key — the one divergence from `tmdb-api.ts`.** Google Books works keyless (lower quota),
  so `googleKeyParam()` appends `&key=` only when `VITE_GOOGLE_BOOKS_API_KEY` is set and **never
  throws** (unlike `tmdb-api.ts#apiKey()`). The var is typed optional (`?`) in `vite-env.d.ts`.
- **`cover_url` is a full image URL** (Google/OL return absolute URLs; Google thumbnails are normalized
  `http→https`) — no CDN base, unlike Shows' `poster_path`.
- **`BookSearchSheet`** (`src/components/BookSearchSheet.tsx`) is a **local** `fixed inset-0` overlay,
  not a route sheet (same lesson as Shows `TitleSearchSheet` — a route sheet remounts Entry and
  discards the draft). Reuses `SearchBar` + `CoverThumb`; returns the pick via `onSelect`.
- **`BooksEntry`**: a **Search Google Books** button opens the overlay; `selectBook` merges the fetched
  `BookMetadata` (authors array → the comma-joined string; year → string; cover/description/genres/
  page_count/language/isbn/ids) while keeping the user's Status/Rating/LGBT+/dates/comments; a read-only
  metadata block renders when populated. Title/Author/Year stay editable.
- **Config**: `VITE_GOOGLE_BOOKS_API_KEY` added to `vite-env.d.ts` + `.env.example`; OWNER-RUNBOOK gained
  an optional "Part C3 — Google Books key" + env/Vercel/smoke-test/credentials-table entries.

### M4 — Books Dashboard

Goal: replace the `BooksDashboard` stub with the real shelves + quick actions. Mostly assembly of
existing tested helpers + the M2 transitions; no schema/API change.

- **Selectors** (`src/lib/books.ts`, +5 tests → **168**): `currentlyReading`, `wantToRead(limit)`,
  `recentlyRead(limit)` (read + non-null `end_date`, newest first — imported NULL-date rows are excluded
  by design), and `countReadThisYear`. Direct parallels of the Shows selectors.
- **`BooksDashboard`**: sticky header (title + `+` New); `useAsync(listBooks)` keyed on
  `useBooksVersion`; shelves as `SectionCard`s shown only when non-empty (Currently Reading / Recently
  Read / Want to Read, per `06-books.md` order); a compact local `DashRow` (`CoverThumb` + two lines +
  optional trailing action). Quick actions reuse the pure transitions — **Mark Read** =
  `updateBook(id, markRead(todayLocal()))`, **Start Reading** = `updateBook(id,
startReading(todayLocal()))` — then `bumpBooks()`; an `updatingId` disables the button in-flight.
- **Parity addition**: an "N read this year" stat line (`countReadThisYear`), mirroring the Shows
  dashboard's "watched this year" — not in `06-books.md`, a re-skin nicety. **No type filter** (books
  are one kind) and **no settings gear** (that lands in M6).
- Verified by `npm run check` (all gates) + manual click-through (Mark Read / Start Reading move books
  between shelves with today's dates).

### M5 — Library filters + sort + cover thumbnails

Goal: the full Library — cover rows + a filter panel + a Sort menu, search over Title/Author.

- **Pure view** (`src/lib/books.ts`, +7 tests → **175**): `applyLibraryView(books, criteria)` filters
  (query via `bookSearchText`; Status/Genre/Rating-min/LGBT+/**Author**; start & finish date ranges)
  then sorts (`field × dir`, **nulls last** regardless of direction, stable title tiebreak; `date` key =
  `end_date ?? last_update_date ?? updated_at`). Plus `bookGenres`/`bookAuthors` (facet options from the
  user's own rows), `BOOK_STATUS_ORDER`, `LibraryCriteria` + `DEFAULT_LIBRARY_CRITERIA`. The only
  divergence from the Shows view: an **Author** filter + sort field where Shows has **Type** (books are
  one kind, so there's no Type `SegmentedTabs` either).
- **`BooksLibrary`** rewritten: sticky header (search + a **Filters** toggle with an active-count + a
  **Sort** `SelectMenu` + asc/desc button); a collapsible filter panel (the five `SelectMenu`s + two
  date ranges via the `Calendar` overlay + Clear filters); cover rows (`CoverThumb`) with
  title/year · author(s) · status·stars · genre·date. Rows come straight from `applyLibraryView`.
- **Decision**: filter/sort state is **local** (resets on leaving the tab); URL-persistence and the
  wide-screen sortable table are **parked** (`PARKED.md`). Rating filter is a **minimum**. Mirrors the
  Shows M5 decisions.
- Verified by `npm run check` (all gates) + manual filter/sort/search/swipe-delete click-through.

### M6 — Books Settings + Entry field-visibility

Goal: a Books Settings screen (the Wellness/Shows Settings split, mirrored) for Entry field-visibility +
an importer-enable toggle, both synced on `profile`.

- **Migration** `08_books_profile_settings.sql`: adds `profile.book_visible_fields text[]`
  (**nullable — NULL = all visible**, default-on, no seeding) + `book_importer_enabled boolean default
false`. Additive columns on an existing table → RLS/grants/`moddatetime` already cover them. Owner
  `db push` + `gen:types`.
- **Null-sentinel decision** (same as Shows): unlike `visible_nutrients` (defaults `'{}'` = none), Books
  field visibility defaults **on** — hiding-by-default is wrong for an entry form, and a NULL sentinel
  means new fields added later are visible without a data migration. `isFieldVisible(prefs, key)` =
  `prefs == null || prefs.includes(key)` (`src/lib/books.ts`, +2 tests → **177**).
- **Screens** (mirror `ShowsSettings`/`ShowsFieldsSheet`): `BooksSettings` (a **Visible Fields** row + an
  **Enable CSV import** `Toggle` on `book_importer_enabled`) and `BooksFieldsSheet` (route `Sheet` of
  per-field toggles over `BOOK_ENTRY_FIELDS`, auto-saving via `useProfileEditor`; initialised from
  `book_visible_fields ?? all keys`). A **gear** was added to the `BooksDashboard`/`BooksLibrary` headers
  (the spot left for it since M4/M5) → `/books/settings`; `/books/settings/visible` is the sheet.
- **Entry** reads the prefs via `useProfile` and wraps each hideable field in `isFieldVisible(...)`
  (Title/Status/Search always shown; the metadata block additionally gated on `'metadata'`). Hiding is
  display-only — `save()` still writes the draft's loaded values, so no data is lost and the dirty check
  is unaffected.
- **Importer toggle persists in M6**; its launcher + the Import sheet (the `/books/import` route) land in
  **M7** — for now Settings shows a hint instead of the launcher. Verified by `npm run check` + a
  click-through (toggle a field off → it disappears from Entry; the importer toggle persists).

### M7 — In-app CSV importer (Books feature-complete)

Goal: the bulk importer to seed the back-catalogue — per-row Google Books resolution +
idempotent commit. Launched from the M6 Settings toggle. No migration, no env.

- **`.gitignore` first** (F7): added `books-import*.csv` + `!templates/books-import-template.csv` before
  creating any CSV; only the sanitized `templates/books-import-template.csv` + guide are tracked.
- **Pure layer** `src/lib/books-import.ts` (+`.test.ts`, +10 tests → **187**): `parseBooksCsv` (shares
  `src/lib/csv.ts`; columns `title,author,rating,lgbtq_rep,end_date` — title+author required, rating
  0–5/0.5 optional, `lgbtq_rep` blank→none, `end_date` `YYYY-MM-DD` optional), `dedupKey(title, author)`,
  `buildImportRow(input, match)` — every row **Read**, `start_date`/`last_update_date` **NULL**,
  `end_date` from the file; a no-match row keeps the CSV title/author with null metadata.
- **Idempotent commit** `data/book.saveImportedBooks(userId, payloads)`: fetch existing `(id, title,
authors)` once → `dedupKey(title, authors[0])` map → update-or-insert (collapsing in-file dupes).
  **Dedup keys on the resolved (stored) title + first author**, so a CSV title that resolves to a
  different Google Books title still re-matches on re-run (both runs resolve identically) — the same
  decision Shows made.
- **`ImportBooksSheet`** (route `Sheet`, mirrors `ImportShowsSheet`): pick file → resolve every row
  against Google Books (`searchBooks` of `"title author"` top hit → `getBookDetails`) with a
  **concurrency pool (5)** + progress → preview (cover, matched title/year, no-match / review flags) →
  per-row **Change** reuses `BookSearchSheet` to re-pick → **Import** → `saveImportedBooks` + `bumpBooks`
  → done ("N — C new, U updated"). Launcher added to `BooksSettings` (shown when
  `book_importer_enabled`); route `/books/import` opens over `/books/settings`.
- **Books is now feature-complete (M1–M7).** The `06-books.md` staging doc was deleted (all sections
  merged into the permanent specs, incl. the `04-design-system` `Thumb`/`CoverThumb`/presentational
  `StatusChip` + `BookSearchSheet` notes), and CLAUDE.md / README mark Books built.
- **Post-launch — Google Books 429 resilience.** Live keyless search 429'd on rapid typing / the import
  pool, and the OL fallback then hit `ERR_CONNECTION_RESET` (OL is network-blocked from some regions).
  Fix: a distinct `BookSearchRateLimitError` (429) that **doesn't** fall back to OL; `AbortSignal`
  support so the search overlay (debounce 600 ms) **cancels** the in-flight request on the next
  keystroke; the importer pool dropped 5→3 with a per-row **429 backoff-retry**. The real fix for heavy
  use is the optional `VITE_GOOGLE_BOOKS_API_KEY` (raises quota). Network calls stay un-unit-tested per
  convention.
- **Post-launch — Books search result ranking** (`rankSearchResults`, `books-api.ts`, +3 tests →
  **190**): the **interactive** overlay re-ranks the fetched hits — titles that **start with** the typed
  query first, then titles that **contain** it, then the rest; within a tier, **year descending**
  (undated last), stable on the upstream Google-relevance order. The importer keeps the raw top hit (its
  query is `"title author"`, so prefix ranking doesn't apply).

## Quotes Build Sequence (per milestone)

- The **Quotes module** (favourite quotes from TV/film/books/podcasts/articles/videos/songs, English or Chinese) is specced in `docs/07-quotes.md` (a staging doc whose sections merge into the permanent specs as each milestone lands, then it is deleted — same lifecycle as `06_shows.md`/`06-books.md`). It drops into the multi-module architecture with no structural change.
- Structurally it is **Books/Shows re-skinned** with three genuinely new pieces landing in later milestones: a cross-module **Show/Book linker** (local search — there is **no external metadata API**; "Discover Quotes" external fetch is out of scope), a **tags input + tag facet**, and the **Moment-of-Zen** randomiser.
- **Owner decisions** carried as built:
  - (1) Show-link auto-fill leaves **Author empty** (the seed uses the speaker/character as `author`); a Book link still fills Author from `book.authors`.
  - (2) Zen refresh is a **shuffle button + pull-to-refresh** (works on non-touch iPad/desktop).
  - (3) the importer's optional Title→link is **scoped by source type** (tv/movie→Show, book→Book; others→no link).
- **CSV parsing — Papa Parse is NOT used; the in-house `src/lib/csv.ts` is** (the same decision Books made). The spec docs say "Papa Parse", but `papaparse` is not a dependency: `parseCsv` already handles quoted fields, embedded commas, `""` escapes, **multi-line quoted cells**, and the Excel BOM.
- **Verified** against the real `templates/quotes-seed-local.csv`, which **does** contain an RFC-4180 multi-line quoted cell (the Schitt's Creek "Moira/Roland" row spans two physical lines) plus `""` escapes and quoted comma-bearing Tags — so a naïve split is wrong, but `csv.ts` parses it correctly.

### M1 — Schema + module registration + scaffold screens

Goal: a runnable, navigable Quotes module behind a hub card, before any data layer.

- **`.gitignore` first** (F7): the owner's `templates/quotes-seed-local.csv` was present, **untracked,
  and not yet ignored** (a `git add .` would have committed private data). Added the Quotes block
  (`quotes-import*.csv` + `quotes-seed-local.csv` + `!templates/quotes-import-template.csv`) **before**
  any staging; verified `git check-ignore` now reports the seed file ignored.
- **Schema:** `09_quotes_schema.sql` — one `quote` table (own `user_id` for direct RLS like
  `book`; CHECKs on `source_type`/`category`/`language`; generated `text_norm = lower(btrim(text))` STORED
  backing `UNIQUE(user_id, text_norm)` for "no exact duplicates" + import idempotency; indexes
  `(user_id, category)` + `(user_id, is_favorite)`; FKs `show_id`/`book_id` → show/book **ON DELETE SET
  NULL** (author/title/source_type are denormalised so a quote survives a linked record's deletion);
  4 owner policies; `moddatetime`; explicit grants). `quote` is not a SQL reserved word — no quoting
  needed (unlike Shows' `"cast"`). Owner reviews + `supabase db push`, then `npm run gen:types`.
- **Module registration (drop-in):** `quotes` namespace in `constants/routes.ts`; a Quotes `ModuleDef`
  in `constants/modules.ts` (tabs **Zen** + **Library**; `IconQuote`; Zen tab `IconSparkles`); flat
  routes `/quotes`, `/quotes/library`, `/quotes/entry`, `/quotes/:id` in `router.tsx`; `/quotes*` keys
  in `AppShell.TAB_FOR_PATH`. `Home` + `moduleForPath` need no change.
- **Constants:** `src/constants/quotes.ts` — `QUOTE_CATEGORIES`/`QUOTE_SOURCE_TYPES`/`QUOTE_LANGUAGES`
  - label maps (the source of truth for the CHECK columns the generated types surface as `string`). The
    runtime helpers (`detectLanguage`, chip palette, selectors) land in M2's `src/lib/quotes.ts`.
- **Stub screens:** `QuotesZen` / `QuotesLibrary` / `QuotesEntry` — navigable empty states (the random
  card, list/filters, and the Entry form arrive in M2–M5). Exported from `screens/index`.
- Verified by `npm run typecheck` + `npm run lint`; the §00-PRD (module list/nav/goals/non-goals) and
  §03-data-model (`quote` table + relationships) sections of `07-quotes.md` were merged into the
  permanent specs. No new pure helpers in M1, so the test count is unchanged (**190**).

### M2 — Data layer + pure logic + manual Entry/Edit + basic Library

Goal: a full **manual** CRUD loop (no cross-module linker yet) so the module is usable end-to-end —
mirrors the Books M2 build.

- **Pure layer** `src/lib/quotes.ts` (+`quotes.test.ts`, +7 tests → **197**): `QuoteRow`/`Insert`/
  `Update` aliases; `detectLanguage(text)` (any CJK char ⇒ `zh`, else `en`); `quoteSearchText` (text +
  author + title + tags, lowercased) backing the Library search; `QUOTE_CATEGORY_CHIP` — a **single**
  neutral chip class used via the presentational `StatusChip`. Per-category colours are optional in the
  spec and there are only ~4 semantic colour tokens, so they're **deferred** (revisit when the Zen badge
  is prominent). The enums/labels stay in `constants/quotes.ts` (not redefined here).
  `src/lib/quotes-refresh.ts` mirrors `books-refresh` (`bumpQuotes`/`useQuotesVersion`).
- **Data** `src/data/quote.ts`: list/get/create/update + **hard** `deleteQuote`, plus
  `listDistinctTags(userId)` (selects the `tags` column, flatten + dedupe + sort client-side — quotes
  are small; no RPC) for the Entry tag autocomplete + M5 facet. `saveImportedQuotes` lands in M7.
- **New shared component** `src/components/TagInput.tsx`: free-form tag editor — committed tags as
  removable chips; commits on **Enter or comma**; **Backspace on empty** removes the last; a filtered
  suggestion dropdown commits on click (keeps focus via `onMouseDown` preventDefault so the click beats
  blur). Case-insensitive dedupe, trims, drops empties. Built from existing tokens — no new visual.
- **Screens**: `QuotesEntry` (full route `/quotes/entry` + `/quotes/:id`, not a sheet — outer loader +
  inner form keyed by id per F8, single `draft`, `JSON.stringify` dirty gate, RESET + CREATE/SAVE).
  Fields: Quote Text (textarea, required), a header favourite **heart** (`FoodDetailSheet` pattern),
  Author, Source Type (`SelectMenu`/7), Title, **Category** (`SelectMenu` with a `'Select category…'`
  placeholder, required), **Tags** (`TagInput`, suggestions from `listDistinctTags`), Language
  (`SegmentedTabs`). **Language auto-detects from the text but is editable** — a `languageTouched` flag
  stops retyping from overwriting a user/edit choice (edit-mode loads touched). A new quote prefills from
  `?text=&author=&title=` (copy-paste / Apple Books Shortcut) and a **Paste from clipboard** button
  (`navigator.clipboard.readText`, feature-detected). `save()` **catches the `UNIQUE(user_id,
text_norm)` violation (Postgres `23505`)** → inline "You already have this quote." (the manual-entry
  counterpart to the importer's `ON CONFLICT DO NOTHING`); never sends the generated `text_norm`.
  `QuotesLibrary` (search over `quoteSearchText` + `SwipeRow` hard-delete with confirm; rows show a
  2-line snippet, the category `StatusChip`, and the author; tap → edit). The cross-module linker,
  field-visibility, and Dashboard/Library selectors are **deferred** (M3 / M6 / M4–M5).
- Verified by `npm run check` (all gates, **197** tests) + manual click-through (create with required
  text+category → Library → search → edit → swipe-delete; `?text=…` deep-link prefill; duplicate-text
  save shows the inline message).

### M3 — Cross-module Show/Book linker

Goal: let the Entry form link a quote to one of the user's existing **Show** or **Book** records,
binding `show_id`/`book_id` and denormalising title/source_type (+author for books) onto the quote.
**No external API** — pure search over the user's own rows.

- **Pure layer** `src/lib/quotes.ts` (+`quotes.test.ts`, +4 tests → **201**): a `LinkCandidate` model
  (`kind`/`id`/`title`/`year`/`thumbUrl`/`sourceType`/`authors`) + `linkSearchText` + pure
  `filterLinkCandidates(candidates, query)` (title/author substring; empty ⇒ all). The screen maps
  `ShowRow`/`BookRow` → `LinkCandidate` so `quotes.ts` stays **decoupled** from `shows.ts`/`books.ts`.
- **`QuoteSourceLinkSheet`** (`src/components/QuoteSourceLinkSheet.tsx`) — a **local** `fixed inset-0`
  overlay (NOT a route `Sheet`: that remounts Entry and discards the draft — the same lesson as Shows
  `TitleSearchSheet` / Books `BookSearchSheet`). One `useAsync` does
  `Promise.all([listShows, listBooks])` and maps to candidates (show thumb via `posterUrl(poster_path,
'w92')`, book thumb via `cover_url`); a `SearchBar` + `filterLinkCandidates` drive a combined list
  (shared `Thumb` + title/year + a `TV`/`Movie`/`Book` `StatusChip` + book authors). **No debounce/abort**
  — the data is already local. Returns the pick via `onSelect`.
- **`QuotesEntry`**: a **Source link** block above Source Type — `Link a Show or Book` opens the overlay;
  when linked, a row shows `{title} · {source-type}` + an **Unlink**. `selectLink` binds the FK +
  denormalises: a **show** fills Title + Source Type (Author **untouched** — owner decision: the speaker
  is the author); a **book** also fills Author from its authors. `unlink` clears only the FKs (keeps the
  denormalised values, still editable). `show_id`/`book_id` were already in `QuoteDraft` since M2, so the
  dirty gate + `save()` persist them — **no data-layer change**. The `ON DELETE SET NULL` FK means a
  later hard-delete of the linked Show/Book just nulls the column; the quote keeps its title/author.
- **Title-as-link navigation** (tap a quote's title → the Show/Book detail) lands in **M4 (Zen)**, where
  the card actually renders the title — the M2 Library row doesn't show it, and nesting a link inside the
  row's tap-to-edit button is bad UX.
- Verified by `npm run check` (all gates, **201** tests) + manual click-through (link a Show → Author
  stays as typed; link a Book → Author fills; Unlink keeps values; SAVE persists the FK).

### M4 — Moment of Zen dashboard

Goal: replace the `QuotesZen` stub with the real single-random-quote experience — favourites first,
broadening to the whole pool on refresh with no immediate repeat. Pure assembly of tested helpers + the
M3 link FKs; no schema/data-layer change (reuses `listQuotes`/`updateQuote`/`useQuotesVersion`).

- **Pure selection** (`src/lib/quotes.ts`, +6 tests → **209**): `initialZenPool` (favourites if any,
  else all), `nextZenPool(quotes, currentId)` (all minus current; degrades to all for a single quote /
  null current — the "no immediate repeat" rule), `randomItem(items, random = Math.random)` (random
  **injected** so the rules are deterministic in tests).
- **`QuotesZen`** (`flex h-full flex-col`): `useAsync(listQuotes)` keyed on `useQuotesVersion`; a
  `currentId` effect picks the initial quote **and keeps the current one across refetches** (so a
  favourite toggle doesn't jump the card). A **Shuffle** button (`IconArrowsShuffle`) draws from
  `nextZenPool`. **Pull-to-refresh** is a hand-rolled Pointer-Events gesture (mirroring `SwipeRow`) on
  the inner `overflow-y-auto` scroller — engages only at `scrollTop===0` dragging **down**, damps the
  offset, shows a "Pull / release to shuffle" hint, and shuffles past the threshold on release; kept
  **inline** (no other consumer). The card centres the quote `text` (`text-2xl`, `whitespace-pre-line`
  - `break-words` so the multi-line Schitt's Creek quote and **CJK** render correctly), a metadata
    cluster **Author · {source-type} · Title** where the **Title is a `Link`** to `/shows/:id` /
    `/books/:id` when `show_id`/`book_id` is set (the deferred M3 title-nav), the category `StatusChip`,
    tag chips, and a favourite **heart** that flips **instantly** via an optimistic
    `Record<id, boolean>` override before `updateQuote` + `bumpQuotes` persist/reconcile (reverts on
    error). Loading / error / empty (→ Add a quote) states.
- **Lint note:** `const all = quotes ?? []` feeding a `useCallback` dep tripped `exhaustive-deps`
  (a fresh `[]` each render) — wrapped in `useMemo(() => quotes ?? [], [quotes])` so the `shuffle`
  callback's deps stay stable.
- Verified by `npm run check` (all gates, **209** tests).

### M5 — Library filters + facets

Goal: the full Library — real-time search + a collapsible faceted filter panel + the "Quotes from this
title" constraint, replacing the M2 basic list. Mirrors the Books M5 build, adapted to the Quotes
facets. No schema/data-layer change.

- **Pure view** (`src/lib/quotes.ts`, +8 tests → **217**): `LibraryCriteria` + `DEFAULT_LIBRARY_CRITERIA`,
  `quoteTags(quotes)` (sorted distinct tags — the facet options, derived from loaded rows), and
  `applyLibraryView(quotes, c)` — **filter only**, preserving input order (`updated_at desc`; the spec
  has no sort menu): query over `quoteSearchText`, Category, **Tags = OR/any**
  (`c.tags.some(t => quote.tags.includes(t))` — owner decision: the seed tags cluster per-quote, so AND
  would yield near-zero), Favourites-only, Source type, Language, and the URL `showId`/`bookId`
  constraint.
- **`QuotesLibrary`** rewritten: sticky header (search + a **Filters** toggle with an active-count);
  the **`?show=`/`?book=` constraint** is read from `useSearchParams` and layered at view time
  (`applyLibraryView(all, { ...criteria, showId, bookId })`), so the panel state stays **purely local**
  (Books M5 decision — filters reset on leaving the tab; URL-persistence parked). A **"Quotes from this
  title" banner** (derives the title from the first matching quote) with a clear-X → plain Library. The
  collapsible panel reuses `SelectMenu` (Category / Source type / Language), `Toggle` (Favourites only),
  and **toggle-chips** for Tags (selected = `bg-accent`), plus Clear filters. Rows unchanged from M2.
- **Launch link (cross-module, owner-approved):** `ShowsEntry` + `BooksEntry` gained a **"Quotes from
  this title"** `Link` (edit mode only) → `` `${routes.quotes.library}?show=${id}` `` / `?book=${id}`.
  Display-only — no save/dirty impact. (The app has no separate read-only detail; the Entry screen _is_
  the record's detail, which the Zen title-link already targets.)
- Verified by `npm run check` (all gates, **217** tests).

### M6 — Quotes Settings + Entry field-visibility

Goal: a Quotes Settings screen (the Wellness/Shows/Books Settings split, mirrored) for Entry
field-visibility + an importer-enable toggle, both synced on `profile`.

- **Migration** `10_quotes_profile_settings.sql`: adds `profile.quote_visible_fields text[]`
  (**nullable — NULL = all visible**, default-on, no seeding) + `quote_importer_enabled boolean default
false`. Additive columns on an existing table → RLS/grants/`moddatetime` already cover them. Owner
  `db push` + `gen:types`.
- **Null-sentinel decision** (same as Shows/Books): unlike `visible_nutrients` (defaults `'{}'` = none),
  Quotes field visibility defaults **on** — hiding-by-default is wrong for an entry form, and a NULL
  sentinel means new fields added later are visible without a data migration. `isFieldVisible(prefs,
key)` = `prefs == null || prefs.includes(key)` (`src/lib/quotes.ts`, +2 tests → **219**).
- **Screens** (mirror `BooksSettings`/`BooksFieldsSheet`): `QuotesSettings` (a **Visible Fields** row +
  an **Enable CSV import** `Toggle` on `quote_importer_enabled`) and `QuotesFieldsSheet` (route `Sheet`
  of per-field toggles over `QUOTE_ENTRY_FIELDS` — `author`/`source_link`/`source_type`/`title`/`tags`/
  `language`; **Quote Text + Category are always shown**), auto-saving via `useProfileEditor`;
  initialised from `quote_visible_fields ?? all keys`. A **gear** was added to the `QuotesZen`/
  `QuotesLibrary` headers → `/quotes/settings`; `/quotes/settings/visible` is the sheet.
- **Importer toggle persists in M6**; its launcher + the `/quotes/import` route land in **M7** — Settings
  shows a hint instead of a launcher (no dead route).
- **Entry** reads the prefs via `useProfile` and wraps each hideable field in `isFieldVisible(...)`.
  Hiding is display-only — `save()` still writes the draft's loaded values (a hidden Source Type still
  saves its default `tv`), so no data is lost and the dirty check is unaffected.
- Verified by `npm run check` (all gates, **219** tests).

### M7 — In-app CSV importer (Quotes feature-complete)

Goal: the bulk importer to seed the back-catalogue — idempotent (no exact duplicates), with an optional
Title→Show/Book link by source type. **Simpler than Books/Shows M7 — no external API**, so no
concurrency pool / per-row "Change"; links resolve against the user's own `show`/`book` rows. No
migration, no env.

- **`.gitignore` already covered it** (added in M1): `quotes-import*.csv` + `quotes-seed-local.csv` +
  `!templates/quotes-import-template.csv` — only the sanitized template + guide are tracked (re-verified
  before adding any CSV, F7).
- **Pure layer** `src/lib/quotes-import.ts` (+`.test.ts`, +12 tests → **231**): `parseQuotesCsv` (shares
  `src/lib/csv.ts`; columns `Quote,Author,Source,Title,Category,Tags`; Category validated against the
  six / Source against the seven, blank/invalid → flagged with line numbers; **Tags = read the whole
  quoted cell, then split on `,`** — the two-comma-meanings step; Language auto-detected;
  `text_norm = lower(trim(text))` via `normalizeQuoteText`), `partitionNewRows` (existing + in-file
  dedup so the DB batch has no in-file conflicts), and `buildTitleIndex`/`resolveLink`/`buildImportPayload`
  (optional Title→Show/Book link **by source type** — tv/movie→Show, book→Book, others→none).
- **Idempotent commit** `data/quote.saveImportedQuotes(userId, payloads)`:
  `upsert(rows, { onConflict: 'user_id,text_norm', ignoreDuplicates: true }).select('id')` — the spec's
  `ON CONFLICT DO NOTHING` (the unique index on the generated `text_norm` is the arbiter; conflict targets
  on a generated column are valid — the insert just omits it). `.select()` returns only the truly-inserted
  rows, so its length is the imported count. Re-running the same file inserts **nothing**.
- **`ImportQuotesSheet`** (route `Sheet`, mirrors `ImportBooksSheet` **without** the resolver pool): on
  mount loads the dedup set (existing quotes' normalised text) + the local Show/Book title index; pick
  `.csv` → `parseCsv` → `parseQuotesCsv` → `partitionNewRows` → `buildImportPayload` → preview
  (**new / duplicate-skipped / flagged** counts + a sample of new rows [snippet + category + a "linked"
  marker] + the flagged list) → Import → `saveImportedQuotes` + `bumpQuotes`. Launcher added to
  `QuotesSettings` (shown when `quote_importer_enabled`); route `/quotes/import` over `/quotes/settings`.
- **Templates** `templates/quotes-import-template.csv` (sanitized — exercises a quoted embedded comma,
  an escaped `""`, a CJK/`zh` row, a multi-line quoted cell, and quoted Tags) + `quotes-import-guide.md`.
- **Docs finalised:** the remaining `07-quotes.md` sections were merged into the permanent specs
  (§01-screens, §02-tech-spec, §04-design-system; §05-seed-data had nothing to add) and `07-quotes.md`
  **deleted**; CLAUDE.md / README mark Quotes built; OWNER-RUNBOOK gained the optional Apple Books
  `?text=` Shortcut note.
- **Quotes is now feature-complete (M1–M7).** Verified by `npm run check` (all gates, **231** tests).

## Medical Build Sequence (per milestone)

- **Feature-complete (M1–M7).** The staging spec (`docs/medical.md`) was merged into the permanent `/docs` (00-PRD … 05-seed-data) and **deleted** (like the former `06-books.md`/`07-quotes.md`), and the session handoff `CONTINUITY.md` was removed.
- Milestones: 1 schema+seed+scaffold · 2 manual report CRUD + detail · 3 structured import + tolerant repair + review-confirm · 4 dashboard trends + tracked-test selection · 5 drag-to-reorder settings · 6 biometric lock · 7 narrative + eye refraction.

### M1 — Schema + RLS + seed + module scaffold

Goal: the three tables, the seeded reference list, and a navigable module behind the Home hub.

- **Migrations:** `11_medical_schema.sql` (three tables — `medical_lab_test` reference
  [read-only to clients: single permissive SELECT policy + `grant select` only],
  `medical_report`, `medical_result` — RLS + 4 owner policies each on the user-owned tables, 18-value
  `category` CHECK, `moddatetime`, grants; `medical_result` cascades on report delete and carries the
  unit-normalization columns `normalized`/`value_num_original`/`unit_original`);
  `13_medical_profile_settings.sql` (nine `medical_*` profile columns incl. the lock +
  `medical_lock_timeout_minutes`); `12_medical_seed_lab_test.sql` (~150 tests, idempotent
  `ON CONFLICT (key) DO UPDATE`).
- **Source of truth + drift guard:** the seed mirrors `src/lib/medical.ts` `MEDICAL_LAB_TESTS`;
  `src/lib/medical.test.ts` reads the seed `.sql` via a `?raw` import (declared by `vite/client`, so no
  node fs types are needed under `tsconfig.app.json`) and asserts the SQL keys exactly equal the TS
  list — catching any hand-edit drift between the two.
- **Seed scope:** built from the owner's **2021–2026** reports across **three providers** (MediFast HK,
  Mobile Medical HK, Global HealthCare Shanghai). `default_unit` is the **canonical unit** the M3
  importer will normalize to; a few canonicalization calls are recorded in `05-seed-data.md` (BP split
  into two keys; thyroid `t4_total` vs `free_t4`/`free_t3`; H. pylori serology vs C-13 breath test;
  cardiac/iron markers + radiation rows → `other`; ECG intervals → `imaging`).
- **Scaffold:** `routes.medical` + a `ModuleDef` (Home card + bottom nav: Dashboard / Reports / New
  Medical / Settings, derived automatically) + flat routes in `router.tsx` → stub screens
  (`MedicalDashboard`/`MedicalReports`/`MedicalEntry`/`MedicalSettings`). `src/lib/medical.ts` holds the
  enums (categories, report types, flags, value kinds) + the seed list; the typed `Tables<'medical_*'>`
  Row/Insert/Update aliases + `src/data/medical.ts` land in **M2**, after the owner applies the
  migrations and regenerates `database.ts` (`gen:types` is `--linked`, so it can't run until the schema
  is pushed).
- **Privacy:** the owner's real extractions (`templates/medical-import-20*.json`) and report PDFs are
  **gitignored** (`medical-import-20*.json`, `templates/*.pdf`); only the prompt, the JSON schema, and a
  sanitized `medical-import-template.json` are tracked.
- Verified by `npm run check` (all gates, **266** tests). Owner step before M2: apply the three
  migrations (`supabase db reset --linked` or `db push`) then `npm run gen:types`.

### M2 — Manual report CRUD + Report detail

Goal: Medical usable by hand — create/edit a report (parent + many result rows), list reports, a
read-only Report detail, delete (cascades results). No import/trends/lock yet.

- **Data layer** `src/data/medical.ts`: `listReports`, `getReportWithResults`, `createReport`/
  `updateReport`/`deleteReport`, and the idempotent **`saveReportResults`** (delete-then-insert of a
  report's `medical_result` rows — mirrors `asset-entry.saveSnapshotEntries`; non-transactional, the
  accepted solo-app trade-off) wrapped by **`saveReport`** (parent then children). Types alias off
  `database.ts` in `src/lib/medical.ts` (the data layer imports them, like `data/show.ts` ←
  `lib/shows.ts`). Refresh tick `src/lib/medical-refresh.ts` (`bumpMedical`/`useMedicalVersion`).
- **Pure helpers** in `src/lib/medical.ts`: `labTestByKey`, `medicalTestsByCategory`,
  `orderResultsForDisplay` (category section order → seeded `sort_order`; ad-hoc/unknown last; honours
  the M5 override params), `MEDICAL_REPORT_FIELDS` + `isMedicalFieldVisible`, `formatResultValue`/
  `formatRefRange`. The static `MEDICAL_LAB_TESTS` is the runtime reference (no DB fetch for the
  picker/ordering). New `formatFullDate` in `src/lib/date.ts` (reports span years).
- **Screens:** `MedicalReports` (swipe-delete list) → new `MedicalReportDetail` (results grouped by
  category in seeded order, flag-coloured values, Open-original links, narrative, Edit) and
  `MedicalEntry` (NetWorthEntry-style parent+children draft, RESET/CREATE/SAVE) + a new local-overlay
  `MedicalTestPickerSheet` (search the seed grouped by category + Add custom test — modelled on
  `TitleSearchSheet` so the draft survives).
- **Routing split** detail vs edit: `/medical/:id` → detail, `/medical/:id/edit` + `/medical/entry` →
  form (the M1 scaffold had `/medical/:id` pointing at the form).
- **Decision:** manual entry stores values **as-entered** (`normalized=false`); ref ranges via a single
  "as printed" `ref_text` field (the numeric `ref_low`/`ref_high` are populated by the M3 importer's
  unit normalization, and are carried through unchanged on a manual edit).
- Verified by `npm run check` (all gates, **275** tests).

### M3 — Structured import (JSON/CSV) + review-confirm

Goal: import a report from a JSON (primary) or CSV file produced outside the app, with tolerant repair,
fuzzy test matching, unit normalization, and a mandatory review.

- **`src/lib/medical-units.ts`** — `normalizeResult` converts a value (+ numeric ref) to the test's
  canonical `default_unit`: a scale table (g/L→g/dL ÷10 for Hgb/MCHC, µmol/L→mmol/L ÷1000 for uric acid)
  - label-only folds (`µmol/L`≡`umol/L`, `international unit/L`≡`U/L`, `K/mcl`≡`K/uL`, `M/mcl`≡`M/uL`,
    `ng/mL`≡`µg/L`, `kU/L`≡`U/mL`); flags `normalized`, keeps `value_num_original`/`unit_original`; rounds
    to 6 dp; **unknown unit pair or no test_key → left as-is** (never guesses).
- **`src/lib/medical-import.ts`** — `repairMedicalJson` (strip a stray quote after a number, e.g.
  `8.6"`; plus a fallback comma-insert), `parseMedicalJson`/`parseMedicalCsv` (RFC-4180 via `csv.ts`) →
  a `ParsedReport` with enum validation (safe fallbacks), `matchTestKey` (alnum index over
  `MEDICAL_LAB_TESTS` + curated global/category alias maps; **CJK stripped**, `%`→pct/`#`→abs so the
  differential survives; category-first to disambiguate urine/stool "Albumin"/"RBC"…), and unit
  normalization wired in. `parseMedicalFile` dispatches by extension/content; specific line/column error
  on unparseable JSON.
- **Shared editor (DRY):** `src/lib/medical-draft.ts` (ReportDraft/ResultDraft + blank/from-report/
  **from-parsed** mappers + `draftToSaveInput`) and `src/components/MedicalResultCard.tsx` were extracted
  from `MedicalEntry` so the **import review reuses the exact same row editor**; `MedicalEntry` refactored
  onto them.
- **`src/screens/ImportMedicalSheet.tsx`** (route `Sheet`) — file → tolerant parse (+ specific error) →
  editable header + **document_urls paste** + **counts per category** (anti-omission) + the result list
  (edit/add/remove via the picker) → idempotent save. Data: `findReportByDateType` + `saveImportedReport`
  (reuses `saveReport`, replacing a same-date+type report) in `src/data/medical.ts`.
- **Settings:** `MedicalSettings` gained the **Visible Fields** sheet (`MedicalFieldsSheet`, over
  `MEDICAL_REPORT_FIELDS`) + the **importer toggle** (`medical_importer_enabled`) gating the Import
  launcher; the New-Report form shows an Import button when enabled. Routes `/medical/import`,
  `/medical/settings/visible`.
- Verified by `npm run check` (all gates, **295** tests).

### M4 — Dashboard trends + tracked-test selection

Goal: turn the stub Dashboard into trend sparklines for the tracked tests, latest values per test by
category, and a recent-reports timeline; plus a Tracked Tests picker in Settings.

- **Data/presentation split (the design constraint):** the data side is a single hook
  `src/hooks/useMedicalTrends.ts` over pure helpers in **`src/lib/medical-trends.ts`**
  (`buildTrendSeries` — date-sorted numeric points per test; `latestResultPerTest` — most-recent row per
  test across all reports, ad-hoc keyed by name; `latestByCategory` — grouped under category headers via
  `orderResultsForDisplay`; `trackedSeries` — tracked tests that have data, in canonical section order;
  `asFlag`/`latestPoint`). Presentation consumes **only** the hook, so an alternate layout (e.g.
  one-chart-with-selector behind a Settings toggle, **deferred** — see `PARKED.md`) is a new component
  over the same data, no refetch.
- **One fetch:** `src/data/medical.ts` `listResultsWithReportMeta` — every `medical_result` flattened
  with its report's `report_date`/`report_type` via one embedded select (parent→children, mirrors
  `asset-entry.listSnapshotsWithEntries`). The hook also loads `listReports` (for the timeline, incl.
  narrative reports with no results). Derive client-side — **no** per-test query (avoids N+1 on a hot path).
- **Sparklines, not 20 charts:** the grid draws cheap **inline-SVG** `src/components/Sparkline.tsx`
  (generic, no dependency) so the full tracked set renders smoothly; **recharts mounts only** in the
  expanded single-test view — `src/components/MedicalTrendChart.tsx`, lazy-loaded into its own chunk
  (same pattern as `NetWorthTrendChart`), with flag-coloured dots + an optional reference band from the
  latest printed range. Tapping a sparkline opens a bottom-sheet **local overlay** (dismiss via
  `useEscapeKey`) with a time-window selector (`src/constants/medical-ranges.ts`, 1Y–5Y/All).
  `recharts` now powers both the Net Worth and Medical dashboards.
- **Latest values = latest per test** (not the single newest report) so a heterogeneous history (an eye
  exam or MRI won't carry blood-panel rows) still surfaces the freshest reading for everything.
- **Settings + seed:** new `MedicalTrackedTestsSheet` (route `/medical/settings/tracked`, mirrors
  `VisibleNutrientsSheet`) writes `profile.medical_tracked_tests`; `MedicalSettings` gained a Dashboard →
  Tracked Tests row. The M2/M3-deferred **first-run seed** now lands: `ensureOwnerProfile`
  (`src/data/profile.ts`) seeds `medical_tracked_tests` from `defaultTrackedTestKeys()` (like
  `visible_nutrients`). **No migration / owner step** — every column already existed.
- Verified by `npm run check` (all gates, **307** tests).

### M5 — Drag-to-reorder display order (sections + tests)

Goal: let the owner reorder the category **sections** and the **tests within a section**, saved as
personal overrides and honoured everywhere results render. **No migration** — `medical_section_order` /
`medical_test_order` already existed.

- **In-house pointer-drag, no dnd dep:** new reusable `src/components/ReorderList.tsx` — drag the
  **handle** (Pointer Events; `touch-action:none` on the handle only, so a row body still scrolls the
  page) to move a row; the rows it passes shift to open a gap, commit on release. Assumes **uniform row
  height** (rows truncate to one line), so the target slot is `round(dragΔ / rowHeight)` — simple and
  robust. Consistent with `SwipeRow`'s in-house pointer approach.
- **Pure model helpers** `src/lib/medical-order.ts` (`effectiveSectionOrder` /
  `effectiveTestOrderForCategory` / `buildOrderModel` / `flattenTestOrder`) — **partial-tolerant**:
  every current category/test appears exactly once (override entries first, then anything missing in
  canonical order), so a stale or incomplete override never drops or duplicates a row. Unit-tested.
- **Screen** `MedicalOrderSheet` (route `/medical/settings/order`, **Settings → Display → Display
  Order**): a **Sections** reorder list + a **Tests in section** reorder list gated by a category
  `SelectMenu` (so it renders one section's tests at a time, not all ~150 rows). Auto-saves on each drop
  (`medical_section_order` always re-flattens `medical_test_order` so the stored flat array stays grouped
  by the new section order).
- **Consumers honour the overrides:** `MedicalReportDetail` now passes `profile.medical_section_order` /
  `medical_test_order` into `orderResultsForDisplay`; the Dashboard's `latestByCategory` already did, and
  `trackedSeries` (the sparkline grid) gained the same optional override params so all three surfaces
  order identically. `orderResultsForDisplay` stays the read-path tolerance (unknown cats/tests last).
- Verified by `npm run check` (all gates, **313** tests).

### M6 — Biometric / PIN lock

Goal: gate the Medical module behind a **mandatory PIN** + an **optional** platform-authenticator
unlock, re-locking on cold start + an adjustable idle timeout. **No migration** — the `medical_lock_*`
columns already existed. Honest constraint (in the spec): a PWA has no background-lock lifecycle and
there's no relying-party backend, so this is a **client-side UX gate over already-RLS-protected data**,
not a cryptographic boundary.

- **PIN (dependable primary)** `src/lib/medical-lock.ts` (pure, unit-tested): `hashPin`/`verifyPin` —
  salted **PBKDF2-SHA-256** (100k iters), stored as `pbkdf2$<iters>$<salt>$<hash>`, never the PIN;
  `isValidPin` (4–8 digits); the timeout options + `isIdleExpired`; and the session/persistent lock
  flags. `crypto.subtle` works in Node's webcrypto, so the hashing is genuinely tested.
- **Biometric (optional, layered)** `src/lib/medical-webauthn.ts`: feature-detect
  (`isUserVerifyingPlatformAuthenticatorAvailable`), `registerPlatformCredential` (platform,
  `userVerification:'required'`, id stored in `medical_lock_webauthn_id`), `assertPlatformCredential`
  (a **local** UV check — the assertion is never server-verified). Every failure is swallowed → silent
  PIN fallback, so biometric can never cause a lockout.
- **Lifecycle** `src/components/MedicalLockProvider.tsx` (`useMedicalLock`): re-locks on **cold start**
  (sessionStorage cleared), and per `medical_lock_timeout_minutes` on **idle** (finite minutes, time
  since last Medical interaction), on **background/leave** (Immediately = 0), or never (Indefinite =
  null). A persistent `enabledHint` (localStorage) lets the gate engage synchronously before the
  profile loads, so locked content never flashes.
- **Gate + UI:** `MedicalLockScreen` (PIN + auto-tried biometric + a "Sign out" escape) is rendered by
  `AppShell` whenever `useMedicalLock()` reports `locked && inMedical` (covers tabs **and** sheets,
  since `moduleForPath` of a `/medical/*` sheet is still Medical); shared `PinInput`. Config in
  `MedicalLockSheet` (`/medical/settings/lock`, **Settings → Security → Lock**): set / change / turn
  off the PIN (each gated by the current PIN), the biometric toggle (hidden where unsupported), and the
  auto-lock timeout.
- Verified by `npm run check` (all gates, **321** tests). Manual: enable → cold-reload `/medical` →
  PIN gate → unlock; toggle biometric (prompts the platform authenticator). Note WebAuthn needs HTTPS
  (localhost exempt) and is unreliable in an installed iOS PWA — the PIN is the guaranteed path.

### M7 — Eye refraction form (module feature-complete)

Goal: the final milestone — a structured **eye-refraction** input on the Add/Edit form. (Narrative
already rendered on the form + detail since M2.) **No migration** — the six keys were seeded in M1.

- The six refraction keys (`sphere_od`/`cylinder_od`/`addition_od` + `…_os`) are ordinary `eye`-category
  **numeric** `medical_result` rows (so they already store + trend like any measurement); M7 just gives
  them a dedicated grid instead of the generic test picker. Pure layout constants
  (`EYE_REFRACTION_ROWS`/`EYE_REFRACTION_COLUMNS`/`EYE_REFRACTION_KEYS`) live in `src/lib/medical.ts`
  with a drift-guard test (the six exist, are `eye` + numeric).
- New `src/components/EyeRefractionFields.tsx` — a row-per-eye (OD/OS) × Sphere/Cylinder/Addition grid
  of numeric inputs (dioptres). `MedicalEntry` shows it **only when type = eye**, upserts each cell into
  the matching result draft by `test_key` (created on first input, removed when cleared), and **hides**
  those six rows from the (renamed) "Other Results" list so they aren't edited twice. IOP / other eye
  findings still go through the generic results list.
- **Module wrap-up:** the staging `docs/medical.md` + `CONTINUITY.md` were merged into `/docs` and
  removed; the `medical-module-in-progress` memory was retired.
- Verified by `npm run check` (all gates, **323** tests).

## Failures & gotchas to not repeat

The actionable rules now live in the spec docs (read those every session); this list keeps the `F#` anchors plus a one-line pointer. The narratives that produced each rule are in the milestone/enhancement sections above.

- **F1** — RLS without table GRANTs → `42501 permission denied`; every migration must also grant to the API roles, and don't loosen RLS to "fix" it. → `02_tech_spec.md` (Database conventions).
- **F2** — USDA `/foods/search` must POST, not GET (400 on `dataType`). → `04_wellness.md` (External APIs).
- **F3** — pin `@zxing/library@0.22` to match `@zxing/browser@0.2`'s peer range. → `02_tech_spec.md` (Stack).
- **F4** — `useAsync(fn)` takes one `useCallback`-stable `fn`, no `deps` array. → `02_tech_spec.md` (Data flow).
- **F5** — type-check with `npm run typecheck`; a bare `tsc --noEmit` checks nothing (root tsconfig is references-only). → `02_tech_spec.md` (Quality gates).
- **F6** — Add-Food search: separate whole-food vs Branded POST searches; stem-wildcard the last word; exact + leading-prefix share the top score tier; plain-block scroll pane. → `04_wellness.md` (External APIs) + `01_design_system.md` (Layout gotchas).
- **F7** — gitignore private data before the first `git add`; sanitize tracked templates (and example numbers in docs). → `02_tech_spec.md` (Database conventions / security).
- **F8** — `useAsync` keeps stale `data` during a refetch: gate on `!loading` only when the loaded subject's identity changes (and key by it). → `02_tech_spec.md` (Data flow).
- **F9** — a flex-col scroll pane needs `min-h-0` on itself + `shrink-0` on its children; don't use a fixed pixel height. → `01_design_system.md` (Layout gotchas).
- **F10** — annotate WebCrypto/WebAuthn byte helpers as `Uint8Array<ArrayBuffer>` under TS 6. → `02_tech_spec.md` (Stack / TypeScript).
- **F11** — `lazyWithReload` wraps every `React.lazy` (a one-time reload recovers a stale hashed chunk after a deploy). → `02_tech_spec.md` (Stack, lazy loading).
- **F12** — `parseOAuthError` surfaces `signup_disabled` after a `db reset --linked` wipes `auth.users` with sign-ups off; check the redirect `?error=` + the Supabase sign-up toggle. → `02_tech_spec.md` (Auth & first-run).
- **F13** — don't gate a child holding unsaved local state on `!loading` (it unmounts on every refetch); render once `data` exists. The inverse of F8. → `02_tech_spec.md` (Data flow).
- **F14** — DOM overlays over a Leaflet map need a `z-index` above Leaflet's controls (`z-index:1000`; use `z-[1100]`). → `10_travel.md` (Visual design) + `01_design_system.md` (Layout gotchas).
- **F15a** — opencc-js (~1.12MB) is lazy-loaded + excluded from the PWA precache; local Chinese filters use the tiny sync `foldZh` fold map, never opencc. → `02_tech_spec.md` (Chinese search).
- **F15b** — never seed body metrics to a non-owner (`MEMBER_PROFILE_SEED`); a profile/onboarding gate reads `data`, not `loading`. → `03_global.md` (Profile seeds).
- **F16a** — bulk DB writes go in one batched `.insert`/`.upsert` (chunked), never a per-row `await` loop (the Shows CSV importer was N round-trips on IMPORT); pass `{ defaultToNull: false }` when batched rows have non-uniform keys over a `NOT NULL DEFAULT` column. → `02_tech_spec.md` (Data flow).
- **F16b** — prefer optimistic local state over a module refresh-version bump (`bumpTravel`) on every mutation; mutate locally + persist in the background, bump only on a write error. Re-seed via the adjust-state-during-render pattern, not `setState`-in-effect. → `02_tech_spec.md` (Data flow) + `10_travel.md` (Itinerary).
- **F17** — surface caught errors with `errorMessage(e, fallback)` (`src/lib/errors.ts`), not `e instanceof Error ? e.message : …`; the `data/*` layer rethrows the raw Supabase error object, which is not an `Error` instance, so `instanceof` hides the real cause (the `message`/`code`/`hint`). → `02_tech_spec.md` (Data flow).
- **F18** — aggregate an unbounded child collection in a `security_invoker` DB view (RLS still applies; needs `grant select`), not by fetching every child row and reducing client-side. Instances: `networth_monthly_type_total` (sum), `medical_latest_result` (DISTINCT ON latest). → `02_tech_spec.md` (Database conventions).

## Shows / Books / global enhancement (favourites, Esc, master-series removal)

A cross-cutting enhancement pass (one batch; the owner refreshes the DB via `supabase db reset
--linked`, so schema changes were **folded into the existing migration files** rather than shipping
additive ones — see `memory/db-migration-workflow.md`). 242 → **249** Vitest tests.

- **Removed `master_series` from Shows.** The documentary sub-series text now lives in the **title**
  itself (owner folds it in, e.g. `国宝档案 — 从东晋到北魏`). Dropped the column + its `(user_id,
master_series)` index from `05_shows_schema.sql`; removed `masterSeriesOptions`, the
  `masterSeries` `LibraryCriteria` filter, the Entry field, the Library filter, the Dashboard/Library/
  importer eyebrow, and the `?master_series=` prefill param. `dedupKey` is now **title-only**
  (`saveImportedShows` selects just `id, title`). Existing master_series values were **not** migrated
  (owner chose a clean drop).
- **`is_favorite` on Shows + Books**, mirroring Quotes: `boolean not null default false` + a
  `(user_id, is_favorite)` index in each table's original migration; a heart toggle in the Entry header,
  a **Favourites** Dashboard shelf (`favoriteShows`/`favoriteBooks`), a **Favourites only** Library
  filter (`favoritesOnly` on `LibraryCriteria`), a ♥ on list rows, and a trailing **`is_favorite`**
  importer CSV column (Shows, Books **and** Quotes — Quotes already had the column/UI, only the importer
  needed it; lenient `true/1/yes/y` parse).
- **Shows Poster URL — auto-show + a force-on toggle.** The Entry field **auto-shows whenever TMDB
  supplied no poster** (`poster_path` is null or a manually pasted absolute URL), and the **Shows
  Settings → Visible Fields → Poster URL** toggle (`profile.show_poster_url_visible`, default false)
  **forces it always visible** even when TMDB has a poster. The toggle needs its own boolean because
  `show_visible_fields` is **default-on** (NULL = all visible) and so can't express a default-off field.
  (Iteration history: first shipped as a separate "Display → Visible Poster URL" section, then the toggle
  was moved into the Visible Fields sheet; the auto-show conditional was briefly removed and then
  restored alongside the toggle.)
- **Shows Start-Date defaulting.** A new show defaults to **Want with a blank Start Date** (it hasn't
  started); `changeStatus` now defaults Start Date to today when moving to Watching/Watched/Dropped (the
  same pattern the Finish date already used).
- **Dashboard watching badge + progress (bug fix).** A `status=watching` title set manually (not via
  "Start Watching") landed in **Up Next** with only a progress label and **no "Watching" chip** — read
  as "no badge". Fix: a shared `WatchingSecondary` renders the **chip + season·episode progress
  together** on both the Up Next and Watching shelves, so every watching title shows the badge regardless
  of shelf.
- **F — Escape-to-dismiss needs a LIFO handler stack, not N independent listeners.** Calendar +
  SelectMenu had no Esc; the Add/Edit screens needed Esc-to-close too — but a naïve per-component
  `document.addEventListener('keydown')` means **every** open overlay's handler fires on one press (a
  dropdown-open Entry screen would both close the dropdown **and** navigate away). Fix: a single shared
  `src/hooks/useEscapeKey.ts` — one document listener over a module-level **LIFO stack**; only the
  top (innermost, most-recently-mounted) enabled handler runs and `preventDefault`s. All overlays
  (`Sheet`, `Calendar`, `SelectMenu`, the three local search sheets, and `ShowsEntry`/`BooksEntry`/
  `QuotesEntry`) were migrated onto it, so the screen-level `navigate(-1)` fires only when nothing is
  layered above it — no per-screen "is an overlay open?" guard needed.

## Bottom-nav New/Settings tabs + header cleanup (Shows/Books/Quotes, Wellness reorder)

The owner moved each module's per-page actions into the **bottom navigation** so they're reachable
from every screen. Because `BottomNav` already renders `module.tabs` generically, this was a pure
data change in `src/constants/modules.ts` plus header deletions — **no `BottomNav` change**:

- **Shows/Books/Quotes** each gained two trailing `NavItem`s: a **New X** tab (reusing the module's
  Home-hub icon — `IconDeviceTv` / `IconBook` / `IconQuote` — pointing at `…/entry`) and a **Settings**
  tab (`IconSettings` → `…/settings`). Per-module order is now `Home | Dashboard/Zen | Library | New X
| Settings`. The entry/settings routes already render the bottom nav (their paths match
  `moduleForPath`) and keep their own back button, so navigation in/out is unchanged.
- **Title rows removed** from `ShowsDashboard` / `BooksDashboard` / `QuotesZen` and the three Libraries
  (the title + "+ New" + Settings-gear row only). **Functional controls were kept**: the Library
  search/filter/sort rows, the Shows-Dashboard `All/TV/Movies/Docs` `SegmentedTabs`, and the Quotes-Zen
  Shuffle button. **Quotes-Zen Shuffle** moved to a floating `absolute bottom-4 right-4` button inside
  the existing scroll container (pull-to-refresh + the centered card untouched). Page titles were
  dropped entirely (the active bottom-nav tab signals location).
- **Wellness** bottom nav reordered to **Dashboard, Diary, Library** (Diary keeps `end: true` as the
  `/wellness` index). No other Wellness change.

No tests asserted on these headers/nav, so none needed updating.

## App-level email allowlist (`VITE_ALLOWED_EMAILS`)

Google OAuth + Supabase mint a session for **any** Google account once the consent screen is
published and sign-ups are enabled; RLS isolates each user's rows, but a stranger could still create
their own account on the project and consume its quota. Added an **optional** email allowlist as a
convenience layer (the real locks are dashboard-side — see `OWNER_RUNBOOK.md` Part H3):

- **`src/lib/access.ts`** — pure `parseAllowlist` + `isEmailAllowed` (comma/whitespace-split,
  case-insensitive) and `ALLOWED_EMAILS = parseAllowlist(import.meta.env.VITE_ALLOWED_EMAILS)`. An
  **empty/unset** list means **no restriction**, so a fresh clone / local dev keeps working until the
  owner opts in. 5 unit tests (`access.test.ts`); 249 → **254**.
- **Enforced in `src/auth/AuthProvider.tsx`**, not `RequireAuth`: the provider only exposes a session
  whose email passes the allowlist; an off-list session is signed straight back out and its email
  stashed in a new `deniedEmail` context field. Doing it here (rather than in `RequireAuth`) avoids a
  Login↔RequireAuth redirect loop — Login's `session ⇒ Navigate('/')` never sees a denied session.
  `Login.tsx` renders "… isn't authorized to use this app." from `deniedEmail`.
- **Build-time var** (`VITE_`), so it's baked into the bundle — changing it needs a redeploy / dev
  restart. Documented in `.env.example`, `OWNER_RUNBOOK.md` (Parts D/H3/K + quick-ref), and the
  `CLAUDE.md` Security section. Typed in `src/vite-env.d.ts`.

## Shows row secondary-text scheme (Dashboard vs Library)

- The per-row "secondary" metadata had grown ad-hoc — each Dashboard shelf showed a different mix and the Library row showed another — so the owner asked for a deliberate scheme.
- Chose **purpose-tailored** over uniform-per-show: the **Library** is one uniform catalog row for every status, while the **Dashboard** keeps a baseline (type badge + status chip, matching the Library) and each shelf adds the single most useful detail.
- No schema/data change — all fields already on `ShowRow`. 254 → **259**.

- Two new pure helpers in `src/lib/shows.ts`: `formatRuntime(min)` (`"2h 10m"`/`"1h"`/`"45m"`) and
  `lengthHint(show)` — a compact "what am I getting into" cue (`~2h 10m` movie, `3 seasons`/`12 eps`
  episodic, null when no data). 5 unit tests.
- **Dashboard** (`ShowsDashboard.tsx`): Favourites now adds the star rating; the **Want** shelf adds
  the length hint after the genre; **Recently Watched** labels the date **"Finished …"**; and
  `WatchingSecondary` now shows progress only for episodic titles **with a known total**, otherwise
  **"Started {start date}"** — so a watching **movie** (no episodes) is no longer a blank dead end.
- **Library** (`ShowsLibrary.tsx`): the bare date gained a context label — **"Finished {date}"** when
  there's an `end_date`, else **"Updated {date}"** (`last_update_date`).
- Scope was Shows only; Books/Quotes rows were left as-is.

## Shows CSV import — `watched_episodes=all`

- **Owner request:** in the Shows CSV importer, let `watched_episodes` be the literal **`all`** on a `watching`/`dropped` episodic row, meaning "I finished every episode of the last season I was on".
- The row's `watched_seasons` is the **last-watched season number**, and the importer resolves `all` to that season's episode count from TMDB.
- No schema change — it's purely an import-layer convenience that still writes a plain INT to `watched_episodes`. 323 → **329**.

- **`tmdb-api.ts`**: `ShowMetadata` gains `season_episode_counts: Record<number, number> | null`
  (movies → null), built by the new pure `pickSeasonEpisodeCounts` from the TV details `seasons[]`
  (specials/season 0 kept; seasons with no count dropped). TMDB's TV details already include `seasons`
  by default, so no extra `append_to_response`.
- **`shows-import.ts`**: `ParsedShowRow.watched_episodes` is now `number | 'all' | null`. Parsing
  accepts `all` only on a `watching`/`dropped` **episodic** row that has a `watched_seasons` ≥ 1 —
  otherwise the row is skipped with a specific error. `buildImportRow` resolves `all` via
  `match.season_episode_counts[watched_seasons]`, falling back to **null** when TMDB has no count for
  that season (or there's no match), so a no-match row degrades gracefully rather than guessing.
- Docs: `templates/shows-import-guide.md` + an `all` example row in the template CSV; `01-screens.md`
  Import section.

## Wellness Settings → bottom-nav tab

- **Owner request:** move Wellness **Settings** off the top-right header **gear** and onto a **bottom-nav tab**, matching Shows/Books/Quotes/Medical.
- Pure UI/navigation — no schema, data, or route change (`/wellness/settings` already existed and stays in `AppShell.TAB_FOR_PATH` so its sub-sheets still paint over it).

- **`modules.ts`**: appended `{ Settings → /wellness/settings, IconSettings }` to the Wellness
  `tabs` (now Dashboard, Diary, Library, Settings + the Home item → 5 nav items, same as Medical).
- Removed the `<Link to=settings>` gear (and now-unused `Link`/`IconSettings` imports) from the three
  Wellness screen headers: `Dashboard.tsx`, `Diary.tsx`, `Library.tsx`.
- `WellnessSettings.tsx` keeps its back-chevron + title header (same pattern as `ShowsSettings`,
  reached as a tab); only its doc comment updated. No test change (no pure-logic change).

## Quotes — owner-configurable Source Types & Categories

- **Owner request:** make the Quotes **Source Type** and **Category** dropdowns configurable (add/rename/delete/reorder) in Settings, migrating existing quotes when an in-use value is deleted.
- Chose **profile JSONB config + stable text key on the row** over dedicated tables (consistent with the Medical/Shows/Books precedent of additive `profile` columns; zero data migration since `quote.source_type`/`category` already hold the keys). 329 → **348**.

- **Schema (existing migrations edited in place; DB reset workflow)**: dropped the `source_type` /
  `category` CHECK constraints on `quote` (`09_quotes_schema.sql`); added
  `quote_source_types jsonb` + `quote_categories jsonb` to `profile`
  (`10_quotes_profile_settings.sql`). NULL ⇒ canonical seed defaults (no per-user seeding /
  backfill). Regenerated `src/types/database.ts` (both surface as `Json | null`).
- **New seed order + value**: Source Types now Book, Podcast, TV Show, Movie, **Interview** (new),
  Article, Song, Video; Categories Wit, Observation, Philosophy, Love, Relationship, Growth (in
  `src/constants/quotes.ts`, which are now only the **seed defaults** — the literal-union types describe
  the defaults' shape, while stored values are plain `string` keys).
- **Pure model** `src/lib/quotes-config.ts` (+ tests): `{key,label,linkKind}` / `{key,label}` configs;
  `effective*` resolution where **a non-null override is authoritative** (does NOT re-append missing
  canonical defaults — otherwise a deleted default would resurrect; NULL still yields current defaults);
  canonical keys keep their built-in `linkKind` even if an override corrupts it; tolerant `*Label`
  lookups (raw-key fallback); `matchKeyOrLabel` (import), `generateKey` (slugify+uniquify), and
  add/rename/remove/reorder transforms.
- **Linking preserved**: `linkKind` (tv/movie→show, book→book) drives `resolveLink` (importer) +
  `selectLink` (Entry); TV/Movie/Book are **protected from deletion** (`isProtectedSourceKey`).
- **Delete migration**: `countQuotesByField` + `reassignQuoteField` (`src/data/quote.ts`) — deleting an
  in-use value forces a reassignment picker that bulk-moves the affected quotes, then removes the value;
  the last value in a list can't be deleted.
- **Read sites** switched to config-driven, orphan-tolerant lookups: `QuotesEntry` (Category now defaults
  to the first value like Source Type — the blank "Select category…" sentinel is gone), `QuotesLibrary`,
  `QuotesZen`, `ImportQuotesSheet`. `QuotesEntry` now fetches `profile` once in the outer loader and
  passes it down (avoids a double `useProfile`).
- **UI**: new shared `QuoteListEditor` (add/rename/delete/reorder + reassignment modal) over an extended
  `ReorderList` (added an optional `renderTrailing` per-row slot); new sheets `QuoteSourceTypesSheet` /
  `QuoteCategoriesSheet` reached from a **Values** section in `QuotesSettings` (background-location sheets
  over `/quotes/settings` — no `AppShell.TAB_FOR_PATH` change).
- **Importer**: `parseQuotesCsv`/`resolveLink`/`buildImportPayload` take the effective lists; Source/
  Category match by **key or label** (case-insensitive); unknown ⇒ skip-with-error (unchanged contract).

## Dynasty field + label/date polish (Shows/Books) & misc

- **Owner request bundle:**
  - (1) a Chinese **Dynasty** field for Shows & Books,
  - (2) Title-Case + American spelling across many field labels,
  - (3) Shows/Books recent + library dates as **month + day** only,
  - (4) Quotes Source-Type hints pluralised,
  - (5) Moment-of-Zen quote text taps through to Edit,
  - (6) Medical structured import **on by default**.
- 348 → **355** tests.

- **Shared, reusable** (future modules will use them): `src/constants/dynasty.ts` (`DYNASTIES`
  newest→oldest, `DEFAULT_DYNASTY = 近代`, `DYNASTY_CHIP`) + a new gold `--color-dynasty` (#d8a657)
  design token. Extracted the duplicated CJK regex into `src/lib/cjk.ts` (`containsCjk`, written with
  `\u` escapes so the range never renders as garbled boundary glyphs) and re-pointed `tmdb-api.ts` +
  `quotes.ts` at it (DRY).
- **Schema (existing migrations edited in place; DB reset workflow)**: added nullable `dynasty text`
  (CHECK against the 12 values) to `show` + `book` (`…shows_schema.sql` / `…books_schema.sql`);
  regenerated `database.ts`. **Chinese-only by decision**: a dynasty is stored only when the title
  contains CJK (defaulting to 近代), NULL otherwise — so the **gold badge** never appears on a
  non-Chinese title. The Entry dropdown is **disabled unless `containsCjk(title)`**; save forces NULL
  when not Chinese. `SelectMenu` grew `disabled`/`placeholder` props for this.
- **Where it shows**: Entry (a compact 2-col row sharing space with LGBT+ Representation), Library
  filter (`Any Dynasty` + the 12), the gold badge right of the title in Library + Dashboard rows, and
  the Visible-Fields list. Library `matchesCriteria` gained a `dynasty` clause (Shows + Books).
- **Dates**: new `formatMonthDay` (`Jun 22`, no weekday/relative/prefix) replaces `formatDayLabel`
  in Shows/Books Dashboard "Recently Watched/Read" and Library row secondary lines (the Shows
  "Finished/Updated" prefix is dropped, matching Books).
- **Importers**: both CSVs gained a `dynasty` column **after `lgbtq_rep`** (validated against
  `DYNASTIES`, kept only for Chinese titles); guides + template CSVs updated.
- **Labels** (Title Case + American spelling): Favorites Only / Started Between / Finished Between /
  Source Type / LGBT+ Representation / Source Link / Enable CSV Import / Enable Structured Import /
  Google Account, plus Wellness (Nutrition Shown Per, Per Serving, Nutrition Facts (Per …),
  Description (Optional), Default Duration (Minutes), MET by Effort) and Net Worth (Maturity Date,
  Policy Year). Quotes Source-Type hints: "links to Shows/Books" (plural).
- **Quotes Zen**: the quote text is now a button → `routes.quotes.edit(id)`.
- **Medical**: `profile.medical_importer_enabled` default flipped `false → true` (takes effect on the
  next `supabase db reset`).

## Travel Build Sequence (per milestone)

- WellWorth's 7th module: trips as Days → Stops itineraries, a visited-places map, and a per-trip expenses layer with an HKD total.
- The `docs/travel.md` staging spec (+ `templates/travel-itinerary-prompt.md` and `templates/travel-itinerary.schema.json`) drove a seven-milestone build; it has since been merged into the permanent spec docs and deleted.

### M1 — Schema + RLS + constants + category config

Goal: stand up the Travel data layer + shared vocabulary (no UI yet).

- **Migrations:** `14_travel_schema.sql` (5 user-owned tables — `trip`, `trip_day`, `stop`, `trip_expense`, `remembered_city` — each with `user_id`, four `(select auth.uid()) = user_id` RLS policies, CHECK enums, `moddatetime`, indexes, and API-role GRANTs; hard delete cascades trip → day → stop and trip → expense) + `15_travel_profile_settings.sql` (`profile.travel_expense_categories` JSONB).
- **Code:** `src/constants/travel.ts` (enums + labels, the `TRAVEL_EXPENSE_CATEGORIES` seed, and the 34-entry `CHINA_PROVINCES`) and `src/lib/travel-config.ts` (the category list helpers).
- **Tests:** `travel-config.test.ts` + `travel.test.ts`.

- **Decision — expense categories are a profile JSONB list, not a table.** `travel.md`'s first draft had a `travel_expense_category` table + `trip_expense.category_id` FK (RESTRICT). We instead used the **Quotes configurable-category pattern verbatim**: a `{key,label}` array on `profile.travel_expense_categories`, with `trip_expense.category` storing the stable TEXT key (no FK). Rationale: maximum reuse (`src/lib/quotes-config.ts` helpers + `QuoteListEditor`/`ReorderList`), a UX the owner already knows, and orphan tolerance (a deleted key still renders via the raw-key fallback). Reassign-before-delete and can't-delete-last are enforced in-app, exactly as in Quotes. Net effect: **the module is 5 tables**, and `travel.md`'s data-model section was updated to match.
- **Decision — FX is generalized, not duplicated (planned for M5).** `src/lib/fx.ts` is hardcoded to `CNY|USD` at the 1st-of-month; Travel needs an arbitrary currency at the trip's first day. The plan is to _add_ `fetchRateToHkdOn(currency, date)` to `fx.ts` (Net Worth's existing API untouched) and build `src/lib/trip-fx.ts` on top — no duplicate Frankfurter client.
- **Decision — layered map fill (planned for M4).** Bundle DataV.GeoAtlas (China province fill, Chinese names) + Natural Earth public-domain world-countries (non-China country fill) behind a `regionName → shape` lookup. `CHINA_PROVINCES` is the single source of truth; a build/test check will assert every province resolves in the DataV GeoJSON (DataV's suffixed names normalized via an explicit alias map, since the 5 autonomous regions carry ethnic qualifiers that a naive suffix-strip misses). Province/state fill outside China is parked.

### M2 — Trips list + Trip Builder (Days → Stops) + City picker

Goal: the full trip-logging loop — create a trip, build its day-by-day itinerary, resolve cities.

- **Module wiring:** `routes.travel.*`, the `IconWorld` `ModuleDef`, three router routes, the screens barrel.
- **Data:** `src/data/travel.ts` (trip/day/stop/remembered_city CRUD, `getTripBundle`, `reorderDays`/`reorderStops`/`nextStopSortOrder`, `recomputeTripDates`, `listTripFacetRows`, `rememberCity`).
- **Logic:** `src/lib/travel.ts` (row aliases, `TRIP_STATUS_CHIP`, the trip-list filter/sort `applyTripList`, facet helpers) + `src/lib/places.ts` (`snapProvince` + the on-demand Nominatim `geocodeCity`) + `src/lib/travel-refresh.ts`.
- **Screens:** `TravelTrips` (search + status/country/province/year filters + swipe-delete), `TripBuilder` (new = header-only + Create; edit = header Save + Itinerary/Expenses tabs, Days with date picker / duplicate / delete, per-day stop list with drag-reorder, a Reorder-Days sheet), `TravelSettings` (placeholder until M5–M7).
- **Components:** `CitySearchSheet` + `StopEditorSheet` (local overlays, **not** route sheets, so the Builder draft survives).
- **Tests:** `places.test.ts`, `travel.test.ts`.

**Decisions / notes:**

- **Create-then-edit, not a giant client draft.** "New Trip" persists a minimal trip first
  (`/travel/entry` → header + Create), then the Builder (`/travel/trip/:id`) does **live CRUD** on days
  and stops (each add/edit/reorder/delete hits the DB + `bumpTravel()` → refetch). Nested ordered
  sub-entities make a persisted parent far simpler than serializing a deep in-memory draft.
- **Transitional route scheme.** For M2 the module index `/travel` renders the **Trips list** (so the
  module is runnable now); M3 introduces the Dashboard at `/travel` and moves the list to `/travel/trips`
  (the `routes.travel.trips` alias already points at the index to ease that move). Bottom-nav tabs are
  Trips / New Trip / Settings; Dashboard (M3) and Map (M4) join later.
- **Day reorder reuses `ReorderList` via a sheet.** Day _cards_ are tall/non-uniform, which
  `ReorderList` (uniform-row assumption) can't drag inline, so day reordering is a compact Reorder-Days
  sheet over one-line labels (same approach as Medical's display-order sheet); stop rows **are** one-line,
  so they drag inline within a day.
- **`sort_order` is `int4`.** New stops append via `nextStopSortOrder` (max+1), not `Date.now()` (which
  overflows a 32-bit int). Reorders renumber to 0..n.
- **City resolution.** Manual + the `remembered_city` cache (instant, no network); Nominatim is an
  on-demand "Look up online" assist (never per-keystroke, so within usage policy) that suggests
  country/admin-1/coords to confirm. Province is `snapProvince`-snapped to a canonical `CHINA_PROVINCES`
  value before saving, so the M3/M4 shaded map + "N / 34" count stay consistent. Confirming a city upserts
  it into the cache (`onConflict: user_id,city_norm`).
- **Stop cost stays informational** (a note on the editor reiterates it's never summed); the Expenses
  layer (M5) is the authoritative spend total.

### M3 — Dashboard (tiles, province progress, shelves)

Goal: an at-a-glance view of places visited.

- **Logic:** `src/lib/travel-stats.ts` (`computeTravelStats` — distinct China-provinces / China-cities / countries / cities **over `status='visited'` trips only**, plus trips-this-year + inclusive days-travelled; `isChinaCountry`; `CHINA_PROVINCE_TOTAL = 34`), tested in `travel-stats.test.ts`.
- **Screen:** `TravelDashboard` (four count tiles, an "N / 34" province-progress bar, count-based metric tiles, and Recently-Visited / Planning / Want-to-Visit shelves reusing `SectionCard` + `StatusChip` + `Thumb`).
- **Reuses** the `listTrips` + `listTripFacetRows` reads already built for the Trips list.

**Decisions / notes:**

- **Routing restructure (the M2-planned move).** `/travel` now renders the **Dashboard**; the Trips list
  moved to `/travel/trips` (the `routes.travel.trips` alias was pre-pointed there in M2, so nothing else
  changed). Bottom-nav tabs are now Dashboard / Trips / New Trip / Settings; the Map tab joins in M4.
- **Province count can't exceed 34.** `computeTravelStats` intersects stop provinces with
  `CHINA_PROVINCES` before counting, so a stray non-canonical value never inflates "N / 34" — belt-and-
  braces on top of the city picker's `snapProvince`.
- **Monetary metrics deferred to M5.** Spend totals + the HKD equivalent (and per-card trip totals) need
  the Expenses layer, so M3 ships only the count-based metrics (trips this year, days travelled); the card
  rows show dates + primary region, not a total yet.
- **Province map is M4.** M3 shows the progress _bar_; a note points to the upcoming shaded map.

### M4 — Map (Leaflet + OSM dots + layered region fill)

Goal: a map of visited cities with a shaded region overlay.

- **Deps added:** `leaflet` + `leaflet.markercluster` (+ `@types/*`).
- **Assets:** two **vendored** GeoJSON files in `public/geo/` — `china-provinces.geojson` (DataV.GeoAtlas, 34 provinces + a South-China-Sea feature) and `world-countries.geojson` (Natural Earth 110m admin-0, public domain).
- **Logic:** `src/lib/travel-geo.ts` (`resolveCountryName` + `COUNTRY_ALIASES`; the asset URLs).
- **Component:** `src/components/TravelMapCanvas.tsx` (imperative Leaflet — no react-leaflet — **lazy-loaded** so Leaflet lands in its own chunk; OSM tiles, markercluster dots coloured by status, two `L.geoJSON` fill layers).
- **Screen:** `src/screens/TravelMap.tsx` (loads trips + facet rows + remembered-city coords, builds the city→trips/coords model, the fill toggle, and the city→trip(s) overlay).
- **Route** `/travel/map` + a Map bottom-nav tab.
- **Test:** `travel-geo.test.ts`.

**Decisions / notes:**

- **Vendored, not fetched-from-CDN, and not precached.** Both GeoJSON live in `public/geo/` (served from
  our origin); the workbox `globPatterns` doesn't list `.geojson`, so they stay out of the PWA precache
  and load on demand with the lazy map chunk. They're also added to `.prettierignore` (don't reflow the
  minified JSON).
- **Build-time name-match guard.** `travel-geo.test.ts` `?raw`-imports both files (so it typechecks under
  `tsconfig.app`'s `vite/client` types — no `node:fs`) and asserts **every `CHINA_PROVINCES` resolves**
  via `snapProvince` against the DataV feature names, and **every `COUNTRY_ALIASES` target exists** in the
  NE `NAME` set. A name drift fails the build, not silently leaves a region unshaded.
- **Layered fill via one `regionName → shape` model.** China is filled by province (DataV, matched with
  `snapProvince`); non-China countries are filled whole (NE, matched with `resolveCountryName`). Both fill
  only **visited** regions, in the teal `--color-positive`. Province/state fill _outside_ China is parked.
- **Dots need coords from the cache.** Stops store only city/country/province; the map joins a stop's city
  to its `remembered_city` row (by normalized name) for lat/lng. Cities without a cached pin show no dot
  (a hint points to the picker's "Look up online"). Dots are coral (visited) / neutral (planned).
- **GCJ-02 not corrected (v1).** Stored coords + the GeoJSON + OSM tiles are treated as WGS-84; the
  GCJ-02 visual offset over Chinese areas isn't corrected — invisible at province/country zoom, accepted
  per `travel.md`.
- **Imperative Leaflet, map created once.** The map/tiles/cluster are built in a mount-only effect that
  reads the latest props via a ref; a second effect restyles the fill + rebuilds markers on data/toggle
  change, so toggling fill never resets the viewport.

### M5 — Expenses layer (CRUD, categories, reimbursement, HKD total)

Goal: the authoritative per-trip spend total (stop costs stay informational).

- **Logic:** `src/lib/fx.ts` gained `fetchRateToHkdOn(currency, date)` (arbitrary currency at a specific date — Net Worth's API untouched); `src/lib/trip-fx.ts` (`tripFirstDay` + `fetchTripRates`); `src/lib/expenses.ts` (`perCurrencyTotals` / `hkdTotals` / `categoryTotalsHkd` / `rateFor` / `formatMoney`); `src/lib/reimburse.ts` (the safe mini-parser).
- **Data:** expense CRUD + `countExpensesByCategory` / `reassignExpenseCategory` in `data/travel.ts`.
- **UI:** `ExpenseEditorSheet`, `TripExpensesPanel` (the Expenses tab — per-currency + HKD totals, FX rates, category breakdown, rows), `TravelExpenseChart` (lazy recharts donut), and `TravelCategoriesSheet`.
- **Tests:** `reimburse.test.ts`, `expenses.test.ts`, `trip-fx.test.ts`.

**Decisions / notes:**

- **`QuoteListEditor` → `ConfigListEditor` (shared, decoupled).** The Quotes list editor was coupled to
  `data/quote` (`countQuotesByField` / `reassignQuoteField` / `bumpQuotes`). It's now a module-agnostic
  `src/components/ConfigListEditor.tsx` that takes `count` / `reassign` / `onChanged` (+ `itemNoun`) as
  props; both Quote sheets and the new `TravelCategoriesSheet` inject their own. No UI duplicated.
- **Expense categories = the Quotes pattern.** `{key,label}` JSONB on `profile.travel_expense_categories`;
  `trip_expense.category` stores the stable key. Deleting an in-use category reassigns its expenses to a
  chosen replacement first; the last category can't be deleted; orphan keys still render (raw-key fallback).
- **Reimbursement is a safe mini-parser, never `eval`.** `evalReimbursement(formula, amount)` is a
  recursive-descent evaluator over `+ - * / ( )`, numbers, and `amount` (presets ½ / ⅖ / Full). Returns
  null on a parse error or non-finite result (e.g. `amount/0`); rounds to cents. Stored as
  `reimbursed_formula` + the computed `reimbursed_amount`. The reimbursement UI shows only when the trip's
  **Track Reimbursement** toggle is on.
- **HKD total: one rate per currency, frozen at the trip's first day.** Per-currency totals stay native;
  the HKD total converts each via `trip.fx_rates` (HKD = 1). A used currency without a rate is surfaced
  (excluded from the total, listed) with a **Fetch missing rates** button (`fetchTripRates` → Frankfurter
  at `tripFirstDay`) and an inline **manual override** input per currency — the fallback for non-ECB
  currencies (e.g. TWD/VND) Frankfurter can't price.
- **Per-trip FX lives in the Expenses tab, not Settings.** `travel.md` listed FX overrides under Settings,
  but they're per-trip and only actionable alongside the expenses, so the rate list + override + fetch sit
  in the trip's Expenses tab. Settings holds the (global) category editor.
- **Category breakdown is in HKD** so cross-currency categories combine; unpriced expenses are excluded
  from the donut (consistent with the HKD total).

### M6 — Import CSV Expenses (wide → long)

Goal: bulk-load a trip's spend from a wide spreadsheet.

- **Logic:** `src/lib/travel-expense-import.ts` (`parseExpenseCsv` classifies the header row into Trip/Date/Cost/Re-imbursed + category + unknown columns; `buildExpenses` turns each row into one or more `trip_expense` drafts; `parseAmount`/`parseDate`), tested in `travel-expense-import.test.ts`.
- **Data:** `deleteExpensesForTrip`.
- **Screen:** `src/screens/ImportTravelExpensesSheet.tsx` (file pick → detected-columns + unknown-header mapping + per-trip summary + replace-per-trip → import).
- **Route** `/travel/import-expenses` + a Settings → Import link.
- **Assets:** `templates/travel-expenses-template.csv` + `…-import-guide.md`; `.gitignore` ignores real `travel-expenses*.csv` (template excepted).

**Decisions / notes:**

- **Wide → long with splitting.** A row's filled category columns each become an expense; a row with >1
  filled splits. `Cost` is the row total, **cross-checked** against the category-cell sum (mismatch =
  warning, not error). A row with only `Cost` falls back to the first category (warned).
- **Reimbursed is allocated pro-rata** across a split row's expenses by cost; the last part takes the
  rounding remainder. Stored as `reimbursed_amount` (+ the number as `reimbursed_formula`).
- **No currency column** — every imported amount is in the **trip's base currency** (a domestic-spend
  sheet); the owner sets HKD rates afterwards in the trip's Expenses tab. New trips are created
  `status='visited'`, `base_currency='CNY'`.
- **Unknown headers are surfaced, never dropped** — a `Skip | <category>` picker per unknown column maps
  them before import (matched against the owner's configured category **labels**, so renamed categories
  still match their own labels and anything else becomes "unknown").
- **Trip attribution by name** (case-insensitive); created if missing. **Additive** by default, with an
  opt-in **"replace existing expenses for matched trips"** (one `deleteExpensesForTrip` per matched trip).

### M7 — Import CSV Trips (itinerary JSON)

Goal: a one-time back-catalogue load of whole itineraries.

- **Logic:** `src/lib/itinerary-import.ts` (`parseItineraryJson` — the Medical tolerant-repair stack, then validates the array into `TripDraft[]` with safe enum fallbacks, null-date preservation, and province snapping; `distinctCities`; `tripSummary`), tested in `itinerary-import.test.ts`.
- **Screen:** `src/screens/ImportTravelTripsSheet.tsx` (one combined review — trip/day/stop counts per trip + a pooled new-cities list with optional per-city geocode — then writes trips → days → stops in order and caches the new cities).
- **Route** `/travel/import-trips` + a Settings → Import link.
- **Input shape:** `templates/travel-itinerary.schema.json` (prompt: `travel-itinerary-prompt.md`), both already in the repo.

**Decisions / notes:**

- **Tolerant repair shared with Medical.** Same two passes (stray quote after a number; missing comma
  before a new key) tried in sequence before a clear line/column error. Bad enums fall back (`type → other`,
  `status → visited`); `base_currency → CNY`; a trip with no `trip_name` is skipped with a warning — the
  import never hard-fails on one bad trip.
- **Drafts, not finished trips.** Everything writes as-is for the owner to finish in the Trip Builder;
  `recomputeTripDates` caches each trip's start/end from its day dates after insert.
- **Pooled new-city resolution.** Distinct cities not already in the `remembered_city` cache are listed
  once; each can optionally be geocoded (Nominatim, on-demand) to pin coords. On import they're cached
  (country/province from the JSON, province snapped for China) so the Map can dot them; existing cached
  cities are left untouched. Skipping resolution still imports — the dot just waits for coords.
- **Province snapping at import.** Chinese stops' `province` is snapped to a canonical `CHINA_PROVINCES`
  value; foreign provinces are kept verbatim — so the shaded map + "N / 34" stay consistent without manual
  cleanup.

> **Travel is feature-complete (M1–M7).** Its `docs/travel.md` staging spec has been merged into the
> permanent spec docs (`00-PRD … 05-seed-data` + OWNER-RUNBOOK "Logging a trip") and deleted, as was done
> for the other modules.
>
> **Post-completion fixes** (all reflected in `01-screens.md`): (1) a per-Day **Calendar date chip** in
> the Trip Builder Itinerary; (2) the Edit screen gained a **RESET** button and **SAVE now returns** to
> where you came from (mirroring the other Entry/Edit forms); (3) the Map's multi-trip **chooser overlay**
> is raised above Leaflet's controls so its rows are tappable (F14); (4) the Edit body stays mounted across
> itinerary refetches so unsaved header edits survive opening a Day/Stop (F13).

## Known limitations / deferred

See `PARKED.md` for the deferred / out-of-scope backlog (barcode-needs-HTTPS, serving fidelity on edit, bundle size, designed app icons, multi-user DRI/sharing limits, etc.). Read it on request.

## Cross-module cosmetic pass (session, June 2026)

A UI-only refinement sweep across every module — **no schema / migration / `database.ts` / seed
changes**, so RLS and the data layer are untouched and the test count stays **432**. Behavior is in the
specs (`01-screens.md`, `04-design-system.md`); the notable engineering decisions:

- **Two new shared components.** **`EntryHeaderActions`** replaces the hand-rolled RESET / CREATE / SAVE
  text buttons in **every** Entry/Edit header (Wellness Food/Activity logging + custom Library items, Net
  Worth, Shows, Books, Quotes, Medical, Travel) with compact **icons** — Reset = `IconArrowBackUp`,
  Submit = `IconPlus` (new) / `IconDeviceFloppy` (editing) — plus a **Delete** (`IconTrash`) shown only
  when editing, behind a two-step inline confirm (no `window.confirm`). Each screen wires its existing
  delete fn (`deleteEntry` / `softDeleteFood` / `softDeleteActivity` / `deleteSnapshot` / `deleteShow` /
  `deleteBook` / `deleteQuote` / `deleteReport` / `deleteTrip`). **`EmptyState`** is the centered
  "No X yet / + New X" block for the media + Medical Dashboards/Libraries. Owner decision: Delete is
  **hidden on new** records (nothing to remove yet).
- **Calendar month/year jump.** The shared `Calendar` header is now a button that toggles an internal
  `mode` to a year-stepper + month grid (the `MonthPicker` pattern, inlined); picking a month returns to
  its day grid. One change covers Wellness Diary + all Shows/Books date pickers.
- **Segmented → dropdown on Entry forms.** Shows/Books **Status** + **LGBT+** and Quotes **Language**
  switched from `SegmentedTabs` to `SelectMenu` so they pair compactly onto shared lines (Status|Rating,
  Category|Language, etc.). **`SelectMenu` now flips its menu upward** when there's no room below
  (measures the trigger rect on open) — fixes the New Trip header where a short, `overflow-y-auto` form
  clipped the Status/Base-Currency menus.
- **Net Worth delete threading.** `NetWorthEntry` is month-based (create-or-replace, no `id`), so the
  loader now also returns the month's `snapshotId`; the header Delete shows only when a saved snapshot
  exists and removes that month (clearing the form, screen stays open).
- **Travel dashboard** collapsed its two 2-col tile blocks + the redundant province-progress bar into one
  **3×2 column-first** grid (`grid-flow-col grid-rows-2`); the first two tiles relabelled **中国省份 /
  中国城市** (owner decision).
- **Search pre-fill.** `TitleSearchSheet` / `BookSearchSheet` / `QuoteSourceLinkSheet` gained an
  `initialQuery` prop (seeded from the Entry's current Title) so opening the search/link sheet shows
  matching results immediately.

A second round of small follow-ups (same session, UI-only):

- **Quotes Language** reverted from a `SelectMenu` back to a `SegmentedTabs` toggle (filling the rest of
  the Category|Language line, which the two clamped dropdowns left half-empty).
- **Medical Report detail** header now shows **Date - Type** (+ body part) over **Provider** and the Edit
  action is a pencil **icon**; the duplicated date block was dropped from the body. **Add/Edit Report**
  pairs **Report Date + Type** on one line (Provider on its own), and the New form's import button moved
  **into the header** beside the title.
- **Travel Trip Builder** header's top-left is now an **✕ Close** (was a back chevron) for cross-module
  consistency; the Edit **Status + Rating** line splits full-width. **Travel Settings** import rows are
  accent upload links (no chevron, Trips first) mirroring Shows; the **Wellness Library** `Import CSV…`
  link recoloured to `accent` to match.
- **Import modals** headers dropped the redundant "CSV" (Import Shows / Books / Quotes; Import Trips /
  Expenses; **Import Medical Report**) and the file-picker label was Title-cased (**Choose CSV/JSON/JSON
  CSV File**).

## Shared Filter / Sort / Search pass (session, June 2026)

- Another UI-only sweep unifying the **Search + Filter + Sort** controls across **Shows, Books, Quotes, Medical, Travel** — **no schema / migration / `database.ts` / seed changes**; every field used already existed (`trip.rating`, `trip.companions`, `medical_report.body_part/provider/narrative`).
- Test count **432 → 445** (new pure-helper coverage only). Specs updated in `01-screens.md` + `04-design-system.md`.

- **Four new shared components** (the parts that had been re-rolled per screen): **`FilterToggleButton`**
  (icon-only `IconFilter`, tints accent while open — promotes the old Travel design to every module and
  retires the labelled "Filters (N)" buttons + their `activeCount` math), **`FilterPanel`** (the
  `rounded-card border bg-surface p-3` pane), **`SortControl`** (label + sort-field `SelectMenu` +
  asc/desc toggle, driven by a per-module `SORT_OPTIONS` array — so editing a module's Sort list is a
  one-line code change, which was the owner's explicit ask), and **`DateRangeRow`** (single-line
  `label · From · To`, absorbing the duplicated `DateButton`/`DateRange` helpers from Shows + Books).
- **Label-free panels.** Shows/Books/Quotes/Medical/Travel dropdowns dropped their `<Field>` labels; the
  first option now names the field (**Any Status / Any Genre / Any Rating / Any LGBT+ / Any Dynasty / Any
  Category / Any Source / Any Language / Any Type / Any Provider / Any Body Part / Any Country / Any
  Province / Any Year**). Shows keeps **Type** as a `SegmentedTabs` (owner decision). **Clear Filters**
  is always shown in the panel footer next to Sort (preserves `query` + sort across a clear).
- **New sort everywhere.** Shows/Books gained a **Dynasty** sort (chronological via `DYNASTIES` index,
  non-Chinese titles last). **Quotes** + **Medical** had no sort at all — added `applyLibraryView` sort
  (Date=created_at / Category / Source Type) and a new pure **`applyReportView`** (Date=report_date /
  Type / Provider / Body Part) with `reportProviders`/`reportBodyParts`/`reportSearchText` helpers.
  **Travel** `applyTripList` gained `sortField`/`sortDir` (Date / Country / Province / City / Status /
  Trip Name; country/province/city use the alphabetically-first itinerary facet) **plus** a `minRating`
  filter (mirrors Shows) and **companion** search.
- **Books drops the Author filter.** Author has too many values to filter usefully — it's now
  search-only (`bookSearchText` already covered it). `author` was removed from `LibraryCriteria` /
  `matchesCriteria`, but **kept** as a Sort option.
- **Search bar fills the row.** `SearchBar` gained an optional `className`; the five list screens pass
  `min-w-0 flex-1` so the input grows to the screen edge and the **Filter icon sits flush at the right**
  in every module (Travel included — its filter icon shares the search row, not a separate row).

## Shared "Visible Fields" sheet + Travel parity (session, June 2026)

- Unified the five modules' near-identical Visible-Fields modals into one shared component, fixed each field list to match New/Edit form order, applied label renames, restructured Medical Settings, and added the feature to Travel (the one module that lacked it).
- Test count **445 → 451**.

- **`src/components/VisibleFieldsSheet.tsx` (new)** — owns the `full` `Sheet` + header + intro + the
  auto-saving toggle list (previously copy-pasted in four `*FieldsSheet.tsx`). Props: `intro`, `fields`
  (`{key,label}[]` in form order), `column` (the `profile` `text[]`), and `extras` — boolean-column
  toggles interleaved via `afterKey`. The four existing sheets + the new `TravelFieldsSheet` are now
  ~10-line wrappers; no router changes for the four.
- **Form-order + renames** (keys unchanged → no stored-data impact, membership is a set check):
  Shows/Books **Metadata** moved up to its form slot (after Year) and renamed **"TMDB Metadata"** /
  **"Google Books Metadata"**; **"Last Update" → "Last Update Date"**; Quotes reordered to author →
  source type → title → source link → language → tags. Shows' **Poster URL** (its own
  `show_poster_url_visible` boolean, default-off) is now an `extra` placed in form position
  (`afterKey: 'episodes'`) instead of appended last. All intros switched to **"New/Edit"** wording;
  Medical gained an intro it never had.
- **Medical Settings** — section **"Report Form" → "Entry Form"**, toggle **"Enable Structured Import"
  → "Enable JSON / CSV Import"**, and the **Security** section moved to **last**.
- **Travel visible-fields (new).** Schema change: `profile.travel_visible_fields text[]` added to the
  **existing** `15_travel_profile_settings.sql` (edited in place per the DB-reset workflow)
  and to `src/types/database.ts` (owner applies via `supabase db reset --linked`). `src/lib/travel.ts`
  gained `TRIP_ENTRY_FIELDS` (rating, cover_url, companions, **track_reimbursement** — owner chose to
  make it hideable — notes) + `isFieldVisible`; new route `travel/settings/visible`, `TravelFieldsSheet`,
  a Travel Settings **Entry Form** section, and `isFieldVisible` gating of the five fields in
  `TripBuilder`.

A small follow-up restructured **Medical Settings** sections (owner request):

- A **Display** section now holds **Tracked Tests** (secondary "(Dashboard)") + **Tests Display Order** (secondary "(Dashboard, Report & Entry)"); a **Report / Entry Form** section holds **Visible Fields**; Import + Security follow (Security last).
- The clarifying finding was that **Display Order** drives the Dashboard **and** Report detail (not just one), and it was **extended to also order the Entry form's result cards** — `MedicalEntry` now wraps its result list in `orderResultsForDisplay(filteredResults, medical_section_order, medical_test_order)` (purely presentational, keyed by `clientId`, so editing/removal is unaffected), so all three surfaces share one ordering.

## Migration filename rename + empty-state icons (session, June 2026)

Two unrelated cosmetic/housekeeping changes; no schema or behaviour change.

- **Migrations renamed `NN_<module>_<name>.sql`** (owner request) — the 14-digit timestamp prefix was
  replaced with a two-digit global ordinal that preserves the original apply order, and the descriptive
  part now leads with the module (`20260613120000_init_schema.sql` → `01_wellness_schema.sql`,
  `20260617130000_profile_show_settings.sql` → `06_shows_profile_settings.sql`,
  `20260622121000_seed_medical_lab_test.sql` → `12_medical_seed_lab_test.sql`, …). Done with `git mv`
  (history preserved). The ordinal is required: pure module-first names sort alphabetically and would run
  e.g. `books_profile_settings` before `wellness_schema` (which creates `profile`), breaking the reset.
  All references updated — the `src/lib/medical.test.ts` `?raw` seed import, the `src/lib/medical.ts`
  comment, the cross-referencing comments inside the SQL files, and every doc (`CLAUDE.md`,
  `03-data-model.md`, `05-seed-data.md`, `OWNER_RUNBOOK.md`, this log). Renumbering changes each
  migration's **version**, so it reconciles only via `supabase db reset --linked` (a `db push` can't) —
  already the owner's workflow. The historical `…_grant_api_roles.sql` mention (a long-merged, deleted
  file) is left as-is.
- **`EmptyState` gained a module icon.** The shared `src/components/EmptyState.tsx` now takes an optional
  `Icon` (a Tabler `Icon`) rendered muted above the "No X yet" line; every usage passes its module icon
  (Shows `IconDeviceTv`, Books `IconBook`, Quotes `IconQuote`, Medical `IconHeartbeat`, Travel
  `IconWorld`). **Travel** now uses the shared `EmptyState` too — `TravelDashboard`, `TravelTrips`, and
  **`TravelMap`** dropped their bespoke centred blocks (and the now-unused `PrimaryButton` import), so the
  "No trips yet" state is the same icon + "+ New Trip" pill as the other modules.
- **True vertical centering (follow-up).** The empty group read as "slightly high" on several screens:
  `EmptyState` used `min-h-[60vh]`, which centres within a 60vh box pinned to the **top** of the taller
  `<main>`. Root cause: the empty-hosting roots weren't full-height, so the EmptyState's `flex-1` had no
  space to fill (only QuotesZen's `flex h-full flex-col` root already centred — which is why Quotes never
  looked off). Fix: every empty-hosting root is now a **full-height flex column** — the dashboards
  (`pb-4` / `pb-4 pt-2` → `flex min-h-full flex-col …`), the Library/Reports/Trips roots (`+ min-h-full`),
  and the two Travel screens that return straight into `<main>` (wrapped in `flex min-h-full flex-col`) —
  so `EmptyState`'s `flex-1` fills the real content area (below any sticky header) and the group sits at
  true centre, consistently across modules. `min-h-full` resolves because `<main>` has a definite
  flex-sized height (the same reason QuotesZen's `h-full` already worked). `EmptyState` itself is
  unchanged.

## Multi-member family — per-member login + forced onboarding

Goal: let a few family members each use the app with their own Google account and strictly-private data, without inheriting the owner's body metrics.

- The data layer was **already** multi-user (every table RLS-isolated on `user_id`; `profile` PK = `user_id`), so this was a small, targeted change — no schema-wide refactor, no data migration, no sharing model.
- **Decisions (from the owner):** own Google login each · strictly private (no household sharing) ·
  a forced first-run wizard · base currency stays global HKD.
- **Owner detection** (`src/lib/access.ts`): `isOwnerEmail(email, OWNER_EMAIL, ALLOWED_EMAILS)` —
  the owner is `VITE_OWNER_EMAIL`, falling back to a single-entry `VITE_ALLOWED_EMAILS` so a lone-user
  build needs zero extra config. Plus `needsOnboarding(profile)` (true only for a loaded row with a
  null `onboarded_at`).
- **Seed split** (`src/constants/profile-defaults.ts`): new `MEMBER_PROFILE_SEED` (activity factor,
  units, the highlighted-nutrient preset — **no** birthday/sex/height/weight/protein); `OWNER_PROFILE_SEED`
  spreads it and adds the owner's body metrics. `ensureOwnerProfile(userId, email)` branches: owner gets
  the owner seed + an `onboarded_at` stamp; everyone else gets the member seed with `onboarded_at` null.
  It now returns whether it created a row; `useEnsureProfile` `bumpDiary()`s on a create so the gate
  re-reads the new profile.
- **Schema:** added `profile.onboarded_at timestamptz` to `01_wellness_schema.sql` (edited in place per
  the `db reset --linked` workflow) + regenerated `src/types/database.ts`.
- **Gate + wizard:** `OnboardingGate` in `AppShell` (modeled on `MedicalLockGate`) shows a splash while
  the profile loads/creates and renders the full-screen `src/screens/Onboarding.tsx` for a new member;
  finishing stamps `onboarded_at` (via the shared `bumpDiary` refetch) and dismisses it. The wizard and
  Settings now share `src/components/ProfileMetricsFields.tsx` — one home for the metric↔imperial math.
- **Known limits (documented, not built):** members outside the populated DRI bands get no Wellness
  nutrient targets (`computeTargets` returns null — graceful); base currency is global HKD; no
  shared/household data. See `PARKED.md`.
- Verified by `npm run check` (all gates, **457** tests — +6 in `access.test.ts` for `isOwnerEmail` /
  `needsOnboarding`).

### Follow-up — DRI bands extended to full adult coverage (female & male, 31–71+)

- Added the rest of the adult DRI matrix to `src/lib/dri.ts` so any family member 31+ gets Wellness nutrient targets.
- Bands now: **female & male, each 31–50 · 51–70 · 71+** (6 total).

- `FEMALE_31_50` spreads `FEMALE_51_70` (iron 18 premenopausal, calcium 1000/UL 2500, fiber 25, omega6
  12, B6 1.3, chromium 25).
- `MALE_51_70` is a **full band** (men differ broadly: water 3700, protein 56, fiber 30, vitamin_a 900,
  vitamin_c 90, vitamin_k 120, b1 1.2, b2 1.3, b3 16, b6 1.7, choline 550, calcium 1000, magnesium 420,
  manganese 2.3, potassium 3400, zinc 11, chromium 30, fluoride 4; iron/phosphorus/etc. match female).
- `MALE_31_50` spreads `MALE_51_70` (fiber 38, omega6 17, B6 1.3, calcium UL 2500, chromium 35).
- `FEMALE_71_PLUS` / `MALE_71_PLUS` spread their 51–70 bands: vitamin D 15→20 µg (800 IU) and the
  phosphorus UL 4000→3000 at 71; male calcium RDA also rises 1000→1200.
- `bandFor` is now `if (age < 31 || sex∉{female,male}) null; tier = ≤50 ? 31-50 : ≤70 ? 51-70 : 71+`.
  Under-31 / other-sex still return null (graceful — `computeTargets` shows no targets).

- ULs are not sex-specific (vary only by age: calcium UL 2500→2000 at 51, phosphorus UL 4000→3000 at 71).
- DRI values transcribed from NASEM/IOM (NIH ODS, NCBI **NBK545442**), documented per band in `05-seed-data.md`.
- +10 tests (`dri.test.ts`, incl. fixing the old "male 40 throws" case which is now a supported band), all gates green.

### Follow-up — `全部` catch-all dynasty (Shows/Books)

- **Owner request:** a leading **`全部`** ("all") option for the Chinese **Dynasty** field, for titles that span every era (e.g. a survey/通史 series).
- One-edit change — everything (both Entry dropdowns, the Library `Any Dynasty` filter, the chronological Dynasty sort, and both CSV importers' validation) derives from the single `DYNASTIES` constant.

- **`src/constants/dynasty.ts`**: prepended `全部` (now `DYNASTIES[0]`), so the list is `全部 近代 清代
明代 元代 宋代 五代 唐代 隋代 南北朝 魏晉 兩漢 先秦` (13). **`DEFAULT_DYNASTY` is now `全部`** (still
  `DYNASTIES[0]`) — owner's choice: new Chinese titles default to `全部`. Sort places it first (its
  index-0 position), ahead of 近代.
- **Schema (existing migrations edited in place; DB reset workflow)**: added `'全部'` to the `dynasty`
  CHECK in `05_shows_schema.sql` + `07_books_schema.sql`. `database.ts` **not** regenerated — the CHECK
  column already surfaces as plain `string`.
- The Library filter keeps **`Any Dynasty`** (the `'all'` no-filter sentinel) as a distinct option;
  `全部` appears below it as a real stored value (English "Any Dynasty" vs. the Chinese tag — no clash).
- Guides + template CSVs (`shows`/`books-import-*`) and `dynasty.test.ts` updated; docs (`01-screens`,
  `03-data-model`) bumped 12 → 13. All gates green.
- **Sort follow-up:** the **display order** (dropdowns/default = `DYNASTIES`) and the **sort order** are
  now intentionally **opposite**. Owner wants the Library Dynasty sort chronological **oldest→newest
  ascending** (先秦 first … 近代, `全部` last), descending the reverse — whereas the dropdowns lead with
  `全部` then run newest→oldest. Added `dynastySortRank` to `dynasty.ts` (`[...DYNASTIES].reverse()`
  indexed; non-Chinese → null, sorted last by the existing comparator) and pointed both `shows.ts` /
  `books.ts` `sortKey('dynasty')` at it (replacing the old `DYNASTIES.indexOf`). One `DYNASTIES` list
  still drives both orderings. Sort tests updated to assert asc + desc + `全部`-last + non-Chinese-last.

### Removed `last_update_date`; importer-supplied dates (Shows/Books/Quotes)

- Two owner requests, one pass:
  - **(1)** Dropped the `last_update_date` column from `show` + `book` — it was a UI-only date (defaulted to today, editable) whose sole job was a fallback behind `end_date` in the Library Date sort + row display; the automatic `updated_at` already covers "row last touched".
  - **(2)** The three CSV importers now carry **real dates** so back-catalogue rows sort correctly and populate the "Recently Watched/Read" shelves.

- **Schema:** removed `last_update_date date` from `05_shows_schema.sql` + `07_books_schema.sql` (edited
  in place; owner `db reset --linked` + `gen:types`). `database.ts` hand-aligned to match (regen confirms).
- **`moddatetime` constraint drove the design.** The triggers are `BEFORE UPDATE` only, so a
  client-supplied `updated_at` is honoured on INSERT but **forced to `now()` on UPDATE**. Rather than
  fight it, the CSV carries explicit `start_date`/`end_date`, the importer **freezes `created_at =
start_date`** (a plain column, honoured on insert _and_ update), and **`updated_at` is left to the DB**
  (= import time). So `updated_at` is now a pure audit column, used by no sort/display.
- **Importers** (`shows-import.ts` / `books-import.ts` / `quotes-import.ts`): new trailing columns —
  Shows/Books `start_date,end_date` (start required on every row **except `want`** — a not-yet-started
  `want` may leave it blank; end required for finished = watched/dropped / read/dropped, ignored
  otherwise; `created_at = start_date`, or — when a `want` row omits `start_date` — left to default so it
  equals `updated_at` = import time), and **Books also gains a `status` column** (was hardcoded `read` —
  now want/reading/read/dropped). Quotes gains a **required `created_at`** (drives its existing
  `created_at` Date sort). All validate as `YYYY-MM-DD`; written as `${date}T00:00:00Z`.
  `QuoteImportPayload` stopped `Omit`-ing `created_at`.
- **Date sort (Shows/Books)** changed `end_date ?? last_update_date ?? updated_at` → **`end_date ??
start_date`** (and the Library row's secondary date likewise); `updated_at` is import-time noise now.
- **Entry forms** lose the 3-way date picker's `'last'` branch (now Start/Finish only) and the
  Last-Update field; removing it from `SHOW_ENTRY_FIELDS`/`BOOK_ENTRY_FIELDS` also drops it from the
  **Visible Fields** modal. Templates + three guides + docs (`01-screens`, `02-tech-spec`,
  `03-data-model`) updated; importer tests rewritten for the new columns. All gates green.
- **Known limit:** `updated_at` can't be set to a historical value via the importer (the trigger), and a
  re-import over an existing row rewrites `created_at` to the CSV `start_date` (idempotent) — both fine
  for the owner's reset-and-reseed workflow.

### Free-tier backups + keep-alive (ops)

- The Supabase **free tier** has no automated backups and pauses a project after ~7 days idle, so added a self-managed, **encrypted off-site backup** + keep-alive.
- New `scripts/db-backup.sh` (pg_dump of **public user data only** — schema + `nutrient`/`medical_lab_test` are reproducible from migrations — **plus `auth.users`/`auth.identities`** so UUIDs/OAuth survive a project recreation; encrypted to an age **public** key so the runner can encrypt but never decrypt) + `scripts/db-restore.sh` (age-decrypt → `psql`).
- `.github/workflows/backup.yml` runs them every ~3 days (the pg_dump connection doubles as the keep-alive; optional REST ping) and pushes the `.age` to a **private** backups repo via a fine-grained PAT.
- Key decisions: **Session-mode pooler** URL (direct host is IPv6-only, runners are IPv4; transaction pooler can't `pg_dump`); install **PG17** client (pg_dump ≥ server).
- Documented end-to-end in **OWNER-RUNBOOK Part Q** (setup, secrets, manual backup, **two-tier restore** — same project vs. recreate + auth reload, the `auth.users` UUID trap).
- `.gitignore` guards `backups/`/`*.age`/`*.key` (not a blanket `*.sql` — that would catch migrations).
- **GitHub disables crons after 60 days idle** — noted as a risk.

### UI polish (session, June 2026)

A cross-module cosmetic pass — no schema/data/behavior changes, all presentational:

- **Empty states unified.** The Wellness Dashboard (empty range) and Net Worth Dashboard (no snapshots)
  now use the shared centered `EmptyState` (icon · "No entries yet" · action pill) like every other
  module — replacing the old inline `<p>` ("Nothing logged…" / "No data yet…"). Wellness branches in
  `Dashboard` **before** the shared `NutrientReport` (which `DailyReportSheet` also uses, so its message
  is untouched). The **Net Worth screen title header was removed** (content opens straight into the
  cards; small `pt-3` keeps it off the safe area).
- **Shared-component props added (non-breaking).** `SearchBar` gained an optional `icon` (default
  `IconSearch`); the Shows/Books online-search sheets + their Entry "TMDB"/"Google Books" buttons now use
  `IconWorldSearch` (the Travel city-lookup glyph) in `accent`. `FieldRow` gained an optional `hint` —
  a small muted note inline after the label — used by Medical Settings so "(Dashboard)" sits next to
  **Tracked Tests** and "(Dashboard, Report & Entry)" next to **Tests Display Order** (the smaller hint
  text lets the label keep its full name on one line on iPhone).
- **Labels.** Shows/Books Entry + Visible-Fields "Comments" → **Notes** (`SHOW_/BOOK_ENTRY_FIELDS`).
  Quotes category **labels** "Heart" → **Love**, "Connection" → **Relationship** (keys `heart`/
  `connection` unchanged — no data migration; importer still matches the old CSV values by key).
- **Wellness Settings** "Display" section moved above "Targets".
- **Travel New Trip** Status dropdown was clipped to ~1.5 options: the short form body's `overflow-y-auto`
  was cropping the `SelectMenu`'s absolute panel — dropped it (the form needs no scroll; EditTrip is
  unaffected). All gates green; 475 tests unchanged (presentational only).

### Quotes enhancement (session, June 2026)

Owner refinements after daily Quotes use:

- **Entry field order** — **Title + Show/Book link** now render **above** Author + Source Type on the
  New/Edit form (`QuotesEntry`), and `QUOTE_ENTRY_FIELDS` was reordered to match so the Visible-Fields
  modal mirrors it (key reorder is data-safe — `isFieldVisible` is membership-based).
- **"Linked Titles Only" filter** — new `linkedOnly` field on `LibraryCriteria` (+ default + a predicate
  in `applyLibraryView`: excludes quotes with no `show_id`/`book_id`); surfaced as a `Toggle` on its own
  line below the filter grid in `QuotesLibrary`. Language stays a dropdown, Favorites Only unchanged.
- **Tag facet scales** — new pure `rankedTags(quotes)` (count desc, alpha tiebreak; replaces the old
  alpha-only `quoteTags`). The Library shows the **top 10 tags by use** by default (selected tags always
  visible); above 10 a **Filter tags…** box searches the full list (local `tagQuery`, reset by Clear
  Filters). +1 `linkedOnly` test, the field-order assertion updated, and `quoteTags`→`rankedTags` tests
  swapped → **477** tests.

### Variant-agnostic Chinese search (session, June 2026)

- **Owner request:** typing **either** Traditional or Simplified Chinese into **any** search bar should find matches stored in **either** script — across all modules (library filters, Wellness food/activity Library, Travel city picker, Medical test picker, tag inputs, **and** the remote APIs TMDB / Google Books / Nominatim / USDA).
- See **F15** for the engine-split rationale and the precache gotcha.

- **Local filters — fold both sides.** A generated single-char Traditional→Simplified fold map
  (`src/constants/zh-fold-map.ts`, built by `scripts/gen-zh-fold-map.mjs` merging OpenCC's HK + TW + TWP
  dictionaries) backs the sync `foldZh` (`src/lib/zh-fold.ts`). Every search-text builder + query is
  routed through it: `quoteSearchText`/`linkSearchText` + `applyLibraryView`/`filterLinkCandidates`
  (quotes), `searchableText`/`matchesCriteria` (shows), `bookSearchText`/`matchesCriteria` (books),
  `reportSearchText`/`applyReportView` (medical), the inline name/city/companion match in `applyTripList`
  (travel), plus the screen/component filters in `Library.tsx`, `CitySearchSheet`, `MedicalTestPickerSheet`,
  `TagInput`, and the `QuotesLibrary` tag facet. Folding both sides to Simplified makes matching symmetric.
- **Remote searches — dual-variant query + merge.** `src/lib/zh-query.ts` (`zhQueryVariants` +
  `searchZhVariants`): for a CJK query it issues both the Simplified fold and the **HK-Traditional**
  form (`convertZh(q, 'hk')`, lazy opencc), runs them in parallel, and merges + de-dupes by a stable id
  (TMDB `tmdbId`, Books `source:sourceId`, Nominatim `lat,lng`, USDA `source:externalId`). A single
  failing variant is tolerated; all-fail rethrows. Non-CJK queries keep the original single-request path
  and never load opencc. Wired into `searchTitles` (tmdb-api), `searchBooks` (books-api), `geocodeCity`
  (places), `searchFoods` (food-api) by extracting each body into a `*One(q)` helper.
- **HK locale.** The owner is in Hong Kong, so the Traditional direction is OpenCC **`hk`**, not `tw`.
- **Tests:** `zh-fold.test.ts` (fold + symmetry), `zh-query.test.ts` (variant generation + merge/dedupe +
  partial-failure/all-fail), and a cross-variant case added to shows/books/quotes/medical/travel → **496**.
- **Deferred:** a global Traditional/Simplified **display toggle** (rewrite on-screen Chinese without
  touching DB values) — see `PARKED.md`. It reuses `convertZh` (already loaded for remote search).

## Session-persistent list state + Shows Type above the search bar (session, June 2026)

- **Owner request:**
  - (1) the Shows Library **All/TV/Movies/Docs** type selector should be **always visible** rather than buried in the filter panel;
  - (2) a list's **search + filter + sort** should survive clicking into an item and coming back, "within the same session".
- **UI-only — no schema/migration/`database.ts`/seed/test-count changes** (stays **496**); specs updated in `01-screens.md`, `02_tech_spec.md`, `04-design-system.md`, `PARKED.md`.

- **Why these screens reset.** Unlike the Wellness Library (which opens an **Edit sheet** via the
  background-location pattern and keeps its tab in the URL), the Shows/Books/Quotes/Medical/Travel lists
  open a detail with a **full route swap** (`navigate(routes.shows.edit(id))`), so the screen **unmounts**
  and its `useState` criteria reset to `DEFAULT_*` on return.
- **Mechanism — `sessionStorage`, not URL params.** Added **`src/hooks/useSessionState.ts`**, a
  `useState` drop-in backed by `sessionStorage` (lazy read + `JSON.parse`; functional + value setters;
  swallows read/write failures like `last-module.ts`; shallow-merges a stored object over `initial` so a
  future new criteria field falls back to its default). The five list screens swapped
  `useState(DEFAULT_*)` → `useSessionState('wellworth:<screen>', DEFAULT_*)` for their criteria object
  only (transient `filtersOpen`/`whichDate`/`tagQuery` stay plain `useState`). The owner picked
  `sessionStorage` over the previously-noted **URL-as-state** plan (PARKED) because it restores on **every**
  return path — Back, bottom nav, **and** Home re-entry — matches "within the session" (clears on tab/app
  close), and stays DRY across five differently-shaped criteria objects via one generic hook; the only
  thing given up is a shareable/bookmarkable URL, which a personal Library doesn't need (that variant
  stays deferred in `PARKED.md`).
- **Shows Type relocation.** Moved the existing `SegmentedTabs` (Type) out of `FilterPanel` and into the
  sticky header **above** the `SearchBar` (its own full-width row over the search+filter row), mirroring
  Wellness Library's Foods/Activities tabs. Pure JSX move — `criteria.type` + `applyLibraryView` unchanged.
- **No new tests:** per project convention only pure `src/lib/*` helpers are unit-tested; the hook is
  verified by `tsc` + the manual run (return via Back / bottom nav / Home restores; tab close clears).

## Travel simplification — leaner stops, city carry-forward, inline completion (session, June 2026)

- Owner request to make the **Edit Trip** screen the working surface and stop over-collecting per-stop data.
- Touches the `stop` schema, so `database.ts` is regenerated.
- Test count **496 → 495** (dropped the `timeHHMM` test with the helper).
- Specs updated in `00_PRD.md`, `01-screens.md`, `03-data-model.md`, `CLAUDE.md`, `PARKED.md`, and the two `templates/travel-itinerary*` files.

- **Removed 7 stop fields** (`time`, `cost`, `cost_currency`, `local_transit`, `travel_mode`,
  `from_loc`, `to_loc`) — they appeared on only some stops, so they're folded into the free-text
  `description`. Dropped from the `stop` table (migration `14_travel_schema.sql` **edited in place** per
  the owner's `supabase db reset --linked` workflow), `database.ts`, `StopEditorSheet`, `TripBuilder`
  (duplicate-day payload + row display), `ImportTravelTripsSheet`, `itinerary-import.ts` (+ test), the
  prompt/schema templates, and `constants/travel.ts` (`TRAVEL_MODES`/labels deleted). **Gotcha:**
  `local_transit` is _also_ a default **expense category** in `constants/travel.ts` — that one stays;
  only the stop field went.
- **City carry-forward (no day-level city).** Kept `city`/`province`/`country` on the stop; a **new**
  stop inherits them from the day's last stop, else the most recent prior day's last stop
  (`carryForwardCity` in `TripBuilder`). The common 1-city-per-day flow needs zero city input. Editing a
  stop does **not** cascade. Considered a day-level city + per-stop override; rejected — multi-city days
  still need overrides, so carry-forward is the same input cost with less schema.
- **City Lookup mirrors Shows Title+TMDB.** The Stop editor's City is now a text input + a **Lookup**
  button; `CitySearchSheet` was refactored to seed from the typed city and **auto-search** (cache +
  Nominatim, debounced) like `TitleSearchSheet`, with result-tap confirming directly. Still a local
  overlay (not a route sheet) so the editor draft survives; manual entry remains the fallback.
- **Grouped display + inline completion.** A day's stops render as consecutive **city-run** groups
  (`cityRuns`), each a separate `ReorderList` under a city-only sub-header (the uniform-row ReorderList
  can't host a header inside a row, so one list per run; cross-run order is rebuilt on reorder). Each row
  has inline **done/skipped** icon toggles (`setStopCompletion`, tap-active-to-clear) so routine marking
  never opens the sheet.
- **Add Day** now defaults the new day's date to the previous day's `day_date` **+ 1** (reusing
  `addDays` from `src/lib/date.ts`), then recomputes the trip span.

### Travel UX Enhancement (2026-06-26)

- **Header field rearrangement.** Edit Trip header card reordered: Trip Name + Status (row 1),
  Companions + Rating (row 2), Notes (row 3), Cover Image URL (row 4). **Base Currency** and **Track
  Reimburse** removed from the header — they now appear in a small card immediately below the
  Itinerary/Expenses toggle **only when Expenses is active** (always visible there, not gated by
  visible-fields settings). Rationale: currency and reimbursement are expense concerns, not trip-identity
  concerns; moving them reduces header clutter.
- **Day expand/collapse.** Each Day card now has a **chevron** at the left end of the header row (same
  stateless pattern as the Diary `GroupHeader` — parent holds `collapsedDays: Set<string>`, chevron
  toggles membership). All days are expanded by default. Icon order in the header: chevron · Day N ·
  date chip · spacer · Trash · Copy · green +. Green + opens the Add Stop modal (replaces the old bottom
  "Add Stop" button, which is removed).
- **Stop swipe-to-delete.** `ReorderList` extended with an optional `onDelete?: (id: string) => void`
  prop. When provided, each row is wrapped in the existing `SwipeRow` and the container switches to
  `divide-y divide-border` for row separators (the original `border-b last:border-b-0` per-row approach
  breaks when `SwipeRow` makes every row the last child of its own SwipeRow inner-div). Stops use
  `deleteStop` directly; no modal — the two-step swipe+tap is sufficient.
- **Stop completion icons more visible.** Inactive Done/Skipped icons changed from `text-text-tertiary`
  to `text-text-secondary` so they look clickable, not disabled.
- **City Picker manual-entry redesign.** "OR ENTER MANUALLY" section replaced with a collapsible
  **Enter manually…** chevron disclosure, collapsed by default. Auto-expands when search returns zero
  results (`geoState === 'done' && suggestions.length === 0`). The PrimaryButton is hidden inside the
  collapsed section, preventing accidental use when search results are present.
- **Country default changed to `中国`.** The `isChina()` recogniser already includes `'中国'`, so
  the province dropdown triggers correctly.

### Colour-scheme follow-up after the accent swap (2026-06-26)

The owner changed `--color-accent` from coral `#e8623c` to blue `#5ba3f5` in `src/index.css`. Because
Tailwind v4 is CSS-first, every `text-accent` re-themed automatically — which surfaced three issues:

- **Favourite heart decoupled from accent.** The filled heart was `text-accent`, so it turned blue with
  everything else. Added a dedicated `--color-favorite: #e06aa0` (rose, the value already used by
  `TravelExpenseChart`) and switched all 10 filled-heart call sites (`IconHeartFilled`) to
  `text-favorite` (Shows/Books Library+Dashboard+Entry, QuotesZen/QuotesEntry, FoodDetailSheet,
  AddFoodSheet). Outline hearts stay `text-text-tertiary`. No shared heart component exists; the edit
  was a per-site class swap (a shared component was considered but deemed unwarranted for the scope).
- **Home bottom-nav item distinguished.** `BottomNav` now wraps the leading Home icon in a subtle
  `bg-input rounded-pill` chip so the hub anchor reads apart from the flat module tabs. The chip uses
  `-my-0.5` to offset its vertical padding, keeping label baselines aligned across all items. Active
  tint still tracks `accent`.
- **App icon recoloured + made reproducible.** The `public/` icons were static orange-ring placeholders
  with **no committed generator** (PARKED "Designed app icons"). Added `scripts/gen-icons.mjs` +
  `npm run gen:icons` (devDeps `sharp` + `png-to-ico`): it builds the ring SVG in code (accent-blue ring
  on `--color-bg`) and rasterises all sizes (pwa-192/512, padded maskable-512, apple-touch 180,
  favicon 16/32/48). Added `src/components/RingMark.tsx` (inline ring via `currentColor`, tracks
  `accent`) and used it for **both** on-screen logos — the Login screen (which had no logo before) and
  the Onboarding header (previously an `<img>` of `pwa-192x192.png`). On-screen logos are a free choice
  where inline SVG wins (crisp + themeable); the installed-app icon/favicon are forced to be raster
  (iOS/manifest don't take SVG), so they stay a separate generated artifact that shares RingMark's
  documented ring geometry. **Lessons:** (1) generated assets need a committed generator, not just the
  output files, or a recolour means hand-editing rasters; (2) keep the two _on-screen_ logos on one
  component so they can't drift — the raster icon is the only unavoidable duplicate.

### Colour-scheme follow-up #2 — teal actions, status chips, nav/toggle contrast (2026-06-26)

More fallout from the accent→blue swap, plus two latent bugs it exposed:

- **Create / Add / Save actions → teal.** Added a `tone` prop to `PrimaryButton` (`fill` default |
  `positive` teal); the shared `EntryHeaderActions` submit (the `+`/floppy used by every entry screen
  via that component), plus `FoodDetailSheet` "Add to diary" and `ExpenseEditorSheet` Save/Add, now pass
  `tone="positive"`. Inline `+` glyphs that were still `text-accent` (blue) flipped to `text-positive`
  (`ConfigListEditor`, `EmptyState`, `MedicalTestPickerSheet`, `ImportMedicalSheet`/`MedicalEntry`
  Add-link/Add-result, and the secondary `Add Day`/`Add Expense`). Most `+` glyphs were _already_
  `text-positive`. Import/link/search actions stay `accent` (blue) — they aren't create/add/save.
- **Status chips: in-progress = orange again.** Watching/Reading used `bg-accent`, so they went blue
  with the swap. Introduced **`--color-warning: #e8623c`** (the old accent orange) and pointed
  Watching/Reading at `bg-warning`. **Latent bug:** `--color-warning` was referenced in **4 places**
  (`TRIP_STATUS_CHIP.planning` + three import "N notes" labels) but **never defined** — so Travel's
  Planning badge had no background (unreadable) and the import notes weren't amber. Defining the token
  fixed all of them. Travel **Want to Go** changed `bg-track` → `bg-info` to match Shows/Books **Want**.
- **Bottom-nav Home chip** changed `bg-input` → `bg-accent/20`: the old chip (#2a3142) was nearly
  invisible on the `bg-surface` (#232a3a) bar. A soft accent tint reads clearly and marks Home as the hub.
- **Trip-stop "skipped" toggle** changed `bg-track text-text-secondary` (dark-on-dark, barely visible)
  → `bg-text-secondary text-bg` (solid grey, dark icon), mirroring the teal `bg-positive` "done" fill.

### Performance pass — Shows import + Travel stop toggle (2026-06-27)

Two latency complaints, both traced to round-trip count rather than the suspected cause:

- **Shows CSV importer, slow on IMPORT (~440 titles).** Suspected to be TMDB rate limiting, but TMDB
  runs in the earlier "Matching titles…" phase (on file choose), not on IMPORT. The IMPORT cost was
  `saveImportedShows` writing rows **one at a time in a sequential `await` loop** — ~440 separate
  Supabase round-trips. Rewrote it to split new vs existing (by the existing `dedupKey`/`idByKey`
  logic) and issue a **bulk `insert` + bulk `upsert`** (conflict on `id`), chunked at 500 — a couple of
  calls instead of hundreds. Idempotency and the created/updated counts are unchanged. → **F16a**.
  **Follow-up fix:** the first batched build failed IMPORT — `buildImportRow` emits `created_at` only
  for rows with a `start_date`, so the batch had non-uniform keys and the bulk write sent the missing
  `created_at` as NULL (the column is `NOT NULL DEFAULT now()`). Resolved with `{ defaultToNull: false }`
  on both the insert and upsert so missing keys fall back to the column default. **Why it was opaque:**
  the screen showed only the generic "Import failed." — the `data/*` layer rethrows the raw Supabase
  error object, which is **not** a JS `Error`, so every importer's `e instanceof Error ? e.message : …`
  fell through to the fallback. Added a shared **`errorMessage(e, fallback)`** (`src/lib/errors.ts`,
  +tests) that reads the Postgrest `message`/`code`/`hint`/`details` (and still handles real `Error`s
  and strings) and routed **all eight CSV/file importers** through it, so a failure now shows the real
  database message + code. → **F17**.
  Separately raised the match-phase worker pool `POOL` 5 → **10** (each worker = one connection, so ~10
  peak — half TMDB's ~20 cap, rate well under ~50/s), ~halving the "Matching titles…" wall-clock.
- **Travel Edit-Trip done/skipped toggle, slow per tap.** The handler did a fast single-row write then
  `bumpTravel()`, whose version bump forced `EditTrip` to refetch the **entire trip bundle** (all days +
  all stops) before the icon's pressed state updated — two sequential round-trips for one field.
  `stop.completion` has no cross-screen consumer (read only in `TripBuilder.tsx`; not the Map/facets),
  so the toggle is now **optimistic**: a local `completionOverrides` map updates instantly and the write
  persists in the background with no `bumpTravel()` (rolls back on error). Structural edits still bump.
  → **F16b**.
- **Books importer, same pass.** `saveImportedBooks` had the identical sequential per-row write loop
  and the identical conditional-`created_at` shape, so it got the same bulk insert + bulk upsert with
  `{ defaultToNull: false }`. Separately, the match phase could stall ~30s on its **last** row: the
  Google→Open Library fallback path had **no request timeout**, so one slow OL response held up the
  whole batch. Added a `REQUEST_TIMEOUT_MS` ceiling via an `AbortController` (the
  `searchBooks`/`getBookDetails` API already threads a `signal`); a timed-out row falls through to
  `nomatch` like any other miss. `POOL` now scales with the key (`hasGoogleBooksApiKey`): 3 keyless,
  **10** with `VITE_GOOGLE_BOOKS_API_KEY` set (higher project quota) — the owner has a key configured,
  so imports run at the higher pool; the 429 backoff stays as the safety net.

The DB-write fixes are behaviour-equivalent (no schema change); the diagnostics work added
`src/lib/errors.ts` + tests. Verified by `npm run check`.

### Travel Edit-Trip — optimistic itinerary + Expenses, token-driven chart (2026-06-27)

Followed the done/skipped toggle's win across the rest of Edit Trip. Every itinerary action used to
`await` its write(s) and then `bumpTravel()`, whose version bump made `EditTrip` refetch the **entire**
trip bundle (all days + all stops) before the UI updated — so Add/Copy/Delete Day, Reorder, Add/Delete
Stop, and the date picker all paid that refetch (Copy Day was worst: it also created the copied stops
in a **sequential** per-stop loop).

- **`EditTripBody` now holds `days`/`stops` in local state.** Each handler mutates that state instantly
  and persists in the background with **no** `bumpTravel()` on success; a write bumps only **on error**,
  which refetches and re-seeds local state (via the adjust-state-during-render pattern, not an effect —
  the `react-hooks/set-state-in-effect` rule). Copy Day bulk-inserts its stops in one round-trip via a
  new `createStops`. `StopEditorSheet`/`ExpenseEditorSheet` now return the saved row so the parent merges
  it (replace on edit, append on add) without a refetch. → **F16b**.
- **Expenses tab** got the same treatment (`TripExpensesPanel`): optimistic local override of the expense
  list **and** the FX-rate map; add/edit/delete and rate edits no longer bump.
- **Expense "By Category (HKD)" donut** (`TravelExpenseChart`) was hardcoded **coral-led** — its lead hex
  was the _old_ accent orange, so it didn't follow the `--color-accent` → blue change. Rebuilt the palette
  from design tokens (`var(--color-*)`, which Recharts resolves in `fill`, cf. `MedicalTrendChart`),
  **accent-led**; orange is demoted to the `--color-warning` slice. Now theme-driven, so it won't drift
  again. Verified by `npm run check` (500 tests).

### Cross-module sweep — optimistic list/dashboard actions (2026-06-27)

A repo-wide audit (parallel readers over every module) for the same `bump*()` → full-collection-refetch
anti-pattern found the direct analogues of the Travel toggle, and they got the same optimistic-override
treatment (`override ?? data`, reset via adjust-state-during-render; bump only on error). → **F16b**.

- **Shows/Books Dashboards** — the **Mark Watched/Start Watching** and **Mark Read/Start Reading** quick
  actions patch the row in a local override so its shelf moves instantly, instead of `bumpShows()`/
  `bumpBooks()` → whole-library refetch + shelf recompute on every tap (the most-frequent offenders).
- **Library/Reports swipe-deletes** — `ShowsLibrary`, `BooksLibrary`, `QuotesLibrary`, `MedicalReports`
  now drop the row locally and delete in the background.
- **Already correct:** `QuotesZen`'s favourite toggle (optimistic `favOverride` + rollback). It still does
  a redundant background `bumpQuotes()`; left as-is (works; minor).
- **Calibration:** these list refetches were each a single `listX(userId)` query (one round-trip, no
  N+1), so the win is "instant + no extra round-trip" rather than the multi-query stall Travel had.
- **Deferred (separate kind of problem):** `NetWorthDashboard` runs `listSnapshotsWithEntries` over **all**
  history (unbounded, grows with months) and `useMedicalTrends` joins all results+reports — both refetch
  on their own mount regardless of the bump, so they're a load-time/scaling concern, not a per-tap lag.
  Left for a separate pass. Verified by `npm run check` (500 tests).

### Net Worth dashboard — pre-aggregate in a DB view (2026-06-27)

Addressed the deferred unbounded-query item above. `NetWorthDashboard` fetched
`listSnapshotsWithEntries` — **every** `asset_entry` (`value_base`/`asset_type`) across all history —
and summed per month/type on the client. That payload grows with **asset count × months**; the dashboard
only ever needs aggregates, never individual holdings.

- Added the project's **first DB view**, `networth_monthly_type_total` (`03_networth_schema.sql`, edited
  in place per the reset workflow): `sum(value_base)` grouped by `(user_id, month, asset_type)`,
  `security_invoker = true` so the base tables' RLS still scopes rows, `grant select` to the API roles.
- Data layer: `listMonthlyTypeTotals` replaces `listSnapshotsWithEntries` (removed). Dashboard folds the
  flat rows with new pure helpers `foldMonthlyTotals` / `sumTotals` / `typeBreakdownFromTotals`
  (`networth.ts`, +tests). Payload is now O(months × asset_types), independent of holding count.
- A snapshot with zero entries no longer appears in the trend (INNER JOIN) — a negligible, arguably
  more-correct change. The Entry screen still reads a month's full `asset_entry` rows (unchanged).
- **Types:** `src/types/database.ts` `Views` was hand-updated to mirror what `npm run gen:types` will
  produce; the owner must `supabase db reset --linked` to create the view, then regen to confirm no
  drift (the hand-added entry is byte-identical to the generator's output). → **F18**. Verified by
  `npm run check` (504 tests).

### Medical dashboard — same view treatment, for symmetry (2026-06-27)

Applied F18 to the Medical dashboard. `useMedicalTrends` fetched **every** result (all tests × all
reports) via `listResultsWithReportMeta` + the reports list, then derived both the sparklines and the
latest-values card client-side — growing with full history.

- Unlike Net Worth (pure sums), only **part** of the medical dashboard is aggregatable. Split the one
  all-results fetch into **three bounded queries**: `listLatestResultPerTest` (new
  `medical_latest_result` view — `DISTINCT ON (user_id, coalesce(test_key, name-fallback))`, latest
  `report_date` wins; powers the latest-values card), `listTrackedResultSeries(trackedKeys)` (history
  for only the tracked tests — the sparklines; drops every un-tracked test's history), and `listReports`
  (the timeline). `listResultsWithReportMeta` removed.
- The view's dedupe key **mirrors the client's `latestResultPerTest`** exactly, so `latestByCategory`
  (which re-applies it) stays idempotent and ad-hoc NULL-`test_key` rows still dedupe by name. The
  tracked set is computed from the profile **before** the fetch (it scopes the series query).
- `medical_latest_result` returns full `medical_result.*` rows (the card renders rich rows), so its
  hand-added `database.ts` `Views` entry mirrors `medical_result` (all nullable) + `report_date`/
  `report_type`. Same owner step as Net Worth: `supabase db reset --linked` then `npm run gen:types`.

## Diary group/day action bars, default-expand, drag-reorder (2026-06-27)

Reworked the Wellness Diary day screen to mirror the Edit Trip ergonomics and retire the `⋯` menu.
Behavior/data are now in `04_wellness.md`; design pieces in `01_design_system.md`.

- **Schema:** added `diary_entry.sort_order numeric not null default 0` (edited `01_wellness_schema.sql`
  in place — owner reset workflow). `listEntriesByDay` orders by `(sort_order, created_at)`. New rows
  default `sort_order = Date.now()` (a large epoch value) in `createEntry`, so a freshly logged item
  appends after any rows the user dragged into order; a drag (`reorderEntries`, mirrors travel's
  `reorderStops`) renumbers a group to small `0..n`, and `cloneEntriesToDay` stamps ascending values
  on pasted clones. `database.ts` hand-patched to match (owner regenerates on next `db reset`).
- **Action bars:** each group header and the day header carry **Delete · Copy · Paste** icons (group
  headers also keep **Add**, and move the kcal subtotal next to the title). Extracted a shared
  `IconAction` button (Tabler icon, `secondary`/`positive` tint, muted when disabled) used by both.
  Delete/Copy disable when the source is empty; Paste tints **positive** while armed.
- **Copy/Paste:** removed per-item Multi-Select entirely. Copy is whole-group or whole-day (each item
  remembers its own group); a group Paste retargets every clipboard item into the clicked group while
  a day Paste preserves original groups (`cloneEntriesToDay`'s new `opts.groupOverride`). Paste is
  **additive** and **one-shot** — the clipboard is cleared after a paste (`setDiaryClipboard(null)`),
  disabling every Paste until the next Copy. `diary-clipboard.ts` dropped its different-day-only rule.
- **Copied cue:** new app-wide `Toaster` (`src/components/Toaster.tsx` + `src/lib/toast.ts`, the same
  module-scoped `useSyncExternalStore` pattern as `diary-clipboard.ts`), mounted once in `AppShell`;
  Copy fires "Copied {group/day} · N items".
- **Default-expand:** when a day's entries first settle, every non-empty group auto-expands (empty
  stay collapsed). A `sawLoadingForDay` ref ignores the stale render where `day` changed but
  `entries`/`loading` are still the previous day's; an `autoExpandedDay` ref makes it once-per-day so
  same-day refetches don't undo a manual collapse.
- **Reorder:** each group's rows are a `ReorderList` (the Edit Trip component) with a new optional
  `containerClassName` so it nests inside the group card without double borders; drag persists
  optimistically (per-group `orderOverride` applied while its id set matches the fetched rows) then
  `reorderEntries` + refetch. Verified by `npm run check` (504 tests; no new pure helpers).

  → **F18**. Verified by `npm run check` (504 tests).

## Importers on by default + Home-hub Visible Modules (2026-06-27)

Two settings additions. Behavior/data are now in `03_global.md` (profile columns, Global Settings),
`10_travel.md` (importer toggle), and the Shows/Books/Quotes spec Settings sections.

- **Importers default ON:** flipped `show_importer_enabled` / `book_importer_enabled` /
  `quote_importer_enabled` from `default false` → `default true` (edited migrations `05/07/09` in place —
  owner reset workflow), matching `medical_importer_enabled`. The in-app toggles are unchanged.
- **Travel single importer toggle:** added `travel_importer_enabled boolean not null default true` to
  migration `14`; `TravelSettings` now gates **both** the JSON-Trips and CSV-Expenses launchers behind
  one **Enable JSON / CSV Import** toggle (mirrors Medical), showing a secondary note when off.
- **Home-hub Visible Modules:** added `module_order` / `visible_modules text[]` to `profile` (migration
  `01`, both NULL = canonical order / all visible). New **DISPLAY** section in Global Settings →
  **Visible Modules** opens a full sheet with a **single combined `ReorderList`** — drag to reorder, a
  per-row `Toggle` (in `renderTrailing`) to show/hide. The last visible module's toggle refuses to turn
  off (`showToast`), mirroring `ConfigListEditor`. Resolution lives in `src/lib/modules-display.ts`
  (`orderedModules` / `homeModules`, tolerant of unknown/newly-shipped keys); `Home` consumes it and
  falls back to all modules while the profile loads, so the hub never flashes empty. Hiding only removes
  the card — module routes stay reachable by URL and the last-used-module launch default is unaffected.
  **Newly-shipped modules default visible:** `module_order` doubles as a seen-set (the sheet writes it
  on every visibility change), and `homeModules` shows any module not in it — so adding a module in a
  later redeploy never silently hides it for users who'd already customized their selection.
- `database.ts` hand-patched to match the three new columns (owner regenerates on next `db reset`).
  Verified by `npm run check` (504 tests; no new pure helpers).

## Standardized Delete interactions (2026-06-27)

Unified the app on **two** delete models, retiring the native `window.confirm()` dialogs. Behavior is
in `01_design_system.md` (the new component + the two models) and the touched module specs.

- **Icon rows → inline confirm.** New shared **`ConfirmDeleteAction`** (`src/components/`): an
  `IconAction`-styled `IconTrash` that flips **inline** to `Delete? ✓ ✗` (the compact counterpart to
  `EntryHeaderActions`' two-step delete; sibling Copy/Paste/Add icons stay visible, the text
  disambiguates). Replaced the immediate/`confirm()`-gated trash in **Diary day header** (and bumped
  that row's `gap-1` → `gap-2` to match the group headers), **Diary `GroupHeader`**, **Net Worth
  monthly row** (was an instant delete), and the **Edit Trip day header**. The corresponding
  `deleteDay`/`deleteGroup`/`removeDay` handlers dropped their `window.confirm` guards.
- **Swipe lists → delete immediately.** The revealed `SwipeRow` Delete now acts on tap with **no**
  browser dialog, matching what Edit-Trip stops/expenses and the Wellness food/activity library
  already did. Removed the `confirm()` from `remove()` in `ShowsLibrary`, `BooksLibrary`,
  `QuotesLibrary`, `MedicalReports`, `TravelTrips` (and dropped the now-unused label params + their
  call-site args). Swipe-to-delete already existed everywhere via `SwipeRow` — the only gap was the
  inconsistent confirmation step.
- No render test added: the suite is **node-env, pure-helpers only** (no jsdom/testing-library by
  design), so a component test would mean new deps against that convention. Verified by
  `npm run check` (504 tests).

## Shows/Books Notes rename + long-notes editor (2026-06-28)

Renamed the column and added comfortable long-note editing across **Shows** and **Books**. Behavior is
in `06_shows.md` / `07_books.md`; the new shared modal is referenced from both.

- **`comments` → `notes`** end-to-end: the `show`/`book` create migrations (`04_`/`06_`, edited in
  place — owner reconciles via `db reset`), `database.ts` (hand-patched, regen on next reset),
  `SHOW_ENTRY_FIELDS`/`BOOK_ENTRY_FIELDS` keys, the Entry drafts/save, the importers, and tests/docs.
  The visible-fields key changed too; stored `*_visible_fields` arrays default NULL (= all visible) and
  the owner's reset clears any stale `'comments'` entry, so no data migration. Postgres `text` is
  effectively unbounded, so no type change for long notes.
- **New shared `NotesEditorModal`** (`src/components/`): full-screen, **buffered** editor opened by an
  expand icon beside the inline Notes label (which grew `rows={3}` → `4`). Header `Title (Year)` (title
  only when Year is null); reuses **`EntryHeaderActions`** (Delete clears the text · Reset reverts to
  the value at open · Save applies + closes) with a top-left ✕ to cancel. A **paste** icon inserts
  clipboard text **at the cursor** (reads the textarea's retained `selectionStart/End` off a ref, then
  restores the caret) — unlike the Quotes paste, which overwrites the whole field. Local overlay
  modelled on `Calendar` (not the route-based `Sheet`) since it's a sub-modal of the Entry form.
- **CSV import** gained `notes` as the **right-most**, nullable, multi-line column in both
  `shows-import.ts` / `books-import.ts` (the RFC-4180 `parseCsv` already handles quoted newlines) plus
  the template CSVs and import guides. +3 pure-helper tests (notes parse + carry-through) → **507**.
- No component test (node-env, pure-helpers-only convention — same as prior passes). Verified by
  `npm run check` (507 tests).

## Net Worth — Funds, Insurance, Settings & Dashboards (2026-06-28)

Major Net Worth enhancement. Behavior/data are now in `05_networth.md` (spec of record); the durable
constraints live in `02_tech_spec.md` (**F19** nested-embed catalogue load, **F20** complete manual
import) and `03_global.md` (new profile columns). Source plan: the (now-deleted)
`05-network-enhancements.md`.

- **Schema (`03_networth_schema.sql`, edited in place):** renamed asset type `mutual_fund` → `fund`;
  added the insurance catalogue — `insurance_policy` (provider/number unique per user, currency,
  notes, surrender fields), `insurance_schedule` (kind `original|update`, `first_year`,
  `effective_date`), `insurance_schedule_point` (real values only; child tables use parent-`EXISTS`
  RLS). New `04_networth_profile_settings.sql` adds `networth_visible_asset_types` /
  `networth_asset_type_order` / `networth_bulk_insurance_import_enabled`. **All migrations 04–14 were
  renumbered → 05–15** (to slot networth profile settings at 04), and **all `.md` docs renamed
  dashes → underscores** (SQL filenames stay underscored to keep the Supabase version parser happy);
  every reference updated. Owner reset + `npm run gen:types` regenerated `database.ts`.
- **Insurance model (`src/lib/networth.ts`):** age-based resolution — `resolvePolicyAtAge`
  (newest-effective version with `first_year ≤ age`, value-at-age or nearest-earlier "as of yr N"),
  `originalCashValueAtAge`/`varianceAtAge`, `breakEven` (incl. "≤ first tracked year"),
  `surrenderGainPctPerYear`, `buildResolvedSeries`, `ageForYear` (birth year from `profile.birthday`,
  default 1974). **Version identity is the schedule row id**, not the date — `effective_date` is an
  editable attribute, so a typo'd date is fixed in place, not by spawning a phantom version.
- **Parsers (+ tests):** `fund-import.ts` (JPM "My Portfolio" — currency-prefix/comma strip, NAV+date
  split incl. embedded newline, footer stop), `insurance-import.ts` (wide bulk seed — provider
  carry-forward, skip-unnumbered, drop trailing totals; narrow single-policy key/value header).
  `networth-import.ts` restricted to manual types (rejects fund/insurance).
- **Data (`src/data/insurance.ts`):** catalogue CRUD; schedule add/replace/delete with
  earliest-remaining → Original promotion; surrender/clear; batched bulk upsert. `listCatalogue` /
  `getPolicyWithSchedules` use **one nested-embed query** (F19). `asset-entry.ts` gained
  `entryToInput`, `replaceAssetTypeEntries` (fund overwrite), and `saveManualImportComplete` (F20 —
  manual import freezes insurance + carries funds so the snapshot is complete).
- **Screens:** Monthly Entry rework (collapsible asset sections, header/exchange-rate restyle,
  copy-forward = manual clone / fund placeholder / insurance re-resolve, read-only fund + insurance
  sections with detail drill-ins); Insurance Policies browse (mirrors Medical Reports); New/Edit
  Insurance (mandatory provider/number/currency, Notes, inline SURRENDER + inline-confirm
  Un-Surrender, SCHEDULE table with editable effective_date + delete, local add/replace import
  overlay); Net Worth Settings + Visible Asset Types sheet; Fund & Insurance importer sheets; Fund &
  Policy detail sheets; dashboard Fund Performance card + Insurance aggregate card with a lazy
  cash-vs-premiums chart. Cross-module Settings import labels standardized (incl. Medical
  "Import JSON").
- **Bug fixes this pass:** manual import was wiping not-yet-frozen insurance (→ F20); catalogue loads
  were 3 sequential queries → slow on free tier (→ F19); Monthly Entry now live-resolves insurance for
  any snapshot lacking it.
- `database.ts` was bridge-edited during the build (no DB access mid-session), then regenerated
  authoritatively after the owner's `db reset --linked`. Verified by `npm run check` (**527 tests**).

## Books matching — CJK-safe, author-aware, shared by importer + search (2026-06-28)

Importing 32 Chinese titles surfaced inconsistent matches between the bulk importer and the New/Edit
search. Root cause was **selection bugs, not missing records** (Google Books has the titles). Behavior
is in `07_books.md` (External APIs → Matching) + `02_tech_spec.md` (Chinese search). No schema/RLS/data
changes.

- **Bug 1 — every Chinese title looked like an exact match.** The importer's ok/`review` check used an
  ASCII-only `norm` (`/[^a-z0-9]+/`), which strips all CJK → both sides became `''` → status was
  **always `ok`**, so wrong Chinese matches were never flagged. **Bug 2 — divergent selection:** the
  importer took the raw Google `results[0]` while the search box applied `rankSearchResults`. **Bug 3 —
  no author scoring:** same-title records with the wrong author (e.g. 张宏杰 books returned under 张敞)
  were picked by both. **Doc drift:** `07_books.md` claimed a `q=title+inauthor:author` query that the
  code never used.
- **Fix (all in `src/lib/books-api.ts`, pure + unit-tested):** a shared CJK-safe `normMatch` (`foldZh`
  fold/lowercase, then strip whitespace + ASCII/CJK punctuation, keeping ideographs); `titleTier`
  (exact > bidirectional-prefix > contains > none); `splitAuthorInput` + `authorMatches` (fold-aware,
  length-guarded containment, comma/`、`/`/`-split multi-author); an **author-aware**
  `rankSearchResults(results, { title, author? })` (title tier → author match → year desc → stable);
  and `isConfidentMatch` for the importer's ok/`review` decision.
- **Wiring:** `ImportBooksSheet.resolveRow` now ranks the hits (not raw `[0]`) and flags `review` via
  `isConfidentMatch`; its "Change" search is seeded with `title author` + an `authorHint`.
  `BookSearchSheet` gained an `authorHint` prop (ranking only, doesn't change the typed query);
  `BooksEntry` passes the draft author. Both flows now resolve a book identically.
- **APIs unchanged:** kept Google → Open Library **fallback-only** (no always-merge — owner decision, to
  spare the keyless quota). **HKPL/parse.bot** as a third Chinese source was evaluated and **deferred**
  (CORS-uncertain for a backend-less app, US$30/mo for usable quota, sparse metadata, scraper
  fragility) — see `PARKED.md`.
- Verified by `npm run check` (**545 tests** — +18 for `normMatch`, `splitAuthorInput`/`authorMatches`,
  the new `rankSearchResults` signature incl. the 文化苦旅/张宏杰 cases, and `isConfidentMatch`).
- **Follow-up — importer `Manual` button:** each preview row gained a **Manual** action beside
  **Change** that clears the match (status `manual`) so the row imports with the CSV title/author and no
  Google Books link — for titles no search hit covers. `buildImportRow(input, null)` already handled the
  null-match case, so this is UI-only.

## Shows `Manual` import button + purple "Want" chip (2026-06-28)

Two small UI parity/polish changes across the media modules. Behavior is in `06_shows.md` /
`07_books.md` / `01_design_system.md`. No schema/data changes.

- **`Manual` button on Shows import** (mirrors the Books importer): each preview row gained a **Manual**
  action beside **Change** that clears the match (new `manual` status) so the title imports with the CSV
  title/metadata and no TMDB link — for titles no search hit covers. `buildImportRow(input, null)`
  already guards every field with `match?.`, so this is UI-only.
- **Purple "Want" chip** (was blue): added a dedicated `--color-plan: #a779e0` design token and pointed
  `SHOW_STATUS_CHIP.want` / `BOOK_STATUS_CHIP.want` / `TRIP_STATUS_CHIP.want` at `bg-plan`. Each module
  reads the chip from these centralized maps, so it changes on **every** screen (Dashboard shelves,
  Library rows, importer preview). Applied to Shows/Books first, then **Travel** in the same pass; `info`
  (blue) is now unused for status chips.

## Shows import — title/year ranking + pre-seeded Change (2026-06-28)

The Shows importer mis-resolved common titles the way the Books importer used to (before the CJK fix).
Behavior is in `06_shows.md` + `templates/shows-import-guide.md`. No schema/data changes.

- **Bugs:** (1) the importer took the raw TMDB `results[0]` with an ASCII-only equality check — no
  ranking — so the correct hit buried at #2/#10 was never picked (`Girls` lost to `Gilmore Girls`,
  `The Chair` to `The Chair Company`, etc.). (2) A CSV title carrying a trailing `(YYYY)` disambiguator
  (`Beyond (2017)`) was searched **literally**; TMDB returns nothing for that, so the row flagged
  **No match**. (3) The "Change" search opened **blank** (the Books importer pre-seeds it).
- **Shared primitives:** extracted `normMatch` + `titleTier` from `books-api.ts` into a new pure
  `src/lib/title-match.ts` (re-exported from `books-api` for its callers/tests) so the TMDB client can
  reuse them without coupling Shows↔Books.
- **TMDB matching (`tmdb-api.ts`, pure + unit-tested):** `parseTitleYear` (splits a trailing `(YYYY)`),
  `rankTitleResults({ title, year? })` (title tier → closeness to the hinted year → year descending,
  stable), and `isConfidentTitleMatch` for the ok/`review` decision.
- **Wiring:** `ImportShowsSheet.resolveRow` searches the clean title, ranks (not raw `[0]`), and flags
  `review` via `isConfidentTitleMatch`; its "Change" opens pre-seeded with the clean title + a year hint.
  `TitleSearchSheet` gained a `yearHint` prop and now ranks its results (also tolerating a typed
  `(YYYY)`); `ShowsEntry` passes the draft year. The Books importer's identical `Manual`/ranking work
  from earlier this day stays unchanged.
- Verified by `npm run check` (**555 tests** — +10 for `parseTitleYear`, `rankTitleResults`, and
  `isConfidentTitleMatch`; the relocated `normMatch`/`titleTier` keep their existing `books-api` tests).
- **Follow-up — preview sorts to-fix rows first:** both importers sort the resolved rows once (No-match
  → review → resolved, stable on CSV order) before `setResolved`, so the rows needing attention sit at
  the top. Sorting the underlying array (not just the display) keeps the Change/Manual row indices valid;
  freezing it at resolve time means rows don't reshuffle as the owner fixes them. UI-only.
- **Follow-up — author beats wrong-author exact title + honor the picked result (Books):** two
  author-matching bugs surfaced on 张宏杰 titles. (1) `rankSearchResults` sorted **title tier first**, so a
  wrong-author _exact_ title (`坐天下` by 张敞) beat the right-author _prefix_ title
  (`坐天下：张宏杰解读中国帝王` by 张宏杰); when an author is known it now orders has-overlap → author →
  tier → year (a no-overlap result still never floats up on author alone). (2) `getBookDetails` rebuilt
  everything from Google's volume record, which can list a different author than the picked search
  snippet — so manually selecting the 张宏杰 row repopulated 张敞; it now carries the selected result's
  author/year/cover (mirrors the Open Library path) and only enriches description/genres/etc. from the
  detail. Also: the importer's "Change" `applyFix` no longer **silently** swallows a failed re-fetch
  (e.g. a 429) — it surfaces a message so the wrong match isn't left in place unnoticed. +2 tests (555 → 557).

## Medical — result-card grouping + "Review" lifecycle + delete-nav (2026-06-28)

Reworked the shared Medical result-card editor (Add/Edit Report + Import review) and turned the
persisted `uncertain` flag into a self-clearing "needs review" marker. Behavior is in `09_medical.md`.
No schema/migration — the `uncertain` boolean is unchanged; only how it's raised, shown, and cleared.

- **Section grouping (Edit + Import):** both result lists now render cards under uppercase **category
  headers** (the read-only Report screen's grouping), via a new generic `groupResultsByCategory` in
  `medical-order.ts` (replaces the private copy in `MedicalReportDetail`). Both call
  `orderResultsForDisplay` first; the import review gained `useProfile` so it uses the owner's order.
  The per-card category badge is gone for matched rows (the header carries it); a **custom** row keeps
  its category `SelectMenu` (it picks the row's group).
- **One-line inputs:** `MedicalResultCard` puts **Value · Unit · Flag** on a single row.
- **"Uncertain" → "Review" lifecycle:** the manual toggle is removed (the owner never set it by hand).
  `uncertain` is now raised by the AI file flag **OR** an app-side rule in `medical-import.ts`
  (`makeResult`): a **numeric** test that imported with no number, or a name that matched **no**
  reference test. A flagged card is **accent-tinted** (`bg-accent/10` + accent border) and shows
  **`Review – <reason>`** (accent) as its last row + a **Mark Reviewed** pill button (`bg-input` accent,
  matching the Shows importer's controls); **editing any field also clears it** (the card's `edit`
  wrapper). The read-only Report detail tints the row and shows the same `Review – <reason>` marker (no
  button) so an unresolved value is visible before tapping Edit. Reason is **derived** from row state
  (`medicalReviewReason` in
  `medical.ts`) — works on parsed/draft and saved rows alike, so nothing extra is persisted. Import
  review counts now read **"· N to review"**.
- **Delete-nav fix:** deleting a report from Edit Report `navigate(-1)`'d back onto its own now-deleted
  read-only detail ("Couldn't load this report"); it now lands on the **Reports list**
  (`routes.medical.reports`).
- Verified by `npm run check` (**566 tests** — +9 for `groupResultsByCategory`, `medicalReviewReason`,
  and the import app-side review rule).

## Net Worth — configurable insurance providers + CNY currency (2026-06-29)

Made the insurance **provider** list owner-configurable (it was a hardcoded `chubb`/`boc`/`manulife`
enum) and allowed **CNY** as an insurance + fund currency. Behavior is in `05_networth.md`; the new
profile column is in `03_global.md`.

- **Providers → the Quotes/Travel configurable-list pattern.** New `src/lib/insurance-config.ts`
  resolves `profile.insurance_providers` (JSONB `{key,label,defaultCurrency}[]`; **NULL = the seed
  defaults** still in `src/lib/networth.ts`) tolerantly — orphan keys fall back to the raw key. New
  **Net Worth → Settings → Manage Providers** sheet (`InsuranceProvidersSheet`) reuses the shared
  `ConfigListEditor`; it gained one optional generic `rowExtra` render-prop so each row can edit the
  provider's **default import currency** (a per-row `SelectMenu`). Delete is gated by
  `countPoliciesByProvider` + `reassignProvider` (data/insurance), mirroring Quotes/Travel.
- **Migration (edited in place, owner re-runs `db reset`):** `03_networth_schema.sql` **drops the
  `provider` CHECK** on `insurance_policy` (provider is now an app-validated key, like
  `quote.source_type`) and **widens the `currency` CHECK** to `('HKD','CNY','USD')`;
  `04_networth_profile_settings.sql` adds `insurance_providers jsonb`. Types hand-edited in
  `database.ts` pending the owner's `gen:types`.
- **Enum removed everywhere:** entry dropdown + default, policy list filter/label, `PolicyDetail`
  (now takes a resolved `providerLabel`), Monthly Entry freeze-sort + grouping (by configured order,
  orphans last), and both CSV importers (`providerKey()` → `matchKeyOrLabel` against the configured
  list; an unknown provider skips its block until added in Settings).
- **CNY:** literal `'HKD' | 'USD'` widened to the shared `Currency` type across the insurance entry,
  bulk-import, and parser; both `CCY_OPTIONS` dropdowns now list HKD/CNY/USD. The insurance **freeze**
  FX (`buildResolvedInsuranceEntries` / `saveManualImportComplete` in `asset-entry.ts`, and
  `buildInsuranceAgg` in `NetWorthDashboard`) now takes `{usd,cny}` rates (sourced from the existing
  `fetchRatesToHkd`, which already returns both) instead of a single USD rate. Funds (`fund-import.ts`)
  accept a CNY base currency (still FX-free — Total Value is already HKD).
- Verified by `npm run check` (**575 tests** — +9 for `insurance-config` + CNY import/fund cases).

## Net Worth — insurance/fund UI polish + break-even fix + gain/loss colors (2026-06-29)

UI/correctness pass across the insurance + fund + dashboard surfaces. Behavior is in `05_networth.md`.

- **Break-even bug fix (durable):** "Past break even" read true for _every_ policy that would ever
  break even, because `breakEven` scans the whole resolved series (incl. future ages). New
  **`hasBrokenEven(schedules, age)`** (`networth.ts`) gates on `breakEven.age ≤ age`; the Policies
  badge/filter and the Dashboard count now use the **current age**. `applyInsuranceView` takes a
  `currentAge` arg.
- **Policies row badges:** Surrendered → grey `StatusChip` (`bg-track`), **Past Break Even** → teal
  (`bg-positive`), mirroring Shows Library Dropped/Watched (provider stays a plain text tag).
- **Gain/loss color (`gainLossClass`)**: teal positive / red negative / muted zero, applied to fund
  Return Rate (Monthly Entry, Fund detail, Dashboard) and Surrender Gain %/Yr (Policy detail + both
  schedule tables). Allocation %s (By-asset-type share) stay neutral.
- **New/Edit Insurance**: header import action renamed **Schedule**; Provider+Currency aligned
  (equal-height control wrappers); Policy Number + Start Date share a line; Notes → 2 rows;
  **Mark Surrendered / Un-Surrender** are now pill buttons; SURRENDER fields reordered to **Surrender
  Date** + **Surrender Effective From** (renamed from "Surrender Month", parens dropped) on one line,
  with the date auto-syncing Effective From (overridable); **Actual Proceeds** drops the currency
  suffix; the SCHEDULE row leads with the editable effective-date, then version dropdown, then delete;
  unset dates read "Set date" (muted). SCHEDULE tables (Entry + Policy detail) add a **GAIN %/Yr**
  column; PolicyDetail's "Resolved schedule" → **SCHEDULE** and break-even "age N" → "Age N".
- **Monthly Entry**: each asset-type card gets a colored border (`ASSET_TYPE_COLORS`, same palette as
  the Dashboard dots); **Import CSV** + the Fund import icon are now **accent**; the local Fund modal
  reserves the top safe-area inset (was overlapping the status bar). Fund detail Total Value shows
  `HKD 1,234` (space) and priced-as-of as `YYYY-MM-DD`.
- **Dashboard**: root is `min-h-full flex flex-col` so the "No entries yet" empty state centers.
- Verified by `npm run check` (**575 tests**, no count change — UI/logic-only).

## Net Worth — insurance follow-up fixes (render loop, fund modal, small tweaks) (2026-06-29)

Follow-up review passes on the insurance/fund surfaces. Behavior is in `05_networth.md`; the durable
deps-stability lesson is in `02_tech_spec.md` (F4).

- **Infinite render loop fix (durable, F4):** New/Edit Insurance threw "Maximum update depth
  exceeded" (and `ERR_INSUFFICIENT_RESOURCES` on Edit — the loop fired unbounded fetches and exhausted
  the browser's per-host connection pool). Cause: `providers = effectiveProviders(profile?…)` builds a
  **fresh array every render**, and it was in `loadFn`'s `useCallback` deps → `loadFn` changed every
  render → `useAsync`'s effect re-ran + `setState`'d every render. Fixed by **`useMemo`**-ing
  `providers` (the guard `NetWorthEntry` already had). Pre-existing since the configurable-providers
  commit; not introduced by this session's UI work.
- **"Slow Insurance Policies load" investigated → no code change:** `listCatalogue` is a single nested
  query with the right indexes + stable `useAsync` deps; the slowness was the connection-pool
  exhaustion above, gone once the loop was fixed.
- **Fund detail modal parity:** the Monthly Entry local modal now closes on **Esc + Backspace**
  (`useEscapeKey` + a Backspace listener) like the routed `Sheet` (Esc + browser-back); shares only
  the `FundDetail` body. **Profit / Loss** now uses `gainLossClass` (green/red).
- **Monthly Entry:** an expanded **empty** asset-type section shows **"Nothing logged."** (Diary
  group pattern).
- **New/Edit Insurance tweaks:** Provider dropdown narrowed so the 3-option Currency toggle stops
  overflowing the right edge; **Mark Surrendered / Un-Surrender** pills → **accent** text; **Actual
  Proceeds** input gained `.no-spinner`; SCHEDULE Effective Date button height matched its dropdown
  (later subsumed by the field-control standardization below).

## App-wide form-field standardization (2026-06-29)

Made `.field-control` the single source of truth for field height/chrome and rolled it out across
**every** module so inputs, dropdowns, segmented controls, date buttons and filter fields share one
height. Behavior/tokens in `01_design_system.md`.

- **`.field-control`** (index.css, `@apply`) now backs all `inputClass`/`inputCls` constants and the
  inline field strings in: Wellness (NewFood, NewActivity, ActivityLog, FoodDetail, VisibleNutrients,
  WellnessSettings/ProfileMetrics), Net Worth (Monthly Entry — **de-compacted** from `px-2 py-1.5`,
  Insurance, ImportFund, ImportNetWorth), Travel (TripBuilder, TripExpensesPanel, ExpenseEditor,
  StopEditor, CitySearch), Shows/Books/Quotes entries, Medical (Entry, ImportMedical, MedicalResultCard),
  and shared `ConfigListEditor` (Settings lists) + `NotesEditorModal`.
- **Shared field components aligned to it:** `SelectMenu` **default → `size="field"`** (one change
  standardizes every form/filter/sort dropdown; `size="compact"` is the new opt-out), `DateRangeRow`
  buttons → `.field-control`, `SearchBar` already matched. `SegmentedTabs` keeps a `size` prop (field
  used by Insurance Currency).
- **Field labels** unified to **`text-xs` (12px)**: fixed `MedicalResultCard`'s `text-[11px]`
  Value/Unit/Flag/Result text/Reference Range labels (the reported "smaller than the rest" case).
  Section labels (11px UPPERCASE) and `text-tertiary` captions intentionally unchanged.
- Left as-is (already field-height or non-field): Search/refresh **action buttons** (Shows/Books/Quotes
  entry, ConfigListEditor Add), dashboard range pickers, `PinInput`, `TagInput` chip well, `SearchBar`.
  The owner will flag any screen that should be re-compacted.
- Verified by `npm run build` (CSS `@apply` compiles) + `npm run check` (**575 tests**).

## Medical Dashboard — latest-values row layout fix (2026-06-29)

- **Bug:** in the Dashboard's "Latest values by category" rows, a long printed reference range
  (e.g. the Total/LDL-Cholesterol ranges) **hid/3-char-truncated the test name and pushed the value
  off the right edge**. The View Report's rows were fine.
- **Cause:** `LatestRow` put the value **and** the ref together in the `shrink-0` right column, so the
  un-wrapping ref forced that column wide. Fix: name + wrapping ref in the `min-w-0 flex-1` left column,
  value-only in `shrink-0`, `items-start`.
- **Extracted to a shared `MedicalValueRow`** (`src/components/MedicalValueRow.tsx`) so the Dashboard
  `LatestRow` and the View Report `ResultRow` share one layout (the report passes `leftExtra` for the
  "normalized from…"/Review lines and `rightExtra` for the flag label; ref prefix unified to `Ref:`).
- Pure layout/refactor; no test impact (**575 tests**).

## Calendar date picker — streamlined interaction (2026-06-29)

Reworked the shared `Calendar` (used by every module's date fields/filters). Behavior in
`01_design_system.md`.

- **Header:** an **X (top-left)** cancels (frees the corner); the `‹ month ›` cluster is **centered**
  with the arrows pulled in tight against the label.
- **Tap-to-commit:** tapping a day fires `onSelect` and closes (every caller already treated `onSelect`
  as "date chosen" + close), so the **Cancel and OK buttons are gone**. **X / scrim / Esc / Backspace**
  all cancel (Backspace via a keydown listener, mirroring the fund modal).
- **Today** button is now **centered** at the bottom and only navigates the view to the current month's
  day grid (no pre-select/confirm step).
- **Day cues:** today = **white ring, no fill**; the previously-selected date (`day` prop) =
  **accent-filled** (both can apply). Dropped the internal `selected` state (selection is now the tap).
- Pure presentational change; no test impact (**575 tests**).

## iOS input-focus zoom fix (viewport lock) (2026-06-29)

- **Annoyance:** on iPhone, focusing a textbox (e.g. Travel Add Expense) made iOS Safari **zoom in**
  (sub-16px field font), and it **stayed zoomed** after saving / closing back to Edit Trip — the right
  edge clipped until a manual pinch-out.
- **Fix:** added `maximum-scale=1, user-scalable=no` to the `index.html` viewport meta. The standalone
  PWA honors it, so focus never triggers the zoom — **keeping the 15px field design** (vs the alternative
  of bumping every focusable control to 16px). Documented as **F21** in `02_tech_spec.md`. Trade-off:
  browser pinch-zoom is disabled (the Travel/Leaflet map has its own zoom controls).
- Config-only; no test impact (**575 tests**). Takes effect after a redeploy + reload of the PWA.
- _Superseded 2026-06-29 (see below) — the viewport lock disabled all pinch-zoom, so small text on a
  screen couldn't be magnified; reversed in favour of 16px focusable controls._

## iOS input-focus zoom — reverse the viewport lock, use 16px controls (2026-06-29)

- **Why:** the viewport lock (`maximum-scale=1, user-scalable=no`) above stopped the auto-zoom but
  also disabled **all** browser pinch-zoom — small text on some screens became impossible to magnify.
- **Fix:** prevent the auto-zoom at the **control** instead of the viewport. iOS only auto-zooms a
  focused field below 16px, so:
  - `.field-control` (`src/index.css`) → `text-[16px]` (was 15px) — the shared field that nearly every
    input/select/textarea flows through.
  - The two inputs that bypass it (their chrome is on a wrapper) set `text-[16px]` directly —
    `SearchBar`, `TagInput` (found via a full scan of focusable text controls).
  - `index.html` viewport: dropped `maximum-scale` / `user-scalable=no` → **pinch-zoom re-enabled**.
- 15px→16px is visually negligible; the F21 note + design-system doc now require **≥16px** for any new
  focusable text input. Renumbered the iOS-zoom note **F17 → F21** (it collided with the `errorMessage`
  F17). No test impact (**602 tests**). Takes effect after a redeploy + reload of the PWA.

## Books import — distinguish Google Books per-day quota from a burst 429 (2026-06-29)

- **Symptom:** a 32-book CSV that imported fine for days suddenly returned **"No match" for every row**
  with **"Rate-limited by Google Books"** — despite `VITE_GOOGLE_BOOKS_API_KEY` set locally + on Vercel
  and the key's referrer/API restrictions unchanged for weeks.
- **Diagnosis (curl against the live API with the real key + an allowlisted `Referer`):** a genuine
  `429` — `Quota exceeded ... limit 'Queries per day'` attributed to the owner's own project. **Not** a
  config issue: the key works; the project's **default 1,000 `Queries per day`** was exhausted. Cause:
  the importer re-matches **all** rows on every upload (no cache) and **each CJK title costs 2 queries**
  (`searchZhVariants` = Simplified + HK-Traditional), so repeated re-imports (the owner was truncating
  `book` / `supabase db reset --linked` to re-test) crossed the daily cap. The old code's 429 backoff
  **retried** — its comment assumed "recovers in a second or two," true for a per-minute burst but
  **false for a per-day quota**, so it burned more of an already-exhausted quota.
- **Fix:** `BookSearchRateLimitError` now carries a **`daily`** flag, classified from the 429 body by
  the pure, unit-tested **`isDailyQuotaBody`** (`limit 'Queries per day'`). The importer **does not
  retry** a daily 429 — it **aborts the whole batch** (remaining rows → `No match`, still importable
  as-is) and shows `DAILY_QUOTA_MESSAGE`; a transient/per-minute 429 still backs off + retries. The
  Entry-form search + importer "Change" surface a distinct **`'quota'`** message ("resets at midnight
  US-Pacific; raise the project quota"). Docs: `07_books.md` (import + External APIs), `OWNER_RUNBOOK.md`
  Part C3 (the per-day-quota note).
- Verified by `npm run check` (**578 tests** — +3 for `isDailyQuotaBody`).

## Books import — persistent match cache (localStorage) + "Clear match cache" (2026-06-29)

- **Why:** the importer re-matched **every** row against Google Books on every upload, so the owner's
  test loop (truncate `book` / `supabase db reset --linked`, re-import the same 32-book CSV) re-spent
  ~64 queries each run and kept exhausting the per-day quota (see the prior entry).
- **What:** `src/lib/book-match-cache.ts` — a `localStorage` cache (one key,
  `wellworth:book-match-cache`, versioned) of resolved `BookMetadata`, keyed on
  `normMatch(title)|normMatch(author)` (Trad→Simp + case/space fold, so script/case variants share an
  entry). `resolveRow` checks it **before** the network (a hit skips search **and** details); positive
  matches are written back. **Change** overwrites the entry (correction persists across re-imports);
  **Manual** removes it (a rejected match is never re-served). Only positives are cached —
  no-match/timeout/quota-abort rows re-query next run. Writes are synchronous read-merge-write so the
  parallel workers can't clobber each other; a quota-exceeded write resets the cache to the one entry.
- **Crucially independent of the DB** — it's in the browser, so a truncate/`db reset` never clears it.
  Cleared via **Books Settings → Clear Import Match Cache (N)** (`clearBookMatchCache`), deleting the
  single localStorage key in DevTools, or a full "Delete data".
- **Docs:** `07_books.md` (Settings + Import match-cache), `02_tech_spec.md` (lib list), and a new
  **`OWNER_RUNBOOK.md` Part R** — a full browser-storage explainer (the three storage layers; the two
  "Delete data" paths; a wiped-by-Delete-data table; what "cached assets" really are vs DB data; when to
  clear; and per-key deletion to avoid logging out).
- Verified by `npm run check` (**587 tests** — +9 for `book-match-cache`).

## Importers — generalize the match cache + add it to Shows/TMDB (2026-06-29)

- **Why:** the Books match cache proved its worth; Shows re-imports (same `db reset` test loop) had the
  same wasteful re-resolve. TMDB has no per-day quota, so for Shows it's a **performance** win (instant
  re-imports), not a quota guard — still worth it for the test loop + UX consistency.
- **Refactor (DRY):** extracted the cache core into **`src/lib/match-cache.ts`** —
  `createMatchCache({ storageKey, version, keyFn })` → `{ key, get, set, remove, size, clear }` with the
  shared semantics (one versioned `localStorage` blob, synchronous read-merge-write so parallel workers
  don't clobber, quota-exceeded reset, tolerant reads). `book-match-cache.ts` is now a thin instance
  (public API unchanged — no call-site churn).
- **New:** `src/lib/show-match-cache.ts` — instance keyed on `type|normMatch(title)|year` (type
  distinguishes a movie vs TV show of the same name; year disambiguates remakes; the trailing `(YYYY)`
  is parsed off via `parseTitleYear` first). `ImportShowsSheet` checks it before TMDB, caches positives,
  **Change** overwrites, **Manual** removes. **Shows Settings** gets the same "Clear Import Match Cache
  (N)" button as Books.
- **Docs:** `06_shows.md` (Settings + Import match-cache), `07_books.md` (now an instance of the shared
  factory), `02_tech_spec.md` (lib list), `OWNER_RUNBOOK.md` Part R (both cache keys), and `PARKED.md`
  (removed the now-built deferral).
- Verified by `npm run check` (**596 tests** — +5 `match-cache`, +4 `show-match-cache`).

## Importers — shared preview list + fix the long-list scroll bug (2026-06-29)

- **Bug:** the Books/Shows import **preview wouldn't scroll** (couldn't reach matched/unmatched rows in a
  432-title import); Medical's scrolled fine.
- **Root cause:** Books/Shows wrapped their rows in an **`overflow-hidden` rounded card** that lacked
  **`shrink-0`**. `overflow:hidden` resets a flex item's `min-height:auto` to 0, so in the sheet's
  `flex-col` body flexbox **shrank the list to fit and clipped it** — the body never overflowed, so its
  `overflow-y-auto` never engaged. Medical's result rows are overflow-visible (`min-height:auto`), so
  they refuse to shrink, the body overflows, and it scrolls. This is the documented **F6c/F9** flex-scroll
  rule (design-system → Layout gotchas).
- **Fix + DRY:** the bug lived in copy-pasted markup, so extracted **`src/components/ImportPreviewList.tsx`**
  — the scroll-safe card (`shrink-0`) + the shared row (thumbnail · title/subtitle/meta · No-match/review/
  manual flag · Change/Manual). `ImportBooksSheet` and `ImportShowsSheet` now pass module-specific
  `media`/`subtitle`/`meta` and drop ~55 lines of duplicated row JSX each. One place to fix, and ready for
  any future importer.
- **Docs:** `01_design_system.md` (new component + the scroll-rule cross-link).
- UI/refactor only — no test-count change (**596 tests**).

## Wellness — bulk Food importer with USDA matching (2026-06-29)

- **Why:** the owner re-seeds foods after every `supabase db reset --linked`, but the old Wellness
  Library importer only created **custom** foods (no USDA). They wanted one CSV (USDA-findable + truly
  custom, not pre-tagged) matched against USDA like the Diary "Add Food → All" tab, flagged Books/Shows
  style, seeded as favorites.
- **Schema:** `food_importer_enabled boolean not null default true` added to the `profile` table
  **in `01_wellness_schema.sql`** (where the other wellness profile columns live — no separate settings
  migration; edit-in-place per the reset workflow). `database.ts` updated (owner re-runs `gen:types`
  after `db reset`).
- **Importer (`ImportFoodsSheet` reworked):** parse (existing `parseFoodCsv`, hybrid CSV, all-optional
  but `name`) → per-row `resolveRow` (cache → `searchFoods` + `foodMatchScore` → `getUsdaFood` detail) →
  `ImportPreviewList` preview (No-match/review sorted top; rows show **name + "{N} nutrients · {serving}"**
  like the live USDA list) → **Change** (`FoodSearchSheet` USDA overlay) / **Manual** (keep as custom) →
  `saveImportedFoods`. New `foodMatchStatus` (pure, tested): score 4 → ok, 1–3 → review, 0 → nomatch.
- **Save (`saveImportedFoods`, new in `data/food.ts`, replaces `importCustomFoods`):** every row a
  **favorite**; matched → `source='usda'` (per-100g USDA nutrients), unmatched/Manual → `source='custom'`
  from the CSV. **Idempotent** (USDA dedupe on external_id, custom on lower(name); bulk insert new + update
  existing). Servings via `replaceServings` for custom updates.
- **Match cache:** `src/lib/food-match-cache.ts` (a `createMatchCache` instance, key `normMatch(name)`,
  value = resolved `ExternalFood`) — re-imports skip USDA. "Clear Import Match Cache" button added to
  **Wellness Settings → Import**; the importer launcher **moved from Library to Settings** (behind the
  toggle), mirroring Books/Shows.
- **Reuse/DRY:** shared `externalFoodServing` extracted to `food-api.ts` (used by Add-Food, the importer,
  and `FoodSearchSheet`); `ImportPreviewList` gained optional `media`/`year` for the image-less food rows.
- **Docs:** `04_wellness.md` (Settings + Import CSV), `01_design_system.md` (FoodSearchSheet; ImportPreviewList
  ×3), `02_tech_spec.md` (lib list), `OWNER_RUNBOOK.md` Part R (food cache key), `templates/wellness-foods-*`.
- Verified by `npm run check` (**602 tests** — +4 `food-match-cache`, +2 `foodMatchStatus`).

## Medical — collapsible, color-accented sections + Latest Report button (2026-06-29)

The Report detail, Edit Report, and Dashboard latest-values were long, grey, monotone walls of
category cards. Made every lab-result section **collapsible and color-coded**. Behavior in
`09_medical.md`; component + palette in `01_design_system.md`.

- **New shared `MedicalSection`** (`src/components/MedicalSection.tsx`): a collapsible section with a
  **left** chevron (mirrors the Diary `GroupHeader`), a **per-category colored left stripe** + a
  **tinted header** (tint via `color-mix` at the boundary), default **expanded**, self-contained
  `useState`. `variant="card"` wraps the body in a `surface` card (Report detail rows, Dashboard
  latest-values); `variant="bare"` is the header bar only (Edit Report, whose `MedicalResultCard`s are
  already cards — avoids double-wrapping).
- **18-hue category palette** added to `index.css` `@theme` (`--color-med-general` … `--color-med-other`),
  surfaced as `MEDICAL_CATEGORY_COLOR` in `src/lib/medical.ts` (mirrors the existing `MEDICAL_FLAG_COLOR`
  raw-CSS-var pattern). One distinct hue per category so adjacent sections read apart.
- **Wired in:** `MedicalReportDetail` (`Body`), `MedicalEntry` (results grouping), and
  `MedicalDashboard` (latest-values) now render groups via `MedicalSection`; the dead
  `MEDICAL_CATEGORY_LABELS` imports were dropped from those screens. The Dashboard's **Recent reports**
  list stays on the plain `SectionCard` (not category-colored).
- **Latest Report button:** the Dashboard gained an accent-styled `Link` (`IconReportMedical`) directly
  under the Trends grid → the newest report's detail (`recentReports[0]`, newest-first), a shortcut the
  cross-report Latest-values list doesn't provide.
- Presentational only — no schema/type/data changes; reuses `groupResultsByCategory` /
  `orderResultsForDisplay`. Verified by `npm run check`.

## Close-control standardization — Report detail X/Esc + Backspace→Esc fix (2026-06-29)

Standardized drill-in close controls and **retired Backspace-to-close** (it was a mis-instruction in
earlier sessions — the intent was always **Esc**).

- **`MedicalReportDetail`** was the lone screen using a **back-arrow** (`IconChevronLeft`) hard-wired
  to `navigate(routes.medical.reports)`. Switched to the app convention: a top-left **X** (`IconX`,
  `aria-label="Close"`) + `navigate(-1)` + `useEscapeKey(() => navigate(-1))` — matching the read-only
  `PolicyDetailSheet` and the Add/Edit screens. `navigate(-1)` also **fixes the round-trip**: opening a
  report from the **Dashboard** (Recent reports / the new Latest Report button) now closes back to the
  Dashboard instead of always dumping onto the Reports list.
- **Backspace-as-close removed** from the two places that had it — the `Calendar` picker and the Net
  Worth Monthly-Entry fund modal — leaving the existing `useEscapeKey` (Esc) as the keyboard close.
  Comments + spec docs (`01_design_system.md` Calendar, `05_networth.md` fund modal) updated.
- **`TagInput` left unchanged:** its Backspace removes the last chip when the field is empty (standard
  tag-editor behavior, not a modal close) — unrelated to the close-key typo.
- Verified by `npm run check`.

## Custom servings for USDA/OFF foods + phantom-food cleanup (2026-06-29)

Let any food carry user-defined servings with a persistent default, and give the silently-created
USDA/OFF rows a delete path. Durable constraint distilled to **F22** (`02_tech_spec.md`); behavior in
`04_wellness.md` (Food Detail → Manage servings, Library, data model, USDA serving-grams).

- **Why:** a USDA result like "2 oz" pasta logged as "100 g" because only `servingSizeUnit === 'g'`
  was honored; and there was no way to log a USDA food as "1 cup"/"2 eggs" or to remove the `food`
  rows that favoriting/logging mint (Library only listed `source='custom'`, so cached rows were
  undeletable and lived forever).
- **Schema:** `food.default_serving_id uuid` (→ `serving`, ON DELETE SET NULL) added in
  `01_wellness_schema.sql`. **Circular-FK gotcha:** `serving.food_id → food`, so the column is
  declared inline on `food` but its FK is a separate `alter table … add constraint` **after** the
  `serving` table. Owner applies via `supabase db reset --linked`; `database.ts` hand-edited to match
  (regenerated on reset).
- **`usdaServingGrams`** (`food-api.ts`): converts weight serving units (`g`/`oz`/`lb`, rounded 0.1 g)
  so an `oz`/`lb` serving survives into Food Detail instead of falling back to 100 g. `ml`/`fl oz`
  stay null (no density) — the user adds a custom serving instead.
- **Food Detail** (`FoodDetailSheet`): on open, USDA/OFF resolves to the cached `food` row
  (`getFoodByExternal`) before the live API. New **Manage servings** editor (add/edit/delete + a
  default star) seeded from `food`; `servingsDirty`-gated persistence on ADD/heart/SAVE — Amount and
  per-log serving selection never write back. `replaceServings` now **returns** the inserted rows so
  `default_serving_id` is re-pointed by position.
- **Data layer:** `replaceServings` returns rows; `diary-entry.foodHasEntries(foodId)`;
  `food.deleteFoodSmart` (soft if referenced, else hard — servings cascade).
- **Add Food / Library:** All-tab dedupes the live twin of a cached external; Library Foods lists all
  foods (custom + cached USDA/OFF, tagged), swipe-delete via `deleteFoodSmart`, USDA/OFF rows open
  Food Detail to manage servings.
- No new pure helpers, so the test count is unchanged (**602**). Verified by `npm run check`.

## Food CSV import aligned to the serving model + `is_custom` fast-path (2026-06-29)

Follow-up to the custom-servings work: the bulk importer predated the new serving model. Behavior in
`04_wellness.md` (Import CSV); constraint extends **F22** (`02_tech_spec.md`).

- **Template** (`wellness-foods-template.csv`) — columns now ordered
  `name,type,is_custom,is_favorite,nutrient_basis,serving*…,default_serving,<nutrients>` (flags up
  front; `nutrient_basis` sits just before the servings/nutrients block and is **custom-rows-only** —
  blank/ignored for USDA). `is_custom` + `default_serving` are the new columns. Examples reworked (a
  USDA-matched Banana with a custom `1 medium` default + blank basis; `is_custom` granola/supplements).
- **`food-import.ts`** — `ImportFoodRecord` gains `is_custom` + `default_serving_name`; `default_serving`
  validated against the row's servings (else warn + null). `parseBool` is now the **lenient**
  `true/1/yes/y ⇒ true` (else false) shared with Books/Shows — no more "not true/false" warnings. New tests.
- **`ImportFoodsSheet`** — `resolveRow` short-circuits `is_custom` rows to a custom result (`manual`)
  with **no USDA/OFF call and no review**.
- **`saveImportedFoods`** — was discarding `serving*` for USDA rows; now `importServings` builds
  `[USDA serving] + [CSV servings]` and sets `default_serving_id` (CSV default → USDA serving →
  first). New rows resolve the default by walking the bulk-inserted servings by position, then set it
  in **one** bulk `food` upsert (full rows so NOT NULL holds; a partial upsert would null
  user_id/source/name on the INSERT attempt — F16a-safe). Existing rows overwrite via
  `applyImportServings` (USDA rows included now). `ImportFoodResolved.match` widened to carry
  `servingText`/`servingGrams`.
- **Regression fixed:** `FoodDetailSheet.ensureCachedId` now seeds a food's servings on first cache
  (shared `writeServings` helper with `persistServings`), so favoriting/logging a USDA food keeps its
  household serving instead of collapsing to "100 g" on reopen (Food Detail reads the cached row, not
  the API).
- Test count **605** (3 new `food-import` tests). Verified by `npm run check`.

## USDA multi-word match ranking — exact name first (2026-06-29)

`foodMatchScore` (the ranker shared by Add Food's list and the importer's `bestHit`) put an exact
multi-word name in the **same** tier as every longer variant, so the nutrient/alphabetical tiebreak
buried it: searching "Coffee, Latte" surfaced "Coffee, Iced Latte"/"…nonfat" above the exact hit, and
"…with salt" lost to "…without salt" (`with` prefix-matches `without`). Behavior in `04_wellness.md`
(Add Food ranking note).

- **Multi-word branch only** (single-word tiers untouched — the deliberate "bare BLUEBERRIES can't beat
  Blueberries, raw, nutrient count decides" design stays): exact full name → **5**, leading phrase → **4**,
  lead-word match → 2, tokens-present → 1. `foodMatchStatus` unchanged (≥4 ⇒ ok), so a multi-word exact
  import row is now **ok** instead of always **review**.
- 2 new `food-search` tests (Coffee/Latte ordering; with/without collision). Test count **607**.
  Verified by `npm run check`.

## Date format — one canonical `MMM DD, YYYY` everywhere (2026-06-30)

Date values displayed inconsistently — many screens showed a weekday + `Today/Yesterday`
(`formatDayLabel`, e.g. `Tue, Jun 30`). Standardized on **`formatFullDate`** (`MMM DD, YYYY`) for every
date value, with the lone exception of Shows/Books/Quotes **Dashboard + Library** rows (and the Shows
Dashboard "Started" line), which stay **`formatMonthDay`** (`MMM DD`, no year). Convention in
`01_design_system.md`.

- **`formatDayLabel`** kept but **de-weekday'd**: now `Today`/`Yesterday`/`Tomorrow` else
  `formatFullDate` (`MMM DD, YYYY`) — used **only** for the Wellness Diary nav/header + its copy toast
  (the one place relative day labels make sense). Its old weekday fallback (`Tue, Jun 30`) is gone.
- Repointed every other former `formatDayLabel` call site to `formatFullDate`: Edit Insurance dates,
  all filters (`DateRangeRow`), Daily Report, profile birthday, Shows/Books/Medical entry date pickers,
  and the Medical-import preview; the Shows Dashboard "Started" line → `formatMonthDay`.
- The Calendar's own month-grid header (`June 2026`) is unaffected. Test count 611. Verified by
  `npm run check`.

## Net Worth — Matured vs Surrendered insurance policies (2026-06-30)

Insurance policies could only be **surrendered**; policies that **mature** (reach term, pay out, stop
counting) were indistinguishable. Generalized surrender into **termination** with a kind discriminator,
auto-detected maturity on import, and surfaced a Matured filter/badge + Mark Matured flow. Behavior in
`05_networth.md`; format in `templates/insurance-import-guide.md`.

- **Schema** (`03_networth_schema.sql`, edit-in-place): renamed `surrender_*` → **`termination_kind`**
  (`surrendered|matured`, CHECK) · **`termination_date`** · **`termination_effective_date`** (renamed
  from `surrendered_from_month` — it stores a full date) · **`termination_proceeds`**, in that order,
  - a CHECK tying `termination_effective_date` and `termination_kind` (set/cleared together).
    `database.ts` hand-edited; owner regenerates on `db reset`.
- **Exclusion** (`asset-entry.ts` + `NetWorthEntry.tsx`): a policy drops out of the monthly total from
  `termination_effective_date`'s month — kind-agnostic, so matured policies exclude exactly like
  surrendered ones.
- **Import** (`insurance-import.ts`): pure **`detectMaturity`** (schedule ends before the owner's
  current age ⇒ Matured; proceeds = last cash value; date = start month/day + `start_year + last
policy_year`). Bulk format gained a **notes row** (provider · name · number:date · **notes** ·
  sub-header · data); single format gained a `Notes,` line. Both take `currentAge` (from
  `profile.birthday`); `ImportInsuranceBulkSheet`/`InsuranceEntry` pass it. `upsertBulkPolicies` now
  stores notes + termination.
- **Data layer:** `setSurrender`/`clearSurrender` → `setTermination`/`clearTermination`.
- **Policies screen:** search adds **notes**; the standalone "Surrendered Only" toggle replaced by an
  **All/Matured/Surrendered** `SegmentedTabs` (`criteria.status`, schema-drift-merged); blue **Matured**
  badge (`bg-accent`). `insurance-view` filters on `termination_kind`.
- **Edit screen:** grey **Mark Surrendered** + blue **Mark Matured** open a shared **Surrender/Maturity**
  section (auto-synced effective date, proceeds, kind-specific helper); mutually exclusive; Un-mark
  clears all four fields. Single-import auto-maturity reflected into the draft + persisted.
- 4 new `insurance-import` tests (notes row, bulk maturity, in-force, single notes+maturity). Verified
  by `npm run check`.

## Net Worth section colours + Fund detail formatting (2026-06-29)

Cosmetic/UX pass; no schema. Behaviour in `05_networth.md`; date helpers in `01_design_system.md`.

- **`ASSET_TYPE_COLORS`** (`networth.ts`) re-hued so **consecutive** asset types contrast (green →
  blue → gold → purple → orange → rose → grey): `stock` blue → **gold** (was a 2nd blue next to
  `time_deposit`), `insurance` red → **rose** (was next to `retirement` orange). One map drives the
  Dashboard dots, Monthly-Entry sections, and the trend chart, so all surfaces stay in sync.
- **Monthly Entry asset-type sections** switched from a full colored border to the `MedicalSection`
  pattern — **4px left stripe + `color-mix … 14%` tinted header**.
- **`FundDetail`** — fund-coloured 4px left stripe; HKD amounts now `HK$1,234` via `formatHkd`
  (matching Dashboard / Monthly Entry; non-HKD base ccy keeps `CODE 1,234` + decimals); priced-as-of
  date now `Jun 25, 2026` via the global **`formatFullDate`** (was `YYYY-MM-DD`).
- **Date helpers documented** as the one source of truth in `01_design_system.md` (use `formatFullDate`
  for MMM DD, YYYY everywhere with a year; `formatMonthDay` stays year-less for Shows/Books/Quotes).
- **Dashboard** "By asset type" + "Fund performance" % columns set to a shared **`w-12`** (down from
  `w-16`) — aligned across both cards and narrower so the **name** column gets more room and the HKD
  value column shifts right.
- **SAVE-enablement fix (`needsFreeze`)** — a saved month with **live-injected insurance** (snapshot
  had none frozen, e.g. from the manual CSV import) left the form not-`dirty`, so SAVE was disabled and
  the live total (incl. insurance) could never be frozen — the Dashboard (saved snapshot) read lower
  and couldn't be reconciled. The loader now flags `needsFreeze` when displayed rows differ from
  persisted (injected insurance, or a brand-new copy-forward month); `canSave = dirty || needsFreeze`,
  cleared after SAVE. This was the root of the earlier "June Dashboard ≠ Monthly Entry total" gap.
- No test changes (cosmetic + UI-state). Verified by `npm run check` (607 tests).

## Monthly Entry — month persistence + row layout tweaks (2026-06-29)

Small UX fixes; no schema. Behaviour in `05_networth.md`.

- **Import no longer resets the month** — the entry's `month` moved from `useState` to
  **`useSessionState`** (key `networth-entry-month`). The background-location tab is re-rendered from
  `AppShell`'s static `TAB_FOR_PATH` element map, so opening an Import sheet (manual or fund) over the
  entry **remounted** `NetWorthEntry` and reset month to the current one; sessionStorage survives that.
  A fresh tab still defaults to the current month.
- **ManualRow** (Cash / Time Deposit / Stock / Retirement / Property) — **Value** box `w-20 → w-24`
  (fits a 7-figure amount); row right padding `pr-2 → pr-1` so the trash sits closer to the edge; the
  Time Deposit **Maturity Date** detail field `w-24 → w-40` so a full date (`2027-06-15`) isn't clipped.
- No test changes (UI-state + layout). Verified by `npm run check` (607 tests).

## Typography standardization + Dynamic Type (2026-06-30)

Readability + a user-adjustable text/icon size. New durable constraint: **F23** (`02_tech_spec.md`).
i18n (English / 繁體中文) was scoped and **deferred** — see `PARKED.md`.

- **Readability fix (Phase 0):** lightened `--color-text-tertiary` `#5b6172 → #7a8294` (hints/disabled
  were too dim for the owner); standardized **placeholders to `text-text-secondary`** app-wide (baked
  into `.field-control`; `SearchBar`/`TagInput`/`PinInput` set it directly) and dropped the per-field
  `placeholder:text-text-tertiary` overrides — fixes the "some placeholders unreadable, one readable"
  inconsistency on New Show etc.
- **One type scale (Phase 1):** added rem `--text-*` tokens to `@theme`
  (`title/heading/field/body/label/caption/section`) as the single source of truth, with documented
  role recipes in `01_design_system.md`. Migrated **all ~730 hardcoded sizes** (`text-[Npx]`,
  `text-xs/sm/lg`) to role tokens; no `text-[…px]` font sizes remain. Tokens are `rem` so they ride a
  scale lever.
- **Dynamic Type (Phase 2):** one `data-font-scale` attribute on `<html>` sets `--font-scale`
  (default / `large` 1.15 / `larger` 1.30); root `font-size: calc(16px * var(--font-scale))` grows all
  rem (text, padding, gaps); a `.tabler-icon` `transform: scale()` keyed off the same attribute grows
  every icon (no per-icon churn; box unchanged → no wrap pressure). Presets ≥ 1 keep inputs ≥ 16px
  (F21). Stored in **`profile.font_size`** (migration `01_…schema.sql`, in place; types regenerated),
  mirrored to localStorage; boot script in `index.html` applies it pre-paint, `useFontSizeSync`
  reconciles from the profile. New **Settings → Display → Font Size** control (`font-scale.ts`).
  `FieldRow` now `flex-wrap`s so values drop to their own line at a larger preset.
- No new tests (CSS/DOM plumbing); pure-helper count unchanged at **611**. Verified by `npm run check`
  - a production build (asserted the scale-lever and icon-transform CSS emit).

## Small UI fixes — Diary % + Travel stop icons/fonts (2026-06-30)

Two quick enhancements; no schema, no tests. Behaviour in `04_wellness.md` + `10_travel.md`.

- **Diary highlighted nutrients show the %:** added a **`compact`** prop to `NutrientBar` that drops
  the "value / target unit" text (name + % only); the Diary's 2-col highlighted-nutrients grid passes
  it so the % is no longer crowded out by the full nutrient name. Matches the long-standing spec wording
  ("name, % of target, bar"); the other `NutrientBar` consumers (`FoodDetailSheet`, `NutrientReport`)
  are unaffected.
- **Travel Edit-Trip readability + stop-type icons:** the day **date chip** and **city sub-headers**
  bumped from caption size to **`text-body`**; each itinerary stop row now leads with a Tabler
  **stop-type icon** via the new shared **`StopTypeIcon`** (Travel=train, Visit=camera,
  Eat=bowl-chopsticks, Shop=brand-shopee, Stay=bed, Other=category) replacing the type **text** — the
  type is preserved in the row's `aria-label`. (Both later rode the Dynamic Type role-token migration.)

## Travel expenses redesign — day-level entry + inline ledger (2026-06-30)

Log expenses **as incurred per day**, review/edit the whole trip's expenses **grouped by date**, and
enter several at once spreadsheet-style — replacing the one-at-a-time modal. Behaviour in
`10_travel.md`; the shared editor in `01_design_system.md`; lifted-state note in `02_tech_spec.md` (F16b).

- **One schema change** (`14_travel_schema.sql`, edited in place per the owner reset workflow):
  `trip_expense.sort_order INT NOT NULL DEFAULT 0` (manual order within a `(trip_id, expense_date)`
  group) + the `(trip_id, expense_date)` index widened to `(trip_id, expense_date, sort_order)`.
  **Apply with `supabase db reset --linked` then `npm run gen:types`** — until the types regenerate, the
  handful of `sort_order` references (the migration-dependent lines in `data/travel.ts`, the
  `EditTripBody` expense helpers, and the test factory) are the only typecheck errors.
- **Decoupled, date-matched:** expenses already had no stop/day FK — they relate to a Day only by a
  matching `expense_date`. `getTripBundle` now also returns `expenses` (ordered by `expense_date`,
  `sort_order`); `EditTripBody` lifts them into the same optimistic local state as days/stops, so the
  per-day modal and the Expenses tab share one source of truth (F16b).
- **Per-day entry:** a new **Expenses** icon (`IconReceipt2`) in each Day header (between Duplicate and
  Add Stop) opens **`DayExpensesSheet`** — the day's date-matched expenses with new rows prefilling that
  date.
- **Shared inline editor `ExpenseRowsEditor`** (replaces `ExpenseEditorSheet`, now deleted): rows of
  **Description · Category · Currency · Cost** + a trailing add row + tap-to-expand (Date · up/down
  reorder · Reimbursed when tracked · Delete). **Adaptive to Dynamic Type (F23):** single-line at
  `font_size` `default`, stacked 2-line at `large`/`larger`. It's `sort_order`-free (parent passes
  ordered rows; reorder is positional) — so the editor, the day sheet, and the panel rework all
  typecheck pre-regen.
- **Expenses tab = trip-level hub:** keeps Base Currency / Track Reimburse / Totals (per-currency) /
  FX rates / the By-**Category** donut; the flat list became the date-grouped inline ledger. The
  Itinerary | Expenses toggle stays.
- **+2 pure-helper tests** (`groupExpensesByDate`). Lint + Prettier + the expenses suite pass;
  `typecheck` passes except the expected `sort_order` lines (green after the owner regenerates types).

## Cross-module UI polish pass (2026-06-30)

Tester-reported consistency/readability fixes from a Default-font-size pass; no schema. Pure cosmetic

- a couple of layout-resilience fixes.

* **Settings (all modules):** button-wrapped `FieldRow` nav rows never drew a divider (their
  `last:border-b-0` scoped to the wrapping `<button>`, not the section) — the wrapper buttons now carry
  `border-b border-border last:border-b-0` so rows divide consistently. **`FieldRow` padding `py-3 → py-2`**
  (with the standalone action/sign-out rows matched to `py-2`) for a more compact, ACCOUNT-like density.
  Durable rule: a `FieldRow` wrapped in a button must put the divider on the **button**.
* **Wellness:** Food Detail servings → **Manage/Hide/Add Servings** (title case); Manage/Hide is now an
  accent toggle at `text-body` (was teal `text-caption`). `EffortPicker` disabled rows `opacity-40 → 60`
  (the "× MET" hint was unreadable). Visible Nutrients: the Protein target input sits **inline beside the
  label** (was stacked below).
* **Shows/Books/Quotes entry:** field-adjacent action buttons (TMDB / Google Books / link) were
  `text-body` (15px) beside a `text-field` (16px) input → heights mismatched; unified to `text-field`.
* **Net Worth / Medical:** Insurance Policies & Medical Reports keep the **search bar visible when empty**
  (mirror Shows/Books Library). Medical New/Edit + Import: **Add Link / Add Result** (title case). Import
  review card: **Mark Reviewed** is now a solid accent button (was low-contrast on the tinted card) and the
  **Review – reason** marker is `text-warning` (was hard-to-read `text-accent` on an accent tint).
* **Net Worth import:** the per-provider currency `SegmentedTabs` was clipped (`w-36` too narrow for
  HKD/CNY/USD) → `w-44`.
* **Top-edge spacing:** Shows Library matched to Shows Dashboard (drop the extra top pad); Books Dashboard
  gained top padding so "Recently Read" isn't jammed against the edge.
* **Import sheets:** added `min-h-0` to every `Import*Sheet` scroll body (the search-sheet convention) so
  a long preview/result scrolls (Quotes import was stuck).
* Pure-helper test count unchanged (**613**). Verified by `npm run check` + a production build.

## Literature module — integrated from the standalone chinese-literature app (2026-06-29)

Added a new **Literature** module (classical Chinese poems & prose with search, filter, read-aloud
粵/國, favourites) by integrating the standalone `tiggerkk/chinese-literature` app (Next.js + SQLite).
Behaviour/data are in `docs/11_literature.md`; the static-corpus pattern + read-aloud caveat are in
`02_tech_spec.md` + `PARKED.md`.

- **Rewritten, not migrated.** The source is Next.js + `better-sqlite3` + a light cream theme — none of
  it ports to WellWorth's Vite SPA + React Router + Supabase + dark design system. Only the **read-aloud
  algorithm** (`speechSynthesis` + `onboundary` progress + seek + voice pick) and the **corpus data**
  were carried over; the screenshots + data are the spec.
- **Corpus = static asset, not a DB table (key decision).** The poem corpus is immutable, shared,
  non-private, so RLS/sync add nothing and offline reading matters. It ships as versioned JSON under
  `public/literature/**` (generated by `scripts/build-literature-data.mjs` from a gitignored `poems.db`
  via a new `better-sqlite3` **devDependency**): a precached `index.json`+`meta.json` (browse/search/
  filter/favourites work offline) + runtime-cached `poem/<id>.json`/`writer/<id>.json` bodies
  (CacheFirst `literature-bodies-v1`, `globIgnores`d from precache like `opencc`). Favouriting a poem
  also `cache.add()`s its body. **Search/filter is client-side** over the in-memory index via `foldZh`
  (the one module that filters in the client — correct for static, bundled data). This dissolved the
  19.5 MB-seed question (no seed migration, no service-role import).
- **Supabase = only the user-owned bits.** Migration `16_literature_schema.sql` (`poem_favorite` —
  `(user_id, poem_id)` PK, RLS select/insert/delete-own, no FK to the corpus, no update/moddatetime) +
  `17_literature_profile_settings.sql` (`literature_tts_lang` `zh-HK`|`zh-CN`, `literature_tts_autoloop`).
- **Read-aloud:** `src/hooks/useSpeech.ts` (Web Speech API; async `voiceschanged`; `onboundary`
  progress; seek by re-speaking from a char offset; auto-loop; cancels on unmount) +
  `src/components/PoemReader.tsx` (粵/國 `SegmentedTabs`, play/stop, seek slider, voice-unavailable
  note). **iOS Cantonese voice is device-dependent → PARKED** (graceful fallback, parallels the
  Medical WebAuthn framing).
- **Screens** (`src/screens/Literature{Home,PoemDetail,Poets,PoetDetail,Favorites,Settings}.tsx`) reuse
  `SearchBar`/`FilterToggleButton`/`FilterPanel`/`SegmentedTabs`/`Toggle`/`ResultCount`/`SectionCard`/
  `EmptyState` + new `PoemCard`; module registered in `modules.ts`/`routes.ts`/`router.tsx`. **`EmptyState`
  gained optional `actionLabel`/`to`** (the corpus is read-only, no create action) — backward-compatible.
- **Typecheck gap (expected, per the migration workflow):** the `poem_favorite`/`literature_tts_*`
  references are the only `tsc` errors until the owner applies migrations 16–17 + `npm run gen:types`.
  Format, full ESLint, and the suite (**620** — +7 `literature.test.ts` for fold-search + filter
  semantics + dynasty grouping) all pass.
- **Corpus build is owner-run** (`npm run build:literature`, OWNER_RUNBOOK Part S); the generated
  `public/literature/**` is committed (no DB/`better-sqlite3` at deploy/CI). The corpus survives
  `supabase db reset` (it isn't in the DB). `public/literature` is **prettier-ignored** (10k minified
  JSON files) and the build's dir-clear removes contents (not the locked top folder, with retries) so a
  Windows file-watcher handle doesn't EPERM the rebuild.
- **Filter taxonomy (data-driven, tuned with the owner).** The source tags (539) don't match the
  standalone app's hardcoded filter labels, so `TYPE_GROUPS` was set to this corpus's actual spelling
  (seasons 春天/…, school anthologies split 古詩/文言文, 親友/孤苦 → 友情/孤獨) across four groups
  **主題/時令/選集/風格** (the new `style` kind = 婉約/豪放/樂府, a high-frequency style/form axis). A
  `TYPE_ALIAS_GROUPS` layer maps ~85 fine-grained `other` tags onto a curated parent (寫景→景物,
  中秋節→節日, 抒懷→抒情, …) so a poem tagged only with an alias still surfaces under its pill — the pills
  are unchanged, aliases only feed them. **Coverage is source-capped:** only ~20% of poems carry any
  type tag, and aliasing reaches ~95% of those — pushing higher would mis-file. Both lists are the
  source of truth in `scripts/build-literature-data.mjs`; the build prints `coverage: N/10000`. See
  `docs/11_literature.md` + `PARKED.md`.

### Follow-up — Onboarding ⇄ Global Settings made identical (shared DISPLAY card) — 2026-06-29

- **Goal:** the first-run "Welcome to WellWorth" wizard and Global Settings should look the same —
  **DISPLAY** (Font Size, Visible Modules, Units) then **PROFILE** (Birthday, Sex, Height, Weight) —
  with no separate Preferences group.
- **New shared `src/components/DisplaySettingsCard.tsx`** — the DISPLAY section (Font Size + Visible
  Modules + Units) extracted from `Settings` so both screens render one source. Fully controlled
  (parent owns values + persistence); it applies the Font Size preset instantly via `applyFontSize`.
  `Settings` and `Onboarding` both render it above `ProfileMetricsFields`.
- **`ProfileMetricsFields` slimmed:** dropped the `showUnits` prop + its "Preferences → Units" group;
  it's now purely the PROFILE card (Birthday/Sex/Height/Weight) and reads `value.units` only to
  label/convert height & weight. Units always lives in `DisplaySettingsCard`.
- **Onboarding persistence:** Display prefs apply live but write once on "Get started" (`font_size`
  added to the submit `save`); **Visible Modules** still auto-saves via its route sheet.
- **Gate stacking fix (F-onboard-z):** the Onboarding overlay dropped `z-50` → **`z-20`** so it sits
  below the `z-30` route-sheet layer — letting the Visible Modules sheet (and the birthday `Calendar`)
  paint **above** the gate. It still covers the app (content/nav are `z-10`); the `Toaster` (`z-50`)
  stays topmost so the "at least one module visible" toast shows. Documented in `03_global.md` /
  `02_tech_spec.md` / `01_design_system.md`.
- No schema/test change; typecheck + ESLint green (snapshot **620** tests unchanged).

## Home hub 2-column grid + grid-aware Visible Modules reorder — 2026-06-29

- **Goal:** the Home hub couldn't show all 8 modules without scrolling. Lay cards out in a **2-column
  grid** and make the Visible Modules reorder UI mirror that layout.
- **`Home.tsx`** — container `flex flex-col` → **`grid grid-cols-2 gap-3`**; cards are now compact
  **button-style** links (smaller `h-9 w-9` icon tile, tighter padding, **no chevron**), label +
  description `truncate` to one line so paired cards stay equal-height.
- **`constants/modules.ts`** — `MODULES` reordered to the hub's linear reading order (Wellness, Net
  Worth, Quotes, Literature, Shows, Books, Travel, Medical) and every `description` shortened to one
  short clause. Order is only the default; users still reorder via `module_order`.
- **New `src/components/ReorderGrid.tsx`** — a 2-up (grid-cols-2) sibling of `ReorderList` (which is
  1-D and shared by 5+ other sheets, so left untouched). Same in-house Pointer-Events drag, but the
  dragged cell **floats under the finger** and the destination slot is **outlined** (target = nearest
  cell center from rects cached at drag start) instead of a 1-D row-shift animation — robust on touch.
  Each cell carries a **position-number badge** (linear index = hub reading order).
- **`VisibleModulesSheet.tsx`** — swapped `ReorderList` → `ReorderGrid` (state/handlers and the
  "≥1 must stay visible" guard unchanged). Both the Onboarding wizard and Global Settings reach this
  same sheet via `DisplaySettingsCard`, so no change there.
- **No schema/data-model change** — order is still the flat `module_order` array; the grid fills
  row-by-row so linear index = grid position. No new pure helper, so the snapshot stays **620** tests.

## Cross-module cosmetic pass (filters, importer pills, in-list "+ New") — 2026-06-29

- **Goal:** a batch of look-and-feel fixes across modules; no schema/data-model change.
- **`SelectMenu.tsx`** — the open menu was clipped to a fixed `max-h-64`/264px even with screen room
  to spare (long lists: Dynasty, Quotes Category/Source). Now the menu's max-height = the space
  actually available on the chosen side (below, or above when it flips), minus an 8px margin, capped at
  the list's own height — fixes every module's filter dropdowns at once.
- **`ImportPreviewList.tsx`** (Shows/Books/Food importers) — Change / Manual pills were faint
  `bg-input` text-only; now solid like Medical's **Mark Reviewed**: **Change** = `bg-danger` red,
  **Manual** = `bg-accent` blue, white text (disabled dims). Shared component, so the Food importer
  matches too.
- **`MedicalReportDetail.tsx`** — the read-only report's `Review – <reason>` marker was `text-caption
text-accent`; aligned to the editor's `text-label font-medium text-warning` so read-only / import /
  Edit Report all read identically.
- **`Library.tsx`** (Wellness) — moved the teal `+ New Food` / `+ New Activity` out of the pinned pane
  to the right edge of the `ResultCount` row (`ml-auto`).
- **`InsurancePolicies.tsx` + `constants/modules.ts`** — dropped the **New Insurance** bottom-nav tab
  (and its `IconFileCertificate` import); the new entry point is a teal `+ New Insurance` on the
  `ResultCount` row (plus the existing empty-state action).
- Docs synced (`01_design_system.md`, `03_global.md`, `04_wellness.md`, `05_networth.md`,
  `09_medical.md`). Typecheck + ESLint green; no test change.

## Net Worth — liquid vs non-liquid assets + "Liquid Only" view — 2026-06-30

- **Goal:** distinguish liquid from non-liquid assets and let the Dashboard + Monthly Entry show
  net worth using only liquid types, via a top-right **Liquid Only** toggle.
- **Classification** is an owner setting on `profile.networth_liquid_asset_types` (NULL = code
  defaults `cash, time_deposit, stock, fund`; non-liquid = `retirement, insurance, property`).
  Editable in **Settings → Liquid Assets** (`NetWorthLiquidAssetTypesSheet`, per-type toggles).
  Column added to the existing `04_networth_profile_settings.sql` (owner reconciles via `db reset`).
- **Toggle state** is ephemeral, not a DB pref: persisted in `localStorage`
  (`wellworth:networth-liquid-only`) via `src/lib/networth-liquid-filter.ts` + `useLiquidOnly`,
  so it's shared across both screens and survives reloads until site data is cleared.
- **New pure helpers** in `src/lib/networth.ts`: `DEFAULT_LIQUID_ASSET_TYPES`, `liquidAssetTypes()`
  (NULL → defaults), `restrictTotals()` (zero out non-liquid types so `sumTotals` /
  `typeBreakdownFromTotals` recompute against the liquid subset).
- **Dashboard** — when ON, current total, trend, and By-type breakdown are computed over the liquid
  subset (percentages recompute). **Monthly Entry** — non-liquid sections stay visible/editable but
  are excluded from the header total and marked with an "Excluded" pill; SAVE is unaffected.
- **No data-model change** beyond the one profile column; the aggregation view and `asset_entry`
  are untouched — this is a display/calculation filter. Docs synced (`05_networth.md`).

## Literature — dynasty-filter ordering fix — 2026-06-30

- **Symptom:** the Poems 朝代 filter pills bunched `隋代 / 金朝 / 當代 / 未知` at the end, out of order.
- **Cause:** the pills come from `meta.dynasties` (distinct corpus dynasty values), sorted by
  `DYNASTY_ORDER` in `scripts/build-literature-data.mjs`. That array only listed the **bare** forms
  `隋`/`金` (not `隋代`/`金朝`) and omitted `當代`/`未知`, so those four fell into the unranked tail
  (rank = `length`, then `localeCompare`).
- **Fix:** extended `DYNASTY_ORDER` to include every value the corpus emits in chronological slots
  (`隋代` after `南北朝`, `金朝` after `宋代`, `當代` after `現代`, `未知` last). Build still only sorts,
  never drops. Re-applied the same deterministic order to the committed `public/literature/meta.json`
  so it ships without a corpus rebuild (next `npm run build:literature` reproduces it byte-identical).
- Decision: kept Literature's own corpus-derived list rather than the shared `dynasty.ts` `DYNASTIES`
  — the corpus legitimately has `現代`/`金朝`/`當代` that the shared list lacks. Docs synced
  (`11_literature.md`).

## Literature — Poems list Sort + Clear Filters — 2026-06-30

- **Goal:** mirror the Shows Library footer in the Poems `FilterPanel` — a Sort menu (朝代 / 作者 /
  標題, default 朝代 ascending) to the right of the 只看收藏 toggle, with 清除篩選 bottom-right on the
  same line.
- **Sort** is a new pure `sortPoems(poems, field, dir, dynastyOrder)` in `src/lib/literature.ts`,
  modelled on Shows' `compareShows`: dynasty rank = position in `meta.dynasties` (already chronological
  after the ordering fix above, so no second source of truth), author/title by `localeCompare`,
  null/unknown values sort last, stable title tiebreak. Kept **separate** from `applyHomeView` (filter)
  so each pure function stays single-purpose and the existing filter tests stay order-independent.
- `HomeCriteria` gained `sortField`/`sortDir` (defaults 朝代/asc); `useSessionState` shallow-merges
  defaults so existing sessions pick them up. 清除篩選 now preserves `query` + sort (like Shows).
- UI uses the shared **`SortControl`** + role tokens only (no hardcoded text sizes). Tests added for
  `sortPoems`. Docs synced (`11_literature.md`).

## Profile-order flash fix — local profile cache (stale-while-revalidate) — 2026-06-30

- **Symptom:** the Home hub (and Medical/Net Worth ordered lists) painted the canonical default order
  for ~100–400 ms, then jumped to the user's saved order/visibility once `useProfile` resolved.
- **Cause:** profile is fetched **per-screen, asynchronously** (no app-wide cache). `useAsync`'s initial
  state is `{ data: undefined }`, so ordering helpers (`homeModules`, etc.) hit their canonical fallback
  on first paint and re-rendered when the Supabase fetch landed — on every cold load AND every navigation.
- **Fix:** `useProfile` now seeds its first render from a **local cache of the last-known profile**
  (`src/lib/profile-cache.ts`, keyed `wellworth:profile:<userId>`), plumbed via a new optional
  `initialData` seed on `useAsync` (additive — the 40+ existing callers are unchanged). Every fetch
  refreshes the cache. This is the `last-module` / `networth-liquid-filter` localStorage convention
  applied to the whole row (see tech-spec **F21**). One central change fixes all affected screens (Home,
  Medical Dashboard/Entry/Report Detail, Net Worth Monthly Entry) plus the minor `*_visible_fields`
  flicker — no per-screen edits.
- **Security:** the cache is **sanitized on write** — `medical_lock_pin_hash` (a brute-forceable PBKDF2
  hash of a 4–8 digit PIN) and `medical_lock_webauthn_id` are stripped, never persisted to localStorage.
- **Opt-outs (`useProfile({ seed: false })`):** `useProfileEditor` (editors copy the profile into local
  state on mount → need the authoritative fresh row, not a possibly-stale cache) and `MedicalLockProvider`
  (a hash-stripped seed would read as "lock not configured" for one frame and briefly unlock Medical; it
  has its own synchronous `enabledHint` gate). Audit confirmed every `useState`-from-profile editor is fed
  via `useProfileEditor`, so these two opt-outs fully cover the freeze/security risks.
- **Tests:** `src/lib/profile-cache.test.ts` (round-trip, per-user isolation, **secret-stripping**,
  storage-unavailable + corrupt-JSON graceful degradation). Docs synced (`02_tech_spec.md` F21,
  `03_global.md`).

## Travel — expense rows overflow fix (always 2-line) — 2026-06-30

- **Symptom:** in the `ExpenseRowsEditor` (per-day modal + trip ledger), the expense rows spilled past
  the card's right edge, and at default font the Category/Currency dropdowns over-truncated
  ("Flight/…", "H…").
- **Causes:** (1) the **Cost `<input>` had no width utility**, so a bare `<input>` kept its intrinsic
  ~20-char width and overflowed its `w-16`/`w-24 shrink-0` wrapper (Description escaped this only via
  `flex-1`); (2) the default-font **single-line** layout crammed all four fields + chevron into one row.
- **Fix:** rows are **always stacked 2-line** now (Description + expand on line 1; Category · Currency ·
  Cost on line 2) at every font size — the adaptive single-line variant and the `font_size` prop were
  dropped from `ExpenseRowsEditor`, `DayExpensesSheet`, `TripExpensesPanel`, and `TripBuilder`. Both
  Cost inputs gained `w-full`.
- **Durable lesson** (now a gotcha in `01_design_system.md` / `10_travel.md`): a bare `<input>` inside a
  fixed-width `shrink-0` flex wrapper must be `w-full`, or its intrinsic width overflows.
- **Add-row data-loss fix:** the add row never persisted typed input until an explicit `+` was pressed,
  and `+` required **both** description **and** cost — so a complete-feeling row that wasn't committed
  (no `+`/Enter, or a blank cost) was silently discarded on close. Three changes: (1) **only a
  description is required** — a blank cost commits as `0`, editable inline (`canAdd` dropped the
  `cost.trim() !== ''` gate; blank cost coerces to 0); (2) **Enter commits from the description field**
  too (previously only the cost field); (3) **a complete draft auto-commits when the editor unmounts**
  (closing the day modal / leaving the Expenses tab) via a latest-draft `useRef` flushed in an unmount
  `useEffect` — it no-ops on an empty/incomplete row, so no blank rows and no double-save (incl. dev
  StrictMode's mount→cleanup).
- **Add-row "looks like a blank saved row" follow-up:** after the 2-line change, the always-present add
  row rendered its default category/currency/cost (+ date chip) looking like a persisted blank expense.
  Now it's visually marked as an entry affordance — a **dashed** card border + the
  category/currency/cost/date line **dimmed (`opacity-55`) until the user types** (`active` flag). The
  trip-ledger **date chip** is the target date for the new expense (defaults to trip start / today; tap
  for any/new date); it stays hidden in the day modal (date fixed).
- No schema or test change (pure layout/markup + doc sync).

## Literature — 名家 tab uses the source app's curated famous-poet list — 2026-06-30

- **Symptom:** the Poets (名家) tab listed **every** writer in the corpus (802 with poems), not the
  curated roster the standalone source app (github.com/tiggerkk/chinese-literature) shows.
- **Cause:** the source app curates via an `isFamous` flag on its `writers` table (set by
  `migrate-writers.cjs` from a 50-name `famousNames` array; `/api/writers` filters `WHERE isFamous=1`).
  WellWorth ships the corpus as a static asset, not a DB, and `build-literature-data.mjs` emitted every
  writer with ≥1 poem into `meta.writers`.
- **Fix:** ported the 50-name roster as a `FAMOUS_WRITERS` set in `build-literature-data.mjs`; only
  those names (with ≥1 poem) go into `meta.writers`. **No runtime change** — `LiteraturePoets.tsx` /
  `groupWritersByDynasty` render whatever `meta.writers` holds (verified `meta.writers` has no other
  consumer). `writer/<id>.json` is still written for **all** writers, so a poem by a non-famous author
  still links to a working poet page (`LiteraturePoemDetail` links any `writerId`).
- **Durable lesson** (now an `F:` note in `11_literature.md`): the famous list follows **this corpus's
  HK-Traditional (OpenCC) spelling**, not the source's — the source's `高啟` is stored here as `高啓`,
  so `FAMOUS_WRITERS` uses `高啓` (49/50 matched verbatim; this was the one variant). The build
  `console.warn`s any name with no matching writer to catch future spelling drift.
- Regenerated + committed `public/literature/meta.json` (writers 802 → 50; poem/writer/index files
  byte-identical). No schema change.

## Code-quality pass — dead code, DRY shells, doc reconciliation — 2026-06-30

A maintenance pass (no schema, no behaviour change beyond the back-button affordance below). Findings
came from `knip` + `ts-prune` + ESLint, cross-verified by grep.

- **Dead code removed** (all zero-reference, verified): `COMPLETION_LABELS` (`constants/travel.ts`),
  `replaceManualAssetEntries` + its now-orphaned `MANUAL_ASSET_TYPES` (`data/asset-entry.ts`),
  `listPolicies` / `setTermination` / `clearTermination` (`data/insurance.ts`), `createServing` /
  `deleteServing` (`data/serving.ts`), `FUND_DETAIL_FIELDS` (`lib/networth.ts`), `RememberedCityInsert`
  (`lib/travel.ts`), `isSameDay` (`lib/date.ts`). Kept on purpose: the symmetric `units.ts` converters
  and `scripts/gen-zh-fold-map.mjs` (one-off generator). No unused deps; ESLint clean.
- **Low-risk DRY extractions:** `FIELD_CLASS` (`constants/forms.ts`) replaces 9 per-file
  `const inputClass = 'field-control w-full'`; `numStr` moved to `lib/quantity.ts` (3 copies);
  `useDirty(current, initial)` hook (`hooks/useDirty.ts`) replaces the inline `JSON.stringify` dirty
  check in 5 entry screens + ActivityLogSheet; `EntryLoader` (`components/EntryLoader.tsx`, a generic
  render-prop) replaces the duplicated outer loader in the 5 entry screens; `SettingsLayout`
  (`components/SettingsLayout.tsx`) replaces the duplicated Settings header shell across all 9 Settings
  screens. Larger refactors (`SearchSheetBase`, `useLibraryList`, `useImportResolver`) deferred — see
  `PARKED.md` → Code-quality / refactor backlog.
- **Back-button migration:** the 8 chevron-as-back Settings screens (global Settings + each module
  Settings) now use the documented top-left **`IconX`** dismiss (Esc-closable) via `SettingsLayout`,
  matching the Literature screens. Diary / NetWorthEntry chevrons are date/month **navigation**, not a
  dismiss, and were left unchanged. Home's `<h1>` wordmark moved off `text-xl` to the `text-title` role
  token (Login's splash wordmark stays as an intentional brand lockup).
- **Doc reconciliation:** `01_design_system.md` accent token corrected `#5ba3f5` → **`#3874f6`** to
  match the shipped `--color-accent` (docs follow code; no visual change). Added `EntryLoader`,
  `SettingsLayout`, `FIELD_CLASS` to `01`, and `useDirty` + the shells to `02_tech_spec.md`.
- **Snapshot:** **632** tests pass (+19 since the prior 613 snapshot, from the intervening passes);
  `npm run check` (format + lint + typecheck + test) green.

## Travel — Expenses tab: auto-fetch rates + merged Totals/Conversion — 2026-06-30

UX pass on the Expenses tab (no schema change). Two complaints: the Base-Currency → Fetch-missing-rates
region wasted vertical space, and a foreign-currency trip opened with a broken HKD total + an orange
warning until the user hunted for a "Fetch missing rates" button.

- **Auto-fetch on open** (`TripExpensesPanel`): a `useEffect` fills any **missing** rate from
  Frankfurter at the trip's first day on mount / when a new foreign currency first appears — so the HKD
  total just works. Gaps only (frozen rates + manual overrides untouched). Dedup/loop control is a
  single `fetchingRef` in-flight guard keyed off `missingKey = hkd.missing.join(',')`: an unpriceable
  currency (offline / non-ECB) stays in `missing` but keeps `missingKey` stable, so the effect doesn't
  re-fire — left for a manual rate or **Refresh**.
- **StrictMode-deadlock fix** (durable lesson — **F-anchor candidate**): the first cut marked a
  currency `attempted` on the **first** effect run and used a `cancelled` cleanup flag. Under
  StrictMode's setup→cleanup→setup double-invoke, the re-run saw the currency already attempted and
  bailed, while the original (now-`cancelled`) fetch skipped both `saveRates` **and** `setFxBusy(false)`
  → spinner stuck forever, rate never saved. Rule: an auto-fetch effect must be **idempotent** — never
  record "done" before the work completes, and **always** clear the busy flag in `finally` (a setState
  after a StrictMode/real unmount is a harmless no-op in React 18). Use a ref **in-flight** guard, not
  attempted-before-fetch + cancel.
- **Merged Totals + Conversion** into one card: the separate "Conversion to HKD" card is gone; each
  non-HKD currency now carries its **inline editable first-day rate + live HKD subtotal** on a second
  line under its native total. The old standalone warning paragraph became a compact footer note + a
  small **Refresh** (↻) action; **Refresh** force-re-pulls all foreign rates (overwrites overrides).
  Footer note is neutral grey while fetching, red (`text-warning`) only on a real pricing failure.
- **Compact top strip** (`TripBuilder`): the currency + Track Reimburse went from a padded card with
  stacked labels to a single slim `flex-wrap` row with inline labels.
- **Renamed the label "Base Currency" → "Default Currency"** across both Trip forms +
  `TravelFieldsSheet` (the **DB column stays `base_currency`** — UI label only). It only prefills the
  currency of new expense rows; the reporting/total currency is always **HKD**. The old name read like
  a reporting-currency setting and confused the owner. ("Default Expense Currency" was tried first but
  is too long for the New-trip header column — shortened to **"Default Currency"**.)
- Lesson (durable, → `docs/10_travel.md`): the first FX fetch is **automatic** (gap-only, deduped by an
  in-flight ref); the manual control is now a force **Refresh**, not the primary path.
- **Snapshot:** **632** tests pass (UI-only change, no new tests); `npm run check` green.

## Medical — Eye Refraction grid: fit all 3 columns + RE/LE labels — 2026-06-30

Cosmetic/UX fix on the Add/Edit Report eye grid (no schema change, no migration). On a phone only the
first ~1.5 columns showed (Cylinder clipped, Addition off-screen), and the row labels were the cryptic
optometry **OD/OS**.

- **Overflow root cause + fix** (`EyeRefractionFields`): the grid used `grid-cols-[3.5rem_1fr_1fr_1fr]`
  with bare `<input>` cells. A `1fr` track is `minmax(auto,1fr)`, and an input's `auto` min is its
  intrinsic ~20-char width, so the three value columns refused to shrink and overflowed the card's
  `overflow-hidden` (the documented _ExpenseRowsEditor_ layout gotcha). Switched the value tracks to
  `minmax(0,1fr)` and gave each input `w-full min-w-0` — all three columns now fit and stay editable at
  the Large/Larger Dynamic Type presets (`rem` tracks + role-token text scale together).
- **RE/LE labels (grid only):** `EYE_REFRACTION_ROWS.eye` now displays **RE** (right) / **LE** (left);
  the helper caption defines them. The DB keys (`*_od`/`*_os`), seed `display_name`s, migration 12, and
  the JSON import matcher are intentionally **unchanged** — real optometry reports print OD/OS and the
  importer keys off `display_name`, so this stays display-only.
- **Snapshot:** **632** tests pass (UI-only change, label not asserted); `npm run check` green.
