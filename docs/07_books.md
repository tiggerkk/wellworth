# 07 — Books Module

## Screens

### Dashboard

Shelves, each a card shown only when it has items. No type filter (books are one kind). Every row shows its **status chip** (Want / Reading / Read / Dropped) consistently across all shelves:

- **Favourites** — every `is_favorite` book (any status), each row showing its status chip. (A favourite also still appears in its status shelf below.)
- **Currently Reading** — all `status=reading`; each row shows the cover, title (+ year), the status chip, and author(s), plus a **Mark Read** action (status → read, finish → today).
- **Recently Read** — the last 5 by finish date; rows show the status chip + star rating + the finish date as **month + day** (e.g. "Jun 22"). Imported rows with no `end_date` don't appear here.
- **Want to Read** — `status=want` titles; each with the **"Want"** chip + author(s) and a **Start Reading** action (status → reading, start → today).

- A favourite row anywhere shows a small filled **♥** before the title.
- Status chip palette: **Want**, **Reading**, **Read**, **Dropped** (the shared `StatusChip`).
- A small stat line: **"N read this year"**.
- The **Mark Read / Start Reading** quick actions are **optimistic**: the row patches in local state and
  moves shelves instantly, persisting in the background (no `bumpBooks()` → full-library refetch on
  success; bump only on error). The Library **swipe-delete** is optimistic the same way. See tech-spec F16b.

### Library

