# 03 — Data Model

Postgres on Supabase. Table names **singular, snake_case**. Every user-owned table has a `user_id` (→ `auth.users.id`) and an RLS policy `user_id = auth.uid()`. RLS is enabled in the first migration.
Nutrient sets are stored as JSONB maps (`nutrient_key → amount`), validated against the `nutrient` reference table — so adding a tracked nutrient never needs a schema change.

## Tables

### profile (one row per user)

- `user_id` UUID PK → `auth.users.id`
- `birthday` DATE, `sex` TEXT, `height_cm` NUMERIC, `weight_kg` NUMERIC
- `protein_target_g` NUMERIC NULL — manual override; null = use DRI
- `activity_factor` NUMERIC DEFAULT 1.4
- `units` TEXT DEFAULT 'metric' — 'metric' | 'imperial' (display only)
- `highlighted_nutrients` TEXT[] — 8 nutrient keys for the Diary grid
- `visible_nutrients` TEXT[] — nutrient keys shown on Dashboard/Daily Report (seeded from defaults)
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
- `met_by_effort` JSONB — { "light": n, "moderate": n, "vigorous": n }; at least one key required. Resolved MET for a session = met_by_effort[session_effort]. Single-intensity activities may have just one key; the default_effort must be a key present in this map.
- `icon` TEXT NULL — Tabler icon component name (e.g. 'IconMartialArts', 'IconBarbell').
  Resolved at render time via TablerIcons[icon]. Null falls back to IconRun.
- `deleted_at` TIMESTAMPTZ NULL — soft delete; NULL = active. Never hard-delete an activity referenced by a diary entry.
- `created_at`, `updated_at`

### diary_entry (the log)

- `id` UUID PK
- `user_id` UUID → auth.users
- `day` DATE — the logged day (no timestamp)
- `group_name` TEXT — 'breakfast'|'lunch'|'dinner'|'snacks'|'supplements'|'activities'
- `kind` TEXT — 'food' | 'activity'
- `food_id` UUID NULL → food
- `activity_id` UUID NULL → activity
- `serving_id` UUID NULL → serving
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

### nutrient (reference / seed — not user data, no RLS needed; read-only to clients)

- `key` TEXT PK — e.g. 'vitamin_d'
- `display_name` TEXT, `unit` TEXT
- `category` TEXT — 'general'|'protein'|'vitamins'|'minerals'|'carbohydrates'|'lipids'
- `parent_key` TEXT NULL — nesting (Fiber→carbs, Omega-3→polyunsaturated, etc.)
- `sort_order` INT
- `default_visible` BOOLEAN
- `has_upper_limit` BOOLEAN — drives red-bar behavior
  (See `05-seed-data.md` for the full seed list. DRI target/UL values are implemented as a lookup in
  `src/lib/dri.ts`, keyed by age/sex, rather than stored per row.)

## Relationships

profile 1—_ food, activity, diary_entry · food 1—_ serving · food 1—_ diary_entry ·
activity 1—_ diary_entry · diary_entry 1—\* strength_set.

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
