-- WellWorth Medical module schema (docs/medical.md → 03-data-model.md).
--
-- Conventions (identical to 04_shows_schema.sql):
--   * Table names singular, snake_case. RLS ON from creation.
--   * User-owned tables (medical_report, medical_result) carry their own user_id and isolate
--     rows with (select auth.uid()) = user_id; four policies each (select/insert/update/delete).
--   * Enumerated TEXT columns use CHECK constraints (no Postgres enums).
--   * updated_at is auto-maintained by the moddatetime extension trigger.
--   * API-role GRANTs (anon/authenticated) at the bottom — required alongside RLS, since
--     raw-SQL-migration tables don't inherit Supabase's default grants (see init F1).
--
-- Design notes:
--   * medical_lab_test is REFERENCE data (seeded by 11_medical_seed_lab_test.sql),
--     read-only to clients: a single permissive SELECT policy, GRANT select only. Writes happen
--     exclusively via migrations (like the nutrient table).
--   * The app never stores original documents — medical_report.document_urls holds Google Drive
--     link(s). No Supabase Storage.
--   * Reference ranges are stored exactly as printed (ref_text verbatim); ref_low/ref_high are the
--     numeric split when the range is clean. The app never computes or interprets a range.
--   * Cross-provider UNIT NORMALIZATION (docs/02-tech-spec.md): the importer converts a value to the
--     test's canonical unit (medical_lab_test.default_unit) and stores the normalized value in
--     value_num/unit, sets normalized=true, and preserves the printed original in
--     value_num_original/unit_original. ref_low/ref_high are converted by the same factor; ref_text
--     stays verbatim. This is an explicit, flagged, reversible transform — the app still never
--     invents/derives clinical values.

-- The 18 result categories, in section display order, reused by both tables' CHECK constraints:
--   general, vitals, lipids, glucose, liver, renal, electrolytes, cbc, thyroid, bone,
--   tumour_markers, hepatitis, inflammation, urine, stool, imaging, eye, other

-- =====================================================================================
-- medical_lab_test — reference/seed: one row per canonical test. Read-only to clients.
-- `key` is the stable identifier results match against; `default_unit` is the canonical unit
-- the importer normalizes to; `default_tracked` seeds the Dashboard trend set; `value_kind`
-- documents whether a test is numeric, qualitative, or either.
-- =====================================================================================
create table public.medical_lab_test (
  key             text primary key,
  display_name    text not null,
  default_unit    text,
  category        text not null check (category in (
                    'general', 'vitals', 'lipids', 'glucose', 'liver', 'renal', 'electrolytes',
                    'cbc', 'thyroid', 'bone', 'tumour_markers', 'hepatitis', 'inflammation',
                    'urine', 'stool', 'imaging', 'eye', 'other'
                  )),
  sort_order      integer not null,             -- within category; seeded from the provider order
  default_tracked boolean not null default false,
  value_kind      text not null default 'numeric'
                    check (value_kind in ('numeric', 'qualitative', 'either'))
);

create index on public.medical_lab_test (category, sort_order);

alter table public.medical_lab_test enable row level security;

-- Reference data: every signed-in (and anon) client may read it; nobody writes via the API.
create policy "read medical_lab_test" on public.medical_lab_test
  for select to anon, authenticated using (true);

