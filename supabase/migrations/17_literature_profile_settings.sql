-- WellWorth — Literature module preferences on the profile.
--
-- Additive read-aloud preference columns for the Literature module (mirroring the other modules'
-- *_profile_settings.sql). Plain columns on the existing profile table — RLS, the API-role grants,
-- and the moddatetime trigger already cover profile, so nothing else is needed here.
--   * literature_tts_lang     — the default read-aloud language: 'zh-HK' (粵 / Cantonese, default) or
--     'zh-CN' (國 / Mandarin). The Poem-detail player seeds its 粵/國 toggle from this.
--   * literature_tts_autoloop — 自動循環: when on, the read-aloud restarts from the top on finish.

alter table public.profile
  add column literature_tts_lang     text not null default 'zh-HK'
    check (literature_tts_lang in ('zh-HK', 'zh-CN')),
  add column literature_tts_autoloop boolean not null default false;
