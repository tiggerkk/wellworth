# PARKED — deferred & out-of-scope work

Things deliberately NOT built in Phase 1, with the rationale and any design decisions already made so we don't re-litigate them. The built app + `/docs` spec are the source of truth for what _exists_; this file is the backlog and the "we decided X, don't redo that analysis" record.

Status legend: **Net Worth** (built) · **Deferred** (Phase-1-adjacent, do later) ·
**Out of scope** (intentionally never, or a hard platform limit).

---

## Net Worth · Built (feature-complete)

**What:** Monthly entry of asset values across categories — cash, time deposits, stocks, mutual funds, retirement, insurance, property — each held in one of three currencies (**HKD = base**, CNY, USD). A net-worth figure computed in the base currency, plus total and by-asset-type trend graphs with a selectable time window.

**Status:** **Built** (Net Worth, M1–M6) — Home hub + module nav, the two tables (`networth_snapshot`, `asset_entry`), Monthly Entry, Frankfurter FX, the Dashboard, and the in-app CSV importer all shipped. The items below are the sub-features that remain **deliberately deferred** within Net Worth:

- **Auto stock price lookup** (Alpha Vantage) — manual value entry for now; `details.shares` is stored to support it later.
- **Mutual fund NAV lookup** — no reliable free source for HK/China-domiciled funds; manual only.
- **Per-asset-type stacked-area composition graph** — scope is one line per type, not stacked bands.
- **Liabilities / net-of-debt** tracking — asset-only for now.
- **Individual-asset (sub-type) trends** — aggregates at asset-type level only.
- **Multi-currency display toggle** for the dashboard.
- **Cost-basis / unrealized gain** — `details.cost`/`details.premium` are captured but not yet surfaced.

**Design notes / constraints already decided (00-PRD.md):**

- **Separate tables.** Net Worth shares only **auth + `profile` + the app shell** with Wellness; it does not touch the wellness tables. Additive, not a rebuild.
- Base currency is **HKD**; CNY/USD values convert to base via **Frankfurter** (keyless, ECB-sourced; quotes CNY directly) as of the 1st of the month, with a manual per-currency override; the rate + `value_base` are frozen on each entry.
- **`recharts` is already installed** specifically for the trend graphs (it was unused in Phase 1).
- Reuse the existing patterns: `src/data/*` repositories, `useAsync`, the RESET/SAVE dirty-snapshot form pattern, the `BottomNav`/`AppShell` shell — Net Worth slots in as a module under the Home hub.
- Multi-user-ready by default (every table carries `user_id` + RLS, same as Wellness).

---

## Deferred (Phase-1-adjacent)

### "Log this again" re-log · Deferred

**What:** Re-log a past diary entry to today (e.g. from a history/favorites view) in one tap.
**Why deferred:** Not in the Phase-1 screen set; the daily loop + copy-day cover the core need.
**Decided:** `diary_entry` already keeps `food_id`/`activity_id`/`serving_id` and a full nutrient/energy/label **snapshot** precisely for this — a re-log clones the snapshot to the target day (like the Multi-Select `cloneEntriesToDay`, but a one-tap per-entry shortcut). No schema change needed.

### Restore (un-delete) via `deleted_at` · Deferred

**What:** Restore a soft-deleted food/activity (a Trash/Archive view).
**Why deferred:** Not needed for Phase 1; soft delete was implemented to make this free later.
**Decided:** Foods/activities soft-delete (`deleted_at`); lists filter `deleted_at IS NULL`. Restore = set `deleted_at = NULL`. The UI (a "Deleted items" list with a Restore action) is the only missing piece. Diary history is unaffected either way (snapshots).

### Add-Food filter/sort control · Deferred

**What:** A user-facing filter/sort control on Add Food (an earlier `01-screens.md` draft mentioned one; only search + the All/Favorites/Custom tabs were built, and that mention has since been removed).
**Why deferred:** Search + tabs proved sufficient for a single user, and results now auto-sort by name-match relevance then nutrient count (`food-search.ts`), which covers the common need; a manual sort/filter is polish.
**Decided:** Would let the user re-sort/filter the combined result list (e.g. by source, recency, or name).

