# 08 — Quotes Module

## Screens

### Moment of Zen (`/quotes`)

- **First load**: one random quote where `is_favorite = true`; falls back to the whole pool when
  there are no favourites.
- **Refresh**: a floating **Shuffle** button at the **bottom-right** of the quote area and
  **pull-to-refresh** (touch) rotate to a new random quote from the **entire pool** (no immediate
  repeat). New Quote and Settings live in the bottom nav.
- **Card**: the quote text (large, centred; renders Chinese + multi-line correctly) — **tapping the
  quote text opens the Edit Quote page**; a metadata cluster — **Author · Source type · Title**,
  where **tapping the Title navigates to the linked Show/Book detail** (only when a link exists); the
  single **Category** badge and any **Tags**; a **heart** to toggle favourite instantly.

### Library (`/quotes/library`)

- **Search** (placeholder "Search quote, author, title, tag"): real-time match across quote text,
  author, title, and tags (via `quoteSearchText`). An **icon-only Filter button** to the right
  (see `docs/01-design-system.md` → FilterToggleButton).
- **FilterPanel** (label-free): **Any Category**, **Any Source**, **Any Language**, and a **Favorites
  Only** toggle share a 2-column grid. **Linked Titles Only** toggle (quotes bound to a Show/Book
  record) shares the next row with the **Filter tags…** search box. Multi-select **Tags** (OR — any
  selected tag) follow: the **top 10 tags by use** show by default (most-used first; selected tags
  always visible, with a "· top 10 by use" hint) in a fixed-height scroll area; the search box narrows
  the full tag list when there are more than 10. When opened from a Show/Book detail (via
  `?show=`/`?book=` param), the list is constrained to that record's quotes with a clearable banner.
- Panel footer: shared **SortControl** next to **Clear Filters**. Sort over { Date, Category,
  Source Type } with an **asc/desc** toggle (Date = date added; Category/Source Type sort on the stored
  key); default is **Date** descending.
- **List**: rows — a quote snippet, the category badge, and author. Tap → Add/Edit; **swipe-left** →
  Delete (hard, with confirm).
- _Search, filter, and sort persist for the **browser-tab session** (`useSessionState`), restored on
  return via Back/bottom nav/Home, cleared when the tab closes._

### Add / Edit (form, `/quotes/entry`, `/quotes/:id`)

- **Quote Text** (6-row textarea; required). Prefilled from `?text=` when launched via copy-paste /
  an Apple Books Shortcut; a **Paste from clipboard** button fills it from the clipboard.
- **Title** sits above Author with a **link control** to its right — a **Show or Book** button
  (icon) opening a local overlay (see below) that searches local Show and Book records (pre-filled
  with the current Title); selecting one binds `show_id`/`book_id` and auto-fills **Source Type** +
  **Title** (for a Book, also **Author**; a Show leaves Author for the speaker/character). When linked
  the button shows **Linked** (tap to unlink, keeping the filled values). Title is entered manually for
  podcasts/songs/articles/videos.
- **Author** + **Source Type** (configured list dropdown) share the next line.
- **Category** (required, a configured dropdown) + **Language** share a line; **Language** is an English /
  Chinese **toggle** (auto-detected from the text — CJK → Chinese — and editable).
- **Tags** (optional): shared `TagInput` with autocomplete against existing tags (see `docs/01-design-system.md`).
  **Favourite** heart in the header.
- Top-right icon actions (Delete when editing · Reset · Create/Save) via shared **EntryHeaderActions**.
  Requires Quote Text + exactly one Category. A duplicate (same normalised text) is rejected inline.
- Field visibility controlled by **Quotes Settings**.

### Source Link (local overlay inside Entry)

- Not a route sheet — a local overlay so the Entry form draft survives.
- A search bar over rows showing local Show/Book records (cover/poster · title · author).
- Tapping a result binds the link and closes.

### Settings (`/quotes/settings`)

- **Entry Form → Visible Fields**: shared **VisibleFieldsSheet** (see `docs/01-design-system.md`)
  over the optional fields in New/Edit form order: Title, Source Link, Author, Source Type, Language,
  Tags. Quote Text and Category are always shown.
- **Values** — manage the dropdown lists used on the Add/Edit form (each opens a sheet):
  - **Source Types** and **Categories**: **add / rename / delete / drag-reorder** the values (display
    order = dropdown order + Library filter order). Changes auto-save via shared **ConfigListEditor**
    (see `docs/01-design-system.md`).
  - **Delete migration**: deleting a value still used by quotes prompts a **reassignment** — pick a
    replacement and the affected quotes are moved to it before the value is removed. A value can't be
    deleted if it's the last one in its list. **TV Show / Movie / Book** source types are
    **protected from deletion** (their `linkKind` drives Show/Book auto-linking) — they can still be
    renamed/reordered.
- **Enable CSV Import**: surfaces the **Import CSV…** launcher.

### Import CSV (sheet, from Quotes Settings)

Columns: `Quote,Author,Source,Title,Category,Tags,is_favorite,created_at`

