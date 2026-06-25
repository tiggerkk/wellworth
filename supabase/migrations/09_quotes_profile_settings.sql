-- WellWorth — Quotes module preferences on the profile.
--
-- Additive preference columns for the Quotes module (mirroring the Shows module's
-- 05_shows_profile_settings.sql and the Books module's
-- 07_books_profile_settings.sql). They are plain columns on the existing profile
-- table — RLS, the API-role grants, and the moddatetime trigger already cover profile, so
-- nothing else is needed here.
--   * quote_visible_fields   — which Entry/Edit fields are shown. NULL = all fields visible
--     (default-on); an explicit array once the owner customizes in Quotes Settings. (This differs
--     from visible_nutrients, which defaults to '{}' = none, because hiding-by-default is wrong
--     for an entry form — a new quote should show every field until the owner trims it.)
--   * quote_importer_enabled — surfaces the in-app CSV importer in Quotes Settings.
--   * quote_source_types / quote_categories — the owner's configurable Source Type / Category lists
--     (add/rename/delete/reorder in Quotes Settings). Each is a JSONB array of objects in display
--     order: source types {key,label,linkKind}, categories {key,label}. NULL = use the canonical
--     seed defaults in code (src/constants/quotes.ts), resolved partial-tolerantly by
--     src/lib/quotes-config.ts — so a newly-shipped default appears for owners who never customized.
--     quote.source_type / quote.category store the stable `key` from these lists.

alter table public.profile
  add column quote_visible_fields   text[],
  add column quote_importer_enabled boolean not null default false,
  add column quote_source_types     jsonb,
  add column quote_categories       jsonb;
