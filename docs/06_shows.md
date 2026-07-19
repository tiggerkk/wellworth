# 06 — Shows Module

## Screens

### Dashboard (`/shows`)

- **Type**: segmented control (All / TV / Movies / Docs) sits in the **sticky header above** that is always visible.
- A small stat line: **"N watched this year"**.
- **Shelves**: a card shown only when it has items. Each row carries the following (with some card-specific items):
  - Line 1: **poster thumbnail**, **title (+ year)** with a small filled **♥** when favorited and a **gold Dynasty badge** for Chinese titles.
  - Line 2: **status chip · star rating** (when set) **· date**.
  - Line 3: **type badge · seasons/episodes or length hint· first genre**.
- **Favorites** — every `is_favorite` title (any status); a favorite also still appears in its status shelf below.
- **Up Next** — in-progress episodic title (TV or documentary); seasons/episodes shows **"S{watched_seasons} · {watched_episodes}/{total_episodes}"** progress + a **Mark Watched** action (status → watched, finish → today, watched counts → totals).
- **Watching** — remaining `status=watching` titles (movies + TV without episode totals); season/episode progress for an episodic title with a known total, otherwise **"Started {start date}"** — plus a **Mark Watched** action. Up Next is de-duplicated out so a show isn't listed twice.
- **Want to Watch** — `status=want` titles; **length hint** is compact (`~2h 10m` for movies, `3 seasons`/`12 eps` for episodic) and a **Start Watching** action (status → watching, start → today).
- **Recently Watched** — last 5 by finish date; shows **finish date**. Imported rows with no `end_date` don't appear here.
- **Mark Watched / Start Watching** quick actions are **optimistic**: the row patches in local state and moves shelves instantly, persisting in the background (no `bumpShows()` → full-library refetch on success; bump only on error).

### Library (`/shows/library`)

- **Type**: segmented control (All / TV / Movies / Docs) sits in the **sticky header above** that is always visible.
- **Search bar**: matches title, director, and cast; **Filter button** to the right.
- **SortControl**, **Favorites Only** toggle, **Clear Filters button**: Sort over { Date, Dynasty, Rating, Status, Genre, Title, Year, Type } with an **asc/desc** toggle (nulls sort last; Dynasty: chronologically oldest→newest ascending — 先秦 first … 近代, `全部` last, non-Chinese last; descending flips it); default is **Date** descending.
- **Filter panel** is label-free: **Any Status**, **Any Genre**, **Any Rating** (minimum: Any / 1★+ … / 5★), **Any LGBT+**, **Any Dynasty**, and single-line **Started** + **Finished** date ranges.
- Each row shows the same information as the Dashboard; Tap → Entry/Edit; **swipe-left → Delete** (optimistic).

### New / Edit Entry (`/shows/entry`, `/shows/:id`)

A new show can be prefilled from `?title=&poster=&overview=&type=`.

- A **favorite heart** in the header toggles `is_favorite`.
- **Type** three-segment control (TV Show / Movie / Documentary): Movie hides season/episode fields; Documentary shows them (optional).
- **Title** (required for CREATE) shares a line with a **TMDB** search button (search icon) and the **⟳ Refresh** action. **Original Title** and **Year** follow.
- **Poster URL**: paste a direct image URL (`referrerpolicy="no-referrer"` everywhere). **Auto-shown** when TMDB supplied no poster; the Shows Settings → Visible Fields → **Poster URL** toggle (off by default) forces it always visible even when TMDB has a poster.
- **Status** (Want / Watching / Watched / Dropped) is a **dropdown** sharing a line with **Rating** (0–5 half-star): Watching/Watched/Dropped defaults **Start date** to today; Watched/Dropped also defaults **Finish/Drop date** to today; Watched on an episodic title snaps watched counts to totals. **Want leaves Start Date blank.**
- **LGBT+ representation**: None / Some / Significant dropdown.
- **Start Date** and **Finish / Drop Date** share a line; each opens the Calendar modal and is clearable.
- **Total Seasons / Episodes** and **Watched Seasons / Episodes** (episodic types — TV + documentary): two labels over four side-by-side number inputs.
- **Notes** (free text): a **4-row** textarea. An **expand icon** beside the label opens the shared full-screen **`NotesEditorOverlay`** for long notes — header `Title (Year)` (title only when Year is unknown), a **buffered** editor (only Save writes back to the form) using the shared **EntryHeaderActions** (Delete clears the text · Reset reverts to the value at open · Save applies + closes), a top-left ✕ to cancel/discard, and a **paste** icon that inserts clipboard text **at the cursor**. Stored as `notes` (TEXT, effectively unbounded).
- **Search TMDB** opens the Title Search modal (CJK-aware; documentary uses the /tv endpoint). Selecting a result fetches details and populates metadata — poster thumbnail + Genres, Director/Creator, top Cast, Overview, Runtime (read-only display) — plus Title/Original Title/Year (editable) and season/episode totals for episodic types. Nothing saved until CREATE/SAVE.
- **⟳ Refresh from TMDB** (beside Search; enabled only when `tmdb_id` exists): re-fetches TMDB metadata and updates **only TMDB-sourced fields** (title, original_title, overview, genres, director, cast, season/episode totals, runtime, original_language, TMDB poster). Never touches owner fields (status, rating, lgbtq_rep, dates, notes, watched counts, is_favorite) or a **manually pasted** poster. Reports "Updated" / "Already up to date".
- Top-right icon actions (Delete when editing · Reset · Create/Save) via shared **EntryHeaderActions**. Create requires a Title.
- Field visibility controlled by **Shows Settings → Visible Fields** (Type, Title, Status, the favorite heart, and the Refresh action are always shown).

