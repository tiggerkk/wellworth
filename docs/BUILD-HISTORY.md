# BUILD-HISTORY — WellWorth

Chronological engineering history: the per-milestone build sequence and the dated enhancement passes, with the rationale behind key decisions.

- **Read this only when explicitly asked** to do a major refactor or regression analysis on an older module. It is **not** part of the per-session context.
- **Not a behavior spec.** The source of truth for behavior/data is `00-PRD.md`, `01-design-system.md`, `02-tech-spec.md`, `03-global.md`, and the module specs `04-wellness.md … 10-travel.md`.
- **Durable constraints + "don't repeat" lessons live in those spec docs now** — this file keeps only one-line pointers (see [Failures & gotchas](#failures--gotchas-to-not-repeat)).

## Old doc-name legend

Older entries cite a previous doc-naming scheme that has since been renumbered:

- `01-screens.md` → module specs `04-wellness.md … 10-travel.md` + `03-global.md` (screen behavior).
- `03-data-model.md` → each module spec's "Data model" section + `02-tech-spec.md` "Database conventions".
- `04-design-system.md` → `01-design-system.md`.
- `05-seed-data.md` → each module spec's "Seed data" section + `04-wellness.md`.

## Module status

All modules are feature-complete:

- **Wellness** — M1–M9 + post-launch polish.
- **Net Worth** — M1–M6.
- **Shows** (TV, movies, documentaries) — M1–M7 + M8 (Chinese documentaries) + later cross-module passes (favourites; `master_series` removed/folded into the title; conditional Poster URL; Watching-badge/Start-Date fixes).
- **Books** (read / to read) — M1–M7 (a Shows re-skin) + favourites.
- **Quotes** (English or Chinese) — M1–M7 + owner-configurable source types/categories.
- **Medical** (lab results + narrative reports) — M1–M7.
- **Travel** (Days → Stops itineraries, map, per-trip expenses) — M1–M7 + simplification & UX passes.

Each module's former staging spec (`docs/06-books.md`, `07-quotes.md`, `medical.md`, `travel.md`, `CONTINUITY.md`) was merged into the permanent docs and deleted. Per-module build sequences and the dated enhancement passes follow below.

---

## Snapshot

- **Tests:** 504 Vitest tests (pure helpers only).
- **Deploy:** Deployed — GitHub `main` → Vercel auto-deploy; installed + tested on iPhone (PWA).
- **Stack / scripts / env / gates / conventions:** see `02-tech-spec.md` (the canonical, current reference) — not duplicated here.

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
- **Rationale & key decisions** (all now in `02-tech-spec.md`): DRI is a sex/age-band lookup populated only for the owner's band (female 51–70) and throws otherwise; upper limits are **scope-tagged** so supplement-only ULs never fire a red bar on dietary intake; fat/saturated/added-sugars get energy-derived soft targets; protein honors the profile override.

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
  DB was reconciled with `supabase db reset --linked` (documented in `OWNER-RUNBOOK.md` Part M). Editing
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
  the global level, last-used-module reopen. Built in the next milestone (M2). `00-PRD.md` carries the
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

- The **Shows module** (TV shows + movies) is specced in `docs/06-shows.md` (a staging doc whose sections merge into the permanent specs as each feature lands). It drops into the multi-module architecture with no structural change.
- Two **owner decisions deviate from `06-shows.md`** and are carried in the permanent docs as built:
  - (1) the back-catalogue importer is **in-app, not a CLI script** (same reversal as Net Worth — an in-app preview table lets the owner fix no-match/ambiguous TMDB rows inline);
  - (2) a **Shows Settings** screen (`/shows/settings`) adds Entry/Edit **field-visibility** + an **importer enable/disable** toggle, with both prefs synced on `profile`.

### M1 — Schema + module registration + scaffold screens

Goal: a runnable, navigable Shows module behind a hub card, before any data layer or external API.

- **Schema:** `04_shows_schema.sql` — one `show` table (own `user_id` for direct RLS like
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
- Verified by `npm run typecheck` + manual click-through; the data-model section of `06-shows.md` was
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

- **Migration** `05_shows_profile_settings.sql`: adds `profile.show_visible_fields text[]`
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
  - **(1)** edit the original `04_shows_schema.sql` + recreate the table (the DB held no live data) rather than ship an additive migration;
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

- **Schema:** `06_books_schema.sql` — one `book` table (own `user_id` for direct RLS like
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

- **Migration** `07_books_profile_settings.sql`: adds `profile.book_visible_fields text[]`
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

- The **Quotes module** (favourite quotes from TV/film/books/podcasts/articles/videos/songs, English or Chinese) is specced in `docs/07-quotes.md` (a staging doc whose sections merge into the permanent specs as each milestone lands, then it is deleted — same lifecycle as `06-shows.md`/`06-books.md`). It drops into the multi-module architecture with no structural change.
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
- **Schema:** `08_quotes_schema.sql` — one `quote` table (own `user_id` for direct RLS like
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

- **Migration** `09_quotes_profile_settings.sql`: adds `profile.quote_visible_fields text[]`
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

- **Migrations:** `10_medical_schema.sql` (three tables — `medical_lab_test` reference
  [read-only to clients: single permissive SELECT policy + `grant select` only],
  `medical_report`, `medical_result` — RLS + 4 owner policies each on the user-owned tables, 18-value
  `category` CHECK, `moddatetime`, grants; `medical_result` cascades on report delete and carries the
  unit-normalization columns `normalized`/`value_num_original`/`unit_original`);
  `12_medical_profile_settings.sql` (nine `medical_*` profile columns incl. the lock +
  `medical_lock_timeout_minutes`); `11_medical_seed_lab_test.sql` (~150 tests, idempotent
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

- **F1** — RLS without table GRANTs → `42501 permission denied`; every migration must also grant to the API roles, and don't loosen RLS to "fix" it. → `02-tech-spec.md` (Database conventions).
- **F2** — USDA `/foods/search` must POST, not GET (400 on `dataType`). → `04-wellness.md` (External APIs).
- **F3** — pin `@zxing/library@0.22` to match `@zxing/browser@0.2`'s peer range. → `02-tech-spec.md` (Stack).
- **F4** — `useAsync(fn)` takes one `useCallback`-stable `fn`, no `deps` array. → `02-tech-spec.md` (Data flow).
- **F5** — type-check with `npm run typecheck`; a bare `tsc --noEmit` checks nothing (root tsconfig is references-only). → `02-tech-spec.md` (Quality gates).
- **F6** — Add-Food search: separate whole-food vs Branded POST searches; stem-wildcard the last word; exact + leading-prefix share the top score tier; plain-block scroll pane. → `04-wellness.md` (External APIs) + `01-design-system.md` (Layout gotchas).
- **F7** — gitignore private data before the first `git add`; sanitize tracked templates (and example numbers in docs). → `02-tech-spec.md` (Database conventions / security).
- **F8** — `useAsync` keeps stale `data` during a refetch: gate on `!loading` only when the loaded subject's identity changes (and key by it). → `02-tech-spec.md` (Data flow).
- **F9** — a flex-col scroll pane needs `min-h-0` on itself + `shrink-0` on its children; don't use a fixed pixel height. → `01-design-system.md` (Layout gotchas).
- **F10** — annotate WebCrypto/WebAuthn byte helpers as `Uint8Array<ArrayBuffer>` under TS 6. → `02-tech-spec.md` (Stack / TypeScript).
- **F11** — `lazyWithReload` wraps every `React.lazy` (a one-time reload recovers a stale hashed chunk after a deploy). → `02-tech-spec.md` (Stack, lazy loading).
- **F12** — `parseOAuthError` surfaces `signup_disabled` after a `db reset --linked` wipes `auth.users` with sign-ups off; check the redirect `?error=` + the Supabase sign-up toggle. → `02-tech-spec.md` (Auth & first-run).
- **F13** — don't gate a child holding unsaved local state on `!loading` (it unmounts on every refetch); render once `data` exists. The inverse of F8. → `02-tech-spec.md` (Data flow).
- **F14** — DOM overlays over a Leaflet map need a `z-index` above Leaflet's controls (`z-index:1000`; use `z-[1100]`). → `10-travel.md` (Visual design) + `01-design-system.md` (Layout gotchas).
- **F15a** — opencc-js (~1.12MB) is lazy-loaded + excluded from the PWA precache; local Chinese filters use the tiny sync `foldZh` fold map, never opencc. → `02-tech-spec.md` (Chinese search).
- **F15b** — never seed body metrics to a non-owner (`MEMBER_PROFILE_SEED`); a profile/onboarding gate reads `data`, not `loading`. → `03-global.md` (Profile seeds).
- **F16a** — bulk DB writes go in one batched `.insert`/`.upsert` (chunked), never a per-row `await` loop (the Shows CSV importer was N round-trips on IMPORT); pass `{ defaultToNull: false }` when batched rows have non-uniform keys over a `NOT NULL DEFAULT` column. → `02-tech-spec.md` (Data flow).
- **F16b** — prefer optimistic local state over a module refresh-version bump (`bumpTravel`) on every mutation; mutate locally + persist in the background, bump only on a write error. Re-seed via the adjust-state-during-render pattern, not `setState`-in-effect. → `02-tech-spec.md` (Data flow) + `10-travel.md` (Itinerary).
- **F17** — surface caught errors with `errorMessage(e, fallback)` (`src/lib/errors.ts`), not `e instanceof Error ? e.message : …`; the `data/*` layer rethrows the raw Supabase error object, which is not an `Error` instance, so `instanceof` hides the real cause (the `message`/`code`/`hint`). → `02-tech-spec.md` (Data flow).
- **F18** — aggregate an unbounded child collection in a `security_invoker` DB view (RLS still applies; needs `grant select`), not by fetching every child row and reducing client-side. Instances: `networth_monthly_type_total` (sum), `medical_latest_result` (DISTINCT ON latest). → `02-tech-spec.md` (Database conventions).

## Shows / Books / global enhancement (favourites, Esc, master-series removal)

A cross-cutting enhancement pass (one batch; the owner refreshes the DB via `supabase db reset
--linked`, so schema changes were **folded into the existing migration files** rather than shipping
additive ones — see `memory/db-migration-workflow.md`). 242 → **249** Vitest tests.

- **Removed `master_series` from Shows.** The documentary sub-series text now lives in the **title**
  itself (owner folds it in, e.g. `国宝档案 — 从东晋到北魏`). Dropped the column + its `(user_id,
master_series)` index from `04_shows_schema.sql`; removed `masterSeriesOptions`, the
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
convenience layer (the real locks are dashboard-side — see `OWNER-RUNBOOK.md` Part H3):

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
  restart. Documented in `.env.example`, `OWNER-RUNBOOK.md` (Parts D/H3/K + quick-ref), and the
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
  `category` CHECK constraints on `quote` (`08_quotes_schema.sql`); added
  `quote_source_types jsonb` + `quote_categories jsonb` to `profile`
  (`09_quotes_profile_settings.sql`). NULL ⇒ canonical seed defaults (no per-user seeding /
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

- **Migrations:** `13_travel_schema.sql` (5 user-owned tables — `trip`, `trip_day`, `stop`, `trip_expense`, `remembered_city` — each with `user_id`, four `(select auth.uid()) = user_id` RLS policies, CHECK enums, `moddatetime`, indexes, and API-role GRANTs; hard delete cascades trip → day → stop and trip → expense) + `14_travel_profile_settings.sql` (`profile.travel_expense_categories` JSONB).
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
  **existing** `14_travel_profile_settings.sql` (edited in place per the DB-reset workflow)
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
  `20260617130000_profile_show_settings.sql` → `05_shows_profile_settings.sql`,
  `20260622121000_seed_medical_lab_test.sql` → `11_medical_seed_lab_test.sql`, …). Done with `git mv`
  (history preserved). The ordinal is required: pure module-first names sort alphabetically and would run
  e.g. `books_profile_settings` before `wellness_schema` (which creates `profile`), breaking the reset.
  All references updated — the `src/lib/medical.test.ts` `?raw` seed import, the `src/lib/medical.ts`
  comment, the cross-referencing comments inside the SQL files, and every doc (`CLAUDE.md`,
  `03-data-model.md`, `05-seed-data.md`, `OWNER-RUNBOOK.md`, this log). Renumbering changes each
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
  CHECK in `04_shows_schema.sql` + `06_books_schema.sql`. `database.ts` **not** regenerated — the CHECK
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

- **Schema:** removed `last_update_date date` from `04_shows_schema.sql` + `06_books_schema.sql` (edited
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
- **UI-only — no schema/migration/`database.ts`/seed/test-count changes** (stays **496**); specs updated in `01-screens.md`, `02-tech-spec.md`, `04-design-system.md`, `PARKED.md`.

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
- Specs updated in `00-PRD.md`, `01-screens.md`, `03-data-model.md`, `CLAUDE.md`, `PARKED.md`, and the two `templates/travel-itinerary*` files.

- **Removed 7 stop fields** (`time`, `cost`, `cost_currency`, `local_transit`, `travel_mode`,
  `from_loc`, `to_loc`) — they appeared on only some stops, so they're folded into the free-text
  `description`. Dropped from the `stop` table (migration `13_travel_schema.sql` **edited in place** per
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
Behavior/data are now in `04-wellness.md`; design pieces in `01-design-system.md`.

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

Two settings additions. Behavior/data are now in `03-global.md` (profile columns, Global Settings),
`10-travel.md` (importer toggle), and the Shows/Books/Quotes spec Settings sections.

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
in `01-design-system.md` (the new component + the two models) and the touched module specs.

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
