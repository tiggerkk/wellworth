# 06 — Shows Module

## Screens

### Dashboard

Shelves, each a card shown only when it has items, scoped by a **type filter** (All / TV / Movies /
Docs). Every row carries **type badge + status chip** as a baseline; each shelf adds the one detail
that matters there:

- **Favourites** — every `is_favorite` title (any status), each row showing its status chip + the
  **star rating** when set. (A favourite also still appears in its status shelf below.)
- **Up Next** — an in-progress episodic title (TV or documentary) with episodes remaining; each row
  shows the poster, title, type badge, a **"Watching"** chip, and
  **"S{watched_seasons} · {watched_episodes}/{total_episodes}"** progress + a **Mark Watched** action
  (status → watched, finish → today, watched counts → totals).
- **Watching** — remaining `status=watching` titles (movies + TV without episode totals); each row
  shows the **"Watching"** chip + season·episode progress for an episodic title with a known total,
  otherwise **"Started {start date}"** — plus a **Mark Watched** action. Up Next is de-duplicated out
  so a show isn't listed twice.
- **Want to Watch** — `status=want` titles; each showing the blue **"Want"** chip + first genre +
  a compact **length hint** (`~2h 10m` for movies, `3 seasons`/`12 eps` for episodic) and a **Start
  Watching** action (status → watching, start → today).
- **Recently Watched** — the last 5 by finish date; rows show the **"Watched"** chip + stars + the
  finish date as **month + day** (e.g. "Jun 22"). Imported rows with no `end_date` don't appear here.

- A small favourite rows anywhere shows a filled **♥** before the title.
- Status chip palette: **Want** = blue, **Watching** = orange, **Watched** = teal, **Dropped** = grey
  (the shared `StatusChip`).
- A small stat line: **"N watched this year"**.

### Library

- A **Type** segmented control (All / TV / Movies / Docs) sits in the **sticky header above** the
  search bar — always visible without opening the filter (see `docs/01-design-system.md` → SegmentedTabs).
- **Search bar** (matches Title, Director, and Cast) with an **icon-only Filter button** to the right
  (see `docs/01-design-system.md` → FilterToggleButton).
- The shared **FilterPanel** is label-free: **Any Status**, **Any Genre** (genres in your own rows),
  **Any Rating** (minimum: Any / 1★+ … / 5★), **Any LGBT+** (None/Some/Significant), **Any Dynasty**
  (+ `全部` and the 12 dynasties), a **Favorites Only** toggle, and single-line **Started** +
  **Finished** date ranges (each bound via the Calendar modal, clearable via DateRangeRow).
- Panel footer: shared **SortControl** next to **Clear Filters**. Sort over
  { Date, Dynasty, Rating, Status, Genre, Title, Year, Type } with an **asc/desc** toggle (nulls sort
  last; Dynasty: chronologically oldest→newest ascending — 先秦 first … 近代, `全部` last, non-Chinese
  last; descending flips it); default is **Date** descending.
- Each row: **poster thumbnail**, title (+ year) with a small filled **♥** when favourited and a **gold
  Dynasty badge** to the right of the title for Chinese titles, then **type badge · status chip · star
  rating** (when set), and a second line of **first genre · date** (as "Jun 22"). Tap → Entry/Edit;
  **swipe-left → Delete** (hard, with a confirm).
- _Type, search, filter, and sort persist for the **browser-tab session** (`useSessionState`), restored
  on return via Back/bottom nav/Home, cleared when the tab closes._

### Entry / Edit (form)

Reached from the **New Show** bottom-nav tab (`/shows/entry`, new) or by tapping a row
(`/shows/:id`, edit). A new show can be prefilled from `?title=&poster=&overview=&type=`.

- A **favourite heart** in the header toggles `is_favorite`.
- **Type** three-segment control (TV Show / Movie / Documentary): Movie hides season/episode fields;
  Documentary shows them (optional).
