# PARKED — deferred & out-of-scope work

Things deliberately NOT built yet, with the rationale and any design decisions already made so we don't re-litigate them. The built app + `/docs` spec are the source of truth for what _exists_; this file is the backlog and the "we decided X, don't redo that analysis" record.

Status legend: **Net Worth** (built) · **Deferred** (later) ·
**Out of scope** (intentionally never, or a hard platform limit).

---

## Net Worth (built)

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

## Medical (built)

**What:** A private multi-year record of lab results + narrative reports, with trend charts; intake via
manual entry or a structured JSON/CSV import (no in-app OCR); Google-Drive-URL storage; a biometric/PIN
lock. **Shipped** end-to-end (see BUILD-LOG → "Medical Build Sequence"; behaviour lives in the permanent
`/docs`). The items below are decided **Medical** non-goals / deferrals so they aren't re-litigated:

- **Alternate Dashboard trend layouts (one-chart-with-selector, sparkline-vs-chart Settings toggle)** —
  **Deferred, not built.** M4 ships the sparkline-grid-with-expand layout only. The data layer
  (`useMedicalTrends` over `lib/medical-trends.ts`) is deliberately layout-agnostic, so an alternate
  presentation could be added later as a new component over the same hook (optionally behind a profile
  toggle) without touching the data layer. Build only if the single layout proves insufficient.

- **Display-only unit-normalization toggle** — **Out of scope.** Cross-provider values are normalized to
  each test's canonical `default_unit` **at import** (flagged via `medical_result.normalized`, original
  kept in `value_num_original`/`unit_original`). The app does **not** offer an on/off "show another unit"
  view — that would be computing a clinical value on the fly, which the module forbids (it never invents
  or derives values, e.g. no eGFR, no computed reference ranges).
- **Server-verified WebAuthn / true background lock** — **Out of scope (hard PWA limit).** A PWA has no
  background-lock lifecycle and there is no relying-party backend, so the biometric lock is a
  **client-side UX gate** over already-RLS-protected data: it challenges on cold start / after the
  configurable idle timeout, with a **mandatory PIN fallback** (biometric is an optional faster unlock
  that always degrades to the PIN). It is a convenience layer over RLS, not a cryptographic boundary.

---

## Deferred

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

**What:** The PWA icons are placeholder marks (an accent-blue ring on the dark bg): `public/pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`,
`favicon.ico`. They are now reproducibly generated by `scripts/gen-icons.mjs` (`npm run gen:icons`) — the ring colour/geometry live at the top of that file (mirrors `src/components/RingMark.tsx`).
**Why deferred:** Functional install needs valid icons; bespoke artwork is cosmetic.
**Decided:** To swap in real artwork, edit the SVG in `scripts/gen-icons.mjs` (keep the padded maskable variant for the safe zone) and re-run — or replace the PNGs at the same paths/sizes.

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

### Shows — bulk "sync all" refresh · Deferred

**What:** A one-tap "refresh every show from TMDB" action.
**Why deferred:** Only **per-show** Refresh from TMDB is built (M8). The owner always knows which title
needs a re-pull (a contributed entry cleared moderation, a show gained a season), so a bulk sync would
spend a lot of TMDB calls for little benefit and risks overwriting many rows at once.
**Decided:** The pure `buildRefreshPatch` + `refreshFromTmdb` are per-show; a bulk action would just
map them over `listShows`, gated behind an explicit confirm, if ever wanted.

### Shows — auto-rematch un-linked titles to TMDB · Deferred

**What:** Automatically (re)match a show that has no `tmdb_id` (e.g. a niche documentary imported
metadata-less) to a TMDB entry.
**Why deferred:** M8 upgrades such a row only by a **manual** re-search (or a pasted Poster URL). Auto
top-hit matching is exactly what produces wrong matches for niche/Chinese titles; the owner picking the
right hit is safer.
**Decided:** The Entry **Search TMDB** + **Refresh** already cover the manual upgrade path.

### Shows — Chinese search-as-you-type via a Worker · Rejected (revisit only if needed)

**What:** Live Chinese title suggestions (Douban/Bilibili) for shows TMDB lacks.
**Why rejected:** A Cloudflare Worker / Douban–Bilibili scraping / server-side OG parsing is fragile,
targets hostile endpoints, and **ends the no-backend architecture**. Manual entry + a pasted poster +
contributing to TMDB cover the need (M8).
**Decided:** If Chinese search-as-you-type ever becomes high-frequency, revisit a Worker over
**Bilibili's keyless suggest endpoint** only — **never** a Douban scraper.

### Books Library — wide-screen sortable table · Deferred

