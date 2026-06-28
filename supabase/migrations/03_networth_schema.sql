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
                      'cash', 'time_deposit', 'stock', 'fund',
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
-- networth_monthly_type_total — per-(user, month, asset_type) HKD rollup for the Net Worth
-- dashboard's trend + latest-month breakdown. Pre-aggregates `asset_entry` so the dashboard
-- reads O(months × asset_types) small rows instead of every individual holding across all
-- history (which grew unbounded with the asset count). `security_invoker = true` (PG15+) runs
-- the view with the querying user's privileges, so the base tables' RLS still scopes rows to
-- the owner. A month whose snapshot has no entries is absent (INNER JOIN) — the dashboard only
-- charts months that have holdings.
-- =====================================================================================
create view public.networth_monthly_type_total
  with (security_invoker = true) as
  select
    s.user_id,
    s.month,
    e.asset_type,
    sum(e.value_base)::numeric as total_base
  from public.networth_snapshot s
  join public.asset_entry e on e.snapshot_id = s.id
  group by s.user_id, s.month, e.asset_type;

-- =====================================================================================
-- Insurance catalogue — per-user reference data (NOT per-month). Monthly `asset_entry`
-- rows of asset_type 'insurance' are generated/frozen from this catalogue at SAVE time, so
-- the net-worth math is unchanged. A policy has one or more schedule VERSIONS (an Original
-- baseline + later anniversary updates); each version is a set of per-age points carrying
-- only real (printed) values. Resolution for a given age uses the newest-effective version
-- whose first_year ≤ age (a pure helper in src/lib/networth.ts).
--   * insurance_policy carries user_id → direct RLS.
--   * insurance_schedule / insurance_schedule_point have no user_id; they enforce ownership
--     with an EXISTS check up the parent chain (like serving/strength_set).
-- =====================================================================================
create table public.insurance_policy (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  -- provider is an owner-configurable key (no CHECK; app-validated against
  -- profile.insurance_providers — like quote.source_type / trip_expense.category). Orphan keys
  -- still render via the raw-key fallback in src/lib/insurance-config.ts.
  provider               text not null,
  policy_number          text not null,
  policy_name            text not null default '',
  start_date             date,
  currency               text not null check (currency in ('HKD', 'CNY', 'USD')),
  notes                  text,
  surrendered_from_month date, -- 1st-of-month; policy is excluded from this month forward
  surrender_date         date,
  surrender_proceeds     numeric,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, policy_number) -- policy_number is the import / update key
);

create index on public.insurance_policy (user_id);

alter table public.insurance_policy enable row level security;

create policy "select own insurance_policy" on public.insurance_policy
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own insurance_policy" on public.insurance_policy
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own insurance_policy" on public.insurance_policy
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own insurance_policy" on public.insurance_policy
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.insurance_policy
  for each row execute procedure extensions.moddatetime (updated_at);

-- A schedule version belonging to a policy. kind 'original' is the baseline (variance is
-- measured against it); 'update' is an anniversary version. Identity is this row's id — the
-- effective_date is an editable attribute (drives recency ordering + the month from which the
-- version's values apply), never the version key.
create table public.insurance_schedule (
  id             uuid primary key default gen_random_uuid(),
  policy_id      uuid not null references public.insurance_policy (id) on delete cascade,
  kind           text not null check (kind in ('original', 'update')),
  first_year     integer not null, -- lowest age present in this version
  effective_date date,
  imported_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on public.insurance_schedule (policy_id);

alter table public.insurance_schedule enable row level security;

create policy "select own insurance_schedule" on public.insurance_schedule
  for select to authenticated using (
    exists (
      select 1 from public.insurance_policy p
      where p.id = insurance_schedule.policy_id and p.user_id = (select auth.uid())
    )
  );
create policy "insert own insurance_schedule" on public.insurance_schedule
  for insert to authenticated with check (
    exists (
      select 1 from public.insurance_policy p
      where p.id = insurance_schedule.policy_id and p.user_id = (select auth.uid())
    )
  );
create policy "update own insurance_schedule" on public.insurance_schedule
  for update to authenticated using (
    exists (
      select 1 from public.insurance_policy p
      where p.id = insurance_schedule.policy_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.insurance_policy p
      where p.id = insurance_schedule.policy_id and p.user_id = (select auth.uid())
    )
  );
create policy "delete own insurance_schedule" on public.insurance_schedule
  for delete to authenticated using (
    exists (
      select 1 from public.insurance_policy p
      where p.id = insurance_schedule.policy_id and p.user_id = (select auth.uid())
    )
  );

create trigger handle_updated_at before update on public.insurance_schedule
  for each row execute procedure extensions.moddatetime (updated_at);

-- One per-age point in a schedule version. Real printed values only — display carry-forward
-- ("as of yr N") is computed, never stored.
create table public.insurance_schedule_point (
  id                 uuid primary key default gen_random_uuid(),
  schedule_id        uuid not null references public.insurance_schedule (id) on delete cascade,
  age                integer not null,
  policy_year        integer not null,
  total_premium_paid numeric not null,
  cash_value         numeric not null,
  unique (schedule_id, age)
);

create index on public.insurance_schedule_point (schedule_id);

alter table public.insurance_schedule_point enable row level security;

create policy "select own insurance_schedule_point" on public.insurance_schedule_point
  for select to authenticated using (
    exists (
      select 1
      from public.insurance_schedule s
      join public.insurance_policy p on p.id = s.policy_id
      where s.id = insurance_schedule_point.schedule_id and p.user_id = (select auth.uid())
    )
  );
create policy "insert own insurance_schedule_point" on public.insurance_schedule_point
  for insert to authenticated with check (
    exists (
      select 1
      from public.insurance_schedule s
      join public.insurance_policy p on p.id = s.policy_id
      where s.id = insurance_schedule_point.schedule_id and p.user_id = (select auth.uid())
    )
  );
create policy "update own insurance_schedule_point" on public.insurance_schedule_point
  for update to authenticated using (
    exists (
      select 1
      from public.insurance_schedule s
      join public.insurance_policy p on p.id = s.policy_id
      where s.id = insurance_schedule_point.schedule_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.insurance_schedule s
      join public.insurance_policy p on p.id = s.policy_id
      where s.id = insurance_schedule_point.schedule_id and p.user_id = (select auth.uid())
    )
  );
create policy "delete own insurance_schedule_point" on public.insurance_schedule_point
  for delete to authenticated using (
    exists (
      select 1
      from public.insurance_schedule s
      join public.insurance_policy p on p.id = s.policy_id
      where s.id = insurance_schedule_point.schedule_id and p.user_id = (select auth.uid())
    )
  );

-- =====================================================================================
-- API role grants. init's `alter default privileges` should already cover tables created
-- by later migrations, but CLAUDE.md requires every migration to grant explicitly (init F1)
-- — belt-and-braces against "42501 permission denied".
-- =====================================================================================
grant select, insert, update, delete on public.networth_snapshot to anon, authenticated;
grant select, insert, update, delete on public.asset_entry to anon, authenticated;
grant select on public.networth_monthly_type_total to anon, authenticated;
grant select, insert, update, delete on public.insurance_policy to anon, authenticated;
grant select, insert, update, delete on public.insurance_schedule to anon, authenticated;
grant select, insert, update, delete on public.insurance_schedule_point to anon, authenticated;
