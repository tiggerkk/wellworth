-- WellWorth — Net Worth module preferences on the profile.
--
-- Additive preference columns for the Net Worth module (mirroring how Shows/Wellness store
-- their prefs on profile). Plain columns on the existing profile table — RLS, the API-role
-- grants, and the moddatetime trigger already cover profile, so nothing else is needed here.
--   * networth_visible_asset_types — which asset-type sections show on Monthly Entry / Dashboard.
--     NULL = all visible (default); an explicit array once the owner customizes in Net Worth
--     Settings → Visible Asset Types.
--   * networth_asset_type_order — Monthly Entry / Dashboard asset-type ordering (asset-type keys).
--     NULL = canonical ASSET_TYPES order. Also the seen-set: a newly-added asset type absent here
--     defaults visible (mirrors module_order/visible_modules).
--   * networth_bulk_insurance_import_enabled — surfaces the ONE-TIME bulk insurance seed importer
--     in Net Worth Settings. ON by default; toggleable. Gates ONLY the bulk seed — the manual,
--     fund-monthly, and single-policy importers are always enabled.
--   * networth_liquid_asset_types — which asset types count as LIQUID for the "Liquid Only" view
--     toggle on the Dashboard + Monthly Entry (which excludes the non-liquid types from the net-worth
--     total). NULL = the code defaults (DEFAULT_LIQUID_ASSET_TYPES in src/lib/networth.ts: cash,
--     time_deposit, stock, fund); an explicit array once the owner customizes in Net Worth Settings →
--     Liquid Assets. The toggle's on/off state itself is ephemeral (localStorage), not stored here.
--   * insurance_providers — the owner's configurable insurance-provider list (add/rename/delete/
--     reorder in Net Worth Settings → Manage Providers), the Quotes pattern. A JSONB array of
--     {key,label,defaultCurrency} objects in display order; defaultCurrency (HKD/CNY/USD) seeds the
--     bulk-import per-provider currency. NULL = the canonical seed defaults in code (INSURANCE_PROVIDERS
--     etc. in src/lib/networth.ts), resolved tolerantly by src/lib/insurance-config.ts — so a
--     newly-shipped default appears for owners who never customized. A non-null array is authoritative
--     (a deleted default does not resurrect). insurance_policy.provider stores the stable `key`.

alter table public.profile
  add column networth_visible_asset_types          text[],
  add column networth_asset_type_order             text[],
  add column networth_liquid_asset_types           text[],
  add column networth_bulk_insurance_import_enabled boolean not null default true,
  add column insurance_providers                   jsonb;
