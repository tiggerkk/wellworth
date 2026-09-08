# 06 — Shows Module

## Screens

### Dashboard (`/shows`)

- **Type**: segmented control (All / TV / Movies / Docs) sits in the **sticky header above** that is always visible.
- A small stat line: **"N watched this year"**.
- **Shelves**: a card shown only when it has items. Each row carries the following (with some card-specific items):
  - Line 1: **poster thumbnail**, **title (+ year)** and a **gold Dynasty badge** for Chinese titles.
  - Line 2: **status chip** (reads **"Caught Up"** in place of "Watching" once every known episode is watched — see below) **· star rating** (when set) **· date**.
  - Line 3: **type badge · seasons/episodes or length hint · first genre**.
- **Currently Watching** — `status=watching` titles that still have unwatched episodes (or, for movies, no episode concept at all), ordered most-recently-updated first (finish date if set, else last-updated timestamp; see Library's Date sort for the shared key); season/episode progress for an episodic title with a known total, otherwise **"Started {start date}"**. Progress is shown as **"S{watched_seasons} · {cumulative watched}/{total_episodes}"** — the numerator is the **true series-wide total watched**, not just the count within the current season (see `totalWatchedEpisodes` below), so a show mid-way through season 2 correctly reads e.g. `S2 · 17/18` rather than `S2 · 7/18`.
- **Caught Up** — episodic `status=watching` titles where cumulative watched episodes have reached the known total (`isCaughtUp`): the owner has watched everything TMDB currently lists but hasn't marked it Watched, i.e. deliberately waiting on more. Sits directly below Currently Watching, above Want to Watch, ordered the same way (most-recently-updated first). A title moves back to Currently Watching automatically once a refresh (per-show or bulk) reveals new episodes/seasons.
- **Want to Watch** — `status=want` titles, ordered most-recently-updated first and capped to the 6 most recent; **length hint** is compact (`~2h 10m` for movies, `3 seasons`/`12 eps` for episodic).
- **Recently Watched** — last 5 **watched** titles with a known `end_date`, sorted by finish date descending; shows **finish date**. Imported rows with no `end_date` don't appear here.

### Library (`/shows/library`)

- **Type**: segmented control (All / TV / Movies / Docs) sits in the **sticky header above** that is always visible.
- **Search bar**: matches title, director, and cast; **Filter button** to the right.
- **SortControl**, **Favorites Only** toggle, **Clear Filters button**: Sort over { Date, Dynasty, Rating, Status, Genre, Title, Year, Type } with an **asc/desc** toggle (nulls sort last; Dynasty: chronologically oldest→newest ascending — 先秦 first … 近代, `全部` last, non-Chinese last; descending flips it); default is **Date** descending. **Date** uses `end_date` if set, else `updated_at`, with `start_date` as a tiebreak before falling back to title (shared with the Dashboard shelves' ordering above).
- **Filter panel** is label-free: **Any Status**, **Any Genre**, **Any Rating** (minimum: Any / 1★+ … / 5★), **Any LGBT+**, **Any Dynasty**, **Notes Only toggle**, and single-line **Started** + **Finished** date ranges.
- Each row shows the same information as the Dashboard + **heart** (toggle is optimistic); Tap → Entry/Edit; **swipe-left → Delete** (optimistic).
- A floating **+** (`ListFab`) opens **New Show**, shown only once the filtered list has at least one row (the bottom-nav **New Show** tab and the empty-state chip remain the other entry points).

### New / Edit Entry (`/shows/entry`, `/shows/:id`)

A new show can be prefilled from `?title=&poster=&overview=&type=`.

- A **favorite heart** in the header toggles `is_favorite`.
- **Type** three-segment control (TV Show / Movie / Documentary): Movie hides season/episode fields; Documentary shows them (optional).
- **Title** (required for CREATE) shares a line with a **TMDB** search button (search icon) and the **⟳ Refresh** action. **Original Title** and **Year** follow.
- **Poster URL**: paste a direct image URL (`referrerpolicy="no-referrer"` everywhere). **Auto-shown** when TMDB supplied no poster; the Shows Settings → Visible Fields → **Poster URL** toggle (off by default) forces it always visible even when TMDB has a poster.
- **Status** (Want / Watching / Watched / Dropped) is a **dropdown** sharing a line with **Rating** (0–5 half-star): Watching/Watched/Dropped defaults **Start date** to today; Watched/Dropped also defaults **Finish/Drop date** to today; Watched on an episodic title snaps watched counts to totals. **Want leaves Start Date blank.**
- **LGBT+ representation**: None / Some / Significant dropdown.
- **Start Date** and **Finish / Drop Date** share a line; each opens the Calendar modal and is clearable.
- **Total Seasons / Episodes** and **Watched Seasons / Episodes** (episodic types — TV + documentary): two labels over four side-by-side number inputs. The **Watched** convention stays entry-only: the owner enters the season they're on plus the episode count **within that season** (e.g. season 2, 7 eps = all of season 1 finished plus 7 of season 2) rather than a series-wide total. A computed caption below the inputs — **"{X} of {Y} episodes watched overall"** — shows the true cumulative total live as the owner types, so the per-season convention doesn't require mentally tallying prior seasons. The caption (and the Dashboard/Library progress line) needs `season_episode_counts` populated (see Data model); it falls back silently to the raw in-season count for a title with no TMDB match or one saved before this field existed.
- **Notes** (free text): a **4-row** textarea. An **expand icon** beside the label opens the shared full-screen **`NotesEditorOverlay`** for long notes — header `Title (Year)` (title only when Year is unknown), a **buffered** editor (only Save writes back to the form) using the shared **EntryHeaderActions** (Delete clears the text · Reset reverts to the value at open · Save applies + closes), a top-left ✕ to cancel/discard, and a **paste** icon that inserts clipboard text **at the cursor**. Stored as `notes` (TEXT, effectively unbounded).
- **Search TMDB** opens the Title Search modal (CJK-aware; documentary uses the /tv endpoint). Selecting a result fetches details and populates metadata — poster thumbnail + Genres, Director/Creator, top Cast, Overview, Runtime (read-only display) — plus Title/Original Title/Year (editable) and season/episode totals for episodic types. Nothing saved until CREATE/SAVE.
- **⟳ Refresh from TMDB** (beside Search; enabled only when `tmdb_id` exists): re-fetches TMDB metadata and updates **only TMDB-sourced fields** (title, original_title, overview, genres, director, cast, season/episode totals, `season_episode_counts` per-season breakdown, runtime, original_language, TMDB poster). Never touches owner fields (status, rating, lgbtq_rep, dates, notes, watched counts, is_favorite) or a **manually pasted** poster. Reports "Updated" / "Already up to date". A title saved before `season_episode_counts` existed picks it up on the next Refresh (or re-selecting from Search), which also corrects its Dashboard/Library progress display.
- Top-right icon actions (Delete when editing · Reset · Create/Save) via shared **EntryHeaderActions**. Create requires a Title.
- Field visibility controlled by **Shows Settings → Visible Fields** (Type, Title, Status, the favorite heart, and the Refresh action are always shown).

### Title Search (local overlay inside Entry)

- Not a route sheet — a local overlay so the Entry form draft survives.
- A search bar over poster-thumbnail result rows (poster · title · year · type badge), scoped to the current Type toggle (documentary searches /tv) and **CJK-aware**.
- Tapping a result populates the live form and closes.
- Shows a hint if `VITE_TMDB_API_KEY` is unset.

### Settings (`/shows/settings`)

- **DISPLAY → Visible Fields**: shared **VisibleFieldsSheet** (see `docs/01_design_system.md`) over the optional Entry/Edit fields in New/Edit form order: Original Title, Year, **TMDB Metadata**, Rating, LGBT+, Dynasty, the two dates, Season & Episode counts, **Poster URL**, Notes. Most stored on `profile.show_visible_fields` (**NULL = all visible**); **Poster URL** is an `extra` backed by `profile.show_poster_url_visible` (**default off**) meaning "force always visible" — stored separately because the visible-fields list is default-on. Type, Title, Status, and the favorite heart are always shown and not listed.
- **Import → Enable Bulk Shows Import / Export** toggle (`profile.show_importer_enabled`, **on by default**); when on, an **Import CSV Shows** launcher opens the importer sheet, an **Export CSV Shows** button downloads every tracked title as a CSV, plus a **Clear Import Match Cache (N)** button (`clearShowMatchCache`; `N` = `showMatchCacheSize`) — see Import CSV → match cache, and `OWNER_RUNBOOK.md` Part R.
- **Maintenance → Refresh All from TMDB**: re-checks every **Want/Watching** episodic (TV or documentary) title with a known `tmdb_id` against TMDB in one pass — movies are skipped (no seasons/episodes to check for). Reuses the same `buildRefreshPatch` diff the per-show Refresh button uses, so the two can't drift; runs with **bounded concurrency** (`REFRESH_CONCURRENCY = 4` requests in flight, not fully sequential) since TMDB comfortably tolerates it — a live "Refreshing… (done/total)" counter tracks progress. Afterward shows a summary — **"{checked} checked · {updated} updated · {N} to review"** — plus a details list naming only the titles that need a look: ones that **gained new episodes/seasons while already caught up** (`hasNewEpisodesAvailable`) or that **errored**. A large "nothing to report" refresh (most titles just get quiet metadata touch-ups) stays uncluttered — the "to review" list is deliberately much shorter than "updated". This is also the fastest way to backfill `season_episode_counts` across an existing library (see Data model) so Dashboard/Library progress math is correct everywhere.

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

### Export CSV Shows (button, from Shows Settings)

`shows-export.ts` (pure), reusing `listShows` as-is — its existing column selection is already a superset of the CSV's columns, so no dedicated export query was added. Same column spec as Import: `title,type,status,rating,lgbtq_rep,dynasty,watched_seasons,watched_episodes,is_favorite,start_date,end_date,notes`.

- Sorted by `type`, then `status` — both by their canonical enum order (`SHOW_TYPES`/`SHOW_STATUSES`), not alphabetically — then `start_date` ascending (a `want` row with no `start_date` sorts last within its group).

Note: the bulk "Refresh All from TMDB" maintenance action (above) uses a separate `listShowsForRefresh` query, not `listShows` — it needs `tmdb_id`/`overview`/`original_language`, which `listShows`' column-trimmed select deliberately omits (list/Dashboard screens never read them), and filters server-side to Want/Watching + episodic + has-a-match so unrelated rows never leave the database.

---

## External APIs (Shows-only)

**TMDB** (`api.themoviedb.org/3`): `VITE_TMDB_API_KEY` (public v3 key, client-side).

- **CJK-aware**: a query containing CJK is sent with `language=zh-CN` (via `containsCjk` + `tmdbLanguage` in `src/lib/shows-tmdb-api.ts`). Both scripts get a query via `searchZhVariants` (see `docs/02_tech_spec.md` → Shared external APIs) and results are merged.
- **Documentary → `/tv` endpoint**: `endpointFor` maps `documentary` to `/tv` so multi-part docs get seasons/episodes.
- **Search**: `GET /search/tv` or `/search/movie` by title; returns poster_path, title, year, id.
- **Details**: `GET /tv/{id}` or `/movie/{id}` for genres, cast, director/creator, runtime, original_language, season/episode totals.
- **Persist only on CREATE/SAVE** — no TMDB data is stored until the user explicitly saves.
- **`buildRefreshPatch`**: assembles the TMDB-sourced field delta for the Refresh action, including the `season_episode_counts` per-season breakdown; never overwrites owner fields or a manually pasted poster. Shared unchanged by the bulk "Refresh All from TMDB" action (Settings), which runs it across many titles with bounded concurrency (`REFRESH_CONCURRENCY = 4`) rather than one-at-a-time.
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
- `season_episode_counts` JSONB NULL — episodic types; `{ [season_number]: episode_count }` from TMDB. Powers **`totalWatchedEpisodes`** (cumulative watched-episode total across all seasons, used by the Dashboard/Library progress line and by `isCaughtUp`) and **`hasNewEpisodesAvailable`** (bulk-refresh "new episodes" detection). Populated on TMDB select/refresh (Entry) and by the bulk "Refresh All from TMDB" action; `NULL` on a title with no TMDB match or one saved before this column existed — `totalWatchedEpisodes` falls back to the raw in-season `watched_episodes` count in that case (the old, less accurate behaviour), never errors.
- `watched_seasons` INT NULL · `watched_episodes` INT NULL — episodic types; set to totals on Watched. **`watched_episodes` is the count WITHIN `watched_seasons`, not a series-wide total** — e.g. season 2, 7 eps means "all of season 1 finished, plus 7 of season 2". This is the entry convention the owner types (no need to mentally tally prior seasons); `totalWatchedEpisodes` derives the true cumulative total from it plus `season_episode_counts`.
- `rating` NUMERIC NULL — user stars, 0–5 in 0.5 steps (CHECK)
- `lgbtq_rep` TEXT DEFAULT 'none' — `'none' | 'some' | 'significant'` (CHECK)
- `dynasty` TEXT NULL — Chinese dynasty (CHECK against the 13 `DYNASTIES` values — `全部` + 12 dynasties in `src/constants/dynasty.ts`); set only for Chinese titles, NULL otherwise; editable in the Entry form only when the title contains CJK
- `is_favorite` BOOLEAN NOT NULL DEFAULT false — ♥; used by the favorites filter
- `start_date` DATE NULL · `end_date` DATE NULL — start and finish/drop date
- `notes` TEXT NULL — free-text user notes (effectively unbounded; edited inline or via `NotesEditorOverlay`)
- `created_at`, `updated_at`
- Index on (`user_id`, `status`) and (`user_id`, `is_favorite`) — the former also serves `listShowsForRefresh`'s Want/Watching filter for the bulk TMDB refresh (type and `tmdb_id` are filtered from the matched rows; no dedicated index needed at personal-library scale)

Standard rules: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, CHECK on enum columns, `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`. **Hard delete** (nothing references `show` except `quote.show_id` ON DELETE SET NULL on `quote` — so deleting a show nullifies the link on any quoting it, but the quote survives). Migration:
`supabase/migrations/05_shows_schema.sql`. Profile columns added by `supabase/migrations/06_shows_profile_settings.sql`.
