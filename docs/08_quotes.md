# 08 — Quotes Module

## Screens

### Moment of Zen (`/quotes`)

- **First load**: one random quote where `is_favorite = true`; falls back to the whole pool when there are no favorites.
- **Refresh**: a floating **Shuffle** button at the **bottom-right** of the quote area and **pull-to-refresh** (touch) rotate to a new random quote from the **entire pool** (no immediate repeat). The module's bottom nav tabs are **Zen · Dashboard · Journal · Quotes · Settings**.
- **Card**: the quote text (large, centred; renders Chinese + multi-line correctly) — **tapping the quote text opens the Edit Quote page**; a metadata cluster — **Author · Source type · Title**, where **tapping the Title navigates to the linked Show/Book detail** (only when a link exists); the single **Category** badge and any **Tags**; a **heart** to toggle favorite instantly (optimistic via a `favOverride` map).

### Journal Dashboard (`/quotes/journal/dashboard`) — bottom-nav tab labeled **Dashboard**

- Header **range picker** (`Last 7 Days ▾`, default): Last 7 Days, Last 1/3/6 Months, Last Year — `JOURNAL_RANGES`/`JOURNAL_RANGE_DEFAULT` in `src/constants/journal.ts`, same pure-UI-constant convention as `WELLNESS_RANGES` (see `docs/04_wellness.md`).
- **KPI row**: Total Entries, Current Streak, Longest Streak (both in days), Entries This Month — all **range-independent** (computed over full history, not the selected range) via `computeJournalStats` (`src/lib/journal-stats.ts`).
- **Mood Map**: a bubble chart on **Russell's Circumplex Model of Affect** (valence × arousal) — one bubble per mood at a **fixed position** (`JOURNAL_MOOD_POSITIONS`), sized by that mood's entry count **within the selected range**. A deliberate simplification: Journal records one discrete mood per entry, not a continuous emotional coordinate, so each mood gets one representative point rather than a per-entry scatter. A "Most common: {mood}" line sits above the chart. Empty state when there are no entries at all (range-independent).

### Quotes Library (`/quotes/library`) — bottom-nav tab labeled **Quotes**

- **Search bar**: matches quote text, author, title, tags (via `quoteSearchText`); **Filter button** to the right.
- The floating **+** (`ListFab`) opens **New Quote**, shown only once the filtered list has at least one row.
- **SortControl**, **Favorites Only toggle**, **Clear Filters button**: Sort over { Date, Category, Source Type } with an **asc/desc** toggle (Date = date added; Category/Source Type sort on the stored key); default is **Date** descending.
- **Filter panel** is label-free: **Any Category**, **Any Source**, **Any Language**, **Linked Titles Only**, and multi-select **Filter Tags** (OR — any selected tag), which follow:
  - **Top 10 tags by use** shown by default (most-used first; selected tags always visible, with a "· top 10 by use" hint) in a fixed-height scroll area; the search box narrows the full tag list when there are more than 10. When opened from a Show/Book detail (via `?show=`/`?book=` param), the list is constrained to that record's quotes with a clearable banner.
- Each row carries:
  - Line 1: **quote snippet**.
  - Line 2: **category badge · author** + **heart** (toggle is optimistic).
  - Tap → Entry/Edit; **swipe-left → Delete** (optimistic). The DB delete runs in the background (no `bumpQuotes()` → full-list refetch; bump only on error).

### New / Edit Entry (`/quotes/entry`, `/quotes/:id`)

