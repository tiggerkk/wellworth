# 03 — Data Model

Postgres on Supabase. Table names **singular, snake_case**. Every user-owned table has a `user_id` (→ `auth.users.id`, `ON DELETE CASCADE`) and four RLS policies (select/insert/update/delete) using `(select auth.uid()) = user_id`. Child tables without their own `user_id` (`serving`, `strength_set`) enforce ownership with an `EXISTS` check against their parent. RLS is enabled in the first migration for **every** table, and that migration also `GRANT`s table privileges to the `anon`/`authenticated` roles\*\* (raw-SQL-migration tables don't inherit Supabase's default grants — RLS alone yields `42501 permission denied`). Enumerated TEXT columns are constrained with `CHECK`; `updated_at` columns are maintained by the `moddatetime` trigger.
Nutrient sets are stored as JSONB maps (`nutrient_key → amount`), validated against the `nutrient` reference table at the data-access layer (`filterToKnownKeys`) — so adding a tracked nutrient never needs a schema change.

## Tables

### profile (one row per user)

- `user_id` UUID PK → `auth.users.id`
- `birthday` DATE, `sex` TEXT, `height_cm` NUMERIC, `weight_kg` NUMERIC
- `protein_target_g` NUMERIC NULL — manual override; null = use DRI
- `activity_factor` NUMERIC DEFAULT 1.4
- `units` TEXT DEFAULT 'metric' — 'metric' | 'imperial' (display only)
- `highlighted_nutrients` TEXT[] — up to 8 nutrient keys for the Diary grid
- `visible_nutrients` TEXT[] — nutrient keys shown on Dashboard/Daily Report (seeded from defaults)
- `show_visible_fields` TEXT[] NULL — Shows Entry-form field visibility; **NULL = all visible**
  (default-on, no seeding); an explicit array once trimmed in Shows Settings
- `show_importer_enabled` BOOLEAN NOT NULL DEFAULT false — surfaces the Shows in-app CSV importer
- `show_poster_url_visible` BOOLEAN NOT NULL DEFAULT false — Shows Settings → Display: force the Entry
  "Poster URL" field always visible (off = shown only when TMDB has no poster)
  (the three `show_*` columns are added by `supabase/migrations/20260617130000_profile_show_settings.sql`)
- `book_visible_fields` TEXT[] NULL — Books Entry-form field visibility; **NULL = all visible**
  (default-on, no seeding); an explicit array once trimmed in Books Settings
- `book_importer_enabled` BOOLEAN NOT NULL DEFAULT false — surfaces the Books in-app CSV importer
  (the two `book_*` columns are added by `supabase/migrations/20260620130000_profile_book_settings.sql`)
- `quote_visible_fields` TEXT[] NULL — Quotes Entry-form field visibility; **NULL = all visible**
  (default-on, no seeding); an explicit array once trimmed in Quotes Settings
- `quote_importer_enabled` BOOLEAN NOT NULL DEFAULT false — surfaces the Quotes in-app CSV importer
  (the two `quote_*` columns are added by `supabase/migrations/20260621130000_profile_quote_settings.sql`)
- `created_at`, `updated_at` TIMESTAMPTZ

### food (custom items + cached USDA/Off items the user favorited or logged)

- `id` UUID PK
- `user_id` UUID → auth.users
- `source` TEXT — 'usda' | 'off' | 'custom'
- `external_id` TEXT NULL — USDA fdcId or barcode
- `name` TEXT
- `type` TEXT DEFAULT 'food' — 'food' | 'supplement'
- `nutrient_basis` TEXT DEFAULT 'per_100g' — 'per_100g' | 'per_serving'
- `nutrients` JSONB — { nutrient_key: amount } relative to the basis
- `is_favorite` BOOLEAN DEFAULT false
- `deleted_at` TIMESTAMPTZ NULL — soft delete; NULL = active. Never hard-delete a food referenced by a diary entry.
- `created_at`, `updated_at`

### serving (a food's measures)

- `id` UUID PK
- `food_id` UUID → food (ON DELETE CASCADE)
- `name` TEXT — e.g. '1 bowl', '1 cup', '1 capsule'
- `grams` NUMERIC

### activity (the user's activity library)