- `is_favorite` optional; `created_at` **required** (`YYYY-MM-DD`, drives the Date sort).
- **No external API** — links resolve against the user's own Show/Book rows.
- **Category** and **Source** matched against the owner's **configured** lists by **key or label**
  (case-insensitive; blank/unknown → flagged + skipped). **Tags** split from the quoted cell.
  **Language** auto-detected. A Title matching an existing Show (`linkKind: show`) or Book
  (`linkKind: book`) **links** the quote.

Steps:

1. **Choose CSV** → rows parsed/validated. Category/Source matched. Links resolved. Language detected.
2. **Preview**: counts of **new / duplicate-skipped / flagged** rows + a sample of new rows (snippet +
   category + "linked" marker) and flagged rows with reasons.
3. **Import** writes only valid new rows **idempotently** (dedup on `lower(trim(text))` via the DB
   UNIQUE + `ON CONFLICT DO NOTHING`) — re-running the same file imports nothing.

Full guide: `templates/quotes-import-guide.md`.

---

## Tech details

- `source_type` and `category` are **owner-configurable** — no CHECK constraint on the columns.
- Their allowed values are stored on the profile (`profile.quote_source_types` /
  `profile.quote_categories`) as JSONB arrays of `{key, label, linkKind?}` / `{key, label}` and
  resolved partial-tolerantly by `src/lib/quotes-config.ts`
  (`effectiveSourceTypes`/`effectiveCategories`).
- NULL = canonical seed defaults.
- Logic: `matchKeyOrLabel`, `generateKey`, add/rename/remove/reorder transforms.

**Zen pool**: `initialZenPool` + `nextZenPool` + `randomItem` in `src/lib/quotes.ts` avoid repeats
by maintaining a shuffled pool, drawing from it in order and refilling when exhausted.

**CJK-aware search**: `detectLanguage` (`containsCjk` → 'zh'). `quoteSearchText` builds the
searchable text; `foldZh` normalises both query and row text for Traditional⇄Simplified-agnostic
local filtering (see `docs/02-tech-spec.md` → Chinese search).

---

## Data model

### `quote`

- `id` UUID PK · `user_id` UUID → auth.users (ON DELETE CASCADE)
- `text` TEXT — the quote (required)
- `author` TEXT NULL
- `source_type` TEXT — a **configurable** Source Type `key` (**no CHECK**; owner-configurable via
  `profile.quote_source_types`, app-validated). Seed default keys: `book, podcast, tv, movie,
interview, article, song, video`
- `title` TEXT NULL — source title (denormalised; survives a linked record's deletion)
- `category` TEXT — a **configurable** Category `key` (**no CHECK**; owner-configurable via
  `profile.quote_categories`, app-validated; required). Seed default keys:
  `wit, observation, philosophy, love, relationship, growth`
- `tags` TEXT[] DEFAULT '{}' — optional; autocomplete reads distinct `unnest(tags)`
- `language` TEXT DEFAULT 'en' — `'en' | 'zh'` (CHECK)
- `is_favorite` BOOLEAN DEFAULT false
- `show_id` UUID NULL → show (ON DELETE SET NULL) · `book_id` UUID NULL → book (ON DELETE SET NULL)
- `created_at`, `updated_at`
- `text_norm` TEXT GENERATED ALWAYS AS (`lower(btrim(text))`) STORED
- **UNIQUE (`user_id`, `text_norm`)** — no exact duplicates; import idempotency
- Indexes on (`user_id`, `category`) and (`user_id`, `is_favorite`)

Standard rules: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`,
only `language` keeps a CHECK; `source_type` and `category` are plain TEXT with no CHECK (validation
in app). `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`.
**Hard delete** (leaf table; no `deleted_at`). `show_id`/`book_id` are optional enrichment — because
`author`, `title`, and `source_type` live on the quote, it stays complete after a linked Show/Book is
hard-deleted (the FK just nulls). Migration: `supabase/migrations/08_quotes_schema.sql`. Profile
columns added by `supabase/migrations/09_quotes_profile_settings.sql`.

---

## Seed data

### Configurable list seed defaults

These are the canonical defaults resolved when `profile.quote_source_types` / `profile.quote_categories`
is NULL. Stored in `src/constants/quotes.ts`:

**Source Types** (in order):

| key       | label     | linkKind |
| --------- | --------- | -------- |
| book      | Book      | book     |
| podcast   | Podcast   | null     |
| tv        | TV Show   | show     |
| movie     | Movie     | show     |
| interview | Interview | null     |
| article   | Article   | null     |
| song      | Song      | null     |
| video     | Video     | null     |

`linkKind` drives Show/Book auto-linking. TV, Movie, and Book are **protected from deletion**.

**Categories** (in order):

| key          | label        |
| ------------ | ------------ |
| wit          | Wit          |
| observation  | Observation  |
| philosophy   | Philosophy   |
| love         | Love         |
| relationship | Relationship |
| growth       | Growth       |
