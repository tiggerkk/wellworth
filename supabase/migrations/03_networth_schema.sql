-- WellWorth Net Worth schema.
--
-- Conventions (identical to 01_wellness_schema.sql):
--   * Table names singular, snake_case.
--   * RLS is ON for every table from creation. Both tables carry their own user_id, so
--     they isolate rows directly with (select auth.uid()) = user_id (like diary_entry) —
--     no parent EXISTS check needed.
--   * Enumerated TEXT columns use CHECK constraints (no Postgres enums).
--   * updated_at is auto-maintained by the moddatetime extension trigger.
--   * value_native/fx_rate_to_base/value_base are stored (computed at the data layer) so a
--     month's HKD figures are frozen against later FX revisions.
--   * API-role GRANTs (anon/authenticated) are at the bottom — required alongside RLS, since
--     raw-SQL-migration tables don't inherit Supabase's default grants (see init F1).

-- =====================================================================================
-- networth_snapshot — one row per (user, month). month is normalized to the 1st of the
-- month; one snapshot per month per user.
-- =====================================================================================
create table public.networth_snapshot (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  month      date not null check (month = date_trunc('month', month)::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create index on public.networth_snapshot (user_id);

alter table public.networth_snapshot enable row level security;

create policy "select own networth_snapshot" on public.networth_snapshot
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own networth_snapshot" on public.networth_snapshot
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own networth_snapshot" on public.networth_snapshot
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own networth_snapshot" on public.networth_snapshot
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.networth_snapshot
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- asset_entry — the holdings within a snapshot. A month is a complete, self-contained set
-- of rows (delete = absent from that month forward; prior months intact). Carries user_id
-- for direct RLS; snapshot_id cascades on snapshot delete.
-- =====================================================================================
create table public.asset_entry (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  snapshot_id     uuid not null references public.networth_snapshot (id) on delete cascade,
  asset_type      text not null check (
                    asset_type in (
                      'cash', 'time_deposit', 'stock', 'mutual_fund',
                      'retirement', 'insurance', 'property'
                    )
                  ),
  name            text not null,
  currency        text not null check (currency in ('HKD', 'CNY', 'USD')),
  details         jsonb not null default '{}'::jsonb, -- type-specific fields (maturity_date, ticker, shares, units, cost, premium, policy_year, …)
  value_native    numeric not null default 0, -- value in the entry's own currency
  fx_rate_to_base numeric not null default 1, -- native -> HKD rate used (1 for HKD)
  value_base      numeric not null default 0, -- value_native * fx_rate_to_base (stored)
  sort_order      integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.asset_entry (user_id, snapshot_id);

alter table public.asset_entry enable row level security;

create policy "select own asset_entry" on public.asset_entry
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own asset_entry" on public.asset_entry
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own asset_entry" on public.asset_entry
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own asset_entry" on public.asset_entry
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.asset_entry
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- API role grants. init's `alter default privileges` should already cover tables created
-- by later migrations, but CLAUDE.md requires every migration to grant explicitly (init F1)
-- — belt-and-braces against "42501 permission denied".
-- =====================================================================================
grant select, insert, update, delete on public.networth_snapshot to anon, authenticated;
grant select, insert, update, delete on public.asset_entry to anon, authenticated;