- `id` UUID PK
- `user_id` UUID → auth.users
- `name` TEXT
- `description` TEXT NULL
- `template` TEXT — 'duration' | 'strength'
- `default_effort` TEXT — 'light' | 'moderate' | 'vigorous'; applies to both templates
- `default_duration_min` NUMERIC NOT NULL DEFAULT 30 — default session length; prefills the Activity Log's Duration field
- `met_by_effort` JSONB — { "light": n, "moderate": n, "vigorous": n }; at least one key required. Resolved MET for a session = met_by_effort[session_effort]. Single-intensity activities may have just one key; the default_effort must be a key present in this map.
- `icon` TEXT NULL — Tabler icon component name (e.g. 'IconKarate', 'IconBarbell').
  Resolved at render time via `ACTIVITY_ICONS[icon]` in `src/constants/activity-icons.ts`
  (named imports only). Null/unknown falls back to `IconRun`.
- `deleted_at` TIMESTAMPTZ NULL — soft delete; NULL = active. Never hard-delete an activity referenced by a diary entry.
- `created_at`, `updated_at`

### diary_entry (the log)

- `id` UUID PK
- `user_id` UUID → auth.users
- `day` DATE — the logged day (no timestamp)
- `group_name` TEXT — 'breakfast'|'lunch'|'dinner'|'snacks'|'supplements'|'activities'
- `kind` TEXT — 'food' | 'activity'
- `food_id` UUID NULL → food (ON DELETE SET NULL)
- `activity_id` UUID NULL → activity (ON DELETE SET NULL)
- `serving_id` UUID NULL → serving (ON DELETE SET NULL)
- `amount` NUMERIC NULL
- `duration_min` NUMERIC NULL
- `effort` TEXT NULL — per-session override
- `energy_kcal` NUMERIC — negative for activities
- `label` TEXT — denormalized display name
- `nutrients` JSONB — snapshot of this entry's nutrient contribution
- `created_at`, `updated_at`
- Index on (`user_id`, `day`).

### strength_set (sets within a strength activity entry)

- `id` UUID PK
- `entry_id` UUID → diary_entry (ON DELETE CASCADE)
- `exercise` TEXT — e.g. 'Chest Press'
- `set_number` INT
- `reps` INT
- `weight` NUMERIC
- `weight_unit` TEXT — store the entered unit label; canonical weight derived for any maths

### nutrient (reference / seed — not user data; RLS on, read-only to clients)

- `key` TEXT PK — e.g. 'vitamin_d'
- `display_name` TEXT, `unit` TEXT
- `category` TEXT — 'general'|'protein'|'vitamins'|'minerals'|'carbohydrates'|'lipids'
- `parent_key` TEXT NULL — nesting (Fiber→carbs, Omega-3→polyunsaturated, amino acids→protein, etc.).
  A **DEFERRABLE INITIALLY DEFERRED** self-FK → `nutrient.key`, so the single multi-row seed insert
  validates at commit regardless of row order.
- `sort_order` INT
- `default_visible` BOOLEAN
- `has_upper_limit` BOOLEAN — whether a UL exists; the red-bar _scope_ (total vs supplemental-only,
  CDRR, guidance) lives in `src/lib/dri.ts` (see `02-tech-spec.md` → "Upper limits / red bars").
- RLS is **enabled** with a single SELECT policy for `authenticated` (no write policies → read-only to
  clients; rows are written only by migrations).
  (See `05-seed-data.md` for the full seed list — exactly 80 rows. DRI target/UL values are a lookup
  in `src/lib/dri.ts`, keyed by sex/age band, not stored per row; **Phase 1 populates only adult
  female 51–70** and throws for other bands.)

### networth_snapshot

- `id` UUID PK
- `user_id` UUID → auth.users
- `month` DATE — normalized to the **first day of the month**; **UNIQUE (user_id, month)**
- `created_at`, `updated_at` TIMESTAMPTZ

### asset_entry

- `id` UUID PK
- `user_id` UUID → auth.users
- `snapshot_id` UUID → networth_snapshot (ON DELETE CASCADE)
- `asset_type` TEXT — the enum above
- `name` TEXT
- `currency` TEXT — 'HKD' | 'CNY' | 'USD'
- `details` JSONB — type-specific fields (maturity_date, ticker, shares, units, …)
- `value_native` NUMERIC — value in the entry's own currency
- `fx_rate_to_base` NUMERIC — native → HKD rate used (1 for HKD)
- `value_base` NUMERIC — value_native × fx_rate_to_base (stored)
- `sort_order` INT NULL
- `created_at`, `updated_at`
- Index on (`user_id`, `snapshot_id`).

