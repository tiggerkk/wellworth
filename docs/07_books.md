# 07 — Books Module

## Screens

### Dashboard

Shelves, each a card shown only when it has items. No type filter (books are one kind). Every row
shows its **status chip** (Want / Reading / Read / Dropped) consistently across all shelves:

- **Favourites** — every `is_favorite` book (any status), each row showing its status chip. (A
  favourite also still appears in its status shelf below.)
- **Currently Reading** — all `status=reading`; each row shows the cover, title (+ year), the status
  chip, and author(s), plus a **Mark Read** action (status → read, finish → today).
- **Recently Read** — the last 5 by finish date; rows show the status chip + star rating + the finish
  date as **month + day** (e.g. "Jun 22"). Imported rows with no `end_date` don't appear here.
- **Want to Read** — `status=want` titles; each with the blue **"Want"** chip + author(s) and a
  **Start Reading** action (status → reading, start → today).

- A favourite row anywhere shows a small filled **♥** before the title.
- Status chip palette: **Want** = blue, **Reading** = orange, **Read** = teal, **Dropped** = grey
  (the shared `StatusChip`).
- A small stat line: **"N read this year"**.
- The **Mark Read / Start Reading** quick actions are **optimistic**: the row patches in local state and
  moves shelves instantly, persisting in the background (no `bumpBooks()` → full-library refetch on
  success; bump only on error). The Library **swipe-delete** is optimistic the same way. See tech-spec F16b.

### Library

- **Search bar** over a list of every tracked book — matches **Title and Author(s)** (author is
  searched, not filtered). An **icon-only Filter button** to the right (see `docs/01_design_system.md`
  → FilterToggleButton).
- The shared **FilterPanel** is label-free: **Any Status**, **Any Genre** (genres in your own rows),
  **Any Rating** (minimum: Any / 1★+ … / 5★), **Any LGBT+** (None/Some/Significant), **Any Dynasty**
  (+ `全部` and the 12 dynasties) sharing a row with the **Favorites Only** toggle, plus single-line
  **Started** + **Finished** date ranges (each bound via the Calendar modal, clearable via DateRangeRow).
- Panel footer: shared **SortControl** next to **Clear Filters**. Sort over
  { Date, Dynasty, Rating, Status, Genre, Author, Title, Year } with an **asc/desc** toggle (nulls sort
  last; Dynasty: chronologically oldest→newest ascending — 先秦 first … 近代, `全部` last, non-Chinese
  last; descending flips it); default is **Date** descending.
