-- WellWorth initial schema (Phase 1 — Wellness). See docs/03-data-model.md.
--
-- Conventions:
--   * Table names singular, snake_case.
--   * RLS is ON for every table from creation. User-owned tables isolate rows with
--     (select auth.uid()) = user_id; child tables (serving, strength_set) check ownership
--     via their parent. The nutrient reference table is read-only to authenticated clients.
--   * Enumerated TEXT columns use CHECK constraints (no Postgres enums).
--   * updated_at is auto-maintained by the moddatetime extension trigger.
--   * JSONB nutrient-map validation (keys must exist in nutrient) is enforced in the
--     data-access layer, not by a DB constraint.
--   * API-role GRANTs (anon/authenticated) are at the bottom of this file — required
--     alongside RLS, since raw-SQL-migration tables don't inherit Supabase's default grants.

create extension if not exists moddatetime schema extensions;

-- =====================================================================================
-- nutrient — reference / seed data. Not user-owned; read-only to clients.
-- =====================================================================================
create table public.nutrient (
  key             text primary key,
  display_name    text not null,
  unit            text not null,
  category        text not null check (
                    category in ('general', 'protein', 'vitamins', 'minerals', 'carbohydrates', 'lipids')
                  ),
  -- Self-reference for nesting (e.g. fiber -> carbs). DEFERRABLE so a single multi-row
  -- seed insert validates at statement end regardless of row order.
  parent_key      text references public.nutrient (key) deferrable initially deferred,
  sort_order      integer not null default 0,
  default_visible boolean not null default false,
  has_upper_limit boolean not null default false
);

alter table public.nutrient enable row level security;

create policy "nutrient readable by authenticated"
  on public.nutrient for select to authenticated
  using (true);

