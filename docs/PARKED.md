# PARKED — deferred & out-of-scope work

Things deliberately NOT built yet, with the rationale and any design decisions already made so we don't re-litigate them. The built app + `/docs` spec are the source of truth for what _exists_; this file is the backlog and the "we decided X, don't redo that analysis" record.

Status legend: **Net Worth** (built) · **Deferred** (later) ·
**Out of scope** (intentionally never, or a hard platform limit).

---

## Net Worth (built)

**What:** Monthly entry of asset values across categories — cash, time deposits, stocks, funds, retirement, insurance, property — each held in one of three currencies (**HKD = base**, CNY, USD). A net-worth figure computed in the base currency, plus total and by-asset-type trend graphs with a selectable time window. Funds import from the JPM monthly CSV; insurance is an age-resolved policy catalogue (`insurance_policy`/`insurance_schedule`/`insurance_schedule_point`).

**Status:** **Built** (Net Worth, M1–M6 + the 2026-06-28 funds/insurance enhancement) — Home hub + module nav, `networth_snapshot` + `asset_entry` + the insurance catalogue tables, Monthly Entry, Frankfurter FX, the Dashboard, and the manual/fund/insurance importers all shipped. The items below are the sub-features that remain **deliberately deferred** within Net Worth:

- **Auto stock price lookup** (Alpha Vantage) — manual value entry for now; `details.shares` is stored to support it later.
- **Auto fund NAV lookup** — no reliable free source for HK/China-domiciled funds; NAV/return/P&L now come from the **JPM monthly CSV import** instead.
- **Per-asset-type stacked-area composition graph** — scope is one line per type, not stacked bands.
- **Liabilities / net-of-debt** tracking — asset-only for now.
- **Individual-asset (sub-type) trends** — aggregates at asset-type level only.
- **Multi-currency display toggle** for the dashboard.
- **Dedicated per-policy & aggregate insurance line charts** — the 2026-06-28 enhancement ships the data + metrics for **Actual-vs-Original Variance**, the **Surrender Curve**, and the **Premiums Trajectory** (in the Policy detail metrics/schedule table), plus an aggregate **Cash Value vs Total Premiums** chart with break-even on the Dashboard. The remaining items — dedicated _line charts_ for per-policy Variance / Surrender Curve / Premiums Trajectory, and an aggregate Variance chart — are deferred; the resolution helpers (`buildResolvedSeries`, `varianceAtAge`, `surrenderGainPctPerYear`) already provide every series, so these are presentational-only follow-ups.
- **Elapsed insurance policies without a policy number** (4 CHUBB blocks in the bulk sheet) are **intentionally skipped** on import (owner no longer tracks them); the importer needs a policy number as the identity/update key. Re-add later via the single-policy import once numbered.
- **Cost-basis / unrealized gain** — funds now surface Total Cost + Profit/Loss (from the JPM import); `details.cost` for other types is still informational only.

**Design notes / constraints already decided (00_PRD.md):**

- **Separate tables.** Net Worth shares only **auth + `profile` + the app shell** with Wellness; it does not touch the wellness tables. Additive, not a rebuild.
- Base currency is **HKD**; CNY/USD values convert to base via **Frankfurter** (keyless, ECB-sourced; quotes CNY directly) as of the 1st of the month, with a manual per-currency override; the rate + `value_base` are frozen on each entry.
- **`recharts` is already installed** specifically for the trend graphs (it was unused in Phase 1).
- Reuse the existing patterns: `src/data/*` repositories, `useAsync`, the RESET/SAVE dirty-snapshot form pattern, the `BottomNav`/`AppShell` shell — Net Worth slots in as a module under the Home hub.
- Multi-user-ready by default (every table carries `user_id` + RLS, same as Wellness).

---

## Medical (built)

