-- WellWorth Shows (TV & movies) schema.
--
-- Conventions (identical to 20260615120000_networth_schema.sql):
--   * Table name singular, snake_case. One row per tracked title.
--   * RLS is ON from creation; `show` carries its own user_id, so it isolates rows
--     directly with (select auth.uid()) = user_id (like diary_entry / asset_entry).
--   * Enumerated TEXT columns use CHECK constraints (no Postgres enums).
--   * updated_at is auto-maintained by the moddatetime extension trigger.
--   * Metadata (poster_path, genres, director/creator, cast, totals) is pulled from TMDB
--     on demand in the UI and persisted only on CREATE/SAVE; tmdb_id is stored so a future
--     "refresh metadata" can re-pull. Images store only poster_path (URL built from the
--     fixed TMDB CDN base in the client).
--   * API-role GRANTs (anon/authenticated) are at the bottom — required alongside RLS, since
--     raw-SQL-migration tables don't inherit Supabase's default grants (see init F1).

-- =====================================================================================
-- show — one row per tracked title (TV show or movie). `type` chooses the TMDB endpoint
-- and the season/episode UI; `watched_*`/`total_*` are TV-only. Dates are NULL for
-- imported back-catalogue rows (genuinely unknown — fabricating "today" would pollute
-- "Recently Watched" and date sorts).
-- =====================================================================================
create table public.show (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  type             text not null check (type in ('tv', 'movie')),
  status           text not null check (status in ('want', 'watching', 'watched', 'dropped')),
  tmdb_id          integer,                  -- TMDB id (enables a future "refresh metadata")
  imdb_id          text,                     -- stable cross-reference
  title            text not null,
  original_title   text,
  year             integer,
  poster_path      text,                     -- TMDB path; URL built from the fixed CDN base
  overview         text,
  genres           text[],
  director         text,                     -- movie director, or TV creator(s) joined
  "cast"           text[],                   -- top ~10 cast names ("cast" is a reserved word)
  runtime_min      integer,
  content_rating   text,
  original_language text,
  total_seasons    integer,                  -- TV only
  total_episodes   integer,                  -- TV only
  watched_seasons  integer,                  -- TV only; set to totals on Watched
  watched_episodes integer,                  -- TV only; set to totals on Watched
  rating           numeric check (
                     rating >= 0 and rating <= 5 and (rating * 2) = floor(rating * 2)
                   ),                         -- user stars, 0–5 in 0.5 steps
  lgbtq_rep        text not null default 'none'
                     check (lgbtq_rep in ('none', 'some', 'significant')),
  start_date       date,
  end_date         date,                     -- finish / drop date
  last_update_date date,
  comments         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.show (user_id, status);

alter table public.show enable row level security;

create policy "select own show" on public.show
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own show" on public.show
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own show" on public.show
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own show" on public.show
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.show
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- API role grants. init's `alter default privileges` should already cover tables created
-- by later migrations, but CLAUDE.md requires every migration to grant explicitly (init F1)
-- — belt-and-braces against "42501 permission denied".
-- =====================================================================================
grant select, insert, update, delete on public.show to anon, authenticated;
