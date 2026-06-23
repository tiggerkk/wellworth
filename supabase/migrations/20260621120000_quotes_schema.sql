-- WellWorth Quotes (favourite quotes) schema.
--
-- Conventions (identical to 20260620120000_books_schema.sql):
--   * Table name singular, snake_case. One row per quote.
--   * RLS is ON from creation; `quote` carries its own user_id, so it isolates rows
--     directly with (select auth.uid()) = user_id (like book / show / asset_entry).
--   * Enumerated TEXT columns use CHECK constraints (no Postgres enums).
--   * updated_at is auto-maintained by the moddatetime extension trigger.
--   * Hard delete (leaf table — nothing references `quote`; no deleted_at).
--   * API-role GRANTs (anon/authenticated) are at the bottom — required alongside RLS, since
--     raw-SQL-migration tables don't inherit Supabase's default grants (see init F1).
--
-- Cross-module links: show_id / book_id are OPTIONAL enrichment with ON DELETE SET NULL.
-- Because author / title / source_type are denormalised onto the quote, a quote stays complete
-- (Library/Zen still render it) after a linked Show or Book is hard-deleted — the FK just nulls.

-- =====================================================================================
-- quote — one row per quote. Exactly one category (required); tags optional. source_type is
-- the medium; language is 'en' | 'zh' (auto-detected from the text in the UI, CJK -> zh).
-- text_norm (generated, lower+trimmed) backs the UNIQUE that enforces "no exact duplicates"
-- and the importer's idempotency (ON CONFLICT DO NOTHING).
--
-- source_type / category are plain TEXT with NO CHECK constraint (since M8): the allowed values
-- are owner-configurable in Quotes Settings (add/rename/delete/reorder), stored on
-- profile.quote_source_types / quote_categories. The app validates against that configured list;
-- each column stores the stable text key (e.g. 'tv', 'philosophy'). See src/lib/quotes-config.ts.
-- =====================================================================================
create table public.quote (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  text        text not null,
  author      text,
  source_type text not null,                         -- configurable key (no CHECK; app-validated)
  title       text,                                  -- source title (denormalised; survives a linked record's deletion)
  category    text not null,                         -- configurable key (no CHECK; app-validated)
  tags        text[] not null default '{}',          -- optional; autocomplete reads distinct unnest(tags)
  language    text not null default 'en' check (language in ('en', 'zh')),
  is_favorite boolean not null default false,
  show_id     uuid references public.show (id) on delete set null,
  book_id     uuid references public.book (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  text_norm   text generated always as (lower(btrim(text))) stored,
  unique (user_id, text_norm)                        -- "no exact duplicates" + import idempotency
);

create index on public.quote (user_id, category);
create index on public.quote (user_id, is_favorite);

alter table public.quote enable row level security;

create policy "select own quote" on public.quote
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own quote" on public.quote
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own quote" on public.quote
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own quote" on public.quote
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.quote
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- API role grants. init's `alter default privileges` should already cover tables created
-- by later migrations, but CLAUDE.md requires every migration to grant explicitly (init F1)
-- — belt-and-braces against "42501 permission denied".
-- =====================================================================================
grant select, insert, update, delete on public.quote to anon, authenticated;