- **Quote Text** (6-row textarea; required). Prefilled from `?text=` when launched via copy-paste / an Apple Books Shortcut; a **Paste from clipboard** button fills it from the clipboard.
- **Title** sits above Author with a **link control** to its right — a **Show or Book** button (icon) opening a local overlay (see below) that searches local Show and Book records (pre-filled with the current Title); selecting one binds `show_id`/`book_id` and auto-fills **Source Type** + **Title** (for a Book, also **Author**; a Show leaves Author for the speaker/character). When linked the button shows **Linked** (tap to unlink, keeping the filled values). Title is entered manually for podcasts/songs/articles/videos.
- **Author** + **Source Type** (configured list dropdown) share the next line.
- **Category** (required, a configured dropdown) + **Language** share a line; **Language** is an English / Chinese **toggle** (auto-detected from the text — CJK → Chinese — and editable).
- **Tags** (optional): shared `TagInput` with autocomplete against existing tags (see `docs/01_design_system.md`). **Favorite** heart in the header.
- Top-right icon actions (Delete when editing · Reset · Create/Save) via shared **EntryHeaderActions**. Requires Quote Text + exactly one Category. A duplicate (same normalised text) is rejected inline.
- Field visibility controlled by **Quotes Settings**.

### Source Link (local overlay inside Entry)

- Not a route sheet — a local overlay so the Entry form draft survives.
- A search bar over rows showing local Show/Book records (cover/poster · title · author).
- Tapping a result binds the link and closes.

### Journal (`/quotes/journal`) — bottom-nav tab labeled **Journal**

- Folded into the Quotes module (own table `journal_entry`, own tag vocabulary — independent of `quote.tags`) rather than a separate module.
- **Search bar** matches entry text + tags. **Filter panel**, below **Date**: a **Mood** dropdown (Any Mood + the 7 moods) and a **Filter tags…** box on the same line, plus a tag facet (top 10 by use, same convention as Quotes). **Sort**: **Date** only, default descending — Journal has no other sortable field.
- Rows are **grouped under a centered "Month Year" heading**, newest month first. Each row's leading badge shows the **weekday** (regular weight) over the **day of month** (bold) — `formatWeekdayShort` + `formatDayOfMonth` — with the entry's **mood `LabelChip`** underneath; the row's **left strip is colored by mood**. The body is the entry text, clamped to **3 lines**.
- The floating **+** (`ListFab`) opens **New Journal**, shown only once the filtered list has at least one row. Tap a row → Journal Entry (edit); **swipe-left → Delete** (optimistic, same pattern as Quotes Library).

### Journal Entry (`/quotes/journal/entry`, `/quotes/journal/:id`)

