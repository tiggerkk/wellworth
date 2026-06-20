-- WellWorth — Quotes module preferences on the profile.
--
-- Two additive preference columns for the Quotes module (mirroring the Shows module's
-- 20260617130000_profile_show_settings.sql and the Books module's
-- 20260620130000_profile_book_settings.sql). They are plain columns on the existing profile
-- table — RLS, the API-role grants, and the moddatetime trigger already cover profile, so
-- nothing else is needed here.
--   * quote_visible_fields   — which Entry/Edit fields are shown. NULL = all fields visible
--     (default-on); an explicit array once the owner customizes in Quotes Settings. (This differs
--     from visible_nutrients, which defaults to '{}' = none, because hiding-by-default is wrong
--     for an entry form — a new quote should show every field until the owner trims it.)
--   * quote_importer_enabled — surfaces the in-app CSV importer in Quotes Settings.

alter table public.profile
  add column quote_visible_fields   text[],
  add column quote_importer_enabled boolean not null default false;