- **Search bar** over a list of every tracked book — matches **Title and Author(s)** (author is searched, not filtered). An **icon-only Filter button** to the right (see `docs/01_design_system.md` → FilterToggleButton).
- The shared **FilterPanel** is label-free: **Any Status**, **Any Genre** (genres in your own rows), **Any Rating** (minimum: Any / 1★+ … / 5★), **Any LGBT+** (None/Some/Significant), **Any Dynasty** (+ `全部` and the 12 dynasties) sharing a row with the **Favorites Only** toggle, plus single-line **Started** + **Finished** date ranges (each bound via the Calendar modal, clearable via DateRangeRow).
- Panel footer: shared **SortControl** next to **Clear Filters**. Sort over { Date, Dynasty, Rating, Status, Genre, Author, Title, Year } with an **asc/desc** toggle (nulls sort last; Dynasty: chronologically oldest→newest ascending — 先秦 first … 近代, `全部` last, non-Chinese last; descending flips it); default is **Date** descending.
- Each row: **cover thumbnail** (2:3, neutral placeholder when there's no cover), title (+ year) with a small filled **♥** when favourited and a **gold Dynasty badge** for Chinese titles, the author(s), a **status chip**, the **star rating** when rated, the first genre, and the date as "Jun 22". Tap → Entry/Edit; **swipe-left → Delete** (hard; tapping the revealed Delete acts immediately — no browser dialog).
- Search, filter, and sort persist for the **browser-tab session** (`useSessionState`), restored on return via Back/bottom nav/Home, cleared when the tab closes.

### Entry / Edit (form)

Reached from the **New Book** bottom-nav tab (`/books/entry`, new) or by tapping a row (`/books/:id`, edit).

- A **favourite heart** in the header toggles `is_favorite`.
- **Title** (required for CREATE) shares a line with a **Google Books** search button (search icon) opening the **Book Search** modal (pre-filled with the current Title). Selecting a result fetches details and populates metadata — a cover thumbnail + Genres, Page count, Language, Description (read-only display) — plus Title / Author(s) / Year (editable). Nothing saved until Create/Save.
- **Author(s)** (comma-separated), **Year**.
- **Status** (Want / Reading / Read / Dropped) is a **dropdown** sharing a line with **Rating** (0–5 half-star): Reading defaults **Start Date** to today; Read/Dropped defaults **Finish/Drop date** to today.
- **LGBT+ Representation** (None / Some / Significant dropdown) and **Dynasty** share one compact row. **Dynasty** is a dropdown of the 13 values (全部 近代 … 先秦), defaulting to 全部, and is **editable only when the Title contains CJK**; for non-Chinese titles it's disabled and stored as NULL.
- **Start Date** and **Finish / Drop Date** share a line; each opens the Calendar modal and is clearable. **Notes** sits below: a **4-row** textarea with an **expand icon** beside the label that opens the shared full-screen **`NotesEditorModal`** (header `Title (Year)`, title only when Year is unknown) — a **buffered** editor (only Save writes back) using the shared **EntryHeaderActions** (Delete clears · Reset reverts · Save applies), a top-left ✕ to cancel, and a **paste** icon that inserts clipboard text **at the cursor**. Stored as `notes` (TEXT, effectively unbounded).
- Top-right icon actions (Delete when editing · Reset · Create/Save) via shared **EntryHeaderActions**. Create requires a Title.
- Field visibility controlled by **Books Settings → Visible Fields**.

### Book Search (local overlay inside Entry)

- Not a route sheet — a local overlay so the Entry form draft survives.
- A search bar over cover-thumbnail result rows (cover · title · author(s) · year).
- Tapping a result populates the live form and closes.
- Results from **Google Books**, falling back to **Open Library** when Google returns nothing.
- `VITE_GOOGLE_BOOKS_API_KEY` is optional (search works keyless at a lower quota).

### Settings

- **Entry Form → Visible Fields**: shared **VisibleFieldsSheet** (see `docs/01_design_system.md`) over the optional Entry/Edit fields in New/Edit form order: Author(s), Year, **Google Books Metadata**, Rating, LGBT+, Dynasty, the two dates, Notes. Stored on `profile.book_visible_fields` (**NULL = all visible**). Title, Status, and the Search button are always shown and not listed.
- **Import → Enable Bulk Books Import** toggle (`profile.book_importer_enabled`, **on by default**); when on, an **Import CSV Books** launcher opens the importer sheet, plus a **Clear Import Match Cache (N)** button — clears the localStorage match cache (`clearBookMatchCache`; `N` = `bookMatchCacheSize`), so the next import does a fresh lookup. The cache is **not** affected by a DB reset (see Import CSV → match cache, and `OWNER_RUNBOOK.md` Part R).

### Import CSV (sheet, from Books Settings)

Columns: `title,author,status,rating,lgbtq_rep,dynasty,is_favorite,start_date,end_date,notes`

- `status` ∈ `want|reading|read|dropped`; `dynasty` for Chinese titles only; `is_favorite` optional.
- `start_date` required except for `want`; `end_date` required for `read|dropped`.
- `notes` is the optional, nullable **right-most** column (free text; wrap multi-line values in quotes); never errors, so it can't skip a row.
- `created_at` frozen to `start_date`, or — when a `want` omits it — defaults to import time.

- **Match cache (`src/lib/books-match-cache.ts`, a `match-cache.ts` instance shared with Shows):**
  - Resolved matches are cached in **`localStorage`** (one key, `wellworth:book-match-cache`) keyed on `normMatch(title)|normMatch(author)` so re-importing the **same** file (the common case when truncating `book` / `supabase db reset --linked` to re-test).
  - **Skips the network entirely** on a hit — the big saving against the per-day Google Books quota.
  - Only **positive** matches are cached; no-match / timed-out / quota-aborted rows re-query next run.
  - **Change** overwrites the entry with the owner's pick (so the correction persists across re-imports).
  - **Manual** removes it (a rejected match is never re-served).
  - The cache is **independent of the database** (it's in the browser), so a DB reset never clears it — only Books Settings → **Clear Import Match Cache**, deleting that one localStorage key, or a full "Delete data" does (`OWNER_RUNBOOK.md` Part R).

Steps:

1. **Choose CSV** → rows parsed/validated (bad rows listed as skipped) and each **matched against Google Books** (cache first, then searching `title author`, Open Library fallback) with a progress count. The hits are **ranked** with the shared author-aware `rankSearchResults({ title, author })` (not the raw top hit) and the best is taken — the same ranking the search box uses (see Matching above).
2. **Preview list** — rows needing attention sort to the **top** (`ratelimited` first, then `No match`, then review; resolved rows follow, CSV order kept within each group; frozen at resolve time so rows don't jump as you fix them — `retryRateLimited` re-sorts explicitly after updating a subset). Each row: cover + matched title/year + author(s) + its status chip + parsed rating/finish date. Rows nothing was found for are flagged **No match**; rows where the match isn't confident — weak title overlap, or the CSV author doesn't match (`isConfidentMatch`) — are flagged **review** (this now works for CJK titles, which the old ASCII-only check silently passed); rows that hit a rate limit or Google-side 5xx and exhausted retries are flagged **`ratelimited`**, with a **Retry rate-limited** button above the list to re-resolve just those rows in place. **Change** on any row opens the Book Search modal, pre-seeded with the row's title + author. **Manual** accepts the row as-is — it clears any (wrong) match so the book imports with the CSV title/author and **no** Google Books link (for titles no search hit covers); the row is then marked `manual entry`.
3. **Import** writes all rows **idempotently** (dedup on lower(title) + lower(author) — re-running the same file updates in place, never duplicates). Dates from the file; `created_at` = `start_date`. `saveImportedBooks` **batches** the writes — one bulk `insert` for new books + one bulk `upsert` (conflict on `id`) for existing ones, chunked at 500, with `{ defaultToNull: false }` (the conditional `created_at` key — see Shows) — rather than a per-row round-trip. See tech-spec F16a.

Full guide: `templates/books-import-guide.md`.

---

## External APIs (Books-only)

**Google Books** (`www.googleapis.com/books/v1/volumes`):

- **`VITE_GOOGLE_BOOKS_API_KEY`** is optional — search works keyless (a small per-IP quota) and never throws when unset; concurrency (`POOL`) scales with it: **3** keyless or **10** keyed (see `hasGoogleBooksApiKey`). The key is browser-injected, so a Cloud-Console **HTTP-referrer restriction** must allowlist the dev origin(s) (`http://localhost:5173/*`, LAN IPs) **and** the prod domain (`https://<app>.vercel.app/*`); otherwise keyed requests 403 (silent Open Library fallback → "No match"). Default project quota is **1,000 `Queries per day`** — each CJK title costs **2** queries (`searchZhVariants` runs Simplified + HK-Traditional) — raise it under Books API → Quotas if repeated full re-imports exhaust it. A shared sliding-window limiter (`acquireGoogleSlot`, in `books-api.ts`) paces **every** request (search + details, import + interactive) under that window, so bulk import runs at the fastest pace that stays under it instead of bursting and hitting a 429. A `429` is classified by its body (`isDailyQuotaBody`, the `daily` flag on `BookSearchRateLimitError`): a **per-day** quota (resets midnight US-Pacific) is **not** retried — the matcher **aborts the whole batch** (remaining rows become `No match`, importable as-is) and shows the distinct `DAILY_QUOTA_MESSAGE`; a **transient/per-minute** 429 or a Google-side **5xx** (`BookSearchUnavailableError`) backs off + retries (`RATE_RETRIES`, jittered, honoring `Retry-After` via the shared `isRetryableBookSearchError` check) — once retries are exhausted the row is flagged **`ratelimited`** (distinct from `No match`, with a one-tap **Retry rate-limited** action in the preview) rather than silently mislabeled as not found. Each request also has a `REQUEST_TIMEOUT_MS` ceiling so a slow Open Library fallback can't stall the batch on its last row — a timed-out row becomes `No match` to fix.
- The search query is the **plain combined string** (`title author` from the importer; the typed term from the search box) — **no** `intitle:`/`inauthor:` qualifiers (Google's whole-word AND semantics over-narrow CJK, which has no word boundaries). Title/author discrimination is **client-side** (see Matching below). Details expand `categories`, `pageCount`, `language`, `description`, `imageLinks.thumbnail` (a full image URL — no CDN base).
- CJK-aware: `searchZhVariants` (see `docs/02_tech_spec.md`) fires in both scripts.
- `cover_url` is stored as the full image URL, no prefix.
- Persist only on CREATE/SAVE.

**Open Library** (`openlibrary.org/search.json`): free, no key.

- Fallback when Google Books returns **nothing** (fallback-only — not merged on every search, to spare the keyless quota). HKPL/other Chinese catalogues were evaluated and deferred (see `PARKED.md`).
- Returns work + edition keys; cover URLs follow `https://covers.openlibrary.org/b/id/{id}-M.jpg`.
- `open_library_id` stored for future re-fetch.

**Matching (shared by the importer + the New/Edit search — `src/lib/books-api.ts`):**

- `rankSearchResults(results, { title, author? })` re-ranks hits. With a **known author** it orders by has-title-overlap → **author match** → title tier → year, so the right author wins over a wrong-author _exact_ title (e.g. `坐天下` by 张敞 vs `坐天下：张宏杰解读中国帝王` by 张宏杰). With no author it's just title tier (exact > prefix > contains) → year descending. Both flows call it, so a book resolves the same way in bulk import and in the search box.
- `getBookDetails` **honors the author/year/cover of the selected result** (Google's full volume record can list a different, mis-attributed author than the displayed search snippet); the detail only enriches description/genres/page-count/ISBN/language. Follows the Open Library path.
- `normMatch` is the canonical match key: `foldZh` (Traditional→Simplified + lowercase) then strip all whitespace + ASCII/CJK punctuation, **keeping** CJK ideographs (an earlier ASCII-only normalizer collapsed every Chinese title to '', so every CJK match looked exact).
- The importer's ok/`review` flag uses `isConfidentMatch` (title exact/prefix **and** the CSV author matches when present) — wrong-author or weak-title rows are flagged `review`, not silently accepted.
- The search box ranks with an optional **author hint** (the Entry form's draft author; the importer's "Change" seeds the box with `title author` + the row's author) — `BookSearchSheet`'s `authorHint` prop.

---

## Data model

### `book` (one row per tracked book)

- `id` UUID PK · `user_id` UUID → auth.users (ON DELETE CASCADE)
- `status` TEXT — `'want' | 'reading' | 'read' | 'dropped'` (CHECK)
- `google_books_id` TEXT NULL · `open_library_id` TEXT NULL · `isbn` TEXT NULL
- `title` TEXT · `authors` TEXT[] NULL · `year` INT NULL — first-published year
- `cover_url` TEXT NULL — **full image URL** (Google Books / Open Library); no CDN base prepended
- `description` TEXT NULL · `genres` TEXT[] NULL · `page_count` INT NULL · `language` TEXT NULL
- `rating` NUMERIC NULL — user stars, 0–5 in 0.5 steps (CHECK)
- `lgbtq_rep` TEXT DEFAULT 'none' — `'none' | 'some' | 'significant'` (CHECK)
- `dynasty` TEXT NULL — Chinese dynasty (CHECK against the 13 `DYNASTIES` values in `src/constants/dynasty.ts`); set only for Chinese titles, NULL otherwise; editable only when the Title contains CJK
- `is_favorite` BOOLEAN NOT NULL DEFAULT false — ♥; favourites filter + Dashboard shelf
- `start_date` DATE NULL · `end_date` DATE NULL
- `notes` TEXT NULL — free-text user notes (effectively unbounded; edited inline or via `NotesEditorModal`)
- `created_at`, `updated_at`
- Index on (`user_id`, `status`) and (`user_id`, `is_favorite`)

### Standard rules:

- Own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, CHECK on enum columns, `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`.
- **Hard delete** (leaf table — nothing references `book`; no `deleted_at`). The Quotes module's optional `quote.book_id` link is declared ON DELETE SET NULL on `quote`, so it imposes no FK constraint here.
- Imported back-catalogue rows carry their status, `start_date` (required except a not-yet-started Want), `end_date` (read/dropped), and `created_at` frozen to `start_date`.
- Migration: `supabase/migrations/07_books_schema.sql`. Profile columns added by `supabase/migrations/08_books_profile_settings.sql`.
