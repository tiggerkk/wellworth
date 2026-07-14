-- WellWorth Books (books read / to read) schema.
--
-- Conventions:
--   * Table name singular, snake_case. One row per tracked book.
--   * RLS is ON from creation; `book` carries its own user_id, so it isolates rows
--     directly with (select auth.uid()) = user_id (like show / asset_entry / diary_entry).
--   * Enumerated TEXT columns use CHECK constraints (no Postgres enums).
--   * updated_at is auto-maintained by the moddatetime extension trigger.
--   * Metadata (cover_url, authors, year, description, genres, page_count, language) is pulled
--     from Google Books (Open Library fallback) on demand in the UI and persisted only on
--     CREATE/SAVE; google_books_id / open_library_id / isbn are stored so a future "refresh
--     metadata" can re-pull. Unlike Shows' poster_path, cover_url stores a full image URL.
--   * Hard delete (leaf table — nothing references `book` here; no deleted_at). The future
--     Quotes module's `quote.book_id` is an optional ON DELETE SET NULL link declared on `quote`,
--     so it imposes no FK on this table.
--   * API-role GRANTs (anon/authenticated) are at the bottom — required alongside RLS, since
--     raw-SQL-migration tables don't inherit Supabase's default grants (see init F1).

-- =====================================================================================
-- book — one row per tracked book. Status only (no page/progress tracking, audiobooks,
-- format, or series — deliberately omitted). The CSV importer supplies real
-- `start_date`/`end_date` (and freezes `created_at = start_date`); `updated_at` is the
-- automatic row-modified timestamp (moddatetime).
-- =====================================================================================
create table public.book (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  status           text not null check (status in ('want', 'reading', 'read', 'dropped')),
  google_books_id  text,                     -- enables a future "refresh metadata"
  open_library_id  text,                     -- Open Library work/edition key (fallback source)
  isbn             text,                     -- stable cross-reference
  title            text not null,
  authors          text[],
  year             integer,                  -- first-published year
  cover_url        text,                     -- full image URL (Google Books / Open Library)
  description      text,
  genres           text[],
  page_count       integer,                  -- informational only (no progress tracking)
  language         text,
  rating           numeric check (
                     rating >= 0 and rating <= 5 and (rating * 2) = floor(rating * 2)
                   ),                         -- user stars, 0–5 in 0.5 steps
  lgbtq_rep        text not null default 'none'
                     check (lgbtq_rep in ('none', 'some', 'significant')),
  dynasty          text                      -- Chinese-titled books only; NULL otherwise
                     check (dynasty in (
                       '全部', '近代', '清代', '明代', '元代', '宋代', '五代',
                       '唐代', '隋代', '南北朝', '魏晉', '兩漢', '先秦'
                     )),
  is_favorite      boolean not null default false,
  start_date       date,
  end_date         date,                     -- finish / drop date
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.book (user_id, status);
create index on public.book (user_id, is_favorite);  -- favourites-first / favourites filter
create index on public.book (user_id, updated_at desc);  -- covers listBooks' default sort order

alter table public.book enable row level security;

create policy "select own book" on public.book
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own book" on public.book
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own book" on public.book
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own book" on public.book
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.book
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- API role grants. init's `alter default privileges` should already cover tables created
-- by later migrations, but CLAUDE.md requires every migration to grant explicitly (init F1)
-- — belt-and-braces against "42501 permission denied".
-- =====================================================================================
grant select, insert, update, delete on public.book to anon, authenticated;