- **Day-based** — one entry per day (`UNIQUE(user_id, day)`). New and Edit are the **same routed screen**, resolving to whichever record exists for the day currently shown.
- **Day nav** at the top of the body: centered `‹ date ›` (reusing Wellness Diary's header pattern), defaulting to **today**. Tapping the date opens the **Calendar** with a green cue dot on days that already have an entry (`legend={false}` — a single cue needs no legend). Landing on a day with an entry (via the arrows or the calendar) loads it for editing; landing on a blank day starts a fresh draft for it. Switching days with unsaved changes prompts a discard-confirm first.
- The header **title is always "Journal Entry"** (never "New"/"Edit" — the record backing the screen can change mid-session as the user browses days), and the **top-left icon tracks the current day**: `<` when it has a saved entry, **X** when it doesn't.
- **Mood** (required, defaults to Neutral): a **2-row grid of 7 `LabelChip`s** (4 + 3), one per mood, single-select, each colored per the owner's Mood config. Selecting a mood surfaces its **sub-tag suggestions** as tappable `SelectableChip`s (neutral tone, not accent — see `docs/01_design_system.md`) beside Tags; tapping one toggles it in/out of the entry's Tags.
- **Journal Entry** (textarea; required) with a **Paste** button (top-right of its label, using the paste-at-cursor pattern) that inserts clipboard text at the cursor. **Tags**: a separate `TagInput` with its own autocomplete pool, independent of Quotes' tags.
- Top-right icon actions (Delete when the current day has a saved entry · Reset · Create/Save) via shared **EntryHeaderActions** — **no favorite heart**. **Save and Cancel both return to the Journal listing** (there's no fixed "this record's" route to return to once the user has browsed to another day). **Hard delete**.

### Settings (`/quotes/settings`)

- **DISPLAY → Visible Fields** (labeled **(Quote Entry)** — Journal Entry's fields aren't independently configurable): shared **VisibleFieldsSheet** (see `docs/01_design_system.md`) over the optional fields in New/Edit form order: Title, Source Link, Author, Source Type, Language, Tags. Quote Text and Category are always shown.
- **JOURNAL VALUES → Moods**: opens **JournalMoodsSheet** — rename, recolor (`ColorPicker`), and edit sub-tag suggestions (`TagInput`) for each of the **7 fixed moods**. Unlike Source Types/Categories below, **not** built on `ConfigListEditor` — no add/delete/reorder, since the 7 keys and their circumplex order are structural (the Journal Dashboard's Mood Map is keyed to them). Each mood is a collapsible row; changes auto-save with a **"Saving… / All changes saved"** line, and expand/collapse state is preserved across a save (see `docs/02_tech_spec.md` → Data flow gotchas, F13).
- **VALUES** — manage the dropdown lists used on the Add/Edit form (each opens a sheet):
  - **Source Types** and **Categories**: uses **ConfigListEditor** to add / rename / delete / drag-reorder / color-pick the lists. Changes auto-save.
  - **Delete migration**: deleting a value still used by quotes prompts a **reassignment** — pick a replacement and the affected quotes are moved to it before the value is removed. A value can't be deleted if it's the last one in its list. **TV Show / Movie / Book** source types are **protected from deletion** (their `linkKind` drives Show/Book auto-linking) — they can still be renamed/reordered.
- **Enable Bulk Quotes Import / Export** (`profile.quote_importer_enabled`, **on by default**): surfaces both the **Import CSV Journal** / **Export CSV Journal** and **Import CSV Quotes** / **Export CSV Quotes** button pairs — Journal's importer/exporter reuse this same toggle rather than adding a second one.

### Import CSV Quotes (sheet, from Quotes Settings)

Columns: `Quote,Author,Source,Title,Category,Tags,is_favorite,created_at`

- `is_favorite` optional; `created_at` **required** (`YYYY-MM-DD`, drives the Date sort).
- **No external API** — links resolve against the user's own Show/Book rows.
- **Category** and **Source** matched against the owner's **configured** lists by **key or label** (case-insensitive; blank/unknown → flagged + skipped). **Tags** split from the quoted cell. **Language** auto-detected. A Title matching an existing Show (`linkKind: show`) or Book (`linkKind: book`) **links** the quote.

Steps:

1. **Choose CSV** → rows parsed/validated. Category/Source matched. Links resolved. Language detected.
2. **Preview**: counts of **new / duplicate-skipped / flagged** rows + a sample of new rows (snippet + category + "linked" marker) and flagged rows with reasons.
3. **Import** writes only valid new rows **idempotently** (dedup on `lower(trim(text))` via the DB UNIQUE + `ON CONFLICT DO NOTHING`) — re-running the same file imports nothing.

Full guide: `templates/quotes-import-guide.md`.

### Export CSV Quotes (button, from Quotes Settings)

`quotes-export.ts` (pure), reusing `listQuotes` as-is — its existing column selection is already every CSV column, so no dedicated export query was added. Same column spec as Import. `Category`/`Source` are exported as their stored **key**, not the display label, so the key stays correct even if that Category/Source Type was later renamed. `Title` is exported verbatim from the quote row — it's stored as plain text, independent of the auto-linked `show_id`/`book_id`.

- Sorted by `created_at`, then `author`, then `title`, all ascending (a null author/title sorts before any non-null value).

### Import CSV Journal (sheet, from Quotes Settings)

Columns: `day,journal_entry,mood,tags`

- `day` **required** (`YYYY-MM-DD`) — also frozen onto the imported row's `created_at`/`updated_at`, since Journal is a day-based table. `journal_entry` **required**. `mood` **optional** — matched against a mood's key or label, case-insensitive; blank or unrecognized **defaults to Neutral** and is flagged with a warning (the row still imports, unlike a bad date/blank entry text). **Tags** split from the quoted cell.
- **No external API, no linking** — a lighter importer than Quotes': no Show/Book resolution, and no Category/Source Type matching (Journal's only configurable values are the fixed 7 Moods).
- **Duplicate = a day already in the journal** — either already in the DB or repeated within the file (first occurrence wins) — enforced by `UNIQUE(user_id, day)` via an upsert with `ignoreDuplicates`, so re-running the same file skips every day already imported.

Steps:

1. **Choose CSV** → rows parsed/validated (day format, non-blank entry text, mood match).
2. **Preview**: counts of **new / duplicate-skipped / flagged** rows + a sample of new rows (snippet + date + mood chip + tags).
3. **Import** writes only the new rows in one batched upsert.

### Export CSV Journal (button, from Quotes Settings)

`journal-export.ts` (pure), reusing `listJournalEntries` as-is — its existing column selection (`day, journal_entry, mood, tags`) is already exactly the CSV's column spec, so no dedicated export query was added. `mood` is exported as its stored **key**, not the display label, so it stays correct even if that mood was later renamed in Journal Values.

- Sorted by `day` ascending (oldest first) — independent of the Library's own newest-first order.

---

## Tech details

- `source_type` and `category` are **owner-configurable** — no CHECK constraint on the columns.
- Their allowed values are stored on the profile (`profile.quote_source_types` / `profile.quote_categories`) as JSONB arrays of `{key, label, linkKind?}` / `{key, label}` and resolved partial-tolerantly by `src/lib/quotes-config.ts` (`effectiveSourceTypes`/`effectiveCategories`).
- NULL = canonical seed defaults.
- Logic: `matchKeyOrLabel`, `generateKey`, add/rename/remove/reorder transforms.

**Zen pool**: `initialZenPool` + `nextZenPool` + `randomItem` in `src/lib/quotes.ts` avoid repeats by maintaining a shuffled pool, drawing from it in order and refilling when exhausted.

**CJK-aware search**: `detectLanguage` (`containsCjk` → 'zh'). `quoteSearchText` builds the searchable text; `foldZh` normalises both query and row text for Traditional⇄Simplified-agnostic local filtering (see `docs/02_tech_spec.md` → Chinese search).

**Journal** (`src/lib/journal.ts`, `src/lib/journal-import.ts`, `src/data/journal.ts`) mirrors Quotes' structure but stays fully independent: its own `JournalCriteria`/`applyJournalView` (date-only sort, plus a `mood` filter), its own `rankedJournalTags` (no shared vocabulary with `quote.tags`), and its own refresh channel (`bumpJournal`/`useJournalVersion` in `src/lib/journal-refresh.ts`) so a Journal mutation never forces a Quotes Library refetch, or vice versa.

**Journal Moods** (`src/lib/journal-moods.ts`, seeds in `src/constants/journal.ts`): the 7 keys/order/positions/default colors/default sub-tags are fixed constants (`JOURNAL_MOODS`, `JOURNAL_MOOD_POSITIONS`, …), not a configurable list. `effectiveMoods(profile.journal_moods)` resolves the owner's rename/recolor/sub-tag overrides **per-key independently** — unlike `effectiveCategories`, a partial override doesn't fall back to the whole default set, since every owner always has all 7 keys. `matchMoodKeyOrLabel` backs the CSV importer's mood-column matching. `computeJournalStats`/`topMood` (`src/lib/journal-stats.ts`) derive the Dashboard's KPIs and "Most common" mood from a plain day list / mood-count map.

---

## Data model

### `quote`

- `id` UUID PK · `user_id` UUID → auth.users (ON DELETE CASCADE)
- `text` TEXT — the quote (required)
- `author` TEXT NULL
- `source_type` TEXT — a **configurable** Source Type `key` (**no CHECK**; owner-configurable via `profile.quote_source_types`, app-validated). Seed default keys: `book, podcast, tv, movie, interview, article, song, video`
- `title` TEXT NULL — source title (denormalised; survives a linked record's deletion)
- `category` TEXT — a **configurable** Category `key` (**no CHECK**; owner-configurable via `profile.quote_categories`, app-validated; required). Seed default keys: `wit, observation, philosophy, love, relationship, growth`
- `tags` TEXT[] DEFAULT '{}' — optional; autocomplete reads distinct `unnest(tags)`
- `language` TEXT DEFAULT 'en' — `'en' | 'zh'` (CHECK)
- `is_favorite` BOOLEAN DEFAULT false
- `show_id` UUID NULL → show (ON DELETE SET NULL) · `book_id` UUID NULL → book (ON DELETE SET NULL)
- `created_at`, `updated_at`
- `text_norm` TEXT GENERATED ALWAYS AS (`lower(btrim(text))`) STORED
- **UNIQUE (`user_id`, `text_norm`)** — no exact duplicates; import idempotency
- Indexes on (`user_id`, `category`) and (`user_id`, `is_favorite`)

Standard rules: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, only `language` keeps a CHECK; `source_type` and `category` are plain TEXT with no CHECK (validation in app). `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`. **Hard delete** (leaf table; no `deleted_at`). `show_id`/`book_id` are optional enrichment — because `author`, `title`, and `source_type` live on the quote, it stays complete after a linked Show/Book is hard-deleted (the FK just nulls). Migration: `supabase/migrations/09_quotes_schema.sql`. Profile columns added by `supabase/migrations/10_quotes_profile_settings.sql`.

### `journal_entry`

- `id` UUID PK · `user_id` UUID → auth.users (ON DELETE CASCADE)
- `day` DATE — the calendar day this entry belongs to (required)
- `journal_entry` TEXT — the entry text (required)
- `mood` TEXT DEFAULT 'neutral' **CHECK** in the 7 fixed keys (`happy, inspired, calm, neutral, sad, anxious, angry`) — unlike `quote.source_type`/`category`, this **is** CHECK-constrained: the set is structural (the Dashboard's Mood Map is keyed to it), not an owner-extensible list. The owner's rename/recolor/sub-tags for each key live on `profile.journal_moods` (JSONB, added by `10_quotes_profile_settings.sql` alongside `quote_categories` etc.; NULL = canonical defaults) — resolved by `src/lib/journal-moods.ts`.
- `tags` TEXT[] DEFAULT '{}' — optional; own vocabulary, independent of `quote.tags`
- `created_at`, `updated_at`
- **UNIQUE (`user_id`, `day`)** — one entry per day; drives the Entry screen's day nav (the arrows/calendar resolve to this record or a blank draft) and the importer's dedup. Its own index also covers every Journal query, including the Dashboard's per-mood count-by-range query (filtered by `user_id` + day range, `mood` only selected) — no separate `mood` index is needed; one wouldn't be used by that query and would be pure write overhead.

Standard rules: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, only `mood` carries a CHECK. `moddatetime` trigger on `updated_at`, explicit GRANT to `anon`/`authenticated`. **Hard delete** (leaf table; no `deleted_at`). Appended directly to `supabase/migrations/09_quotes_schema.sql` — Journal has no migration file of its own, per this repo's one-file-per-module SQL convention.

---

## Seed data

### Configurable list seed defaults

These are the canonical defaults resolved when `profile.quote_source_types` / `profile.quote_categories` is NULL. Stored in `src/constants/quotes.ts`:

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

### Journal Mood seed defaults

The canonical defaults resolved when `profile.journal_moods` is NULL (rename/recolor/sub-tags only — the 7 keys/order themselves are fixed, see Data model above). Stored in `src/constants/journal.ts`:

| key      | label    | default color | default sub-tags                        |
| -------- | -------- | ------------- | --------------------------------------- |
| happy    | Happy    | Gold          | relieved, grateful, excited             |
| inspired | Inspired | Emerald       | energetic, focused                      |
| calm     | Calm     | Cyan          | content, relaxed, peaceful, resigned    |
| neutral  | Neutral  | Grey          | indifferent                             |
| sad      | Sad      | Blue          | lonely, hurt, disappointed, depressed   |
| anxious  | Anxious  | Purple        | stressed, worried, restless             |
| angry    | Angry    | Red           | frustrated, annoyed, resentful, furious |

Each mood also has a fixed valence/arousal position on the Dashboard's Mood Map (`JOURNAL_MOOD_POSITIONS`) — not owner-editable.