-- =====================================================================================
-- profile — one row per user. PK is the auth user id.
-- =====================================================================================
create table public.profile (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  birthday              date,
  sex                   text check (sex in ('female', 'male')),
  height_cm             numeric,
  weight_kg             numeric,
  protein_target_g      numeric, -- manual override; null = use DRI
  activity_factor       numeric not null default 1.4,
  units                 text not null default 'metric' check (units in ('metric', 'imperial')),
  highlighted_nutrients text[] not null default '{}', -- 8 keys for the Diary grid
  visible_nutrients     text[] not null default '{}', -- keys shown on Dashboard/Daily Report
  module_order          text[], -- Home-hub module order + seen-set (keys); null = canonical MODULES order
  visible_modules       text[], -- modules shown on the Home hub (keys); null = all visible; a module not
                                 -- in module_order (newly shipped) defaults visible even if absent here
  onboarded_at          timestamptz, -- null = member hasn't finished first-run onboarding (forces the wizard)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.profile enable row level security;

create policy "select own profile" on public.profile
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own profile" on public.profile
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own profile" on public.profile
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own profile" on public.profile
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.profile
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- food — custom items + cached USDA/Off items the user favorited or logged.
-- =====================================================================================
create table public.food (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  source         text not null check (source in ('usda', 'off', 'custom')),
  external_id    text, -- USDA fdcId or barcode
  name           text not null,
  type           text not null default 'food' check (type in ('food', 'supplement')),
  nutrient_basis text not null default 'per_100g' check (nutrient_basis in ('per_100g', 'per_serving')),
  nutrients      jsonb not null default '{}'::jsonb, -- { nutrient_key: amount } relative to basis
  is_favorite    boolean not null default false,
  deleted_at     timestamptz, -- soft delete; null = active
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on public.food (user_id);

alter table public.food enable row level security;

create policy "select own food" on public.food
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own food" on public.food
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own food" on public.food
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own food" on public.food
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.food
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- serving — a food's measures. Ownership derives from the parent food.
-- =====================================================================================
create table public.serving (
  id      uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.food (id) on delete cascade,
  name    text not null, -- e.g. '1 bowl', '1 cup', '1 capsule'
  grams   numeric not null
);

create index on public.serving (food_id);

alter table public.serving enable row level security;

create policy "select serving via owned food" on public.serving
  for select to authenticated
  using (exists (
    select 1 from public.food f
    where f.id = serving.food_id and f.user_id = (select auth.uid())
  ));
create policy "insert serving via owned food" on public.serving
  for insert to authenticated
  with check (exists (
    select 1 from public.food f
    where f.id = serving.food_id and f.user_id = (select auth.uid())
  ));
create policy "update serving via owned food" on public.serving
  for update to authenticated
  using (exists (
    select 1 from public.food f
    where f.id = serving.food_id and f.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.food f
    where f.id = serving.food_id and f.user_id = (select auth.uid())
  ));
create policy "delete serving via owned food" on public.serving
  for delete to authenticated
  using (exists (
    select 1 from public.food f
    where f.id = serving.food_id and f.user_id = (select auth.uid())
  ));

-- =====================================================================================
-- activity — the user's activity library.
-- =====================================================================================
create table public.activity (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  description    text,
  template       text not null check (template in ('duration', 'strength')),
  default_effort text not null check (default_effort in ('light', 'moderate', 'vigorous')),
  default_duration_min numeric not null default 30, -- prefills the Activity Log's Duration
  met_by_effort  jsonb not null default '{}'::jsonb, -- { "light": n, "moderate": n, "vigorous": n }
  icon           text, -- Tabler icon component name; null falls back to IconRun
  deleted_at     timestamptz, -- soft delete; null = active
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on public.activity (user_id);

alter table public.activity enable row level security;

create policy "select own activity" on public.activity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own activity" on public.activity
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own activity" on public.activity
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own activity" on public.activity
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.activity
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- diary_entry — the log. Holds a nutrient/energy/label snapshot so history stays stable
-- even if the source food/activity is later soft-deleted. FK columns are ON DELETE SET
-- NULL so the snapshot survives any future hard delete of a source row.
-- =====================================================================================
create table public.diary_entry (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  group_name   text not null check (
                 group_name in ('breakfast', 'lunch', 'dinner', 'snacks', 'supplements', 'activities')
               ),
  kind         text not null check (kind in ('food', 'activity')),
  food_id      uuid references public.food (id) on delete set null,
  activity_id  uuid references public.activity (id) on delete set null,
  serving_id   uuid references public.serving (id) on delete set null,
  amount       numeric,
  duration_min numeric,
  effort       text check (effort in ('light', 'moderate', 'vigorous')),
  energy_kcal  numeric not null default 0, -- negative for activities
  label        text not null, -- denormalized display name
  nutrients    jsonb not null default '{}'::jsonb, -- snapshot of this entry's contribution
  -- Manual ordering within a (day, group_name). New rows get Date.now() (a large epoch value) so
  -- they append after any reordered rows; a drag renumbers a group's rows to small 0..n indices.
  -- Queries order by (sort_order, created_at) so un-reordered groups keep insertion order.
  sort_order   numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on public.diary_entry (user_id, day);

alter table public.diary_entry enable row level security;

create policy "select own diary_entry" on public.diary_entry
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own diary_entry" on public.diary_entry
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own diary_entry" on public.diary_entry
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own diary_entry" on public.diary_entry
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.diary_entry
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- strength_set — sets within a strength activity entry. Ownership derives from the parent.
-- =====================================================================================
create table public.strength_set (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.diary_entry (id) on delete cascade,
  exercise    text not null, -- e.g. 'Chest Press'
  set_number  integer not null,
  reps        integer,
  weight      numeric,
  weight_unit text -- entered unit label; canonical weight derived for any maths
);

create index on public.strength_set (entry_id);

alter table public.strength_set enable row level security;

create policy "select strength_set via owned entry" on public.strength_set
  for select to authenticated
  using (exists (
    select 1 from public.diary_entry e
    where e.id = strength_set.entry_id and e.user_id = (select auth.uid())
  ));
create policy "insert strength_set via owned entry" on public.strength_set
  for insert to authenticated
  with check (exists (
    select 1 from public.diary_entry e
    where e.id = strength_set.entry_id and e.user_id = (select auth.uid())
  ));
create policy "update strength_set via owned entry" on public.strength_set
  for update to authenticated
  using (exists (
    select 1 from public.diary_entry e
    where e.id = strength_set.entry_id and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.diary_entry e
    where e.id = strength_set.entry_id and e.user_id = (select auth.uid())
  ));
create policy "delete strength_set via owned entry" on public.strength_set
  for delete to authenticated
  using (exists (
    select 1 from public.diary_entry e
    where e.id = strength_set.entry_id and e.user_id = (select auth.uid())
  ));

-- =====================================================================================
-- API role grants. RLS (above) restricts which ROWS each user sees; these GRANTs give the
-- Supabase API roles table-level access in the first place — both are required. Tables
-- created via raw-SQL migrations do NOT inherit the default grants dashboard-created tables
-- get, which otherwise causes "42501 permission denied". Where a table has no policy for a
-- command/role (e.g. nutrient has only SELECT-to-authenticated), RLS still denies it.
-- =====================================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Apply the same defaults to tables/sequences created by future migrations (this role).
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