**What:** On wide screens (iPad), render the Books Library as a sortable **table** with tappable column
headers, instead of the list + Sort-menu.
**Why deferred:** `06-books.md` lists it as a "may"; header-click sorting is a desktop idiom. Phones +
iPad both ship the **list + Sort-menu** (which already covers every column), the correct mobile-first
idiom, avoiding a second responsive layout.
**Decided:** The pure `applyLibraryView(books, criteria)` (`src/lib/books.ts`) already does all the
filtering/sorting; a table view would be an additive presentation over the same criteria + helper.

### List filter/sort — shareable-URL persistence · Deferred

**What:** Make a Library/Reports/Trips view's search + filter + sort **bookmarkable / shareable** by
also reflecting the criteria in the URL (`useSearchParams`).
**Why deferred:** Session persistence is now **built** — every list screen holds its criteria in
`useSessionState` (`src/hooks/useSessionState.ts` → `sessionStorage`), so the view survives the
navigate-into-an-item-and-back remount (via Back, bottom nav, or Home) and clears on tab/app close. The
remaining gap is only a shareable URL, which a single-user personal Library doesn't need. (The
`?show=`/`?book=` "Quotes from this title" constraint is already URL-driven.)
**Decided:** If shareability is ever wanted, layer query-param encode/decode over the same centralized
criteria object on top of (or in place of) the `sessionStorage` hook.

### Quotes — per-category badge colours · Deferred

**What:** A fixed accent colour per Category badge on the Zen card / Library rows (instead of one
neutral chip for all categories).
**Why deferred:** The spec marks it **optional**, and the dark theme has only ~4 semantic colour tokens,
so distinct category colours would need a new palette. The single neutral `QUOTE_CATEGORY_CHIP`
(via the presentational `StatusChip`) ships now.
**Decided:** Categories are now **owner-configurable** (`profile.quote_categories`), so a static
`Record<QuoteCategory, string>` no longer fits — add an optional `color` to each `QuoteCategoryConfig`
entry (set in the Categories management sheet), defaulting to the neutral chip, and pass it to the
existing chip. Purely additive.

### Global Traditional/Simplified Chinese display toggle · Deferred

**What:** A Settings preference that rewrites **all on-screen Chinese** to the chosen script
(Traditional **HK** / Simplified) — display-only, **never** changing stored DB values. The owner is in
Hong Kong, so Traditional means OpenCC **`hk`**. Target: user data **and** app-defined Chinese labels
(dynasty names, hardcoded labels like 中国省份).

**Why deferred:** It is moderately invasive — the app has ~80 inline text render sites and **no central
text chokepoint** — whereas variant-agnostic **search** (the higher-value half) shipped first. Building
search first also validates the `opencc-js` engine choice before the display work.

