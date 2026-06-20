# 07 — Quotes — staging doc

Staging spec for the **Quotes** module (favourite quotes from TV, film, books, podcasts, articles, videos,
songs; English or Chinese). Sections are labelled with the file they merge into; this is a transient file
(delete after merging). Conventions follow the other modules: Home-hub card + `/quotes/*` route, singular
`quote` table with `user_id` + 4 RLS policies + `CHECK` enums + `moddatetime` + `GRANT`s, hard-delete,
the **RESET / SAVE / CREATE** buttons, and the existing search-sheet / Library / importer patterns.

Settled decisions: **exactly one category** (required) from a fixed set of six; **tags optional**;
source-type enum **tv / movie / book / podcast / article / video / song**; optional **cross-module
link** to a Show or Book with author/title/source denormalised onto the quote (survives a hard-delete of
the linked record); **language en | zh** (one "Chinese", auto-detected); a **recurring in-app importer**
(.xlsx/.csv); **idempotent, no exact duplicates**; **"Discover Quotes" external fetch is OUT OF SCOPE**.

---

## (merge into 00-PRD later)

**Overview** — add **(5) Quotes** to the module list.

**Goals** — add:

- Quotes: collect favourite quotes (English or Chinese) from TV shows, films, books, podcasts, articles,
  videos, and songs; each filed under **exactly one** of six categories with optional free-form tags, and
  optionally **linked to a Show or Book** record; a "Moment of Zen" dashboard, a searchable/filterable
  Library, and a recurring **CSV/XLSX import**.

**Navigation model** — extend routes to include `/quotes/*`.

**Quotes** (new feature section):

- **Moment of Zen** (`/quotes`): a single random quote — favourites first, broadening to the whole pool on
  pull-to-refresh; tapping the source title jumps to the linked Show/Book.
- **Library** (`/quotes/library`): search + faceted filters; list of quote snippets.
- **Add / Edit** (`/quotes/entry`, `/quotes/:id`): quote text, author, source type, title, optional
  Show/Book link, one category, optional tags, favourite, language. Accepts a `?text=&author=&title=`
  prefill (copy-paste / Apple-Books Shortcut). An **Import** button opens the importer.

**Out of scope / non-goals → Quotes** (new sub-block):

- **"Discover Quotes" / external quote fetch** (the Wikiquote + TV-quotes hybrid routing engine) — parked.
  Reliability and CORS of those sources are unproven, and manual entry + import cover the need. The
  `language` field is kept so routing can be added later.
- **Traditional vs Simplified** Chinese distinction — one `zh` value is enough for now.
- **Quotes from Articles** — the source type exists, but there's no data yet.
- **Direct Apple Books integration** — not possible from a PWA; copy-paste + the optional `?text=` Shortcut
  are the ingestion path (see runbook).

---

## (merge into 01-screens later)

**Navigation** — add to the tab list:

- **Quotes** tabs: **Home**, **Zen** (the Moment-of-Zen dashboard), **Library**. Add/Edit is a form
  reached from a `+` or by tapping a row. Modal reused: the **search-sheet** (for the Show/Book linker).

### Quotes - Moment of Zen (`/quotes`, dashboard)

- **First load**: one random quote where `is_favorite = true`; falls back to the whole pool if no favourites.
- **Pull-to-refresh**: rotates to a new random quote from the **entire pool** (no immediate repeat).
- **Card**: the quote text (large, centred; renders Chinese correctly); a metadata cluster — **Author ·
  Source type · Title**, where **tapping the Title navigates to the linked Show/Book detail** (only when a
  link exists); the single **Category** badge and any **Tags**; a **heart** to toggle favourite instantly.

### Quotes - Library (`/quotes/library`)

- **Search**: real-time match across quote text, author, title, and tags.
- **Filters**: the six **Categories**, multi-select **Tags**, **Favourites** toggle, **Source type**,
  **Language**. When opened from a Show/Book detail ("Quotes from this title"), the list is constrained to
  that record's `show_id`/`book_id`.
- **List**: lazy-loaded rows — a quote snippet, author, and category badge. Tap → Add/Edit; **swipe-left** →
  Delete (hard, with confirm).

### Quotes - Add / Edit (form)

- **Quote Text** (textarea; required). Prefilled from `?text=` when launched via copy-paste / Shortcut.
- **Source link** (optional): a search-and-link field querying local **Show** and **Book** records;
  selecting one binds `show_id`/`book_id` and auto-fills **Author**, **Source Type**, **Title** (still
  editable). Clearing the link keeps the filled values.
- **Author**, **Source Type** (TV Show / Movie / Book / Podcast / Article / Video / Song), **Title** — for
  podcasts, songs, articles, videos (no module to link) these are entered manually.
- **Category** (required): single-select from the six.
- **Tags** (optional): inline tag input with autocomplete against existing tags; delimiter creates a tag.
- **Language**: `English` / `Chinese`, auto-detected from the text (CJK → Chinese), editable.
- **Favourite** toggle.
- Top-right: **RESET** + **CREATE** (new) / **SAVE** (editing). **Validation**: requires Quote Text +
  exactly one Category. Tags are optional.

### Quotes - Import (from the Library; recurring)

- An **Import** button opens a sheet: pick a `.csv` file → preview (valid rows, flagged rows, duplicates
  skipped) → **Import**. Columns: `templates/quotes-import-guide.md`. (Spec in 02-tech-spec.)

---

## (merge into 02-tech-spec later)

> _App-wide convention:_ **all CSV imports across every module** (Wellness custom foods, Net Worth, Shows,
> Books, Quotes) are parsed with **Papa Parse (RFC-4180, UTF-8)** — never hand-split. Files are authored as
> **CSV UTF-8**; dates are `YYYY-MM-DD` text. No XLSX/SheetJS import path.