`asset_entry` cascades on snapshot delete. No `asset` table and no soft-delete: each month is a complete, self-contained set of `asset_entry` rows, so deleting an entry simply means it is absent from that month forward; prior months are intact.

The migration is `supabase/migrations/20260615120000_networth_schema.sql`.

### show (one row per tracked title)

- `id` UUID PK
- `user_id` UUID → auth.users (ON DELETE CASCADE)
- `type` TEXT — 'tv' | 'movie' | 'documentary' (CHECK); chooses the TMDB endpoint (documentary → /tv) and the season/episode UI
- `status` TEXT — 'want' | 'watching' | 'watched' | 'dropped' (CHECK)
- `tmdb_id` INT NULL — TMDB id (enables the per-show "Refresh from TMDB")
- `imdb_id` TEXT NULL — stable cross-reference
- `title` TEXT, `original_title` TEXT NULL, `year` INT NULL
- `poster_path` TEXT NULL — **either** a TMDB path (URL built from the fixed CDN base) **or** a full pasted image URL; always rendered with `referrerpolicy="no-referrer"`
- `overview` TEXT NULL
- `genres` TEXT[] NULL
- `director` TEXT NULL — movie director, or TV/documentary creator(s) joined
- `cast` TEXT[] NULL — top ~10 cast names (quoted `"cast"` in DDL — reserved word)
- `runtime_min` INT NULL
- `original_language` TEXT NULL
- `total_seasons` INT NULL, `total_episodes` INT NULL — episodic types only (TV + documentary)
- `watched_seasons` INT NULL, `watched_episodes` INT NULL — episodic types only; set to totals on Watched
- `rating` NUMERIC NULL — user stars, 0–5 in 0.5 steps (CHECK)
- `lgbtq_rep` TEXT DEFAULT 'none' — LGBT+ representation: 'none' | 'some' | 'significant' (CHECK)
- `is_favorite` BOOLEAN NOT NULL DEFAULT false — starred title (the ♥; favourites filter + Dashboard shelf)
- `start_date` DATE NULL, `end_date` DATE NULL — finish/drop date
- `last_update_date` DATE NULL — defaults to today in the UI, editable; NULL for imported rows
- `comments` TEXT NULL
- `created_at`, `updated_at`
- Index on (`user_id`, `status`) and on (`user_id`, `is_favorite`) — the latter backs the favourites filter.

Standard rules apply: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, `CHECK` on the enum columns, `moddatetime` trigger on `updated_at`, explicit `GRANT` to `anon`/`authenticated`. Imported back-catalogue rows leave the three dates NULL (genuinely unknown). The migration is `supabase/migrations/20260617120000_shows_schema.sql`.

### book (one row per tracked book)

- `id` UUID PK
- `user_id` UUID → auth.users (ON DELETE CASCADE)
- `status` TEXT — 'want' | 'reading' | 'read' | 'dropped' (CHECK)
- `google_books_id` TEXT NULL — enables a future "refresh metadata"
- `open_library_id` TEXT NULL — Open Library work/edition key (fallback source)
- `isbn` TEXT NULL — stable cross-reference
- `title` TEXT, `authors` TEXT[] NULL, `year` INT NULL — first-published year
- `cover_url` TEXT NULL — **full image URL** (Google Books / Open Library); unlike Shows'
  `poster_path`, no CDN base is prepended
- `description` TEXT NULL
- `genres` TEXT[] NULL
- `page_count` INT NULL — informational only (no progress tracking)
- `language` TEXT NULL
- `rating` NUMERIC NULL — user stars, 0–5 in 0.5 steps (CHECK)
- `lgbtq_rep` TEXT DEFAULT 'none' — LGBT+ representation: 'none' | 'some' | 'significant' (CHECK)
- `is_favorite` BOOLEAN NOT NULL DEFAULT false — starred book (the ♥; favourites filter + Dashboard shelf)
- `start_date` DATE NULL, `end_date` DATE NULL — finish/drop date
- `last_update_date` DATE NULL — defaults to today in the UI, editable; NULL for imported rows
- `comments` TEXT NULL
- `created_at`, `updated_at`
- Index on (`user_id`, `status`) and on (`user_id`, `is_favorite`).

