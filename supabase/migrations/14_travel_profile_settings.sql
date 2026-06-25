-- WellWorth — Travel module preferences on the profile.
--
-- Additive preference column for the Travel module (mirroring the Quotes module's
-- 09_quotes_profile_settings.sql). It is a plain column on the existing profile table —
-- RLS, the API-role grants, and the moddatetime trigger already cover profile, so nothing else is
-- needed here.
--   * travel_expense_categories — the owner's configurable expense-category list
--     (add/rename/delete/reorder in Travel Settings). A JSONB array of {key,label} objects in display
--     order. NULL = use the canonical seed defaults in code (src/constants/travel.ts), resolved
--     tolerantly by src/lib/travel-config.ts — so a newly-shipped default appears for owners who never
--     customized. A non-null array is authoritative (a deleted default does not resurrect).
--     trip_expense.category stores the stable `key` from this list.
--   * travel_visible_fields — which optional Trip-form fields are shown (mirrors the other modules'
--     *_visible_fields). A text[] of TRIP_ENTRY_FIELDS keys; NULL = all visible (default-on). The core
--     Trip Name / Base Currency / Status are always shown and aren't listed.

alter table public.profile
  add column travel_expense_categories jsonb,
  add column travel_visible_fields     text[];
