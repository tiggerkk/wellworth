-- Grant table privileges to the Supabase API roles (anon, authenticated).
--
-- RLS (enabled in 20260613120000_init_schema.sql) restricts which ROWS each user can
-- access; these GRANTs give the roles table-level access in the first place — both are
-- required. Tables created via raw SQL migrations do NOT automatically inherit the
-- default grants that dashboard-created tables get, which caused
-- "42501 permission denied for table profile" on first login.
--
-- Broad grants + RLS is the standard Supabase model: where a table has no policy for a
-- command/role (e.g. nutrient has only a SELECT-to-authenticated policy), RLS still
-- denies it regardless of the table grant.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Apply the same defaults to tables/sequences created by future migrations (this role).
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