### Title Search (local overlay inside Entry)

- Not a route sheet — a local overlay so the Entry form draft survives.
- A search bar over poster-thumbnail result rows (poster · title · year · type badge), scoped to the current Type toggle (documentary searches /tv) and **CJK-aware**.
- Tapping a result populates the live form and closes.
- Shows a hint if `VITE_TMDB_API_KEY` is unset.

### Settings (`/shows/settings`)

- **Entry Form → Visible Fields**: shared **VisibleFieldsSheet** (see `docs/01_design_system.md`) over the optional Entry/Edit fields in New/Edit form order: Original Title, Year, **TMDB Metadata**, Rating, LGBT+, Dynasty, the two dates, Season & Episode counts, **Poster URL**, Notes. Most stored on `profile.show_visible_fields` (**NULL = all visible**); **Poster URL** is an `extra` backed by `profile.show_poster_url_visible` (**default off**) meaning "force always visible" — stored separately because the visible-fields list is default-on. Type, Title, Status, and the favorite heart are always shown and not listed.
- **Import → Enable Bulk Shows Import** toggle (`profile.show_importer_enabled`, **on by default**); when on, an **Import CSV Shows** launcher opens the importer sheet, plus a **Clear Import Match Cache (N)** button (`clearShowMatchCache`; `N` = `showMatchCacheSize`) — see Import CSV → match cache, and `OWNER_RUNBOOK.md` Part R.

### Import CSV (sheet, from Shows Settings)

Columns: `title,type,status,rating,lgbtq_rep,dynasty,watched_seasons,watched_episodes,is_favorite,start_date,end_date,notes`

- `type` ∈ `tv|movie|documentary`; `dynasty` for Chinese titles only; `is_favorite` optional.
- `start_date` required except for `want`; `end_date` required for `watched|dropped`.
- `notes` is the optional, nullable **right-most** column (free text; wrap multi-line values in quotes); never errors, so it can't skip a row.
- `created_at` is frozen to `start_date`, or — when a `want` omits it — defaults to import time.
- `watched_episodes` accepts the literal **`all`** on a `watching|dropped` episodic row (with `watched_seasons`), resolved to that season's TMDB episode count at import (left blank if TMDB has no count); used elsewhere, the row is skipped.

**Match cache (`src/lib/shows-match-cache.ts`, a `match-cache.ts` instance shared with Books):** resolved matches are cached in **`localStorage`** (one key, `wellworth:shows-match-cache`) keyed on `type|normMatch(title)|year`, so re-importing the **same** file (e.g. after `supabase db reset --linked` while testing) **skips TMDB entirely** on a hit and resolves instantly. Unlike Books this is a **performance** aid, not a quota guard (TMDB has no per-day cap). Only **positive** matches are cached; **Change** overwrites with the owner's pick, **Manual** removes it. It's **independent of the database** — cleared only via Shows Settings → **Clear Import Match Cache**, deleting that one localStorage key, or "Delete data" (`OWNER_RUNBOOK.md` Part R).

Steps:

