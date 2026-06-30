-- WellWorth Literature (classical Chinese poems) schema.
--
-- The Literature corpus (poems, writers, types) is NOT in Postgres: it is immutable, shared,
-- non-private reference data shipped as a versioned STATIC ASSET (public/literature/**), so it
-- reads fully offline at zero DB cost (see docs/11_literature.md + docs/02_tech_spec.md). The only
-- user-owned, sync-worthy state is the per-user favourite, which lives here.
--
-- Conventions (identical to 09_quotes_schema.sql):
--   * Table name singular, snake_case. One row per (user, favourited poem).
--   * RLS is ON from creation; `poem_favorite` carries its own user_id, so it isolates rows
--     directly with (select auth.uid()) = user_id (like quote / book / show).
--   * No update path / no moddatetime trigger — this is a pure join row (favourite on/off), so it's
--     insert + delete only (toggling a favourite off is a delete).
--   * API-role GRANTs (anon/authenticated) are required alongside RLS, since raw-SQL-migration tables
--     don't inherit Supabase's default grants (see init F1).
--
-- poem_id has NO foreign key: the poem it references lives in the static corpus, not the DB (the same
-- way a quote can store an external tmdb_id). It is the stable integer id from the source corpus.

-- =====================================================================================
-- poem_favorite — one row per (user, favourited poem). Composite PK makes a favourite idempotent
-- (re-inserting the same pair is a no-op via ON CONFLICT DO NOTHING in the data layer).
-- =====================================================================================
create table public.poem_favorite (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  poem_id    integer not null,                 -- static corpus id (no FK; corpus is a static asset)
  created_at timestamptz not null default now(),
  primary key (user_id, poem_id)
);

create index on public.poem_favorite (user_id);

alter table public.poem_favorite enable row level security;

create policy "select own poem_favorite" on public.poem_favorite
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own poem_favorite" on public.poem_favorite
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "delete own poem_favorite" on public.poem_favorite
  for delete to authenticated using ((select auth.uid()) = user_id);

-- =====================================================================================
-- API role grants. init's `alter default privileges` should already cover tables created by later
-- migrations, but CLAUDE.md requires every migration to grant explicitly (init F1) — belt-and-braces
-- against "42501 permission denied". No update (favourite rows are immutable; toggle = insert/delete).
-- =====================================================================================
grant select, insert, delete on public.poem_favorite to anon, authenticated;
