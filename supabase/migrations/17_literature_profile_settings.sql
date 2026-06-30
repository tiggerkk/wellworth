-- WellWorth — Literature module preferences on the profile.
--
-- Additive preference columns for the Literature module (mirroring the other modules'
-- *_profile_settings.sql). Plain columns on the existing profile table — RLS, the API-role grants,
-- and the moddatetime trigger already cover profile, so nothing else is needed here.
--   * literature_tts_lang     — the default read-aloud language: 'zh-HK' (粵 / Cantonese, default) or
--     'zh-CN' (國 / Mandarin). The Poem-detail player seeds its 粵/國 toggle from this.
--   * literature_tts_autoloop — 自動循環: when on, the read-aloud restarts from the top on finish.
--   * literature_poem_visible_fields   — 可見詩書欄位: which Poem-detail sections show (譯文/註釋/賞析);
--     NULL = all visible. 原文 is always shown and never listed.
--   * literature_writer_visible_fields — 可見名家欄位: which Poet-detail sections show (作者簡介);
--     NULL = all visible. 作品 is always shown and never listed.

alter table public.profile
  add column literature_tts_lang     text not null default 'zh-HK'
    check (literature_tts_lang in ('zh-HK', 'zh-CN')),
  add column literature_tts_autoloop boolean not null default false,
  add column literature_poem_visible_fields   text[],
  add column literature_writer_visible_fields text[];