- Each row: **cover thumbnail** (2:3, neutral placeholder when there's no cover), title (+ year) with a
  small filled **♥** when favourited and a **gold Dynasty badge** for Chinese titles, the author(s), a
  **status chip**, the **star rating** when rated, the first genre, and the date as "Jun 22". Tap →
  Entry/Edit; **swipe-left → Delete** (hard; tapping the revealed Delete acts immediately — no
  browser dialog).
- _Search, filter, and sort persist for the **browser-tab session** (`useSessionState`), restored on
  return via Back/bottom nav/Home, cleared when the tab closes._

### Entry / Edit (form)

Reached from the **New Book** bottom-nav tab (`/books/entry`, new) or by tapping a row (`/books/:id`,
edit).

- A **favourite heart** in the header toggles `is_favorite`.
- **Title** (required for CREATE) shares a line with a **Google Books** search button (search icon)
  opening the **Book Search** modal (pre-filled with the current Title). Selecting a result fetches
  details and populates metadata — a cover thumbnail + Genres, Page count, Language, Description
  (read-only display) — plus Title / Author(s) / Year (editable). Nothing saved until Create/Save.
- **Author(s)** (comma-separated), **Year**.
- **Status** (Want / Reading / Read / Dropped) is a **dropdown** sharing a line with **Rating** (0–5
  half-star): Reading defaults **Start Date** to today; Read/Dropped defaults **Finish/Drop date** to today.
- **LGBT+ Representation** (None / Some / Significant dropdown) and **Dynasty** share one compact row.
  **Dynasty** is a dropdown of the 13 values (全部 近代 … 先秦), defaulting to 全部, and is **editable only
  when the Title contains CJK**; for non-Chinese titles it's disabled and stored as NULL.
- **Start Date** and **Finish / Drop Date** share a line; each opens the Calendar modal and is
  clearable. **Notes** sits below: a **4-row** textarea with an **expand icon** beside the label that
  opens the shared full-screen **`NotesEditorModal`** (header `Title (Year)`, title only when Year is
  unknown) — a **buffered** editor (only Save writes back) using the shared **EntryHeaderActions**
  (Delete clears · Reset reverts · Save applies), a top-left ✕ to cancel, and a **paste** icon that
  inserts clipboard text **at the cursor**. Stored as `notes` (TEXT, effectively unbounded).
- Top-right icon actions (Delete when editing · Reset · Create/Save) via shared **EntryHeaderActions**.
  Create requires a Title.
- Field visibility controlled by **Books Settings → Visible Fields**.

### Book Search (local overlay inside Entry)

- Not a route sheet — a local overlay so the Entry form draft survives.
- A search bar over cover-thumbnail result rows (cover · title · author(s) · year).
- Tapping a result populates the live form and closes.
- Results from **Google Books**, falling back to **Open Library** when Google returns nothing.
- `VITE_GOOGLE_BOOKS_API_KEY` is optional (search works keyless at a lower quota).

### Settings

- **Entry Form → Visible Fields**: shared **VisibleFieldsSheet** (see `docs/01_design_system.md`)
  over the optional Entry/Edit fields in New/Edit form order: Author(s), Year, **Google Books
  Metadata**, Rating, LGBT+, Dynasty, the two dates, Notes. Stored on `profile.book_visible_fields`
  (**NULL = all visible**). Title, Status, and the Search button are always shown and not listed.
- **Import → Enable Bulk Books Import** toggle (`profile.book_importer_enabled`, **on by default**); when on,
  an **Import CSV Books** launcher opens the importer sheet.

### Import CSV (sheet, from Books Settings)

Columns: `title,author,status,rating,lgbtq_rep,dynasty,is_favorite,start_date,end_date,notes`

- `status` ∈ `want|reading|read|dropped`; `dynasty` for Chinese titles only; `is_favorite` optional.
- `start_date` required except for `want`; `end_date` required for `read|dropped`.
- `notes` is the optional, nullable **right-most** column (free text; wrap multi-line values in quotes);
  never errors, so it can't skip a row.
- `created_at` frozen to `start_date`, or — when a `want` omits it — defaults to import time.

Steps:

1. **Choose CSV** → rows parsed/validated (bad rows listed as skipped) and each **matched against
   Google Books** (searching `title author` for the top hit, Open Library fallback) with a progress
   count. Concurrency (`POOL`) scales with the API key: **3** keyless (the tiny per-IP quota 429s
   quickly) or **10** when `VITE_GOOGLE_BOOKS_API_KEY` is set (higher project quota) — see
   `hasGoogleBooksApiKey`; the 429 backoff + retry stays as a safety net either way. Each request also
   has a `REQUEST_TIMEOUT_MS` ceiling so a slow Open Library fallback can't stall the batch on its last
   row — a timed-out row becomes a `No match` to fix.
2. **Preview list**: each row's cover + matched title/year + author(s) + its status chip + parsed
   rating/finish date. Rows nothing was found for are flagged **No match**; rows whose top hit differs
   are flagged **review**. **Change** on any row opens the Book Search modal.
3. **Import** writes all rows **idempotently** (dedup on lower(title) + lower(author) — re-running the
   same file updates in place, never duplicates). Dates from the file; `created_at` = `start_date`.
   `saveImportedBooks` **batches** the writes — one bulk `insert` for new books + one bulk `upsert`
   (conflict on `id`) for existing ones, chunked at 500, with `{ defaultToNull: false }` (the
   conditional `created_at` key — see Shows) — rather than a per-row round-trip. Mirrors
   `saveImportedShows`; see tech-spec F16a.

Full guide: `templates/books-import-guide.md`.

---

## External APIs (Books-only)

**Google Books** (`www.googleapis.com/books/v1/volumes`):

- **optional** `VITE_GOOGLE_BOOKS_API_KEY` (raises quota; search works keyless without it — never
  throws when unset).
- Search queries `q=title+inauthor:author` for the top hit; details expand `categories`, `pageCount`,
  `language`, `description`, `imageLinks.thumbnail` (a full image URL — no CDN base).
- CJK-aware: `searchZhVariants` (see `docs/02_tech_spec.md`) fires in both scripts.
- `cover_url` is stored as the full image URL, no prefix.
- Persist only on CREATE/SAVE.

**Open Library** (`openlibrary.org/search.json`): free, no key.

- Fallback when Google Books returns nothing.
- Returns work + edition keys; cover URLs follow `https://covers.openlibrary.org/b/id/{id}-M.jpg`.
- `open_library_id` stored for future re-fetch.

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
- `dynasty` TEXT NULL — Chinese dynasty (CHECK against the 13 `DYNASTIES` values in
  `src/constants/dynasty.ts`); set only for Chinese titles, NULL otherwise; editable only when the
  Title contains CJK
- `is_favorite` BOOLEAN NOT NULL DEFAULT false — ♥; favourites filter + Dashboard shelf
- `start_date` DATE NULL · `end_date` DATE NULL
- `notes` TEXT NULL — free-text user notes (effectively unbounded; edited inline or via `NotesEditorModal`)
- `created_at`, `updated_at`
- Index on (`user_id`, `status`) and (`user_id`, `is_favorite`)

Standard rules: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`,
CHECK on enum columns, `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`.
**Hard delete** (leaf table — nothing references `book`; no `deleted_at`). The Quotes module's optional
`quote.book_id` link is declared ON DELETE SET NULL on `quote`, so it imposes no FK constraint here.
Imported back-catalogue rows carry their status, `start_date` (required except a not-yet-started Want),
`end_date` (read/dropped), and `created_at` frozen to `start_date`. Migration:
`supabase/migrations/07_books_schema.sql`. Profile columns added by
`supabase/migrations/08_books_profile_settings.sql`.