- **Title** (required for CREATE) shares a line with a **TMDB** search button (search icon) and the
  **⟳ Refresh** action. **Original Title** and **Year** follow.
- **Poster URL**: paste a direct image URL (`referrerpolicy="no-referrer"` everywhere). **Auto-shown**
  when TMDB supplied no poster; the Shows Settings → Visible Fields → **Poster URL** toggle (off by
  default) forces it always visible even when TMDB has a poster.
- **Status** (Want / Watching / Watched / Dropped) is a **dropdown** sharing a line with **Rating**
  (0–5 half-star): Watching/Watched/Dropped defaults **Start date** to today; Watched/Dropped also
  defaults **Finish/Drop date** to today; Watched on an episodic title snaps watched counts to totals.
  **Want leaves Start Date blank.**
- **LGBT+ representation**: None / Some / Significant dropdown.
- **Start Date** and **Finish / Drop Date** share a line; each opens the Calendar modal and is
  clearable.
- **Total Seasons / Episodes** and **Watched Seasons / Episodes** (episodic types — TV + documentary):
  two labels over four side-by-side number inputs.
- **Search TMDB** opens the Title Search modal (CJK-aware; documentary uses the /tv endpoint). Selecting
  a result fetches details and populates metadata — poster thumbnail + Genres, Director/Creator, top
  Cast, Overview, Runtime (read-only display) — plus Title/Original Title/Year (editable) and season/episode
  totals for episodic types. Nothing saved until CREATE/SAVE.
- **⟳ Refresh from TMDB** (beside Search; enabled only when `tmdb_id` exists): re-fetches TMDB metadata
  and updates **only TMDB-sourced fields** (title, original_title, overview, genres, director, cast,
  season/episode totals, runtime, original_language, TMDB poster). Never touches owner fields (status,
  rating, lgbtq_rep, dates, comments, watched counts, is_favorite) or a **manually pasted** poster.
  Reports "Updated" / "Already up to date".
- Top-right icon actions (Delete when editing · Reset · Create/Save) via shared **EntryHeaderActions**.
  Create requires a Title.
- Field visibility controlled by **Shows Settings → Visible Fields** (Type, Title, Status, the favourite
  heart, and the Refresh action are always shown).

### Title Search (local overlay inside Entry)

- Not a route sheet — a local overlay so the Entry form draft survives.
- A search bar over poster-thumbnail result rows (poster · title · year · type badge), scoped to the
  current Type toggle (documentary searches /tv) and **CJK-aware**.
- Tapping a result populates the live form and closes.
- Shows a hint if `VITE_TMDB_API_KEY` is unset.

### Settings

- **Entry Form → Visible Fields**: shared **VisibleFieldsSheet** (see `docs/01-design-system.md`)
  over the optional Entry/Edit fields in New/Edit form order: Original Title, Year, **TMDB Metadata**,
  Rating, LGBT+, Dynasty, the two dates, Season & Episode counts, **Poster URL**, Notes. Most stored on
  `profile.show_visible_fields` (**NULL = all visible**); **Poster URL** is an `extra` backed by
  `profile.show_poster_url_visible` (**default off**) meaning "force always visible" — stored separately
  because the visible-fields list is default-on. Type, Title, Status, and the favourite heart are always
  shown and not listed.
- **Import → Enable CSV Import** toggle (`profile.show_importer_enabled`); when on, an **Import CSV…**
  launcher opens the importer sheet.

### Import CSV (sheet, from Shows Settings)

Columns: `title,type,status,rating,lgbtq_rep,dynasty,watched_seasons,watched_episodes,is_favorite,start_date,end_date`

- `type` ∈ `tv|movie|documentary`; `dynasty` for Chinese titles only; `is_favorite` optional.
- `start_date` required except for `want`; `end_date` required for `watched|dropped`.
- `created_at` is frozen to `start_date`, or — when a `want` omits it — defaults to import time.
- `watched_episodes` accepts the literal **`all`** on a `watching|dropped` episodic row (with
  `watched_seasons`), resolved to that season's TMDB episode count at import (left blank if TMDB has
  no count); used elsewhere, the row is skipped.