Standard rules apply: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, `CHECK` on the enum columns, `moddatetime` trigger on `updated_at`, explicit `GRANT` to `anon`/`authenticated`. **Hard delete** (leaf table — nothing references `book`; no `deleted_at`). The Quotes module's optional `quote.book_id` link is declared `ON DELETE SET NULL` on `quote`, so it imposes no FK here. Imported back-catalogue rows get `status = 'read'`, the file's `end_date`, and NULL `start_date`/`last_update_date`. The migration is `supabase/migrations/20260620120000_books_schema.sql`.

### quote (one row per quote)

- `id` UUID PK
- `user_id` UUID → auth.users (ON DELETE CASCADE)
- `text` TEXT — the quote
- `author` TEXT NULL
- `source_type` TEXT — 'tv' | 'movie' | 'book' | 'podcast' | 'article' | 'video' | 'song' (CHECK)
- `title` TEXT NULL — source title (denormalised; survives a linked record's deletion)
- `category` TEXT — 'philosophy' | 'heart' | 'connection' | 'growth' | 'wit' | 'observation' (CHECK; required)
- `tags` TEXT[] DEFAULT '{}' — optional; autocomplete reads distinct `unnest(tags)`
- `language` TEXT DEFAULT 'en' — 'en' | 'zh' (CHECK)
- `is_favorite` BOOLEAN DEFAULT false
- `show_id` UUID NULL → show (ON DELETE SET NULL), `book_id` UUID NULL → book (ON DELETE SET NULL)
- `created_at`, `updated_at`
- `text_norm` TEXT GENERATED ALWAYS AS (`lower(btrim(text))`) STORED
- **UNIQUE (`user_id`, `text_norm`)** — enforces "no exact duplicates" and import idempotency.
- Indexes on (`user_id`, `category`) and (`user_id`, `is_favorite`).

Standard rules apply: own `user_id` for direct RLS, four owner policies using `(select auth.uid()) = user_id`, `CHECK` on the enum columns, `moddatetime` trigger on `updated_at`, explicit `GRANT` to `anon`/`authenticated`. **Hard delete** (leaf table; no `deleted_at`). `show_id`/`book_id` are optional enrichment — because `author`, `title`, and `source_type` live on the quote, it stays complete after a linked Show/Book is hard-deleted (the FK just nulls). The migration is `supabase/migrations/20260621120000_quotes_schema.sql`.

## Relationships

profile 1—_ food, activity, diary_entry · food 1—_ serving · food 1—_ diary_entry ·
activity 1—_ diary_entry · diary_entry 1—\* strength_set · profile 1—\* show ·
profile 1—\* book · profile 1—\* quote · show 1—\* quote and book 1—\* quote
(both optional, ON DELETE SET NULL).

## Soft deletes

Foods and activities are **never hard-deleted** if they have been referenced by a diary entry.
Instead, `deleted_at` is set to the deletion timestamp (soft delete). Library screens and Add
sheets always filter to `deleted_at IS NULL` so deleted items disappear from the UI. Old diary
entries retain their FK reference and can still resolve the source row's name and details.

Always soft-delete for simplicity and consistency — no need to check references first.
The `deleted_at` timestamp also enables a future "Restore" feature at zero extra cost.

## Snapshotting

`diary_entry.nutrients`, `energy_kcal`, and `label` are computed and stored at log time. History stays stable even if a source food or activity is later soft-deleted: the nutrient math is in the snapshot, and the `label` column preserves the display name independently of the source row.
The FK columns (`food_id`, `activity_id`) are kept for the "log this again" feature and for
foreign-key integrity, but the diary display never depends on them being non-null.

## Multi-user readiness

Because every table already carries `user_id` and RLS isolates rows by `auth.uid()`, additional family members work with no schema change: they sign in with their own Google account and get their own `profile` and data automatically. A future "shared household custom foods" feature would be an additive change (e.g. a nullable `household_id` + a shared-visibility policy), not a rebuild.
