# BUILD-LOG — WellWorth (Wellness)

Engineering history: the build sequence, the rationale behind key decisions, and a short list of
approaches that were tried and **failed** (so they aren't repeated). **This file is not a behavior
spec** — `/docs/00-PRD.md … 05-seed-data.md` + `CLAUDE.md` are the source of truth and already
describe what the app does. Where this log mentions a past failure, it points to the spec section that
now encodes the correct approach.

Net Worth is **feature-complete** (M1–M6) — see "Net Worth (build sequence)" below.
**Shows** (TV, movies & documentaries) is **feature-complete (M1–M7 + the M8 enhancement)** — see "Shows
Build Sequence" below: schema, module scaffold, manual CRUD, TMDB metadata, Dashboard, Library
filters/sort, Settings, CSV importer, then M8 (documentary type + master series, Chinese-aware TMDB,
pasted Poster URL, per-show Refresh, prefill).
**Books** (books read / to read) is **feature-complete (M1–M7)** — see "Books Build Sequence" below:
schema, module scaffold, manual CRUD, Google Books / Open Library metadata, Dashboard, Library
filters/sort, Settings, CSV importer. It re-skinned Shows; its `docs/06-books.md` staging spec has been
merged into the permanent docs and deleted.
**Quotes** (favourite quotes from screen/page/sound, English or Chinese) is **feature-complete (M1–M7)**
— see "Quotes Build Sequence" below: schema + module scaffold, data layer + manual Entry/Edit, the
cross-module Show/Book linker, the Moment-of-Zen dashboard, the Library filters/facets, Settings + Entry
field-visibility, and the in-app CSV importer. It re-skinned Books/Shows (adding the shared `TagInput`);
its `docs/07-quotes.md` staging spec has been merged into the permanent docs and deleted.

---

## Snapshot

- **Stack (as built, June 2026):** React 19.2, react-router 7.17 (unified `react-router` package),
  Vite 8.0, TypeScript 6.0 (strict), Tailwind 4.3 (CSS-first via `@tailwindcss/vite`),
  vite-plugin-pwa 1.3, `@supabase/supabase-js` 2.108, `@zxing/library` 0.22 + `@zxing/browser` 0.2,
  `@tabler/icons-react` 3.44, Vitest 4.1, ESLint 10 (flat config), Prettier 3.8, husky 9. `recharts`
  3.8 powers the Net Worth dashboard trend chart (lazy-loaded into its own chunk).
- **Scripts:** `dev`, `build` (`tsc -b && vite build`), `preview`, `lint`, `format`, `typecheck`,
  `test`, `check` (all gates), `gen:types` (Supabase → `src/types/database.ts`), `prepare` (husky).
- **Env (`.env`, gitignored; `.env.example` documents):** `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_USDA_API_KEY`, `VITE_TMDB_API_KEY`, and the optional
  `VITE_GOOGLE_BOOKS_API_KEY` (Books). All build-time `VITE_` vars.
- **Gates:** husky `.husky/pre-commit` → lint-staged + `typecheck` + `test`; GitHub Actions
  (`.github/workflows/ci.yml`, Node 24) re-runs `check` + `build`. 242 Vitest tests (pure helpers).
- **Deploy status:** Deployed. GitHub `main` → Vercel auto-deploy; the production URL is in the
  Supabase redirect URLs + Google JS origins (see `OWNER-RUNBOOK.md`). Installed + tested on iPhone (PWA).
- Conventions (DB-access-via-`src/data`, metric storage, generated `database.ts` contract, etc.) live
  in `CLAUDE.md` and `02-tech-spec.md` — not repeated here.

---

## Wellness Build Sequence (per milestone)

### M1 — Scaffold + tooling (`d61e352`)

Goal: runnable dark Vite/React/TS PWA skeleton with the four quality gates enforced by a pre-commit
hook. Scaffolded from `create-vite` 9.0.7 `react-ts` (Vite 8 / React 19 / TS 6 / ESLint 10 flat
config). Established Tailwind v4 CSS-first tokens in `src/index.css` (the design system), the strict
`tsconfig`, Vitest (node env), husky + lint-staged, CI, `.gitattributes` (LF — matters on Windows),
and the first real helper `src/lib/units.ts`.
Rationale: tokens-as-utilities keeps the design system in one file; husky+CI double-gate so a bypassed
hook is still caught.

### M2 — Supabase schema + RLS + seed + types (`959e6a3`, `965c9fb`)

Goal: full Postgres schema on the cloud project (remote-only, no Docker), nutrient reference seeded,
`database.ts` generated.
Migrations: `20260613120000_init_schema.sql` (7 tables, CHECK constraints, FKs, indexes, RLS +
policies, `moddatetime` triggers — all as `03-data-model.md` now specifies);
`20260613120100_seed_nutrient.sql` (80 nutrient rows, idempotent `ON CONFLICT (key) DO UPDATE`).
Rationale: reference data ships _in a migration_ (not `seed.sql`, which only runs on local resets) so
it reaches prod and is re-runnable; the `nutrient.parent_key` self-FK is DEFERRABLE so one multi-row
insert validates at commit.

### M3 — Google auth + first-run seed + app shell (`f31be26`, `6c3503d`)

Goal: Google sign-in, session-gated 4-tab shell, first-login owner data.
Built: `src/lib/supabase.ts` (PKCE client), `AuthProvider`/`RequireAuth` (splash, no login flash),
React Router v7 `createBrowserRouter`, `BottomNav`/`AppShell`/`Splash`/`PrimaryButton`, `Login` +
stub tab screens, `useEnsureProfile` (idempotent first-login seed), `vercel.json` SPA rewrite.
Migration `20260613120200_grant_api_roles.sql` was added here — see **Failure F1**. (Later merged
into `20260613120000_init_schema.sql` during the migration consolidation; the standalone file is gone.)
Rationale: client-side seeding (not a DB trigger) keeps the owner-seed logic in readable TS and needs
no `auth`-schema grants; PKCE is the right SPA flow.

### M4 — Data-access layer + calc helpers (`12477a7`)

Goal: the computational + data foundation; no UI; 29 tests.
Built: `src/lib/{energy,met,nutrients,dri,targets}.ts` and `src/data/*` repos for all 7 tables.
Rationale & key decisions (all now in `02-tech-spec.md`): DRI is a sex/age-band lookup populated only
for the owner's band (female 51–70) and throws otherwise; upper limits are **scope-tagged** so
supplement-only ULs never fire a red bar on dietary intake; fat/saturated/added-sugars get
energy-derived soft targets; protein honors the profile override.

### M5 — Diary + Add Food/Activity logging (`094a401`, `27e4b89`)

Goal: the core daily loop; built most of the shared component library.
Built: components (`Sheet`, `NutrientBar`, `GroupHeader`, `SwipeRow` [hand-rolled Pointer Events],
`SegmentedTabs`, `SearchBar`, `EffortPicker`, `Calendar`, `BarcodeScanner`, …); screens (`Diary`,
`AddFoodSheet`, `FoodDetailSheet`, `AddActivitySheet`, `ActivityLogSheet`); hooks (`useAsync`,
`useBarcodeScanner`, `useProfile`, `useNutrientReference`, `useSheetNavigate`); lib (`date`,
`food-api`, `off-api`, `targets`, `diary-refresh`); constants. `ensureOwnerActivities` (first-login
activity seeding) added to `useEnsureProfile`. USDA search fix in `27e4b89` — see **Failure F2**.
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
Built: `src/lib/report.ts` (+tests), `EnergyBalanceCard`, shared `NutrientReport`, `Dashboard` (range
dropdown), `DailyReportSheet` (`/report/:day`), `constants/{nutrient-sections,ranges}.ts`.
Rationale: averages divide by **days-with-entries** (a typical logged day), per `01-screens.md`; one
`NutrientReport` serves both screens (single day → 1 logged day).

### M7 — Library (`986448f`)

Goal: create/edit/delete custom foods/supplements and activities.
Built: `Library.tsx` (Foods/Activities tabs, search, swipe-delete, edit, +New), `NewFoodSheet`
(full collapsible nutrient entry; blank inputs omitted), `NewActivitySheet` (template, MET-by-effort,
icon picker), `CollapsibleSection`, `serving.replaceServings`.
Rationale: forms are outer-loader + inner-form (lazy `useState` init) so edits preload without a
set-state-in-effect; edit re-inserts servings (`replaceServings`) — simplest correct sync at this
scale.

### M8 — Settings (`ea43586`)

Goal: profile/targets/visibility/units/account.
Built: `Settings.tsx`, `HighlightedNutrientsSheet` (cap 8), `VisibleNutrientsSheet` (grouped toggles

- protein target + "limited data" notes), `useProfileEditor`. `useProfile` now refetches on the
  `diary-refresh` tick so edits propagate to Diary/Dashboard.
  Rationale: auto-save on change (per the spec's button convention); units are display-only via
  `src/lib/units.ts`.

### M9 — PWA polish (`c9a2c2c`)

Goal: real icons, smaller bundle, verified PWA, then deploy.
Built: branded coral-ring icons (`public/`, incl. a padded maskable) + manifest update; **barcode
scanner code-split** — `AddFoodSheet` lazy-loads `BarcodeScanner`, moving `@zxing` into its own
~470 kB chunk (initial JS ~1 MB → ~567 kB). `registerType: 'autoUpdate'` (silent SW update).
Subsequently deployed to Vercel + installed on iPhone (see post-launch work below).

### Post-launch polish (session, June 2026)

A batch of usability + data fixes after the first deploy. Behavior is in the specs; the notable
engineering decisions:

- **Schema:** added `activity.default_duration_min` (prefills the Activity Log duration). Then
  **consolidated migrations** — folded the API-role grants (old F1 migration) _and_ the new column
  into `20260613120000_init_schema.sql`, so the tree is just `init_schema` + `seed_nutrient`. The live
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
- **Schema:** `20260615120000_networth_schema.sql` — `networth_snapshot` (one row per user+month,
  `month` CHECK-normalized to the 1st, `UNIQUE(user_id, month)`) and `asset_entry` (own `user_id` for
  direct RLS like `diary_entry`; `snapshot_id` ON DELETE CASCADE; `value_native`/`fx_rate_to_base`/
  `value_base` stored so a month's HKD figures freeze against later FX revisions). RLS + 4 owner
  policies + explicit per-table grants, matching `init_schema`.
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

The Shows module (TV shows + movies) is specced in `docs/06-shows.md` (a staging doc whose sections
merge into the permanent specs as each feature lands). It drops into the multi-module architecture
with no structural change. Two **owner decisions deviate from `06-shows.md`** and are carried in the
permanent docs as built: (1) the back-catalogue importer is **in-app, not a CLI script** (same
reversal as Net Worth — an in-app preview table lets the owner fix no-match/ambiguous TMDB rows
inline); (2) a **Shows Settings** screen (`/shows/settings`) adds Entry/Edit **field-visibility** +
an **importer enable/disable** toggle, with both prefs synced on `profile`.

### M1 — Schema + module registration + scaffold screens

Goal: a runnable, navigable Shows module behind a hub card, before any data layer or external API.

- **Schema:** `20260617120000_shows_schema.sql` — one `show` table (own `user_id` for direct RLS like
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

- **Migration** `20260617130000_profile_show_settings.sql`: adds `profile.show_visible_fields text[]`
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

Goal: track Chinese-language content — esp. Chinese documentaries / CCTV series TMDB often lacks or only
carries under Chinese titles. Four owner decisions taken before building (see `06-shows-enhancement.md`'s
ambiguities): **(1)** edit the original `20260617120000_shows_schema.sql` + recreate the table (the DB
held no live data) rather than ship an additive migration; **(2)** **remove** the dormant `content_rating`
column outright (it was fetched/displayed nowhere); **(3)** Library handles `master_series` with a
**filter only** (no grouped headers); **(4)** documentary uses the **`/tv`** endpoint by default.

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

The Books module (books read / to read) is specced in `docs/06-books.md` (a staging doc whose
sections merge into the permanent specs as each feature lands). Per that doc it is **"the Shows module
re-skinned for books"**, so it drops into the multi-module architecture with no structural change and
its build mirrors the Shows M1–M7 sequence. **Four owner decisions deviate from `06-books.md`** and
are carried in the permanent docs as built: (1) the back-catalogue importer is **in-app, not a CLI
script** (same reversal as Net Worth / Shows — an in-app preview lets the owner fix no-match/ambiguous
Google Books rows inline); (2) a **Books Settings** screen (`/books/settings`) adds Entry
field-visibility + an importer enable/disable toggle, synced on `profile` (mirrors Shows Settings);
(3) the **Open Library fallback is built**, not parked, so titles Google Books lacks (and ISBN/cover
lookup) still resolve; (4) the importer **reuses the in-house RFC-4180 parser `src/lib/csv.ts`, not
Papa Parse** — verified against the real `templates/quotes-seed-local.csv` that `csv.ts` already
handles quoted fields with embedded commas, `""` escapes, embedded newlines, and the Excel BOM, and
the Books CSV (`title,author,rating,lgbtq_rep,end_date`) has no multi-line cells at all.

### M1 — Schema + module registration + scaffold screens

Goal: a runnable, navigable Books module behind a hub card, before any data layer or external API.

- **Schema:** `20260620120000_books_schema.sql` — one `book` table (own `user_id` for direct RLS like
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

- **Migration** `20260620130000_profile_book_settings.sql`: adds `profile.book_visible_fields text[]`
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

The Quotes module (favourite quotes from TV/film/books/podcasts/articles/videos/songs, English or
Chinese) is specced in `docs/07-quotes.md` (a staging doc whose sections merge into the permanent
specs as each milestone lands, then it is deleted — same lifecycle as `06-shows.md`/`06-books.md`).
It drops into the multi-module architecture with no structural change. Structurally it is **Books/Shows
re-skinned** with three genuinely new pieces landing in later milestones: a cross-module **Show/Book
linker** (local search — there is **no external metadata API**; "Discover Quotes" external fetch is out
of scope), a **tags input + tag facet**, and the **Moment-of-Zen** randomiser. **Owner decisions**
carried as built: (1) Show-link auto-fill leaves **Author empty** (the seed uses the speaker/character
as `author`); a Book link still fills Author from `book.authors`. (2) Zen refresh is a \*\*shuffle button

- pull-to-refresh** (works on non-touch iPad/desktop). (3) the importer's optional Title→link is
  **scoped by source type\*\* (tv/movie→Show, book→Book; others→no link).

**CSV parsing — Papa Parse is NOT used; the in-house `src/lib/csv.ts` is** (the same decision Books
made). The spec docs say "Papa Parse", but `papaparse` is not a dependency: `parseCsv` already handles
quoted fields, embedded commas, `""` escapes, **multi-line quoted cells**, and the Excel BOM. Verified
against the real `templates/quotes-seed-local.csv`, which **does** contain an RFC-4180 multi-line quoted
cell (the Schitt's Creek "Moira/Roland" row spans two physical lines) plus `""` escapes and quoted
comma-bearing Tags — so a naïve split is wrong, but `csv.ts` parses it correctly.

### M1 — Schema + module registration + scaffold screens

Goal: a runnable, navigable Quotes module behind a hub card, before any data layer.

- **`.gitignore` first** (F7): the owner's `templates/quotes-seed-local.csv` was present, **untracked,
  and not yet ignored** (a `git add .` would have committed private data). Added the Quotes block
  (`quotes-import*.csv` + `quotes-seed-local.csv` + `!templates/quotes-import-template.csv`) **before**
  any staging; verified `git check-ignore` now reports the seed file ignored.
- **Schema:** `20260621120000_quotes_schema.sql` — one `quote` table (own `user_id` for direct RLS like
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

- **Migration** `20260621130000_profile_quote_settings.sql`: adds `profile.quote_visible_fields text[]`
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

## Failures & gotchas to not repeat

- **F1 — RLS without table GRANTs → `42501 permission denied` (M3).** Tables created by raw-SQL
  migrations do **not** inherit Supabase's default grants to the `anon`/`authenticated` API roles, so
  enabling RLS alone left the authenticated role with no table access; first login failed on the
  `profile` select. Fix: the API-role grants (originally `20260613120200_grant_api_roles.sql`, since
  merged into `20260613120000_init_schema.sql`) grant privileges + set default privileges. **Every
  migration must grant to the API roles** — now specified in `03-data-model.md` and `CLAUDE.md`. Don't
  "fix" a future permission error by loosening RLS.
- **F2 — USDA `GET /foods/search` 400s on `dataType` (M5).** A GET search whose `dataType` includes
  `"Survey (FNDDS)"` returns HTTP 400 (the space/parens), which also yielded stale `fdcId`s that then
  404'd on the detail endpoint. Fix: **search via POST** with a JSON body. Don't switch food search
  back to GET — see `02-tech-spec.md` → External APIs.
- **F3 — `@zxing/browser` peer range (M5).** `@zxing/browser@0.2` peers `@zxing/library@^0.22`, so
  `@zxing/library` was pinned to 0.22 (M1 had installed 0.23). Don't bump `@zxing/library` past 0.22
  without also moving `@zxing/browser`, or `npm install` needs `--legacy-peer-deps`.
- **F4 — `useAsync` dep-array shape (M5).** An early `useAsync(fn, deps)` passing a variable `deps`
  array was rejected by the `react-hooks` v7 ESLint rule ("dependency list must be an array literal").
  The shipped `useAsync(fn)` takes a single stable (caller-`useCallback`'d) `fn` and exposes
  `refetch`. Don't reintroduce a `deps` parameter; memoize `fn` at the call site instead.
- **F5 — `npx tsc --noEmit` type-checks nothing.** The root `tsconfig.json` is references-only
  (`files: []` + project references), so a bare `npx tsc --noEmit` exits 0 without checking the app.
  Verify types with **`npm run typecheck`** (`tsc --noEmit -p tsconfig.app.json`) or `tsc -b`.
- **F6 — Add Food search: a cluster of bugs (post-launch).** (a) **USDA Branded flood:** a single
  `/foods/search` across all `dataType`s ranks the thousands of identical Branded exact-name products
  first (8000+ "BLUEBERRIES"), so the first page is _only_ those — "Blueberries, raw" / "Muffins,
  blueberry" never appear. Fix: query whole-food types and `Branded` as **separate POST searches**,
  merge whole-foods-first, dedupe/cap Branded. Don't fold them back into one search. (b) **Exact
  matches buried nutrient-rich ones:** the relevance scorer ranked an _exact_ name match above a
  _prefix_ match, so a bare 14-nutrient Branded "BLUEBERRIES" sorted above the 61-nutrient
  "Blueberries, raw" (and looked like "uppercase wins"). Fix: exact and leading-prefix matches share
  the top tier in `foodMatchScore`, so the nutrient-count tiebreak orders them — the fuller food wins.
  (b2) **Partial words returned junk/nothing:** USDA matches whole tokens, so "blueberr"/"blueberrie"
  returned 0 hits (or loose noise) and the client scorer can only rank what USDA returns. Fix:
  wildcard the last word at a stem (`toUsdaWildcardQuery`) so partial/plural input recalls the full
  set, then let the scorer filter by the typed term. The wildcard must sit at a **stem** (`blueberr*`),
  not the raw word — `blueberry*` can't match "blueberries" and `blueberries*` can't match
  "blueberry". And the scorer's prefix match must stay **plain** (no fuzzy last-char tolerance), or
  "rice" matches "rich". (c) **Results wouldn't scroll:** the scroll pane was a `flex flex-col`
  column, so the results card
  (a flex item, default `flex-shrink:1`) **shrank to fit** the pane instead of overflowing it; the
  card's `overflow-hidden` then clipped the rows past the fold, unreachable. Fix: make the scroll
  pane a **plain block** `flex-1 overflow-y-auto` (matching the other full sheets) so the card keeps
  its full height and the pane scrolls. A `flex-col` scroll pane needs its children `shrink-0`.

---

- **F7 — Private financial data committed + pushed (Net Worth M1).** The Net Worth seed CSV
  (`templates/networth-seed-template.csv`) was filled with **real** balances and committed/pushed to
  GitHub before being gitignored — gitignore only stops _future_ commits, so the data sat in pushed
  history. Fix: purge with `git filter-repo --invert-paths --path <file>` (then re-add the `origin`
  remote it strips) and **force-push**; commit a **sanitized** template and keep the real file
  gitignored (`*.local.csv`). Lesson: gitignore the private file **before** the first `git add`; a
  committed template must be sanitized example data, never real values. Sanitize example numbers in
  **docs** too.

- **F8 — `useAsync` keeps stale `data` during a refetch (Net Worth)** When `fn` changes, `useAsync`
  flips `loading=true` but **retains the previous `data`** until the new result lands. A screen that
  swaps its loaded subject (e.g. Net Worth Monthly Entry switching months) must **gate the form on
  `!loading`** (and key it by the subject) — else the new subject briefly mounts with the old
  subject's data. See `NetWorthEntry`.

- **F9 — Flex scroll pane, two-part fix: `min-h-0` to pin + `shrink-0` children to stop squish
  (Net Worth Monthly Entry).** The screen is `flex h-full flex-col` with a `shrink-0` header and a
  `flex-1 flex-col overflow-y-auto` body. **(a)** A flex item's default `min-height:auto` refuses to
  shrink below its content, so the body grew to fit every asset card, overflowed, and the **whole
  screen scrolled inside `<main>`** — header included — pushing cards below the fold (read as "cut
  off" / "not displayed"). Fix: **`min-h-0`** on the body (and the `h-full` root) so it constrains to
  the parent and scrolls internally. **(b)** But the body is itself `flex-col`, so once it _was_
  height-constrained its children (default `flex-shrink:1`) **shrank to fit** instead of overflowing —
  empty asset cards collapsed to thin bars and `overflow-hidden` clipped the rest (visible only after
  adding a row pushed total content past the viewport). Fix: **`shrink-0` on every direct child** of
  the scroll pane (Import button, Exchange-rates card, empty note, each asset-group card). Exact same
  root cause as F6(c): a `flex-col` scroll pane needs `min-h-0` on itself **and** `shrink-0` on its
  children. Don't reach for a fixed pixel height.

## Known limitations / deferred (not spec issues — future work)

- Barcode scanning needs an HTTPS origin: works on the deployed PWA (or an HTTPS tunnel), not over a
  plain `http://<LAN-ip>` address.
- Editing a logged **USDA / Open Food Facts food** entry can't restore a non-100 g serving — those
  cached foods have no persisted `serving` rows (see `PARKED.md` → serving fidelity on edit).
- App icons are programmatically-generated placeholder marks (coral ring), not designed artwork.
- Initial JS bundle ~567 kB (supabase-js + react-router + tabler); acceptable, not further optimized.
- DRI data covers only adult female 51–70; adding other bands is pure data in `src/lib/dri.ts` (the
  multi-user onboarding path for non-owner users is documented in code but not built).