Steps:

1. **Choose CSV** → rows parsed/validated (bad rows listed as skipped) and each **matched against TMDB**
   (CJK-aware top hit + details) with a progress count.
2. **Preview list**: each row's poster + matched title/year + type/status + season·episode totals. Rows
   TMDB couldn't find are flagged **No match**; rows whose top hit differs from the CSV title are flagged
   **review**. **Change** on any row opens the Title Search modal.
3. **Import** writes all rows **idempotently** (dedup on lower(title) — re-running the same file updates
   in place, never duplicates). Dates from the file; `created_at` = `start_date`.

Full guide: `templates/shows-import-guide.md`.

---

## External APIs (Shows-only)

**TMDB** (`api.themoviedb.org/3`): `VITE_TMDB_API_KEY` (public v3 key, client-side).

- **CJK-aware**: a query containing CJK is sent with `language=zh-CN` (via `containsCjk` +
  `tmdbLanguage` in `src/lib/tmdb-api.ts`). Both scripts get a query via `searchZhVariants`
  (see `docs/02-tech-spec.md` → Shared external APIs) and results are merged.
- **Documentary → `/tv` endpoint**: `endpointFor` maps `documentary` to `/tv` so multi-part docs
  get seasons/episodes.
- **Search**: `GET /search/tv` or `/search/movie` by title; returns poster_path, title, year, id.
- **Details**: `GET /tv/{id}` or `/movie/{id}` for genres, cast, director/creator, runtime,
  original_language, season/episode totals.
- **Persist only on CREATE/SAVE** — no TMDB data is stored until the user explicitly saves.
- **`buildRefreshPatch`**: assembles the TMDB-sourced field delta for the Refresh action; never
  overwrites owner fields or a manually pasted poster.
- Poster CDN base is `https://image.tmdb.org/t/p/w92` (list) / `w185` (detail). A manually pasted
  URL passes through as-is (detected by `isAbsoluteUrl`). All `<img>` tags use
  `referrerpolicy="no-referrer"`.

---

## Data model

### `show` (one row per tracked title)

- `id` UUID PK · `user_id` UUID → auth.users (ON DELETE CASCADE)
- `type` TEXT — `'tv' | 'movie' | 'documentary'` (CHECK); chooses the TMDB endpoint and the
  season/episode UI
- `status` TEXT — `'want' | 'watching' | 'watched' | 'dropped'` (CHECK)
- `tmdb_id` INT NULL — enables the per-show Refresh from TMDB
- `imdb_id` TEXT NULL — stable cross-reference
- `title` TEXT · `original_title` TEXT NULL · `year` INT NULL
- `poster_path` TEXT NULL — **either** a TMDB path (CDN base prepended) **or** a full pasted image
  URL; always rendered with `referrerpolicy="no-referrer"`
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
- `dynasty` TEXT NULL — Chinese dynasty (CHECK against the 13 `DYNASTIES` values — `全部` + 12 dynasties
  in `src/constants/dynasty.ts`); set only for Chinese titles, NULL otherwise; editable in the Entry
  form only when the title contains CJK
- `is_favorite` BOOLEAN NOT NULL DEFAULT false — ♥; favourites filter + Dashboard shelf
- `start_date` DATE NULL · `end_date` DATE NULL — start and finish/drop date
- `comments` TEXT NULL
- `created_at`, `updated_at`
- Index on (`user_id`, `status`) and (`user_id`, `is_favorite`)

Standard rules: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`,
CHECK on enum columns, `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`.
**Hard delete** (nothing references `show` except `quote.show_id` ON DELETE SET NULL on `quote` — so
deleting a show nullifies the link on any quoting it, but the quote survives). Migration:
`supabase/migrations/04_shows_schema.sql`. Profile columns added by
`supabase/migrations/05_shows_profile_settings.sql`.
