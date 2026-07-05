-- WellWorth — Books module preferences on the profile.
--
-- Two additive preference columns for the Books module. They are
-- plain columns on the existing profile table — RLS, the API-role grants, and the moddatetime
-- trigger already cover profile, so nothing else is needed here.
--   * book_visible_fields   — which Entry/Edit fields are shown. NULL = all fields visible
--     (default-on); an explicit array once the owner customizes in Books Settings. (This differs
--     from visible_nutrients, which defaults to '{}' = none, because hiding-by-default is wrong
--     for an entry form — a new book should show every field until the owner trims it.)
--   * book_importer_enabled — surfaces the in-app CSV importer in Books Settings. ON by default
--     (the owner imports their existing library on first run); toggleable off in Books Settings.

alter table public.profile
  add column book_visible_fields   text[],
  add column book_importer_enabled boolean not null default true;