### Inline favoriting of raw USDA search results · Deferred

**What:** A heart directly on USDA search rows. Currently you favorite from **Food Detail**.
**Why deferred:** Raw USDA results aren't cached in `food` until favorited/logged, so an inline heart would need to cache-on-tap from the list. Saved foods (Favorites/Custom) already have inline hearts.
**Decided:** On inline-favorite, call the same `ensureCachedId` path used by Food Detail, then `setFavorite`.

### Adjustable activity factor in Settings · Deferred

**What:** `profile.activity_factor` (default 1.4) feeds the energy target but isn't editable in the UI.
**Why deferred:** Spec exposes only the Protein Target as a manual override in Phase 1.
**Decided:** The column + default exist; surfacing a Settings field is the only work.

### USDA / Open Food Facts serverless proxy · Deferred (researched)

**What:** A Vercel edge function proxying USDA + OFF.
**Why deferred:** For a single-user app, direct browser calls are fine and match the spec
(`VITE_USDA_API_KEY` is a client var; OFF accepts the browser UA). A proxy was researched and judged unnecessary now.
**Decided / when to revisit:** Add a proxy if going multi-user/public, or if rate-limited — it would (a) hide the USDA key, (b) set OFF's recommended custom `User-Agent` (browsers can't override UA), and (c) give a stable rate-limit IP. Then cache external lookups server-side too.

### PWA update prompt · Deferred

**What:** A "new version available — reload" toast.
**Why deferred:** `vite-plugin-pwa` is `registerType: 'autoUpdate'` (silent update on next load), which is fine for a solo user.
**Decided:** For a prompt, switch to `registerType: 'prompt'` + `virtual:pwa-register/react`'s `useRegisterSW`.

### Offline write queue · Deferred

**What:** Queue diary writes made while offline and sync when back online.
**Why deferred:** Supabase is the single source of truth (sidesteps iOS PWA storage eviction). The SW precaches the app shell so it _loads_ offline, but data reads/writes need the network and fail with the existing error states.
**Decided:** Cloud-authoritative by design; an offline queue would be an additive local cache, not a change to the source of truth.

### Designed app icons · Deferred

**What:** The PWA icons are programmatically-generated placeholder marks (a coral ring on the dark bg): `public/pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`,
`favicon.ico`.
**Why deferred:** Functional install needs valid icons; artwork is cosmetic.
**Decided:** Swap real artwork at the same paths/sizes; keep a padded maskable variant for the safe zone.

### iOS standalone splash screens · Deferred

**What:** Apple `apple-touch-startup-image` launch images (many device sizes).
**Why deferred:** Cosmetic; install/meta already works. High maintenance (per-size assets).

### Imperial display for food amounts · Deferred / decided-against for now

**What:** Showing food amounts / the per-100 g basis in ounces in Imperial mode.
**Why:** Only **Settings** height/weight are imperialized (in/lb); food amounts and nutrient values stay metric/absolute. This was a deliberate simplification (now reflected in `02-tech-spec.md`).

### Diary food-entry serving fidelity on edit · Deferred

**What:** Editing a logged **food** entry restores the exact serving only for custom foods. USDA /
Open Food Facts entries cache a `food` row with no `serving` rows (synthetic servings aren't
persisted), so on edit only a 100 g serving is offered and a non-100 g original can't be reproduced —
Amount is prefilled but recomputed nutrients may differ.
**Why deferred:** Custom foods (the common case) round-trip correctly; the gap only affects edited
external-source entries.
**Decided:** A faithful fix stores the per-unit grams (or `serving_id`) on `diary_entry` at log time
and restores it on edit — a small additive schema change, not a rebuild.

### Activities CSV bulk import · Deferred

**What:** A CSV import for the activity library, mirroring the foods/supplements importer.
**Why deferred:** Foods/supplements import was built (`templates/custom-foods-template.csv`, Library →
**Import CSV**); an activities import was explicitly declined for now.
**Decided:** Mirror the foods path — an activities template (name, template, default_effort,
default_duration_min, met_by_effort, icon) parsed in-browser and inserted via the data layer.