**Decided (don't re-litigate):**

- **Storage:** a `profile.zh_display` column (`'off' | 'traditional' | 'simplified'`, default `'off'`) —
  migration + `npm run gen:types`. Mirrors the existing `units` preference exactly (Settings →
  `ProfileMetricsFields` `SegmentedTabs` + `useProfileEditor` auto-save).
- **Engine reuse:** the conversion is **already built** — `convertZh(text, 'hk' | 'cn')`
  (`src/lib/zh-convert.ts`, lazy `opencc-js`, loaded for remote search). The toggle adds a
  `DisplayPreferenceProvider` (wrap at `src/main.tsx`) + a memoized `<Zh>` text wrapper / `useZhText()`
  applied at the render boundary (read screens + shared `StatusChip`/`ListRow`/`SectionCard`).
- **Perf:** conversions memoized per `(text, target)` — a cached dictionary lookup, negligible steady-state.

### Automated tests beyond pure helpers · Deferred

**What:** Component/integration tests; tests for `src/data/*` repositories.
**Why deferred:** The suite unit-tests the pure calc/mapping helpers (the spec's named targets, plus the CSV-parse, food/shows/books/quotes-import, quantity, and search helpers — 230+ tests). Repos are thin wrappers verified manually + by `tsc` against the generated schema.

---

## Multi-user / family · **Per-member login + onboarding SHIPPED** (sharing still deferred)

**What shipped:** Multiple family members, each their own Google account + strictly-private data. Each
member is allow-listed (`VITE_ALLOWED_EMAILS`), the owner is identified by `VITE_OWNER_EMAIL`
(`isOwnerEmail`), non-owners get the neutral `MEMBER_PROFILE_SEED` (no owner body metrics) and are
forced through the **Onboarding** wizard (`src/screens/Onboarding.tsx`, gated in `AppShell`) via the
`profile.onboarded_at` flag. No schema-wide change — RLS already isolated every table per `user_id`.

**Still deferred:** shared/household data and a couple of known limitations:

- **DRI bands:** `src/lib/dri.ts` populates **adult female & male, 31–50 · 51–70 · 71+** (i.e. 31
  through 71+, both sexes). Only members **under 31** (or a non-binary `sex`) get **no nutrient
  targets** — `computeTargets` returns null (graceful, no crash). Add a younger band the same way
  (pure data — spread a nearby band and override the differences) if ever needed.
- **Base currency is global HKD** (`BASE_CURRENCY` in `src/lib/networth.ts`; Travel converts to HKD).
  Not per-member — revisit as its own task (FX rework) if a member needs a different base.
- **Shared household custom foods / shared net worth / shared trips** would be an **additive** change:
  a nullable `household_id` + a shared-visibility RLS policy (per `03-data-model.md`), not a rebuild.
  Strictly-private is the current, intended model.
- **Allowlist + owner are build-time `VITE_*`** — adding a member or changing the owner needs a
  **redeploy**, not a runtime change.

---

## Out of scope (non-goals / hard limits)

- **Automatic step / activity sync (HealthKit, etc.)** — **Out of scope, permanent.** HealthKit is native-only and unreachable from a PWA. Steps/activity are entered **manually**. Do not attempt native health sync. (Note: there is no dedicated "steps" metric/screen in Phase 1; physical activity is logged via the activity library, e.g. Walking.)
- **Social features, ads, third-party tracking/analytics** — non-goals (PRD).
- **Medical-device claims** — nutrient targets are public-DRI guidance, not medical advice.
- **Native app / App Store** — the whole point is a free installable PWA (no Apple Developer account).
- **Quotes — "Discover Quotes" / external quote fetch** (the Wikiquote + TV-quotes routing engine) —
  **parked.** The reliability and CORS of those sources are unproven, and manual entry + the `?text=`
  prefill + the CSV importer cover the need. The `language` field is kept so routing could be added
  later. (Quotes deliberately has **no external metadata API**, unlike Shows/Books.)
- **Quotes — Traditional vs Simplified Chinese `language` value** — the `language` enum keeps a single
  `zh` (no Trad/Simp split of the stored field). Note this is now narrower than it once was: **search**
  _is_ script-agnostic across all modules (Traditional⇄Simplified matching shipped — see
  `BUILD-LOG.md` → "Variant-agnostic Chinese search"), and a display-only **script toggle** is a
  Deferred item above — but neither splits or rewrites the stored `language`/text values.
- **Quotes — direct Apple Books integration** — not possible from a PWA; the ingestion path is
  copy-paste, the **Paste from clipboard** button, the CSV importer, and the optional Apple **Shortcut**
  that opens `/quotes/entry?text=…` (see OWNER-RUNBOOK). The `Article` source type exists but the import
  file has no article rows yet.
- **Travel — province/state-level map fill outside China** — **parked.** Non-China countries are filled
  whole (Natural Earth admin-0). Admin-1 shading elsewhere would need Natural Earth admin-1 + per-country
  province-name matching; the `regionName → shape` model leaves room to add it without rework.
- **Travel — GCJ-02 offset correction** — **parked (v1).** Stored coords, the bundled GeoJSON, and OSM
  tiles are all treated as WGS-84; the GCJ-02 visual offset over Chinese areas isn't corrected. It's
  invisible at province/country zoom (the only place fill is drawn) and a few-hundred-metre dot offset at
  city zoom is acceptable for a personal log.
- **Travel — offline map** — the map needs network: OSM tiles aren't cached, and the two `public/geo/*`
  GeoJSON are intentionally excluded from the PWA precache (loaded on demand with the lazy map chunk).
- **Travel — all-trips spend roll-up on the Dashboard** — **parked** (the `00-PRD` non-goal: no
  cross-currency dashboard conversion beyond the per-trip HKD total). Each trip computes its own HKD total
  in its Expenses tab (M5); the Dashboard shows only count-based metrics (trips this year, days travelled),
  not a money figure, since a cross-trip total would need every trip's rates loaded at once.
- **Travel — city-edit cascade** — **deliberately not built.** A new stop's City/Province/Country carry
  forward from the previous stop, but **editing** an existing stop's city changes only that stop (no
  cascade to following same-city stops). The owner chose the simpler, predictable behaviour; cascade
  would be more "magic" for a rare relabel.

---

## Code TODO/FIXME scan

A scan of `src/**` for `TODO` / `FIXME` / `HACK` / `XXX` / `WIP` markers found **none** — there are no unfinished-work comments in the source. (The only `placeholder` occurrences are HTML input `placeholder` attributes; "later" appears only in explanatory doc-comments.) The one genuine placeholder artifact is the generated icon set under `public/` (see "Designed app icons" above).