-- =====================================================================================
-- medical_report — one row per visit / document set. Holds Drive link(s) + narrative.
-- =====================================================================================
create table public.medical_report (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  report_date   date not null,
  report_type   text not null check (report_type in (
                  'health_screening', 'mri', 'ultrasound', 'mammogram', 'eye', 'other'
                )),
  body_part     text,                           -- for mri/ultrasound/mammogram/other
  provider      text,
  narrative     text,                           -- MRI/imaging/eye findings, doctor's comments
  document_urls text[] not null default '{}',   -- Google Drive link(s); never a stored file
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.medical_report (user_id, report_date);

alter table public.medical_report enable row level security;

create policy "select own medical_report" on public.medical_report
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own medical_report" on public.medical_report
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own medical_report" on public.medical_report
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own medical_report" on public.medical_report
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.medical_report
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- medical_result — one row per test per report (numeric OR qualitative). Deleting a report
-- cascades its results (hard delete). test_key links to the reference (NULL for ad-hoc tests
-- the reference doesn't list). See the unit-normalization note above for value_num_original /
-- unit_original / normalized.
-- =====================================================================================
create table public.medical_result (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  report_id          uuid not null references public.medical_report (id) on delete cascade,
  test_key           text references public.medical_lab_test (key),  -- NULL for ad-hoc tests
  test_name          text not null,             -- display name as printed/captured (may be bilingual)
  category           text not null check (category in (
                       'general', 'vitals', 'lipids', 'glucose', 'liver', 'renal', 'electrolytes',
                       'cbc', 'thyroid', 'bone', 'tumour_markers', 'hepatitis', 'inflammation',
                       'urine', 'stool', 'imaging', 'eye', 'other'
                     )),
  value_num          numeric,                   -- normalized to the test's canonical unit
  value_text         text,                      -- qualitative result or unreadable raw text
  unit               text,                      -- canonical unit after normalization
  ref_low            numeric,                   -- range low (converted by the same factor as value)
  ref_high           numeric,
  ref_text           text,                      -- reference range exactly as printed (verbatim)
  flag               text check (flag in ('high', 'low', 'abnormal')),
  uncertain          boolean not null default false,
  normalized         boolean not null default false,  -- true if value/unit was unit-converted on import
  value_num_original numeric,                   -- printed value before normalization (when normalized)
  unit_original      text,                      -- printed unit before normalization (when normalized)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index on public.medical_result (user_id, test_key);
create index on public.medical_result (report_id);

alter table public.medical_result enable row level security;

create policy "select own medical_result" on public.medical_result
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own medical_result" on public.medical_result
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own medical_result" on public.medical_result
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own medical_result" on public.medical_result
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger handle_updated_at before update on public.medical_result
  for each row execute procedure extensions.moddatetime (updated_at);

-- =====================================================================================
-- medical_latest_result — the most recent result **per test** (per user), with its report's
-- date + type. Powers the Dashboard's "latest values by category" card without fetching every
-- historical result: the payload is O(distinct tests), not O(reports × tests). DISTINCT ON keys
-- by `coalesce(test_key, 'name:'||lower(btrim(test_name)))` — exactly mirroring the client's
-- `latestResultPerTest` so ad-hoc (NULL test_key) tests dedupe by name; latest = greatest
-- report_date (created_at breaks ties). `security_invoker = true` (PG15+) runs the view as the
-- querying user, so the base tables' RLS still scopes rows to the owner.
-- (Sparkline series still read per-test history from `medical_result`, filtered to tracked keys.)
-- =====================================================================================
create view public.medical_latest_result
  with (security_invoker = true) as
  select distinct on (r.user_id, coalesce(r.test_key, 'name:' || lower(btrim(r.test_name))))
    r.*, mr.report_date, mr.report_type
  from public.medical_result r
  join public.medical_report mr on mr.id = r.report_id
  order by
    r.user_id,
    coalesce(r.test_key, 'name:' || lower(btrim(r.test_name))),
    mr.report_date desc,
    r.created_at desc;

-- =====================================================================================
-- API role grants (init F1 — belt-and-braces against "42501 permission denied").
-- medical_lab_test is read-only to clients; the user-owned tables get full CRUD (RLS gates rows).
-- =====================================================================================
grant select on public.medical_lab_test to anon, authenticated;
grant select, insert, update, delete on public.medical_report to anon, authenticated;
grant select, insert, update, delete on public.medical_result to anon, authenticated;
grant select on public.medical_latest_result to anon, authenticated;