1. **Choose CSV** → rows parsed/validated (bad rows listed as skipped) and each **matched against TMDB** (cache first, CJK-aware) with a progress count. A trailing **`(YYYY)`** on the title (e.g. `Beyond (2017)`) is split off before searching — TMDB returns nothing for that literal — and the year is then used to **rank** + confirm. Hits are ranked by the shared author-/year-aware ranker (`rankTitleResults` — title tier, then closeness to the hinted year, then year descending) rather than the raw top hit, so the right title wins even when TMDB's relevance order buries it. Matching runs a pool of **10** concurrent workers (`POOL`); each holds one connection at a time, so peak connections ≈ 10 — half TMDB's ~20 connection cap, with the request rate well under ~50/s.
2. **Preview list** — rows needing attention sort to the **top** (No-match first, then review; resolved rows follow, CSV order kept within each group; frozen at resolve time so rows don't jump as you fix them). Each row: poster + matched title/year + type/status + season·episode totals. Rows TMDB couldn't find are flagged **No match**; rows where the match isn't confident — weak title overlap, or the matched year is off from a `(YYYY)` hint (`isConfidentTitleMatch`) — are flagged **review**. **Change** on any row opens the Title Search modal, **pre-seeded with the row's title** (year hint applied to ranking). **Manual** accepts the row as-is — it clears any (wrong) match so the title imports with the CSV title/metadata and **no** TMDB link (for titles no search hit covers); the row is then marked `manual entry`.
3. **Import** writes all rows **idempotently** (dedup on lower(title) — re-running the same file updates in place, never duplicates). Dates from the file; `created_at` = `start_date`. `saveImportedShows` **batches** the writes — one bulk `insert` for new titles + one bulk `upsert` (conflict on `id`) for existing ones, chunked at 500 — rather than a per-row round-trip, so a ~440-row import is a couple of calls, not hundreds. (TMDB matching is the separate step 1, before this.)

Full guide: `templates/shows-import-guide.md`.

---

## External APIs (Shows-only)

**TMDB** (`api.themoviedb.org/3`): `VITE_TMDB_API_KEY` (public v3 key, client-side).

- **CJK-aware**: a query containing CJK is sent with `language=zh-CN` (via `containsCjk` + `tmdbLanguage` in `src/lib/shows-tmdb-api.ts`). Both scripts get a query via `searchZhVariants` (see `docs/02_tech_spec.md` → Shared external APIs) and results are merged.
- **Documentary → `/tv` endpoint**: `endpointFor` maps `documentary` to `/tv` so multi-part docs get seasons/episodes.
- **Search**: `GET /search/tv` or `/search/movie` by title; returns poster_path, title, year, id.
- **Details**: `GET /tv/{id}` or `/movie/{id}` for genres, cast, director/creator, runtime, original_language, season/episode totals.
- **Persist only on CREATE/SAVE** — no TMDB data is stored until the user explicitly saves.
- **`buildRefreshPatch`**: assembles the TMDB-sourced field delta for the Refresh action; never overwrites owner fields or a manually pasted poster.
- Poster CDN base is `https://image.tmdb.org/t/p/w92` (list) / `w185` (detail). A manually pasted URL passes through as-is (detected by `isAbsoluteUrl`). All `<img>` tags use `referrerpolicy="no-referrer"`.

---

## Data model

### `show` (one row per tracked title)

- `id` UUID PK · `user_id` UUID → auth.users (ON DELETE CASCADE)
- `type` TEXT — `'tv' | 'movie' | 'documentary'` (CHECK); chooses the TMDB endpoint and the season/episode UI
- `status` TEXT — `'want' | 'watching' | 'watched' | 'dropped'` (CHECK)
- `tmdb_id` INT NULL — enables the per-show Refresh from TMDB
- `imdb_id` TEXT NULL — stable cross-reference
- `title` TEXT · `original_title` TEXT NULL · `year` INT NULL
- `poster_path` TEXT NULL — **either** a TMDB path (CDN base prepended) **or** a full pasted image URL; always rendered with `referrerpolicy="no-referrer"`
- `overview` TEXT NULL
- `genres` TEXT[] NULL
- `director` TEXT NULL — movie director, or TV/documentary creator(s) joined
- `cast` TEXT[] NULL — top ~10 cast names (quoted `"cast"` in DDL — reserved word)
- `runtime_min` INT NULL
- `original_language` TEXT NULL
- `total_seasons` INT NULL · `total_episodes` INT NULL — episodic types (TV + documentary)
- `watched_seasons` INT NULL · `watched_episodes` INT NULL — episodic types; set to totals on Watched
- `rating` NUMERIC NULL — user stars, 0–5 in 0.5 steps (CHECK)
- `lgbtq_rep` TEXT DEFAULT 'none' — `'none' | 'some' | 'significant'` (CHECK)
- `dynasty` TEXT NULL — Chinese dynasty (CHECK against the 13 `DYNASTIES` values — `全部` + 12 dynasties in `src/constants/dynasty.ts`); set only for Chinese titles, NULL otherwise; editable in the Entry form only when the title contains CJK
- `is_favorite` BOOLEAN NOT NULL DEFAULT false — ♥; favorites filter + Dashboard shelf
- `start_date` DATE NULL · `end_date` DATE NULL — start and finish/drop date
- `notes` TEXT NULL — free-text user notes (effectively unbounded; edited inline or via `NotesEditorOverlay`)
- `created_at`, `updated_at`
- Index on (`user_id`, `status`) and (`user_id`, `is_favorite`)

Standard rules: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, CHECK on enum columns, `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`. **Hard delete** (nothing references `show` except `quote.show_id` ON DELETE SET NULL on `quote` — so deleting a show nullifies the link on any quoting it, but the quote survives). Migration:
`supabase/migrations/05_shows_schema.sql`. Profile columns added by `supabase/migrations/06_shows_profile_settings.sql`.
