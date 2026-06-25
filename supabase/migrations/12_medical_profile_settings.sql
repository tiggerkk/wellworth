-- WellWorth — Medical module preferences on the profile (docs/medical.md → 03-data-model.md).
--
-- Additive preference columns for the Medical module (mirroring how Wellness/Shows store prefs on
-- profile). RLS, API-role grants, and the moddatetime trigger already cover profile, so nothing
-- else is needed here.
--   * medical_tracked_tests   — test keys whose trends show on the Dashboard. NULL until first-run,
--     when ensureOwnerProfile seeds it from medical_lab_test.default_tracked (like visible_nutrients).
--   * medical_section_order    — personal category-section order override; NULL/empty = seeded order.
--   * medical_test_order       — personal flat ordered list of test keys; NULL/empty = seeded order.
--   * medical_visible_fields   — which Add/Edit Report fields are shown. NULL = all visible
--     (default-on, like show_visible_fields).
--   * medical_importer_enabled — surfaces the structured JSON/CSV importer in Medical Settings.
--   * Biometric lock (client-side UX gate over RLS-protected data; see docs/02-tech-spec.md):
--       - medical_lock_enabled         — master toggle.
--       - medical_lock_pin_hash        — salted PBKDF2-SHA-256 hash of the fallback PIN. Never the PIN.
--       - medical_lock_webauthn_id     — registered platform-authenticator credential id (optional
--         faster unlock; always falls back to the PIN).
--       - medical_lock_timeout_minutes — auto-lock idle timeout. NULL = Indefinite (re-lock only on
--         cold start); the UI default is 5. (Choices: Immediately(0)/1/5/15/Indefinite(NULL).)

alter table public.profile
  add column medical_tracked_tests       text[],
  add column medical_section_order       text[],
  add column medical_test_order          text[],
  add column medical_visible_fields      text[],
  add column medical_importer_enabled    boolean not null default true,
  add column medical_lock_enabled        boolean not null default false,
  add column medical_lock_pin_hash       text,
  add column medical_lock_webauthn_id    text,
  add column medical_lock_timeout_minutes integer;