### Shows Library — wide-screen sortable table · Deferred

**What:** On wide screens (iPad), render the Shows Library as a sortable **table** with tappable
column headers, instead of the list + Sort-menu.
**Why deferred:** `06-shows.md` lists it as a "may"; header-click sorting is a desktop idiom. Phones

- iPad both ship the **list + Sort-menu** (the Sort menu already covers every column), which is the
  correct mobile-first idiom and avoids a second responsive layout.
  **Decided:** The pure `applyLibraryView(shows, criteria)` (`src/lib/shows.ts`) already does all the
  filtering/sorting; a table view would be an additive presentation over the same criteria + helper.

### Shows Library — filter/sort URL-persistence · Deferred

**What:** Persist the Library's filter + sort state across navigation (e.g. in `useSearchParams`), so
leaving the tab and returning restores it.
**Why deferred:** M5 keeps the criteria in local component state (resets on remount) — fine for a
single user and simpler. The Wellness Library persists only its tab in the URL today.
**Decided:** Mirror the Wellness "URL-as-state" pattern — serialize `LibraryCriteria` into query
params written with `{replace:true}`; the screen already centralizes the criteria in one state object.

### Automated tests beyond pure helpers · Deferred

**What:** Component/integration tests; tests for `src/data/*` repositories.
**Why deferred:** The suite unit-tests the pure calc/mapping helpers (the spec's named targets, plus the CSV-parse, food-import, quantity, and food-search helpers — 76 tests). Repos are thin wrappers verified manually + by `tsc` against the generated schema.

---

## Multi-user / family · Deferred (schema is ready)

**What:** Multiple family members, each their own Google account + data; later, shared household custom foods.

**Why deferred:** PRD builds Phase 1 multi-user-_ready_ but with no family-only features.

**Decided / constraints (so a future session doesn't redo this):**

- The schema is already isolated per user (`user_id` + RLS on every table), so additional members work with **no schema change** — they sign in and get their own `profile`/data.
- **First-run seeding is currently owner-specific and must change for real multi-user.** Today `useEnsureProfile` seeds the _owner's_ body metrics (`src/constants/profile-defaults.ts`) and the owner's starter activities (`src/constants/seed-activities.ts`) to _any_ new user. For non-owner users, seed only **neutral** defaults (units, activity factor, the default visible/highlighted sets) and route them through an **onboarding/Settings step** to enter their own birthday/sex/height/weight — never inherit the owner's metrics. (This is noted in those files' header comments.)
- **DRI bands:** `src/lib/dri.ts` only populates **adult female 51–70** and throws otherwise. Other users need their sex/age bands added (pure data) before targets compute.
- **Shared household custom foods** would be an **additive** change: a nullable `household_id` + a shared-visibility RLS policy (per `03-data-model.md`), not a rebuild.

---

## Out of scope (non-goals / hard limits)

- **Automatic step / activity sync (HealthKit, etc.)** — **Out of scope, permanent.** HealthKit is native-only and unreachable from a PWA. Steps/activity are entered **manually**. Do not attempt native health sync. (Note: there is no dedicated "steps" metric/screen in Phase 1; physical activity is logged via the activity library, e.g. Walking.)
- **Social features, ads, third-party tracking/analytics** — non-goals (PRD).
- **Medical-device claims** — nutrient targets are public-DRI guidance, not medical advice.
- **Native app / App Store** — the whole point is a free installable PWA (no Apple Developer account).

---

## Code TODO/FIXME scan

A scan of `src/**` for `TODO` / `FIXME` / `HACK` / `XXX` / `WIP` markers found **none** — there are no unfinished-work comments in the source. (The only `placeholder` occurrences are HTML input `placeholder` attributes; "later" appears only in explanatory doc-comments.) The one genuine placeholder artifact is the generated icon set under `public/` (see "Designed app icons" above).
