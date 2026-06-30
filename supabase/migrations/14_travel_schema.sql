-- WellWorth Travel module schema (docs/travel.md → 03-data-model.md).
--
-- Conventions (identical to 10_medical_schema.sql):
--   * Table names singular, snake_case. RLS ON from creation.
--   * User-owned tables carry their own user_id and isolate rows with
--     (select auth.uid()) = user_id; four policies each (select/insert/update/delete).
--   * Enumerated TEXT columns use CHECK constraints (no Postgres enums).
--   * updated_at is auto-maintained by the moddatetime extension trigger.
--   * API-role GRANTs (anon/authenticated) at the bottom — required alongside RLS, since
--     raw-SQL-migration tables don't inherit Supabase's default grants (see init F1).
--
-- Design notes:
--   * HARD DELETE: deleting a trip cascades its trip_day / stop / trip_expense rows. Stops
--     cascade from their trip_day.
--   * Expense categories are NOT a table — they are an owner-configurable {key,label} JSONB list on
--     profile.travel_expense_categories (see 15_travel_profile_settings.sql), the same
--     pattern as Quotes. trip_expense.category stores the stable TEXT key (no FK); reassign-before-
--     delete and can't-delete-last are enforced in the app, and an orphaned key still renders via the
--     raw-key fallback in src/lib/travel-config.ts.
--   * The trip cover is a pasted image URL (rendered referrerpolicy="no-referrer"); never a stored
--     file. No Supabase Storage.
--   * A stop's cost is informational only and never summed (the Expenses layer is the spend total);
--     cost_currency defaults to the stop country's currency at the UI boundary but is overridable.
--   * trip.fx_rates caches { currency: rate_to_HKD } at the trip's first day (+ manual overrides) so
--     the HKD trip total is reproducible (see src/lib/trip-fx.ts).

-- =====================================================================================
-- trip — one row per trip. start_date/end_date are cached from its days for cheap listing.
-- =====================================================================================
create table public.trip (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null,
  status              text not null check (status in ('want', 'planning', 'visited')),
  base_currency       text not null default 'CNY',
  cover_url           text,                          -- pasted image URL; rendered no-referrer
  companions          text,
  rating              numeric check (
                        rating >= 0 and rating <= 5 and (rating * 2) = floor(rating * 2)
                      ),                             -- user stars, 0–5 in 0.5 steps
  notes               text,
  track_reimbursement boolean not null default false,
  fx_rates            jsonb not null default '{}',  -- { currency: rate_to_HKD } at the trip's first day
  start_date          date,                          -- cached from days (nullable while planning)
  end_date            date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on public.trip (user_id, status);
create index on public.trip (user_id, start_date);

alter table public.trip enable row level security;

create policy "select own trip" on public.trip
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own trip" on public.trip
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own trip" on public.trip
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own trip" on public.trip
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.trip
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- trip_day — an ordered day within a trip. day_date is nullable while planning.
-- =====================================================================================
create table public.trip_day (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  trip_id    uuid not null references public.trip (id) on delete cascade,
  day_date   date,
  sort_order integer not null,
  label      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.trip_day (trip_id, sort_order);

alter table public.trip_day enable row level security;

create policy "select own trip_day" on public.trip_day
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own trip_day" on public.trip_day
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own trip_day" on public.trip_day
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own trip_day" on public.trip_day
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.trip_day
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- stop — an ordered entry within a day. type labels the entry (travel/visit/eat/…). Any leg or
-- transit detail lives in the free-text description. city/country/province resolve via the
-- remembered_city cache and carry forward from the previous stop; province is snapped to a
-- CHINA_PROVINCES canonical name in the app so the shaded map and "N / 34" count line up.
-- =====================================================================================
create table public.stop (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  trip_day_id   uuid not null references public.trip_day (id) on delete cascade,
  type          text not null check (type in ('travel', 'visit', 'eat', 'shop', 'stay', 'other')),
  city          text,
  country       text,
  province      text,
  description   text,
  details       text,
  completion    text check (completion in ('done', 'skipped')),  -- null = unmarked
  sort_order    integer not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.stop (trip_day_id, sort_order);

alter table public.stop enable row level security;

create policy "select own stop" on public.stop
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own stop" on public.stop
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own stop" on public.stop
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own stop" on public.stop
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.stop
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- trip_expense — the trip's authoritative spend log (decoupled from the itinerary). category is the
-- stable key from profile.travel_expense_categories (no FK; see the design note above).
-- reimbursed_amount is the value computed from reimbursed_formula (number or amount-expression).
-- =====================================================================================
create table public.trip_expense (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  trip_id            uuid not null references public.trip (id) on delete cascade,
  expense_date       date,
  description        text not null,
  category           text not null,                -- stable key from profile.travel_expense_categories
  cost               numeric not null,
  currency           text not null,
  reimbursed_formula text,                          -- a number or an arithmetic expr in `amount`
  reimbursed_amount  numeric,
  sort_order         int not null default 0,        -- manual order within a (trip, expense_date) group
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Ordering index doubles as the (trip_id, expense_date) lookup (it's a left-prefix).
create index on public.trip_expense (trip_id, expense_date, sort_order);
create index on public.trip_expense (trip_id, category);

alter table public.trip_expense enable row level security;

create policy "select own trip_expense" on public.trip_expense
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own trip_expense" on public.trip_expense
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own trip_expense" on public.trip_expense
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own trip_expense" on public.trip_expense
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.trip_expense
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- remembered_city — the city → country/province/coords cache. Unique per owner on the normalized
-- city name so a city is resolved (manually or via geocode assist) once and reused thereafter.
-- =====================================================================================
create table public.remembered_city (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  city       text not null,
  country    text not null,
  province   text,
  lat        numeric,
  lng        numeric,
  -- city_norm (generated, lower+trimmed) backs the per-owner UNIQUE so a city is cached once.
  -- (An inline UNIQUE can't hold an expression; a generated column is the codebase pattern — cf.
  -- quote.text_norm in 08_quotes_schema.sql.)
  city_norm  text generated always as (lower(btrim(city))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, city_norm)
);

alter table public.remembered_city enable row level security;

create policy "select own remembered_city" on public.remembered_city
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own remembered_city" on public.remembered_city
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own remembered_city" on public.remembered_city
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own remembered_city" on public.remembered_city
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.remembered_city
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- API role grants (init F1 — belt-and-braces against "42501 permission denied").
-- RLS gates rows; the role still needs table-level CRUD.
-- =====================================================================================
grant select, insert, update, delete on public.trip to anon, authenticated;
grant select, insert, update, delete on public.trip_day to anon, authenticated;
grant select, insert, update, delete on public.stop to anon, authenticated;
grant select, insert, update, delete on public.trip_expense to anon, authenticated;
grant select, insert, update, delete on public.remembered_city to anon, authenticated;