**Quotes constants** (`src/constants/quotes.ts`):

- `QUOTE_CATEGORIES` = philosophy, heart, connection, growth, wit, observation (display-cased in UI).
- `QUOTE_SOURCE_TYPES` = tv, movie, book, podcast, article, video, song.

**Language detection** (`src/lib/quotes.ts`): a quote is `zh` if it contains any CJK characters, else `en`;
editable on the form.

**Apple Books / external ingestion**: the Add/Edit route reads `?text=&author=&title=` query params to
prefill the form (enables copy-paste and an optional Apple Books **Shortcut** that opens that URL — see
runbook). A **Paste from clipboard** button on the form fills Quote Text from the clipboard. No direct
Apple Books API exists.

**In-app importer** (recurring; mirrors the Wellness custom-foods importer):

- **CSV only**, parsed with **Papa Parse (RFC-4180), UTF-8**. **Never line-split or comma-split the raw
  file** — Papa Parse handles quoted fields, embedded commas, and **multi-line quote cells** (e.g. the
  House-of-Cards dialogue) correctly when the exporter quotes them (Excel/Numbers do this automatically on
  "Save As **CSV UTF-8**"). Export the owner's `quotes-seed-local.xlsx` to `quotes-seed-local.csv` once.
- Columns (header row): `Quote, Author, Source, Title, Category, Tags`.
  - **Category** validated against the six (case-insensitive); blank/invalid → **flagged for review**, not imported.
  - **Source** normalised to the enum (`tv`→`tv`, `video`→`video`, `song`→`song`,
    `podcast`→`podcast`, `movie`→`movie`, `book`→`book`, `article`→`article`); unknown → flagged.
  - **Tags** is a single (quoted) CSV cell holding comma-separated tags — read the whole cell, **then**
    split on `,`, trim, drop empties (two different comma meanings, handled in two steps; CSV-level commas
    are resolved by Papa Parse via quoting, tag-level commas by this post-parse split). Optional (blank is fine).
  - **Language** auto-detected per row (CJK → `zh`).
  - Optional: if **Title** matches an existing Show/Book (case-insensitive), set `show_id`/`book_id`.
- **Idempotent / no exact duplicates**: dedup on `user_id` + normalised text (`lower(trim(text))`); an
  existing match is **skipped**, so re-running the same file never duplicates. Enforced by the DB unique
  index (below) + `ON CONFLICT DO NOTHING`.
- **Preview before commit**: shows counts of new / skipped-duplicate / flagged rows + a sample; **Import**
  writes only the valid, non-duplicate rows.

---

## (merge into 03-data-model later)

### quote (one row per quote)

- `id` UUID PK
- `user_id` UUID → auth.users
- `text` TEXT — the quote
- `author` TEXT NULL
- `source_type` TEXT — 'tv'|'movie'|'book'|'podcast'|'article'|'video'|'song' (CHECK)
- `title` TEXT NULL — source title (denormalised; survives a linked record's deletion)
- `category` TEXT — 'philosophy'|'heart'|'connection'|'growth'|'wit'|'observation' (CHECK; required)
- `tags` TEXT[] DEFAULT '{}' — optional; autocomplete reads distinct `unnest(tags)`
- `language` TEXT DEFAULT 'en' — 'en' | 'zh' (CHECK)
- `is_favorite` BOOLEAN DEFAULT false
- `show_id` UUID NULL → show (ON DELETE SET NULL)
- `book_id` UUID NULL → book (ON DELETE SET NULL)
- `created_at`, `updated_at`
- `text_norm` TEXT GENERATED ALWAYS AS (lower(btrim(text))) STORED
- **UNIQUE (`user_id`, `text_norm`)** — enforces "no exact duplicates" and import idempotency.
- Indexes on (`user_id`, `category`) and (`user_id`, `is_favorite`).

Standard rules: `user_id` (ON DELETE CASCADE), four RLS policies using `(select auth.uid()) = user_id`,
`CHECK` on enum columns, `moddatetime` trigger, migration `GRANT`s to `anon`/`authenticated`. **Hard
delete** (leaf table); no `deleted_at`. New migration `supabase/migrations/<ts>_quotes_schema.sql`.

**Cross-module links**: `show_id`/`book_id` are optional enrichment. Because the denormalised `author`,
`title`, and `source_type` live on the quote, a quote stays complete (and the Library/Zen still render it)
after a linked Show or Book is hard-deleted — the FK just goes null.

**Relationships** — add: `profile 1—* quote`; `show 1—* quote` and `book 1—* quote` (optional, SET NULL).

---

## (merge into 04-design-system later)

- **Quote card** (Zen): large centred text with comfortable line-height; correct CJK rendering; metadata
  cluster (author · source type · title-as-link); a Category badge + Tag chips; a favourite heart.
- **Category badge**: a chip per category (reuse existing accent/neutral tokens; a fixed colour per category
  is optional). **Tag chips**: small neutral chips.
- **Source-type icon** (optional, small): a Tabler glyph per source type (e.g. `IconDeviceTv`, `IconMovie`,
  `IconBook`, `IconMicrophone`, `IconArticle`, `IconVideo`, `IconMusic`).
- Reuse the **search-sheet** (Show/Book linker), list + swipe-to-delete, filter chips, the favourite heart,
  and the importer sheet — no new visual language.

---

## (merge into 05-seed-data later)

No seed rows required for Quotes — quotes are private user data loaded via the in-app importer (owner's
`quotes-seed-local.csv`, exported once from the original xlsx), and the category/source enums live in code
(`src/constants/quotes.ts`). The importer guide lives at `templates/quotes-import-guide.md`. (Nothing to
add to `05-seed-data.md`.)
