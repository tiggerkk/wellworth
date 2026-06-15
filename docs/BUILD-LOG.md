# BUILD-LOG — WellWorth Phase 1 (Wellness)

Engineering history: the build sequence, the rationale behind key decisions, and a short list of
approaches that were tried and **failed** (so they aren't repeated). **This file is not a behavior
spec** — `/docs/00-PRD.md … 05-seed-data.md` + `CLAUDE.md` are the source of truth and already
describe what the app does. Where this log mentions a past failure, it points to the spec section that
now encodes the correct approach.

Phase 2 (Net Worth) is **in progress** — see "Phase 2 — Net Worth (build sequence)" below.

---

## Snapshot

- **Stack (as built, June 2026):** React 19.2, react-router 7.17 (unified `react-router` package),
  Vite 8.0, TypeScript 6.0 (strict), Tailwind 4.3 (CSS-first via `@tailwindcss/vite`),
  vite-plugin-pwa 1.3, `@supabase/supabase-js` 2.108, `@zxing/library` 0.22 + `@zxing/browser` 0.2,
  `@tabler/icons-react` 3.44, Vitest 4.1, ESLint 10 (flat config), Prettier 3.8, husky 9. `recharts`
  3.8 is installed but unused (Phase 2).
- **Scripts:** `dev`, `build` (`tsc -b && vite build`), `preview`, `lint`, `format`, `typecheck`,
  `test`, `check` (all gates), `gen:types` (Supabase → `src/types/database.ts`), `prepare` (husky).
- **Env (`.env`, gitignored; `.env.example` documents):** `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_USDA_API_KEY`. All build-time `VITE_` vars.
- **Gates:** husky `.husky/pre-commit` → lint-staged + `typecheck` + `test`; GitHub Actions
  (`.github/workflows/ci.yml`, Node 24) re-runs `check` + `build`. 76 Vitest tests (pure helpers).
- **Deploy status:** Deployed. GitHub `main` → Vercel auto-deploy; the production URL is in the
  Supabase redirect URLs + Google JS origins (see `OWNER-RUNBOOK.md`). Installed + tested on iPhone (PWA).
- Conventions (DB-access-via-`src/data`, metric storage, generated `database.ts` contract, etc.) live
  in `CLAUDE.md` and `02-tech-spec.md` — not repeated here.

---

## Build sequence (per milestone)

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

## Phase 2 — Net Worth (build sequence)

### M1 — Secure seed data + Net Worth schema (this session)

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
  what Frankfurter (ECB) quotes — so FX needs no code translation. Docs (`00-PRD`, `06-networth`,
  `PARKED`) updated accordingly.
- **Import is in-app, not a script.** Per the owner's choice, the one-time CSV seed becomes a reusable
  **in-app importer** (anon key + RLS, signed in as the owner) that creates/replaces a month's entries
  — idempotent per month. Built in a later Net Worth milestone.
- **Navigation grows into a Home hub** (owner's decision): instead of a two-way Wellness⇄Net Worth
  switch, a top-level Home hub of module cards, Wellness moved under `/wellness/*`, Settings lifted to
  the global level, last-used-module reopen. Built in the next milestone (M2). `00-PRD.md` carries the
  navigation model.

### M2 — Home hub + module routing refactor (this session)

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
- **Module-aware shell.** `BottomNav` takes a `module` prop (its tabs + a trailing Home item);
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

---

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

- **F7 — Private financial data committed + pushed (Phase 2 M1).** The Net Worth seed CSV
  (`templates/networth-seed-template.csv`) was filled with **real** balances and committed/pushed to
  GitHub before being gitignored — gitignore only stops _future_ commits, so the data sat in pushed
  history. Fix: purge with `git filter-repo --invert-paths --path <file>` (then re-add the `origin`
  remote it strips) and **force-push**; commit a **sanitized** template and keep the real file
  gitignored (`*.local.csv`). Lesson: gitignore the private file **before** the first `git add`; a
  committed template must be sanitized example data, never real values. Sanitize example numbers in
  **docs** too — a real balance had leaked into a `06-networth.md` parsing example.

## Known limitations / deferred (not spec issues — future work)

- Barcode scanning needs an HTTPS origin: works on the deployed PWA (or an HTTPS tunnel), not over a
  plain `http://<LAN-ip>` address.
- Editing a logged **USDA / Open Food Facts food** entry can't restore a non-100 g serving — those
  cached foods have no persisted `serving` rows (see `PARKED.md` → serving fidelity on edit).
- App icons are programmatically-generated placeholder marks (coral ring), not designed artwork.
- Initial JS bundle ~567 kB (supabase-js + react-router + tabler); acceptable, not further optimized.
- DRI data covers only adult female 51–70; adding other bands is pure data in `src/lib/dri.ts` (the
  multi-user onboarding path for non-owner users is documented in code but not built).