**What:** A private multi-year record of lab results + narrative reports, with trend charts; intake via
manual entry or a structured JSON/CSV import (no in-app OCR); Google-Drive-URL storage; a biometric/PIN
lock. **Shipped** end-to-end (see BUILD-HISTORY → "Medical Build Sequence"; behaviour lives in the permanent
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

## Literature (built)

**What:** Classical Chinese poems & prose with search, filter, read-aloud (粵/國), and favourites. The
corpus is an immutable **static asset** (`public/literature/**`, generated from a gitignored `poems.db`);
favourites + read-aloud settings are in Supabase. **Shipped** (see `docs/11_literature.md`). Decided
**Literature** non-goals / deferrals so they aren't re-litigated:

- **`sentences` / 名句 not imported** — the source DB's notable-passages table isn't in the 6 shipped
  screens. Additive later: a `poem_sentence` static file + a Poem-detail section.
- **`audioUrl` unused** — the source's per-poem audio URLs are dropped; read-aloud uses the Web Speech
  API (`useSpeech`) instead, which gives 粵/國 + seek with no hosted audio.
- **iOS single Chinese voice (粵/國 toggle inert on iPhone)** — **Out of scope (hard Safari limit).**
  iOS Safari's Web Speech API exposes only the **one** Chinese voice set as the iOS system default
  (Settings → Accessibility → Read & Speak → Voices → Chinese), so the in-app 粵/國 toggle can't switch
  between Cantonese and Mandarin on iPhone — both follow whatever the iOS default is. Confirmed by Apple
  (downloadable voices aren't returned to the Web Speech API). `PoemReader` surfaces a quiet "voice
  unavailable" note (`voiceAvailable=false`) **and** an info icon → inline note telling the user how to
  change the iOS default voice. Desktop Chrome/Edge expose all voices, so the toggle works there. The
  only way to get both voices on one iPhone is a cloud TTS (`yue-HK`/`zh-CN`) via an Edge-Function
  proxy — not built (online-first + cost). Parallels the Medical WebAuthn framing.
- **Same-URL corpus corrections need a cache-name bump** — poem/writer bodies are CacheFirst
  (`literature-bodies-v1`); a corrected poem at the same URL won't refresh until the cache name is
  bumped on regeneration. Acceptable for an essentially-static corpus.
- **Filter-tag coverage is source-limited (~20%)** — **Decided, don't re-chase.** Only ≈2,037 / 10,000
  poems carry **any** type tag in the source `poems.db`; the rest were never tagged. The curated 主題/時令/
  選集/風格 pills + a ~85-tag alias map (`scripts/build-literature-data.mjs` `TYPE_GROUPS` /
  `TYPE_ALIAS_GROUPS`) already reach **≈95% of the taggable poems** — the ceiling. Untagged poems stay
  reachable via search / dynasty / unfiltered browse. Pushing overall coverage higher would mean
  mis-filing poems under themes the data never assigned, so it's intentionally not done.
- **Server-side search / pagination** — **Decided-against.** The corpus is static + bundled (a small
  in-memory index), so search/filter is client-side via `foldZh`; no DB query layer is needed.

---

## Deferred

### English / 繁體中文 (HK Traditional) UI language toggle · Deferred (scoped 2026-06-30)

**What:** A Settings language picker (English / 繁體中文) that translates **UI chrome** — headers, field
labels, buttons, placeholders, tab labels, empty states, toasts, aria-labels, and dynamic enum labels
(show statuses/types, nutrient names, asset types). **User-entered data stays as typed.**
**Why deferred:** Largest, most independent track — ~350 strings across ~143 `.tsx`, a new i18n
dependency, and a profile column. Sequenced **after** the typography + Dynamic Type work (done
2026-06-30), which it doesn't depend on.
**Decided (so we don't re-analyze):**

- The existing `opencc-js` plumbing (`zh-convert.ts`, `zh-fold.ts`, `zh-query.ts`) is **data-side
  only** (search folding / variant queries) and is **not** reusable for UI translation.
- Use the project's **HK Traditional `'hk'`** locale convention, not Taiwan `'tw'`.
- **Library:** `react-i18next` (extraction tooling, plurals) wrapping a `t()`, or a minimal in-house
  dictionary to avoid the dep — pick at build time. The bulk of the work is string extraction + JSX
  migration, not the toggle.
- **Preference:** add `profile.language` (`'en' | 'zh-hk'`, default `'en'`) — same in-place-migration
  rule as `font_size`; surface the picker next to **Settings → Display → Font Size**.

### HKPL / extra Chinese book catalogue as a match fallback · Deferred

**What:** A third book-metadata source (beyond Google Books + Open Library) with strong Hong Kong /
Traditional-Chinese coverage, e.g. the **HKPL catalogue** via a parse.bot REST wrapper.
**Why deferred:** Evaluated 2026-06-28 and **not** worth it now —

- **CORS-uncertain** for a backend-less app: every book API is called directly from the browser; the
  parse.bot wrapper doesn't document CORS, and adding a proxy is new infrastructure we don't have.
- **Quota too small / paid:** free tier is 100 credits/mo + 5 req/min — one 32-book import (~64
  search+detail calls) blows the month and the rate limit; the usable tier is **US$30/mo**.
- **Sparse metadata:** search returns title/author/publisher/availability only — **no cover, year,
  description, or ISBN** — so it couldn't replace Google Books, only supplement matching (a complex
  two-source merge).
- It's a **third-party scraper**, not an official HKPL API (breaks when HKPL's site changes).

**Decided:** The reported Chinese-import mismatches were **selection bugs, not missing records** — Google
Books has the titles. Fixed client-side instead (shared CJK-safe, author-aware `rankSearchResults` +
`isConfidentMatch`; see `docs/07_books.md` → Matching). Revisit a richer Chinese source only if Google
coverage proves genuinely insufficient, and only with a CORS-safe path.

### "Log this again" re-log · Deferred

**What:** Re-log a past diary entry to today (e.g. from a history/favorites view) in one tap.
**Why deferred:** Not in the Phase-1 screen set; the daily loop + copy-day cover the core need.
**Decided:** `diary_entry` already keeps `food_id`/`activity_id`/`serving_id` and a full nutrient/energy/label **snapshot** precisely for this — a re-log clones the snapshot to the target day (like the Multi-Select `cloneEntriesToDay`, but a one-tap per-entry shortcut). No schema change needed.

### Restore (un-delete) via `deleted_at` · Deferred

**What:** Restore a soft-deleted food/activity (a Trash/Archive view).
**Why deferred:** Not needed for Phase 1; soft delete was implemented to make this free later.
**Decided:** Foods/activities soft-delete (`deleted_at`); lists filter `deleted_at IS NULL`. Restore = set `deleted_at = NULL`. The UI (a "Deleted items" list with a Restore action) is the only missing piece. Diary history is unaffected either way (snapshots).

### Add-Food filter/sort control · Deferred

**What:** A user-facing filter/sort control on Add Food (an earlier draft in the old `01-screens.md` — whose behaviour now lives in the module specs `04_wellness.md`…`10_travel.md` + `03_global.md` — mentioned one; only search + the All/Favorites/Custom tabs were built, and that mention has since been removed).
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
**Why:** Only **Settings** height/weight are imperialized (in/lb); food amounts and nutrient values stay metric/absolute. This was a deliberate simplification (now reflected in `02_tech_spec.md`).

### Diary food-entry serving fidelity on edit · Deferred

**What:** On edit, the original serving is **inferred** by matching the entry's logged energy to a
serving's scaled energy — not stored. **Partially mitigated (2026-06-29):** USDA/OFF foods can now
carry persisted `serving` rows + a default (Food Detail → Manage servings), so a customized food's
non-100 g measures are available on edit; an uncustomized USDA food still only offers its USDA serving

- 100 g. The residual gap is that the **exact** serving used for a given entry isn't recorded, so the
  energy-match can pick a different same-energy serving.
  **Why deferred:** Custom + customized foods (the common case) round-trip well enough; the gap is the
  precise serving identity per entry.
  **Decided:** A faithful fix stores `serving_id` (or the per-unit grams) on `diary_entry` at log time
  and restores it on edit — a small additive change. Caveat: `replaceServings` mints new serving ids on
  every Manage-servings save (F22), so a stored `serving_id` can dangle (ON DELETE SET NULL) — store the
  per-unit grams alongside, or stop replacing-in-place, if doing this.

### Activities CSV bulk import · Deferred

**What:** A CSV import for the activity library, mirroring the foods/supplements importer.
**Why deferred:** Foods/supplements import was built (`templates/wellness-foods-template.csv`, Library →
**Import CSV**); an activities import was explicitly declined for now.
**Decided:** Mirror the foods path — an activities template (name, template, default_effort,
default_duration_min, met_by_effort, icon) parsed in-browser and inserted via the data layer.

### Shows Library — wide-screen sortable table · Deferred

**What:** On wide screens (iPad), render the Shows Library as a sortable **table** with tappable
column headers, instead of the list + Sort-menu.
**Why deferred:** `06_shows.md` lists it as a "may"; header-click sorting is a desktop idiom. Phones

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

### Initial JS bundle size · Deferred

**What:** The initial JS bundle is ~567 kB (`supabase-js` + `react-router` + tabler).
**Why deferred:** Acceptable for a personal PWA; not further optimized.

---

## Multi-user / family · **Per-member login + onboarding SHIPPED** (sharing still deferred)

**What shipped:**

- Multiple family members, each their own Google account + strictly-private data.
- Each member is **allow-listed** (`VITE_ALLOWED_EMAILS`); the owner is identified by `VITE_OWNER_EMAIL`
  (`isOwnerEmail`).
- Non-owners get the neutral `MEMBER_PROFILE_SEED` (no owner body metrics) and are forced through the
  **Onboarding** wizard (`src/screens/Onboarding.tsx`, gated in `AppShell`) via the `profile.onboarded_at` flag.
- No schema-wide change — RLS already isolated every table per `user_id`.

**Still deferred:** shared/household data and a couple of known limitations:

- **DRI bands:** `src/lib/dri.ts` populates **adult female & male, 31–50 · 51–70 · 71+** (i.e. 31
  through 71+, both sexes). Only members **under 31** (or a non-binary `sex`) get **no nutrient
  targets** — `computeTargets` returns null (graceful, no crash). Add a younger band the same way
  (pure data — spread a nearby band and override the differences) if ever needed.
- **Base currency is global HKD** (`BASE_CURRENCY` in `src/lib/networth.ts`; Travel converts to HKD).
  Not per-member — revisit as its own task (FX rework) if a member needs a different base.
- **Shared household custom foods / shared net worth / shared trips** would be an **additive** change:
  a nullable `household_id` + a shared-visibility RLS policy (per `02_tech_spec.md`'s "Database conventions"), not a rebuild.
  Strictly-private is the current, intended model.
- **Allowlist + owner are build-time `VITE_*`** — adding a member or changing the owner needs a
  **redeploy**, not a runtime change.

---

## Out of scope (non-goals / hard limits)

- **Automatic step / activity sync (HealthKit, etc.)** — **Out of scope, permanent.** HealthKit is native-only and unreachable from a PWA. Steps/activity are entered **manually**. Do not attempt native health sync. (Note: there is no dedicated "steps" metric/screen in Phase 1; physical activity is logged via the activity library, e.g. Walking.)
- **Social features, ads, third-party tracking/analytics** — non-goals (PRD).
- **Medical-device claims** — nutrient targets are public-DRI guidance, not medical advice.
- **Native app / App Store** — the whole point is a free installable PWA (no Apple Developer account).
- **Barcode scanning needs an HTTPS origin** — the scanner works on the deployed PWA (or an HTTPS tunnel), not over a plain `http://<LAN-ip>` address (a browser secure-context requirement).
- **Quotes — "Discover Quotes" / external quote fetch** (the Wikiquote + TV-quotes routing engine) —
  **parked.** The reliability and CORS of those sources are unproven, and manual entry + the `?text=`
  prefill + the CSV importer cover the need. The `language` field is kept so routing could be added
  later. (Quotes deliberately has **no external metadata API**, unlike Shows/Books.)
- **Quotes — Traditional vs Simplified Chinese `language` value** — the `language` enum keeps a single
  `zh` (no Trad/Simp split of the stored field). Note this is now narrower than it once was: **search**
  _is_ script-agnostic across all modules (Traditional⇄Simplified matching shipped — see
  `BUILD_HISTORY.md` → "Variant-agnostic Chinese search"), and a display-only **script toggle** is a
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

---

## Code-quality / refactor backlog

Larger DRY extractions identified in the 2026-06-30 code-quality pass but **deliberately deferred** as
higher-risk (they touch search/list/import behaviour, not just chrome). The low-risk extractions from
that pass — `FIELD_CLASS`, `numStr`, `useDirty`, `EntryLoader`, `SettingsLayout` — were done; these
remain:

- **`SearchSheetBase`** — `TitleSearchSheet` / `BookSearchSheet` / `FoodSearchSheet` share the same
  local-overlay scaffold (query + debounce + cancel flag + scrim/header/result-row layout, differing
  only in debounce timing, search fn, and row renderer). A generic base with those as params would save
  ~400 lines. Deferred: each has subtly different debounce/error handling, so extraction needs care.
- **`useLibraryList`** — Shows + Books Libraries duplicate `setBound`/`clearFilters` and the
  override+synced optimistic-delete state. A shared hook returning `{ criteria, setBound, clearFilters,
remove, … }` would cover both (and future Libraries). Deferred: optimistic-delete state is fiddly.
- **`useImportResolver`** — Shows + Books importers share the worker-pool + progress + match-cache
  resolve loop (`ResolvedRow`, `STATUS_RANK`, `resolveRow`/`resolveAll`). Extracting just the worker
  pool + progress state would halve each. Deferred: search API + caching differ per module.
