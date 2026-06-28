-- WellWorth — Shows module preferences on the profile.
--
-- Two additive preference columns for the Shows module (mirroring how Wellness stores its
-- nutrient-visibility prefs on profile). They are plain columns on the existing profile table —
-- RLS, the API-role grants, and the moddatetime trigger already cover profile, so nothing else
-- is needed here.
--   * show_visible_fields  — which Entry/Edit fields are shown. NULL = all fields visible
--     (default-on); an explicit array once the owner customizes in Shows Settings. (This differs
--     from visible_nutrients, which defaults to '{}' = none, because hiding-by-default is wrong
--     for an entry form — a new title should show every field until the owner trims it.)
--   * show_importer_enabled — surfaces the in-app CSV importer in Shows Settings. ON by default
--     (the owner imports their existing library on first run); toggleable off in Shows Settings.
--   * show_poster_url_visible — Visible-Fields toggle that FORCES the Entry "Poster URL" field always
--     visible. Default off; the field still auto-shows whenever TMDB supplied no poster. Stored
--     separately from show_visible_fields (which is default-on) so the toggle can default to off.

alter table public.profile
  add column show_visible_fields     text[],
  add column show_importer_enabled   boolean not null default true,
  add column show_poster_url_visible boolean not null default false;
